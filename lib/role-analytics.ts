/** Pure summaries for the HOD, TPO and faculty dashboards. They take the students the signed-in person may see and invent nothing. */
import type { ScopeStudent } from "@/lib/data/scope";

export const ATTENDANCE_LIMIT = 75;
export const READINESS_THRESHOLDS = { ready: 80, inPreparation: 50 } as const;
export const SKILL_THRESHOLDS = { strength: 75, gap: 65 } as const;

const mean = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null);
const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export type DepartmentSummary = {
  students: number; avgAttendance: number | null; belowAttendance: number; avgCgpa: number | null; withBacklog: number; highRisk: number; mediumRisk: number;
  avgSgpaForecast: number | null;
};
export function summarize(students: ScopeStudent[]): DepartmentSummary {
  return {
    students: students.length,
    avgAttendance: round1(mean(students.map((s) => s.attendance))),
    belowAttendance: students.filter((s) => s.attendance < ATTENDANCE_LIMIT).length,
    avgCgpa: round2(mean(students.map((s) => s.cgpa))),
    withBacklog: students.filter((s) => s.backlogs > 0).length,
    highRisk: students.filter((s) => s.overall === "High").length,
    mediumRisk: students.filter((s) => s.overall === "Medium").length,
    avgSgpaForecast: round1(mean(students.map((s) => s.predSgpa))),
  };
}

export type SectionRow = { section: string; students: number; avgAttendance: number | null; belowAttendance: number; avgCgpa: number | null; highRisk: number };
export function bySection(students: ScopeStudent[]): SectionRow[] {
  const groups = new Map<string, ScopeStudent[]>();
  for (const s of students) groups.set(s.section, [...(groups.get(s.section) ?? []), s]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([section, list]) => {
    const t = summarize(list);
    return { section, students: t.students, avgAttendance: t.avgAttendance, belowAttendance: t.belowAttendance, avgCgpa: t.avgCgpa, highRisk: t.highRisk };
  });
}

export type FacultyRow = { id: string; name: string; mentees: number; highRisk: number; avgAttendance: number | null; avgCgpa: number | null; withBacklog: number };
export function byMentor(students: ScopeStudent[], faculty: { id: string; name: string }[]): FacultyRow[] {
  return faculty.map((f) => {
    const list = students.filter((s) => s.mentorId === f.id);
    const t = summarize(list);
    return { id: f.id, name: f.name, mentees: t.students, highRisk: t.highRisk, avgAttendance: t.avgAttendance, avgCgpa: t.avgCgpa, withBacklog: t.withBacklog };
  });
}

/** Buckets for a histogram: [lower, upper) with the last bucket closed. */
export function histogram(values: number[], edges: number[]): { label: string; count: number }[] {
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    const last = i === edges.length - 2;
    return { label: `${lo}–${hi}`, count: values.filter((v) => v >= lo && (last ? v <= hi : v < hi)).length };
  });
}

/* ---------------------------------------------------------------------------------------------- placement (TPO) */
export type TpoStatus = "Ready" | "In preparation" | "Not ready" | "Not assessed";
export type PlacementRow = {
  student: ScopeStudent; readiness: number | null; status: TpoStatus;
  skills: { label: string; score: number | null }[]; strengths: string[]; weaknesses: string[]; notAssessed: string[]; recommendations: string[];
};

export function tpoStatus(readiness: number | null): TpoStatus {
  if (readiness === null) return "Not assessed";
  return readiness >= READINESS_THRESHOLDS.ready ? "Ready" : readiness >= READINESS_THRESHOLDS.inPreparation ? "In preparation" : "Not ready";
}

/**
 * Readiness is the average of the placement components the student has actually been assessed on (a test or interview taken,
 * or a skill rating on record); a student with none is "Not assessed" rather than scored zero.
 */
