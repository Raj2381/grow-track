/**
 * Outcome labels for the Round 2 prediction models.
 *
 * A row is (student, as_of_semester N). Features may only use data dated on or before the end of semester N.
 * Targets look at semester N+1 (and the supplementary exams held at its end). Rows for N = CURRENT_SEM have no
 * labels: they are the upcoming semester the models must forecast.
 */
import { SEM_DATES, CURRENT_SEM } from "./calendar";
import type { GeneratedStudent } from "./generate";
import { WEIGHTS } from "../../student-portal/lib/scoring";
import { subjectByCode } from "../../student-portal/data/catalog";

export const TRAINING_CUTOFFS = [2, 3, 4] as const;
export const ALL_CUTOFFS = [2, 3, 4, 5] as const;

export type SgpaBand = "Low" | "Average" | "Good" | "Excellent";

export type OutcomeRow = {
  student_id: string;
  as_of_semester: number;
  label_available: boolean;
  next_sgpa: number | null;
  next_sgpa_band: SgpaBand | null;
  next_sgpa_below_6: boolean | null;
  has_active_backlog_at_asof: boolean;
  new_backlog_next_sem: boolean | null;
  failed_to_clear_existing_backlog: boolean | null;
  backlog_risk_any: boolean | null;
  placement_ready_before_season: boolean | null;
  engagement_drop_next_weeks: boolean | null;
};

export const PLACEMENT_BENCHMARK = { aptitude: 60, coding: 60, interview: 60 };
/** Engagement index must fall by at least this many points between the last two months of N and the first two of N+1. */
export const ENGAGEMENT_DROP_POINTS = 8;

const end = (sem: number) => SEM_DATES[sem][1];

export function sgpaOfFirstAttempt(g: GeneratedStudent, sem: number) {
  const rows = g.firstAttempt.filter((r) => r.semester === sem);
  const credits = rows.reduce((a, r) => a + subjectByCode(r.code).credits, 0);
  return credits ? rows.reduce((a, r) => a + r.gradePoint * subjectByCode(r.code).credits, 0) / credits : 0;
}

export function cgpaAsOf(g: GeneratedStudent, upTo: number) {
  const rows = g.firstAttempt.filter((r) => r.semester <= upTo);
  const credits = rows.reduce((a, r) => a + subjectByCode(r.code).credits, 0);
  return credits ? rows.reduce((a, r) => a + r.gradePoint * subjectByCode(r.code).credits, 0) / credits : 0;
}

export const sgpaBand = (sgpa: number): SgpaBand => (sgpa < 5.5 ? "Low" : sgpa < 7 ? "Average" : sgpa < 8.5 ? "Good" : "Excellent");

/** Failed subjects whose latest attempt dated on or before `asOfDate` is still a fail. */
export function activeBacklogCodesAt(g: GeneratedStudent, asOfDate: string) {
  const byCode = new Map<string, { semester: number; last: string }>();
  for (const row of g.backlogRows) {
    if (row.date > asOfDate) continue;
    const current = byCode.get(row.code);
    if (!current || row.date >= current.last) byCode.set(row.code, { semester: row.semester, last: row.date });
  }
  const active: string[] = [];
  for (const [code] of byCode) {
    const attempts = g.backlogRows.filter((r) => r.code === code && r.date <= asOfDate).sort((a, b) => a.date.localeCompare(b.date));
    if (attempts.length && attempts[attempts.length - 1].result === "Fail") active.push(code);
  }
  return active;
}

export type PlacementState = { aptitude: number; coding: number; interview: number; ready: boolean };

export function placementStateAt(g: GeneratedStudent, asOfDate: string): PlacementState {
  const aptitude = g.student.placement.aptitude.filter((a) => a.date <= asOfDate).sort((a, b) => a.date.localeCompare(b.date));
  const coding = g.student.skills.codingAttempts.filter((c) => c.date <= asOfDate && c.questionCount >= 5);
  const interviews = g.student.placement.interviews.filter((i) => i.date <= asOfDate);
  const aptitudeScore = aptitude.length ? aptitude[aptitude.length - 1].totalPercent : 0;
  const codingScore = coding.length ? Math.max(...coding.map((c) => c.score)) : 0;
  const interviewScore = interviews.length ? Math.max(...interviews.map((i) => i.score)) : 0;
  return {
    aptitude: aptitudeScore,
    coding: codingScore,
    interview: interviewScore,
    ready:
      aptitude.length > 0 &&
      coding.length > 0 &&
      interviews.length > 0 &&
      aptitudeScore >= PLACEMENT_BENCHMARK.aptitude &&
      codingScore >= PLACEMENT_BENCHMARK.coding &&
      interviewScore >= PLACEMENT_BENCHMARK.interview,
  };
}

/** 0-100 composite of attendance, LMS logins and assignment submission over a window of months. */
export function engagementIndex(g: GeneratedStudent, sem: number, months: string[]) {
  const att = g.attendanceMonthly.filter((a) => a.semester === sem && months.includes(a.month));
  const lms = g.lmsMonthly.filter((m) => m.semester === sem && months.includes(m.month));
  const held = att.reduce((a, x) => a + x.held, 0);
  const attended = att.reduce((a, x) => a + x.attended, 0);
  const attendancePct = held ? (attended / held) * 100 : 0;
  const logins = lms.length ? lms.reduce((a, m) => a + m.logins, 0) / lms.length : 0;
  const assigned = lms.reduce((a, m) => a + m.assigned, 0);
  const submitted = lms.reduce((a, m) => a + m.submitted, 0);
  const submitPct = assigned ? (submitted / assigned) * 100 : 100;
  return 0.5 * attendancePct + 0.3 * Math.min(100, (logins / 27) * 100) + 0.2 * submitPct;
}

