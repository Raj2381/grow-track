/**
 * Turns generated students into files: CSV tables (deliberately messy), per-student JSON for the portal,
 * a slim summary index for the admin pages, and cohort statistics.
 */
import { SEM_DATES, SEMESTERS, CURRENT_SEM, addDays } from "./calendar";
import { DATASET_SEED, DEPARTMENTS } from "./config";
import { cgpaAsOf, sgpaOfFirstAttempt, activeBacklogCodesAt, computeOutcomes, type OutcomeRow } from "./outcomes";
import { semesterOfDate, SOFT_SKILLS, TECH_SKILLS, type GeneratedStudent } from "./generate";
import { mulberry32, chance, int, pick, type Rng } from "./rng";
import { subjectByCode } from "../../student-portal/data/catalog";
import {
  activeBacklogs,
  attendanceOverall,
  assignmentCompletion,
  academicRisk,
  bestInterview,
  latestAptitude,
  techAvg,
  cgpa as cgpaOf,
  clamp,
  componentScores,
  engagementPoints,
  placementReadiness,
  skillsScore,
  weightedScore,
} from "../../student-portal/lib/scoring";
import { buildCohortStats } from "../../student-portal/lib/cohort";
import type { CohortStats, Student } from "../../student-portal/types";

/* ------------------------------------------------------------------------ */
/* CSV                                                                       */
/* ------------------------------------------------------------------------ */

type Cell = string | number | boolean | null | undefined;
export type Table = { name: string; columns: string[]; rows: Cell[][] };

