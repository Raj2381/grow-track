/** Builds public/data/recommendations.json.  Run:  npm run build:recommendations */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildRecommendations, PRIORITIES, OWNERS, RULES, MAX_PER_STUDENT, SEVERITY_WEIGHT } from "../lib/recommendations";
import { loadInputs, root } from "./ml-io";

const { predictions, segments, info, open } = loadInputs();
const recommendations = buildRecommendations(predictions, segments, info, open);

const count = <K extends string>(values: K[], order: K[]) => Object.fromEntries(order.map((k) => [k, values.filter((v) => v === k).length]));
const payload = {
  spec: {
    forecast_for: "semester 6, from data known at the end of semester 5",
    fields: "id, targetType (student|segment), targetId, targetLabel, department, action, reason, owner, ownerId, priority, priorityScore, expectedImpact, dueInDays, triggeredBy, ruleId, outcomes",
    max_per_student: MAX_PER_STUDENT,
    priority_rule: "student score = max over the rule's outcomes of (severity weight x probability) + 0.05 per additional High outcome, capped at 1; segment score = 0.85 x max(weight x mean risk) + 0.15 x min(1, members / 15% of students); Critical >= 0.8, High >= 0.6, Medium >= 0.4, else Low",
    severity_weights: SEVERITY_WEIGHT,
    rules: RULES.map((r) => ({ id: r.id, summary: r.summary, owner: r.owner, outcomes: r.outcomes, dueInDays: r.dueInDays })),
    caveat: "Synthetic data. Recommendations are decision support for a mentor to review, not automatic actions.",
  },
  counts: {
    total: recommendations.length,
    students_with_recommendation: new Set(recommendations.filter((r) => r.targetType === "student").map((r) => r.targetId)).size,
    by_owner: count(recommendations.map((r) => r.owner), OWNERS),
    by_priority: count(recommendations.map((r) => r.priority), PRIORITIES),
    by_rule: Object.fromEntries(RULES.map((r) => [r.id, recommendations.filter((x) => x.ruleId === r.id).length])),
    by_target_type: { student: recommendations.filter((r) => r.targetType === "student").length, segment: recommendations.filter((r) => r.targetType === "segment").length },
  },
  recommendations,
};
writeFileSync(path.join(root, "public/data/recommendations.json"), JSON.stringify(payload) + "\n");
console.log(`wrote ${recommendations.length} recommendations`);
console.log("by owner   ", payload.counts.by_owner);
console.log("by priority", payload.counts.by_priority);
console.log("by rule    ", payload.counts.by_rule);
console.log("students with a recommendation:", payload.counts.students_with_recommendation, "of", Object.keys(predictions.students).length);
