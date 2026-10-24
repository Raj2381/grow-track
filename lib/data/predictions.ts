import type { DirectoryRow, OutcomeKey, PredictionSummary, RiskLevel, StudentPrediction } from "@/lib/ml-types";
import { cleanSearch, DataError, friendlyMessage, unwrap, type Db } from "./db";
import { fetchRecommendationsFor } from "./recommendations";
import { fetchWhatIfInputs, type WhatIfStudent } from "./whatif";
import type { StoredRecommendation } from "@/lib/ml-types";

export type PredictionFilters = {
  branch?: string;
  section?: string;
  mentor?: string;
  overall?: RiskLevel;
  /** a level on one outcome, e.g. { outcome: "backlog", level: "High" } */
  outcome?: { key: OutcomeKey; level: RiskLevel };
  search?: string;
};
export type PredictionSort = "risk" | "name" | "sgpa" | "backlog" | "ready" | "engagement";

const LEVEL_COLUMN: Record<OutcomeKey, keyof DirectoryRow> = {
  sgpa_below_6: "sgpa_level", backlog: "backlog_level", placement: "placement_level", engagement: "engagement_level",
};
const SORTS: Record<PredictionSort, { column: keyof DirectoryRow; ascending: boolean }> = {
  risk: { column: "risk_score", ascending: false },
  name: { column: "name", ascending: true },
  sgpa: { column: "pred_sgpa", ascending: true },
  backlog: { column: "backlog_p", ascending: false },
  ready: { column: "ready_p", ascending: true },
  engagement: { column: "engagement_p", ascending: false },
};

export async function fetchPredictionList(db: Db, filters: PredictionFilters, page: number, pageSize: number, sort: PredictionSort = "risk") {
  let query = db.from("predictions_directory").select("*", { count: "exact" });
  if (filters.branch) query = query.eq("branch_code", filters.branch);
  if (filters.section) query = query.eq("section", filters.section);
  if (filters.mentor) query = query.eq("mentor_id", filters.mentor);
  if (filters.overall) query = query.eq("overall", filters.overall);
  if (filters.outcome) query = query.eq(LEVEL_COLUMN[filters.outcome.key] as string, filters.outcome.level);
  const text = cleanSearch(filters.search ?? "");
  if (text) query = query.or(`name.ilike.%${text}%,student_id.ilike.%${text}%,roll_no.ilike.%${text}%`);
  const { column, ascending } = SORTS[sort];
  const from = page * pageSize;
  const { data, error, count } = await query.order(column as string, { ascending }).order("student_id").range(from, from + pageSize - 1);
  if (error) throw new DataError(friendlyMessage(error), error.code);
  return { rows: (data ?? []) as unknown as DirectoryRow[], count: count ?? 0 };
}

export async function fetchPredictionSummary(db: Db, filters: Pick<PredictionFilters, "branch" | "section" | "mentor"> = {}): Promise<PredictionSummary> {
  const result = await db.rpc("prediction_summary", { p_branch: filters.branch ?? null, p_section: filters.section ?? null, p_mentor: filters.mentor ?? null });
  return unwrap(result) as unknown as PredictionSummary;
}

/** Departments, sections and mentors present in the caller's visible predictions (for the filter menus). */
export async function fetchFilterOptions(db: Db) {
  const { data, error } = await db.from("predictions_directory").select("branch_code, department, section, mentor_id").limit(1000);
  if (error) throw new DataError(friendlyMessage(error), error.code);
  const rows = (data ?? []) as { branch_code: string; department: string; section: string; mentor_id: string }[];
  const uniq = <T,>(xs: T[]) => [...new Set(xs)].sort();
  return {
    departments: uniq(rows.map((r) => `${r.branch_code}|${r.department}`)).map((v) => ({ code: v.split("|")[0], name: v.split("|")[1] })),
    sections: uniq(rows.map((r) => r.section)),
    mentors: uniq(rows.map((r) => r.mentor_id)),
  };
}

export type PredictionDetail = {
  summary: DirectoryRow;
  prediction: StudentPrediction;
  recommendations: StoredRecommendation[];
  whatIf: WhatIfStudent | null;
};

/** Everything the drill-down needs for one student. Drivers and facts are loaded only here, not for the list. */
export async function fetchPredictionDetail(db: Db, studentId: string): Promise<PredictionDetail> {
  const [directory, full, recommendations, whatIf] = await Promise.all([
    db.from("predictions_directory").select("*").eq("student_id", studentId).single(),
    db.from("predictions").select("*").eq("student_id", studentId).single(),
    fetchRecommendationsFor(db, studentId),
    fetchWhatIfInputs(db, studentId).catch(() => null),
  ]);
  const summary = unwrap(directory) as unknown as DirectoryRow;
  const row = unwrap(full);
  const drivers = row.drivers as unknown as Record<OutcomeKey, StudentPrediction["backlog"]["drivers"]>;
  const prediction: StudentPrediction = {
    overall: row.overall as RiskLevel,
    reason: row.reason,
    mentorId: row.mentor_id,
    facts: row.facts as unknown as StudentPrediction["facts"],
    sgpa_below_6: { p: Number(row.sgpa_p), level: row.sgpa_level as RiskLevel, drivers: drivers.sgpa_below_6, pred: Number(row.pred_sgpa), lo: Number(row.sgpa_lo), hi: Number(row.sgpa_hi), band: row.sgpa_band },
    backlog: { p: Number(row.backlog_p), level: row.backlog_level as RiskLevel, drivers: drivers.backlog },
    placement: { p: Number(row.notready_p), level: row.placement_level as RiskLevel, drivers: drivers.placement, p_ready: Number(row.ready_p) },
    engagement: { p: Number(row.engagement_p), level: row.engagement_level as RiskLevel, drivers: drivers.engagement },
  };
  return { summary, prediction, recommendations, whatIf };
}