const escapeCell = (v: Cell) => {
  if (v === null || v === undefined) return "";
  const text = String(v);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export const toCsv = (table: Table) => [table.columns.join(","), ...table.rows.map((row) => row.map(escapeCell).join(","))].join("\n") + "\n";

export type Intervention = {
  id: string;
  studentId: string;
  semester: number;
  reason: string;
  actionPlan: string;
  priority: "High" | "Medium" | "Low";
  followUpDate: string;
  status: "Planned" | "In Progress" | "Completed";
  createdAt: string;
};

/** Historical support actions, created only for students who were visibly struggling at the time. */
export function generateInterventions(all: GeneratedStudent[]): Intervention[] {
  const r = mulberry32(DATASET_SEED + 99);
  const out: Intervention[] = [];
  for (const g of all) {
    for (const sem of [2, 3, 4, 5]) {
      const att = g.semesterAttendance[sem];
      const cg = cgpaAsOf(g, sem);
      const backlogs = activeBacklogCodesAt(g, SEM_DATES[sem][1]).length;
      const issues: { reason: string; action: string }[] = [];
      if (att < 70) issues.push({ reason: `Attendance ${att}% in semester ${sem}, below the 75% requirement.`, action: "Weekly mentor check-in and attendance monitoring; contact guardian if it stays below 70%." });
      if (backlogs > 0) issues.push({ reason: `${backlogs} active backlog(s) at the end of semester ${sem}.`, action: "Enrol in remedial classes and book the supplementary exam." });
      if (cg < 6) issues.push({ reason: `CGPA ${cg.toFixed(2)} after semester ${sem}.`, action: "Pair with a peer tutor and review study plan with the faculty mentor." });
      if (!issues.length || !chance(r, 0.5)) continue;
      const created = addDays(SEM_DATES[sem][1], -int(r, 3, 20));
      const status = sem === CURRENT_SEM ? pick(r, ["Planned", "In Progress", "In Progress", "Completed"] as const) : "Completed";
      out.push({
        id: `INT-${g.student.id.slice(4)}-${sem}`,
        studentId: g.student.id,
        semester: sem,
        reason: issues.map((i) => i.reason).join(" "),
        actionPlan: issues.map((i) => i.action).join(" "),
        priority: issues.length >= 2 ? "High" : cg < 5 || att < 60 ? "High" : "Medium",
        followUpDate: addDays(created, 21),
        status,
        createdAt: `${created}T09:30:00.000Z`,
      });
    }
  }
  return out;
}

export function buildTables(all: GeneratedStudent[], outcomes: OutcomeRow[], interventions: Intervention[]): Table[] {
  const students: Table = {
    name: "students",
    columns: ["student_id", "name", "roll_no", "department", "branch_code", "section", "mentor_id", "gender", "residence", "scholarship", "entry_band", "income_band", "batch", "current_semester", "archetype_diagnostic"],
    rows: all.map(({ student: s, archetype }) => [s.id, s.name, s.rollNo, s.profile.department, s.branchCode, s.profile.section, s.profile.mentorId, s.profile.gender, s.profile.residence, s.profile.scholarship, s.profile.entryBand, s.profile.incomeBand, s.profile.batch, s.semester, archetype]),
  };
  const semesterResults: Table = {
    name: "semester_results",
    columns: ["student_id", "semester", "subject_code", "subject_name", "credits", "internal", "external", "total", "grade", "grade_point", "passed"],
    rows: all.flatMap((g) =>
      g.firstAttempt.map((x) => {
        const sub = subjectByCode(x.code);
        return [g.student.id, x.semester, x.code, sub.name, sub.credits, x.internal, x.external, x.total, x.grade, x.gradePoint, x.passed];
      }),
    ),
  };
  const semesterSummary: Table = {
    name: "semester_summary",
    columns: ["student_id", "semester", "sgpa", "cgpa_running", "attendance_pct", "subjects_failed", "faculty_rating"],
    rows: all.flatMap((g) =>
      SEMESTERS.map((sem) => {
        const remarks = g.facultyRemarksAll.filter((x) => x.semester === sem).flatMap((x) => [x.participation, x.discipline, x.attitude]);
        return [
          g.student.id,
          sem,
          Math.round(sgpaOfFirstAttempt(g, sem) * 100) / 100,
          Math.round(cgpaAsOf(g, sem) * 100) / 100,
          g.semesterAttendance[sem],
          g.firstAttempt.filter((x) => x.semester === sem && !x.passed).length,
          Math.round((remarks.reduce((a, b) => a + b, 0) / remarks.length) * 100) / 100,
        ];
      }),
    ),
  };
  const backlogs: Table = {
    name: "backlogs",
    columns: ["student_id", "subject_code", "semester", "attempt", "attempt_date", "marks", "result"],
    rows: all.flatMap((g) => g.backlogRows.map((b) => [g.student.id, b.code, b.semester, b.attempt, b.date, b.marks, b.result])),
  };
  const attendance: Table = {
    name: "attendance_monthly",
    columns: ["student_id", "semester", "subject_code", "month", "lectures_held", "lectures_attended"],
    rows: all.flatMap((g) => g.attendanceMonthly.map((a) => [g.student.id, a.semester, a.code, a.month, a.held, a.attended])),
  };
  const lms: Table = {
    name: "lms_monthly",
    columns: ["student_id", "semester", "month", "logins", "hours_online", "assignments_due", "assignments_submitted", "assignments_late", "avg_quiz_score", "quizzes_taken"],
    rows: all.flatMap((g) => g.lmsMonthly.map((m) => [g.student.id, m.semester, m.month, m.logins, m.hours, m.assigned, m.submitted, m.late, m.avgQuiz, m.quizCount])),
  };
  const assignments: Table = {
    name: "assignments",
    columns: ["assignment_id", "student_id", "semester", "subject_code", "assigned_date", "due_date", "submitted", "submitted_date", "late", "score"],
    rows: all.flatMap((g) => g.assignments.map((a) => [a.id, g.student.id, a.semester, a.code, a.assignedDate, a.dueDate, a.submitted, a.submittedDate, a.late, a.score])),
  };
  const aptitude: Table = {
    name: "aptitude_attempts",
    columns: ["attempt_id", "student_id", "semester", "date", "pattern", "quantitative", "logical_reasoning", "verbal", "total_percent", "time_taken_sec"],
    rows: all.flatMap((g) => g.student.placement.aptitude.map((a) => [a.id, g.student.id, semesterOfDate(a.date), a.date, a.pattern, a.sections.Quantitative.score, a.sections["Logical Reasoning"].score, a.sections.Verbal.score, a.totalPercent, a.timeTakenSec])),
  };
  const coding: Table = {
    name: "coding_attempts",
    columns: ["attempt_id", "student_id", "semester", "date", "language", "difficulty", "score_percent", "questions", "correct", "wrong", "skipped", "time_taken_sec"],
    rows: all.flatMap((g) => g.student.skills.codingAttempts.map((c) => [c.id, g.student.id, semesterOfDate(c.date), c.date, c.language, c.difficulty, c.score, c.questionCount, c.correct, c.wrong, c.skipped, c.timeTakenSec])),
  };
  const interviews: Table = {
    name: "interview_attempts",
    columns: ["attempt_id", "student_id", "semester", "date", "type", "difficulty", "score", "communication", "technical", "confidence"],
    rows: all.flatMap((g) => g.student.placement.interviews.map((i) => [i.id, g.student.id, semesterOfDate(i.date), i.date, i.type, i.difficulty, i.score, i.ratings.communication, i.ratings.technical, i.ratings.confidence])),
  };
  const activities: Table = {
    name: "activities",
    columns: ["activity_id", "student_id", "semester", "date", "type", "title", "organizer", "category", "role", "status"],
    rows: all.flatMap((g) => g.student.activities.map((a) => [a.id, g.student.id, a.semester, a.date, a.type, a.title, a.organizer, a.category, a.role, a.status])),
  };
  const skills: Table = {
    name: "skill_assessments",
    columns: ["assessment_id", "student_id", "semester", "kind", "skill", "score", "date"],
    rows: all.flatMap((g) => g.skillAssessments.map((s) => [s.id, g.student.id, s.semester, s.kind, s.skill, s.score, s.date])),
  };
  const remarks: Table = {
    name: "faculty_remarks",
    columns: ["student_id", "semester", "subject_code", "teacher", "date", "participation", "discipline", "attitude"],
    rows: all.flatMap((g) => g.facultyRemarksAll.map((x) => [g.student.id, x.semester, x.code, x.teacher, x.date, x.participation, x.discipline, x.attitude])),
  };
  const interventionTable: Table = {
    name: "interventions",
    columns: ["intervention_id", "student_id", "semester", "created_at", "reason", "action_plan", "priority", "status", "follow_up_date"],
    rows: interventions.map((i) => [i.id, i.studentId, i.semester, i.createdAt, i.reason, i.actionPlan, i.priority, i.status, i.followUpDate]),
  };
  const outcomeTable: Table = {
    name: "outcomes",
    columns: ["student_id", "as_of_semester", "label_available", "next_sgpa", "next_sgpa_band", "next_sgpa_below_6", "has_active_backlog_at_asof", "new_backlog_next_sem", "failed_to_clear_existing_backlog", "backlog_risk_any", "placement_ready_before_season", "engagement_drop_next_weeks"],
    rows: outcomes.map((o) => [o.student_id, o.as_of_semester, o.label_available, o.next_sgpa, o.next_sgpa_band, o.next_sgpa_below_6, o.has_active_backlog_at_asof, o.new_backlog_next_sem, o.failed_to_clear_existing_backlog, o.backlog_risk_any, o.placement_ready_before_season, o.engagement_drop_next_weeks]),
  };
  return [students, semesterResults, semesterSummary, backlogs, attendance, lms, assignments, aptitude, coding, interviews, activities, skills, remarks, interventionTable, outcomeTable];
}

/* ------------------------------------------------------------------------ */
/* messy layer: missing values and outliers (CSV only)                       */
/* ------------------------------------------------------------------------ */

export type QualityIssue = { table: string; column: string; kind: "missing" | "outlier"; count: number };

type Corruption = { table: string; column: string; kind: "missing" | "outlier"; rate: number; value?: (row: Cell[], r: Rng) => Cell };

const CORRUPTIONS: Corruption[] = [
  { table: "students", column: "income_band", kind: "missing", rate: 0.03 },
  { table: "students", column: "entry_band", kind: "missing", rate: 0.02 },
  { table: "semester_results", column: "internal", kind: "missing", rate: 0.01 },
  { table: "attendance_monthly", column: "lectures_attended", kind: "missing", rate: 0.012 },
  { table: "attendance_monthly", column: "lectures_attended", kind: "outlier", rate: 0.003, value: (row, r) => Number(row[4]) + int(r, 3, 8) },
  { table: "lms_monthly", column: "avg_quiz_score", kind: "missing", rate: 0.025 },
  { table: "lms_monthly", column: "hours_online", kind: "missing", rate: 0.02 },
  { table: "lms_monthly", column: "logins", kind: "outlier", rate: 0.004, value: (row) => Number(row[3]) * 8 },
  { table: "assignments", column: "score", kind: "missing", rate: 0.02 },
  { table: "coding_attempts", column: "time_taken_sec", kind: "missing", rate: 0.03 },
  { table: "coding_attempts", column: "score_percent", kind: "outlier", rate: 0.004, value: (row) => Number(row[6]) + 100 },
  { table: "interview_attempts", column: "confidence", kind: "missing", rate: 0.03 },
  { table: "skill_assessments", column: "score", kind: "outlier", rate: 0.003, value: () => 250 },
];

/** Applies the corruption plan to the tables in place and reports exactly what was changed. */
export function corruptTables(tables: Table[]): QualityIssue[] {
  const r = mulberry32(DATASET_SEED + 7);
  const issues: QualityIssue[] = [];
  for (const rule of CORRUPTIONS) {
    const table = tables.find((t) => t.name === rule.table)!;
    const col = table.columns.indexOf(rule.column);
    let count = 0;
    for (const row of table.rows) {
      if (row[col] === null || row[col] === "" || !chance(r, rule.rate)) continue;
      row[col] = rule.kind === "missing" ? "" : (rule.value?.(row, r) ?? row[col]);
      count++;
    }
    issues.push({ table: rule.table, column: rule.column, kind: rule.kind, count });
  }
  return issues;
}

/* ------------------------------------------------------------------------ */
/* JSON for the apps                                                         */
/* ------------------------------------------------------------------------ */

export type StudentFile = Omit<Student, "attendance"> & { lecturePresence: Record<string, string> };

export const toStudentFile = (g: GeneratedStudent): StudentFile => {
  const file: Partial<Student> & { lecturePresence?: Record<string, string> } = { ...g.student };
  delete file.attendance; // rebuilt from the presence strings when the file is loaded
  return { ...(file as Omit<Student, "attendance">), lecturePresence: g.lecturePresence };
};

export type AdminStudentRow = {
  id: string;
  name: string;
  department: string;
  year: string;
  attendance: number;
  academicScore: number;
  assignmentCompletion: number;
  skillsScore: number;
  placementScore: number;
  engagementScore: number;
  successScore: number;
  risk: "High" | "Medium" | "Low";
  riskReasons: string[];
  rollNo: string;
  branchCode: string;
  section: string;
  mentorId: string;
  mentorName: string;
  cgpa: number;
  activeBacklogs: number;
  semester: number;
  /** Mean marks (0-100) per semester, index 0 = semester 1 (final marks after supplementary exams). */
  semesterScores: number[];
  /** [subject code, marks] of the latest semester. */
  subjectScores: [string, number][];
  /** Placement components (0-100): average technical skill, latest aptitude test, communication skill, best mock interview. */
  placement: { technical: number; aptitude: number; communication: number; interview: number };
  /** Attendance % per semester, index 0 = semester 1. */
  semesterAttendance: number[];
  /** Lectures attended / held in the latest semester. */
  lectures: { attended: number; total: number };
  /** Latest technical (DSA, Web Dev, DBMS, Python, Java, C, SQL) then soft (Communication, Teamwork, Problem Solving, Leadership, Time Management) scores. */
  skillVector: number[];
};

const YEARS: Record<number, string> = { 1: "1st year", 2: "1st year", 3: "2nd year", 4: "2nd year", 5: "3rd year", 6: "3rd year", 7: "4th year", 8: "4th year" };

/** Flat per-student summary in the shape the admin pages already use, derived from the full record. */
export function buildAdminIndex(students: Student[], cohort: CohortStats): AdminStudentRow[] {
  return students.map((s) => {
    const comps = componentScores(s, cohort);
    const academic = academicRisk(s);
    const latest = s.results.filter((x) => x.semester === s.semester);
    const academicScore = Math.round(latest.reduce((a, x) => a + x.total, 0) / Math.max(1, latest.length));
    const placement = Math.round(placementReadiness(s).score);
    const reasons = academic.indicators.filter((i) => i.status !== "ok").map((i) => i.detail);
    if (placement < 60) reasons.push(`Placement readiness ${placement} is below 60.`);
    return {
      id: s.id,
      name: s.name,
      department: s.profile.department,
      year: YEARS[s.semester],
      attendance: Math.round(attendanceOverall(s).percent),
      academicScore,
      assignmentCompletion: Math.round(assignmentCompletion(s)),
      skillsScore: Math.round(skillsScore(s)),
      placementScore: placement,
      engagementScore: Math.round(clamp(engagementPoints(s))),
      successScore: Math.round(weightedScore(comps)),
      risk: academic.level,
      riskReasons: academic.level === "Low" && placement >= 60 ? [] : reasons,
      rollNo: s.rollNo,
      branchCode: s.branchCode,
      section: s.profile.section,
      mentorId: s.profile.mentorId,
      mentorName: s.profile.mentorName,
      cgpa: cgpaOf(s),
      activeBacklogs: activeBacklogs(s).length,
      semester: s.semester,
      semesterScores: Array.from({ length: s.semester }, (_, i) => {
        const rs = s.results.filter((x) => x.semester === i + 1);
        return Math.round(rs.reduce((a, x) => a + x.total, 0) / Math.max(1, rs.length));
      }),
      subjectScores: latest.map((x) => [x.code, x.total] as [string, number]),
      skillVector: [...TECH_SKILLS.map((k) => s.skills.technical[k] ?? 0), ...SOFT_SKILLS.map((k) => s.skills.soft[k])],
      semesterAttendance: [...[1, 2, 3, 4].map((k) => s.semesterAttendance[k]), Math.round(attendanceOverall(s).percent)],
      lectures: { attended: attendanceOverall(s).attended, total: attendanceOverall(s).total },
      placement: {
        technical: Math.round(techAvg(s)),
        aptitude: Math.round(latestAptitude(s)?.totalPercent ?? 0),
        communication: Math.round(s.skills.soft.Communication),
        interview: Math.round(bestInterview(s)),
      },
    };
  });
}

export const buildCohort = (students: Student[]) => buildCohortStats(students);
export { computeOutcomes, DEPARTMENTS };
