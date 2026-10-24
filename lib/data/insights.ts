import type { DirectoryRow, ModelMetricsFile, RiskTrendsFile, SegmentRecord } from "@/lib/ml-types";
import { DataError, friendlyMessage, unwrap, type Db } from "./db";

export async function fetchRiskTrends(db: Db): Promise<RiskTrendsFile> {
  return unwrap(await db.from("risk_trends").select("data").limit(1).single()).data as unknown as RiskTrendsFile;
}

export async function fetchModelMetrics(db: Db): Promise<ModelMetricsFile> {
  return unwrap(await db.from("model_metrics").select("data").limit(1).single()).data as unknown as ModelMetricsFile;
}

type SegmentRow = {
  id: string; label: string; definition: string; member_count: number; share_of_students: number | string;
  by_department: Record<string, number>; department_lift: Record<string, number>; mean_risk: SegmentRecord["mean_risk"];
  mean_cgpa: number | string | null; mean_attendance: number | string | null; overall_high_share: number | string | null;
};

export async function fetchSegments(db: Db): Promise<Omit<SegmentRecord, "members">[]> {
  const { data, error } = await db.from("segments").select("*").order("member_count", { ascending: false });
  if (error) throw new DataError(friendlyMessage(error), error.code);
  return ((data ?? []) as unknown as SegmentRow[]).map((s) => ({
    id: s.id, label: s.label, definition: s.definition, count: s.member_count, share_of_students: Number(s.share_of_students),
    by_department: s.by_department, department_lift: s.department_lift, mean_risk: s.mean_risk,
    mean_cgpa: s.mean_cgpa === null ? null : Number(s.mean_cgpa), mean_attendance: s.mean_attendance === null ? null : Number(s.mean_attendance),
    overall_high_share: s.overall_high_share === null ? null : Number(s.overall_high_share),
  }));
}

/** A page of a segment's members with their forecast rows. */
export async function fetchSegmentMembers(db: Db, segmentId: string, page: number, pageSize: number) {
  const from = page * pageSize;
  const members = await db.from("segment_members").select("student_id", { count: "exact" }).eq("segment_id", segmentId).order("student_id").range(from, from + pageSize - 1);
  if (members.error) throw new DataError(friendlyMessage(members.error), members.error.code);
  const ids = (members.data ?? []).map((m) => m.student_id);
  if (!ids.length) return { rows: [], count: members.count ?? 0 };
  const rows = unwrap(await db.from("predictions_directory").select("*").in("student_id", ids).order("risk_score", { ascending: false })) as unknown as DirectoryRow[];
  return { rows, count: members.count ?? 0 };
}