export function placementRow(s: ScopeStudent): PlacementRow {
  const skills: { label: string; score: number | null }[] = [
    { label: "Aptitude", score: s.aptitudeAttempts > 0 ? s.aptitude : null },
    { label: "Coding", score: s.codingAttempts > 0 ? s.coding : null },
    { label: "Mock interviews", score: s.interviewAttempts > 0 ? s.interview : null },
    { label: "Technical skills", score: s.tech > 0 ? s.tech : null },
    { label: "Communication", score: s.comm > 0 ? s.comm : null },
  ];
  const assessed = skills.filter((k) => k.score !== null) as { label: string; score: number }[];
  const readiness = assessed.length ? round1(mean(assessed.map((k) => k.score))) : null;
  const strengths = assessed.filter((k) => k.score >= SKILL_THRESHOLDS.strength).map((k) => k.label);
  const weaknesses = assessed.filter((k) => k.score < SKILL_THRESHOLDS.gap).map((k) => k.label);
  const notAssessed = skills.filter((k) => k.score === null).map((k) => k.label);
  const rec: string[] = [];
  if (weaknesses.includes("Aptitude")) rec.push("Weekly aptitude practice tests");
  if (weaknesses.includes("Coding")) rec.push("Coding practice and a coding bootcamp");
  if (weaknesses.includes("Mock interviews")) rec.push("Mock interviews with feedback");
  if (weaknesses.includes("Technical skills")) rec.push("Technical skill workshops");
  if (weaknesses.includes("Communication")) rec.push("Communication and presentation training");
  if (notAssessed.length) rec.push(`First assessment in: ${notAssessed.join(", ")}`);
  return { student: s, readiness, status: tpoStatus(readiness), skills, strengths, weaknesses, notAssessed, recommendations: rec.length ? rec : ["Continue placement preparation"] };
}

export function placementRows(students: ScopeStudent[]): PlacementRow[] {
  return students.map(placementRow);
}

export function skillAverages(rows: PlacementRow[]): { label: string; average: number | null; assessed: number; strong: number; weak: number }[] {
  const labels = ["Aptitude", "Coding", "Mock interviews", "Technical skills", "Communication"];
  return labels.map((label) => {
    const scores = rows.map((r) => r.skills.find((k) => k.label === label)?.score).filter((x): x is number => typeof x === "number");
    return { label, average: round1(mean(scores)), assessed: scores.length, strong: scores.filter((x) => x >= SKILL_THRESHOLDS.strength).length, weak: scores.filter((x) => x < SKILL_THRESHOLDS.gap).length };
  });
}

export function statusCounts(rows: PlacementRow[]): Record<TpoStatus, number> {
  const c: Record<TpoStatus, number> = { Ready: 0, "In preparation": 0, "Not ready": 0, "Not assessed": 0 };
  for (const r of rows) c[r.status]++;
  return c;
}

/* ---------------------------------------------------------------------------------------------- assistant input */
import type { AnalyticsStudent } from "@/lib/admin-analytics";

/**
 * The assistant's view of a student, all from stored records: the academic score is CGPA on a 100 scale, placement is the readiness
 * built from assessments actually taken (the model's placement-ready chance if none), skills the mean of technical and communication ratings.
 */
export function toAnalyticsStudent(s: ScopeStudent): AnalyticsStudent {
  const readiness = placementRow(s).readiness;
  const skills = [s.tech, s.comm].filter((x) => x > 0);
  return {
    id: s.id, name: s.name, department: s.department,
    academicScore: Math.round(s.cgpa * 10), attendance: Math.round(s.attendance), assignmentCompletion: Math.round(s.submitPct),
    skillsScore: Math.round(mean(skills) ?? 0), placementScore: Math.round(readiness ?? s.readyP * 100), engagementScore: Math.min(100, Math.round(s.points)),
    successScore: Math.round(s.successScore), risk: s.overall, riskReasons: s.reason ? [s.reason] : [], cgpa: s.cgpa, sgpa: s.sgpaLast,
  };
}
