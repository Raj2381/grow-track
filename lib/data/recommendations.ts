import type { Json } from "@/lib/supabase/database.types";
import type { OutcomeKey, Owner, Priority, RecStatus, RecommendationSummary, StoredRecommendation } from "@/lib/ml-types";
import { cleanSearch, DataError, friendlyMessage, unwrap, type Db } from "./db";

export type RecommendationFilters = {
  targetType?: "student" | "segment";
  department?: string;
  owner?: Owner;
  priority?: Priority;
  status?: RecStatus;
  outcome?: OutcomeKey;
  /** exact student id */
  student?: string;
  /** a segment id, which also matches that segment's department-level items ("<segment>:<department>") */
  segment?: string;
  search?: string;
};

type Row = {
  id: string; target_type: string; target_id: string; target_label: string; department: string | null; action: string; reason: string;
  owner: string; owner_id: string | null; priority: string; priority_score: number | string; expected_impact: string; due_in_days: number;
  triggered_by: string[]; rule_id: string; outcomes: string[]; status: string; assigned_to: string | null; updated_at: string;
};

export const toStored = (r: Row): StoredRecommendation => ({
  id: r.id, targetType: r.target_type as "student" | "segment", targetId: r.target_id, targetLabel: r.target_label, department: r.department,
  action: r.action, reason: r.reason, owner: r.owner as Owner, ownerId: r.owner_id, priority: r.priority as Priority, priorityScore: Number(r.priority_score),
  expectedImpact: r.expected_impact, dueInDays: r.due_in_days, triggeredBy: r.triggered_by ?? [], ruleId: r.rule_id, outcomes: (r.outcomes ?? []) as OutcomeKey[],
  status: r.status as RecStatus, assignedTo: r.assigned_to, updatedAt: r.updated_at,
});

export async function fetchRecommendations(db: Db, filters: RecommendationFilters, page: number, pageSize: number) {
  let q = db.from("recommendations").select("*", { count: "exact" });
  if (filters.targetType) q = q.eq("target_type", filters.targetType);
  if (filters.department) q = q.eq("department", filters.department);
  if (filters.owner) q = q.eq("owner", filters.owner);
  if (filters.priority) q = q.eq("priority", filters.priority);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.outcome) q = q.contains("outcomes", [filters.outcome]);
  if (filters.student) q = q.eq("target_type", "student").eq("target_id", filters.student);
  if (filters.segment) q = q.eq("target_type", "segment").or(`target_id.eq.${cleanSearch(filters.segment)},target_id.like.${cleanSearch(filters.segment)}:*`);
  const text = cleanSearch(filters.search ?? "");
  if (text) q = q.or(`target_label.ilike.%${text}%,target_id.ilike.%${text}%,action.ilike.%${text}%`);
  const from = page * pageSize;
  const { data, error, count } = await q.order("priority_score", { ascending: false }).order("id").range(from, from + pageSize - 1);
  if (error) throw new DataError(friendlyMessage(error), error.code);
  return { rows: ((data ?? []) as unknown as Row[]).map(toStored), count: count ?? 0 };
}

export async function fetchRecommendationsFor(db: Db, studentId: string): Promise<StoredRecommendation[]> {
  const { data, error } = await db.from("recommendations").select("*").eq("target_type", "student").eq("target_id", studentId).order("priority_score", { ascending: false }).order("id");
  if (error) throw new DataError(friendlyMessage(error), error.code);
  return ((data ?? []) as unknown as Row[]).map(toStored);
}

export async function fetchRecommendationSummary(db: Db, department?: string): Promise<RecommendationSummary> {
  return unwrap(await db.rpc("recommendation_summary", { p_department: department ?? null })) as unknown as RecommendationSummary;
}

/**
 * Changes the status and/or assignee. The database allows nothing else (a trigger blocks any other column) and Row Level
 * Security decides WHO may change WHICH item; an item the caller may not change comes back as zero rows, which is reported.
 */
export async function updateRecommendation(db: Db, id: string, patch: { status?: RecStatus; assignedTo?: string | null }): Promise<StoredRecommendation> {
  const values: { status?: string; assigned_to?: string | null } = {};
  if (patch.status) values.status = patch.status;
  if (patch.assignedTo !== undefined) values.assigned_to = patch.assignedTo ? patch.assignedTo.trim().slice(0, 80) : null;
  const { data, error } = await db.from("recommendations").update(values).eq("id", id).select("*");
  if (error) throw new DataError(friendlyMessage(error), error.code);
  if (!data || data.length === 0) throw new DataError("You are not allowed to change this item.");
  return toStored(data[0] as unknown as Row);
}

export type { Json };