function monthsOf(g: GeneratedStudent, sem: number) {
  return [...new Set(g.attendanceMonthly.filter((a) => a.semester === sem).map((a) => a.month))].sort();
}

export function computeOutcomes(g: GeneratedStudent, cutoffs: readonly number[] = ALL_CUTOFFS): OutcomeRow[] {
  return cutoffs.map((n) => {
    const hasActive = activeBacklogCodesAt(g, end(n)).length > 0;
    if (n >= CURRENT_SEM) {
      return {
        student_id: g.student.id,
        as_of_semester: n,
        label_available: false,
        next_sgpa: null,
        next_sgpa_band: null,
        next_sgpa_below_6: null,
        has_active_backlog_at_asof: hasActive,
        new_backlog_next_sem: null,
        failed_to_clear_existing_backlog: null,
        backlog_risk_any: null,
        placement_ready_before_season: null,
        engagement_drop_next_weeks: null,
      };
    }
    const next = n + 1;
    const sgpa = sgpaOfFirstAttempt(g, next);
    const newBacklog = g.firstAttempt.some((r) => r.semester === next && !r.passed);
    const activeAtN = activeBacklogCodesAt(g, end(n));
    const stillActive = activeBacklogCodesAt(g, end(next));
    const failedToClear = activeAtN.length ? activeAtN.some((code) => stillActive.includes(code)) : null;
    const prevMonths = monthsOf(g, n).slice(-2);
    const nextMonths = monthsOf(g, next).slice(0, 2);
    const drop = engagementIndex(g, n, prevMonths) - engagementIndex(g, next, nextMonths) >= ENGAGEMENT_DROP_POINTS;
    return {
      student_id: g.student.id,
      as_of_semester: n,
      label_available: true,
      next_sgpa: Math.round(sgpa * 100) / 100,
      next_sgpa_band: sgpaBand(sgpa),
      next_sgpa_below_6: sgpa < 6,
      has_active_backlog_at_asof: hasActive,
      new_backlog_next_sem: newBacklog,
      failed_to_clear_existing_backlog: failedToClear,
      backlog_risk_any: newBacklog || failedToClear === true,
      placement_ready_before_season: placementStateAt(g, end(next)).ready,
      engagement_drop_next_weeks: drop,
    };
  });
}

/**
 * Round 1 Success Score proxy as of semester N, built only from data known at N. It uses the same component
 * weights as student-portal/lib/scoring.ts (WEIGHTS). The portal's live score needs the full record, so this
 * time-travelled version exists only to benchmark labels in the sanity report and as a baseline for the models.
 */
export function successScoreAsOf(g: GeneratedStudent, n: number) {
  const asOf = end(n);
  const cgpa = cgpaAsOf(g, n);
  const active = activeBacklogCodesAt(g, asOf).length;
  const academic = Math.max(0, Math.min(100, (cgpa / 10) * 100 - 10 * active));
  const att = g.attendanceMonthly.filter((a) => a.semester === n);
  const attendance = (att.reduce((a, x) => a + x.attended, 0) / Math.max(1, att.reduce((a, x) => a + x.held, 0))) * 100;
  const lms = g.lmsMonthly.filter((m) => m.semester === n);
  const assigned = lms.reduce((a, m) => a + m.assigned, 0);
  const submitted = lms.reduce((a, m) => a + m.submitted, 0);
  const loginScore = Math.min(100, (lms.reduce((a, m) => a + m.logins, 0) / Math.max(1, lms.length) / 27) * 100);
  const quiz = lms.reduce((a, m) => a + m.avgQuiz, 0) / Math.max(1, lms.length);
  const lmsScore = 0.5 * (assigned ? (submitted / assigned) * 100 : 0) + 0.3 * loginScore + 0.2 * quiz;
  const latestSkills = (kind: "technical" | "soft") => {
    const rows = g.skillAssessments.filter((s) => s.kind === kind && s.semester <= n);
    const lastSem = rows.length ? Math.max(...rows.map((r) => r.semester)) : 0;
    const values = rows.filter((r) => r.semester === lastSem).map((r) => r.score);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };
  const tech = latestSkills("technical");
  const skills = (tech + latestSkills("soft")) / 2;
  const state = placementStateAt(g, asOf);
  const placement = 0.35 * state.aptitude + 0.3 * state.coding + 0.25 * state.interview + 0.1 * tech;
  const points = g.student.activities
    .filter((a) => a.status === "Approved" && a.semester <= n)
    .reduce((p, a) => p + ({ hackathon: 15, certification: 10, club: 10, event: 5 } as const)[a.type], 0);
  const remarks = g.facultyRemarksAll.filter((x) => x.semester === n).flatMap((x) => [x.participation, x.discipline, x.attitude]);
  const faculty = remarks.length ? (remarks.reduce((a, b) => a + b, 0) / remarks.length / 5) * 100 : 0;
  const comps = { academic, attendance, lms: lmsScore, placement, skills, engagement: Math.min(100, points), faculty };
  return (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((t, k) => t + WEIGHTS[k] * comps[k], 0);
}
