/**
 * Loads the machine-learning outputs (public/data/*.json written by `npm run ml:all`) into their tables under a new
 * model run. Re-runnable: staff decisions on recommendations (status, assignment) are never overwritten, stale OPEN
 * recommendations are removed, and exactly one run stays current.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { root } from "./migrations";
import type { Row } from "./seed-data";
import type { Sink } from "./sink";
import type { PredictionsFile, Recommendation, SegmentsFile } from "../../lib/ml-types";

const read = <T,>(file: string) => JSON.parse(readFileSync(path.join(root, "public", "data", file), "utf8")) as T;

export type MlLoadReport = { runId: string; predictions: number; recommendations: number; segments: number };

export async function loadMlOutputs(sink: Sink, log: (line: string) => void = () => {}): Promise<MlLoadReport> {
  const predictions = read<PredictionsFile>("predictions.json");
  const recommendations = read<{ recommendations: Recommendation[] }>("recommendations.json").recommendations;
  const segments = read<SegmentsFile & { segments: (SegmentsFile["segments"][number])[] }>("segments.json");
  const trends = read<unknown>("risk-trends.json");
  const metrics = read<{ data_sha256: string; seed: number; python_version: string; sklearn_version: string }>("model-metrics.json");
  const whatifModel = read<Record<string, unknown>>("whatif-model.json");
  const whatifInputs = read<{ numeric: string[]; categorical: string[]; students: Record<string, unknown> }>("whatif-inputs.json");
  const cohort = read<unknown>("cohort.json");

  const runId = randomUUID();
  await sink.update("model_runs", { is_current: false }, { is_current: true });
  await sink.upsert("model_runs", [{ id: runId, data_sha256: metrics.data_sha256, seed: metrics.seed, python_version: metrics.python_version, sklearn_version: metrics.sklearn_version, notes: "loaded by npm run db:load-ml", is_current: true }], ["id"]);
  log(`ok   model_runs          new current run ${runId.slice(0, 8)}`);

  const predictionRows: Row[] = Object.entries(predictions.students).map(([id, s]) => ({
    student_id: id, run_id: runId, overall: s.overall, reason: s.reason, mentor_id: s.mentorId,
    sgpa_p: s.sgpa_below_6.p, sgpa_level: s.sgpa_below_6.level, pred_sgpa: s.sgpa_below_6.pred, sgpa_lo: s.sgpa_below_6.lo, sgpa_hi: s.sgpa_below_6.hi, sgpa_band: s.sgpa_below_6.band,
    backlog_p: s.backlog.p, backlog_level: s.backlog.level,
    notready_p: s.placement.p, ready_p: s.placement.p_ready, placement_level: s.placement.level,
    engagement_p: s.engagement.p, engagement_level: s.engagement.level,
    drivers: { sgpa_below_6: s.sgpa_below_6.drivers, backlog: s.backlog.drivers, placement: s.placement.drivers, engagement: s.engagement.drivers },
    facts: s.facts,
  }));
  await sink.upsert("predictions", predictionRows, ["student_id"]);
  log(`ok   predictions         ${predictionRows.length}`);

  // status / assigned_to / updated_* are deliberately NOT in these rows, so an update never overwrites a staff decision
  const recRows: Row[] = recommendations.map((r) => ({
    id: r.id, run_id: runId, target_type: r.targetType, target_id: r.targetId, target_label: r.targetLabel, department: r.department,
    action: r.action, reason: r.reason, owner: r.owner, owner_id: r.ownerId, priority: r.priority, priority_score: r.priorityScore,
    expected_impact: r.expectedImpact, due_in_days: r.dueInDays, triggered_by: r.triggeredBy, rule_id: r.ruleId, outcomes: r.outcomes,
  }));
  await sink.upsert("recommendations", recRows, ["id"]);
  await sink.deleteWhereNotIn("recommendations", "id", recRows.map((r) => String(r.id)), { column: "status", value: "open" });
  log(`ok   recommendations     ${recRows.length}`);

  const segmentRows: Row[] = segments.segments.map((s) => ({
    id: s.id, run_id: runId, label: s.label, definition: s.definition, member_count: s.count, share_of_students: s.share_of_students,
    by_department: s.by_department, department_lift: s.department_lift, mean_risk: s.mean_risk, mean_cgpa: s.mean_cgpa, mean_attendance: s.mean_attendance, overall_high_share: s.overall_high_share,
  }));
  await sink.upsert("segments", segmentRows, ["id"]);
  await sink.deleteWhereNotIn("segments", "id", segmentRows.map((r) => String(r.id)));
  await sink.deleteAll("segment_members");
  await sink.upsert("segment_members", segments.segments.flatMap((s) => s.members.map((m) => ({ segment_id: s.id, student_id: m }))), ["segment_id", "student_id"]);
  log(`ok   segments            ${segmentRows.length}`);

  for (const [table, data] of [["risk_trends", trends], ["model_metrics", metrics && read<unknown>("model-metrics.json")], ["whatif_model", { ...whatifModel, input_schema: { numeric: whatifInputs.numeric, categorical: whatifInputs.categorical } }], ["cohort_stats", cohort]] as [string, unknown][]) {
    await sink.upsert(table, [{ run_id: runId, data }], ["run_id"]);
    await sink.deleteWhereNotIn(table, "run_id", [runId]);
  }
  await sink.upsert("whatif_inputs", Object.entries(whatifInputs.students).map(([id, data]) => ({ student_id: id, run_id: runId, data })), ["student_id"]);
  log(`ok   whatif / trends / metrics / cohort`);
  return { runId, predictions: predictionRows.length, recommendations: recRows.length, segments: segmentRows.length };
}
