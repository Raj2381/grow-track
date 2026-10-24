import type { RiskLevel } from "@/lib/ml-types";
import { DataError, friendlyMessage, type Db } from "./db";

/** One student as the HOD, TPO and faculty dashboards need them: identity, forecast level and the facts behind it. */
export type ScopeStudent = {
  id: string; name: string; department: string; branchCode: string; section: string; mentorId: string;
  overall: RiskLevel; reason: string; predSgpa: number; backlogLevel: RiskLevel; placementLevel: RiskLevel; engagementLevel: RiskLevel;
  readyP: number; backlogP: number;
  cgpa: number; sgpaLast: number; attendance: number; attChange: number; backlogs: number; submitPct: number; points: number; faculty: number;
  aptitude: number; aptitudeAttempts: number; coding: number; codingAttempts: number; interview: number; interviewAttempts: number;
  tech: number; comm: number; successScore: number;
};

const PAGE = 1000;
/** PostgREST returns at most 1000 rows per request, so read in pages until a short page arrives. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new DataError(friendlyMessage(error as Parameters<typeof friendlyMessage>[0]), error.code);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? 0 : Number(v));

/**
 * Everyone the signed-in person may see (Row Level Security does the scoping: a mentor's mentees, a HOD's department, all
 * students for a TPO or the dean), from the forecast directory plus the facts stored with each forecast.
 */
export async function fetchScopeStudents(db: Db): Promise<ScopeStudent[]> {
  const [dir, facts, summary] = await Promise.all([
    readAll((a, b) => db.from("predictions_directory")
      .select("student_id, name, branch_code, department, section, mentor_id, overall, reason, pred_sgpa, backlog_p, backlog_level, ready_p, placement_level, engagement_level")
      .order("student_id").range(a, b)),
    readAll((a, b) => db.from("predictions")
      .select("student_id, cgpa:facts->>cgpa, sgpa_last:facts->>sgpa_last, att:facts->>att, att_change:facts->>att_change, backlogs:facts->>backlogs, submit_pct:facts->>submit_pct, points:facts->>points, faculty:facts->>faculty, aptitude:facts->>aptitude, aptitude_attempts:facts->>aptitude_attempts, coding:facts->>coding, coding_attempts:facts->>coding_attempts, interview:facts->>interview, interview_attempts:facts->>interview_attempts, tech:facts->>tech, comm:facts->>comm, success_score:facts->>success_score")
      .order("student_id").range(a, b)),
    // CGPA and attendance come from the stored results and lectures (what the student's own dashboard shows), not from the model snapshot
    readAll((a, b) => (db as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string) => { range: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }> } } } })
      .from("student_summary").select("student_id, cgpa, attendance_pct").order("student_id").range(a, b)),
  ]);
  const sumById = new Map((summary as unknown as Record<string, unknown>[]).map((r) => [String(r.student_id), r]));
  const byId = new Map((facts as unknown as Record<string, unknown>[]).map((f) => [String(f.student_id), f]));
  return (dir as unknown as Record<string, unknown>[]).map((d) => {
    const f = byId.get(String(d.student_id)) ?? {};
    return {
      id: String(d.student_id), name: String(d.name), department: String(d.department), branchCode: String(d.branch_code), section: String(d.section), mentorId: String(d.mentor_id),
      overall: d.overall as RiskLevel, reason: String(d.reason ?? ""), predSgpa: num(d.pred_sgpa), backlogLevel: d.backlog_level as RiskLevel,
      placementLevel: d.placement_level as RiskLevel, engagementLevel: d.engagement_level as RiskLevel, readyP: num(d.ready_p), backlogP: num(d.backlog_p),
      cgpa: num(sumById.get(String(d.student_id))?.cgpa ?? f.cgpa), sgpaLast: num(f.sgpa_last), attendance: num(sumById.get(String(d.student_id))?.attendance_pct ?? f.att), attChange: num(f.att_change), backlogs: num(f.backlogs), submitPct: num(f.submit_pct),
      points: num(f.points), faculty: num(f.faculty), aptitude: num(f.aptitude), aptitudeAttempts: num(f.aptitude_attempts), coding: num(f.coding),
      codingAttempts: num(f.coding_attempts), interview: num(f.interview), interviewAttempts: num(f.interview_attempts), tech: num(f.tech), comm: num(f.comm),
      successScore: num(f.success_score),
    };
  });
}

export type DirectoryFaculty = { id: string; name: string; branchCode: string };
export async function fetchFaculty(db: Db): Promise<DirectoryFaculty[]> {
  const { data, error } = await db.from("faculty").select("id, name, branch_code").order("id");
  if (error) throw new DataError(friendlyMessage(error), error.code);
  return (data ?? []).map((f) => ({ id: f.id, name: f.name, branchCode: f.branch_code }));
}

export type StudentCounts = { total: number; scored: number; awaiting: number };

/**
 * The one student count every dashboard shows: everyone in the students table the signed-in person may see, with how many of them
 * already have a forecast. Students added later have none until their records are loaded, so total and scored can differ.
 */
export async function fetchStudentCounts(db: Db): Promise<StudentCounts> {
  const [all, scored] = await Promise.all([
    db.from("students").select("id", { count: "exact", head: true }),
    db.from("predictions_directory").select("student_id", { count: "exact", head: true }),
  ]);
  if (all.error) throw new DataError(friendlyMessage(all.error), all.error.code);
  if (scored.error) throw new DataError(friendlyMessage(scored.error), scored.error.code);
  const total = all.count ?? 0;
  const done = Math.min(total, scored.count ?? 0);
  return { total, scored: done, awaiting: total - done };
}

export const countNote = (c: StudentCounts, fallback: string) => (c.awaiting > 0 ? `${c.scored.toLocaleString()} forecast · ${c.awaiting} awaiting records` : fallback);
