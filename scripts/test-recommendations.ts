/** Recommendation tests.  Run:  npm run test:recommendations   (after npm run build:recommendations) */
import { OUTCOME_KEYS, type Recommendation } from "../lib/ml-types";
import { OWNERS, PRIORITIES, buildRecommendations } from "../lib/recommendations";
import { loadInputs, readJson } from "./ml-io";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
  if (!ok) failures++;
};

const { predictions, segments, info, open } = loadInputs();
const file = readJson<{ recommendations: Recommendation[] }>("public/data/recommendations.json");
const recs = file.recommendations;
const fresh = buildRecommendations(predictions, segments, info, open);

check("the committed recommendations.json equals a fresh build", JSON.stringify(fresh) === JSON.stringify(recs), `${recs.length} recommendations`);

const required: (keyof Recommendation)[] = ["id", "targetType", "targetId", "targetLabel", "action", "reason", "owner", "priority", "priorityScore", "expectedImpact", "dueInDays", "triggeredBy", "ruleId", "outcomes"];
const missing = recs.filter((r) => required.some((k) => r[k] === undefined || r[k] === null || r[k] === ""));
check("every recommendation has every required field", missing.length === 0, missing.length ? missing[0].id : "");

check("owners are from the allowed set", recs.every((r) => OWNERS.includes(r.owner)));
check("priorities are from the allowed set", recs.every((r) => PRIORITIES.includes(r.priority)));
check("priority scores are within 0..1", recs.every((r) => r.priorityScore >= 0 && r.priorityScore <= 1));
check("ids are unique", new Set(recs.map((r) => r.id)).size === recs.length);

const bad = recs.filter((r) => /undefined|NaN|\bnull\b|\{|\}/.test(`${r.action} ${r.reason} ${r.expectedImpact}`) || r.reason.trim().length < 20 || r.action.trim().length < 10);
check("no reason or action is empty or contains undefined / NaN / braces", bad.length === 0, bad.length ? `${bad[0].id}: ${bad[0].reason}` : "");

const studentRecs = recs.filter((r) => r.targetType === "student");
check("a student has at most 3 recommendations", Object.values(studentRecs.reduce<Record<string, number>>((m, r) => ((m[r.targetId] = (m[r.targetId] ?? 0) + 1), m), {})).every((n) => n <= 3));

const highIds = Object.entries(predictions.students).filter(([, p]) => p.overall === "High").map(([id]) => id);
const covered = new Set(studentRecs.map((r) => r.targetId));
const uncovered = highIds.filter((id) => !covered.has(id));
check("every student with overall risk High has at least one recommendation", uncovered.length === 0, `${highIds.length} High students${uncovered.length ? `, uncovered: ${uncovered.slice(0, 5)}` : ""}`);
check("every High student has a recommendation with an owner and a priority", highIds.every((id) => studentRecs.some((r) => r.targetId === id && r.owner && r.priority)));

// reasons must carry the student's own numbers: at least one digit, and the lead driver sentence when one exists
const withoutNumbers = studentRecs.filter((r) => !/\d/.test(r.reason));
check("every student reason contains numbers", withoutNumbers.length === 0, withoutNumbers.length ? withoutNumbers[0].id : "");
const facultyWithoutId = recs.filter((r) => r.owner === "Faculty mentor" && r.targetType === "student" && !r.ownerId);
check("faculty-mentor recommendations carry the mentor's id", facultyWithoutId.length === 0);

const segmentRecs = recs.filter((r) => r.targetType === "segment" && !r.ruleId.endsWith("_department"));
const missingSegments = segments.segments.filter((s) => s.count > 0 && !segmentRecs.some((r) => r.targetId === s.id));
check("every non-empty segment has a segment recommendation", missingSegments.length === 0, missingSegments.map((s) => s.id).join(","));

// drivers referenced by a recommendation really belong to the student's prediction
const driverKeys = (id: string) => new Set(OUTCOME_KEYS.flatMap((k) => predictions.students[id][k].drivers.map((d) => d.k)).concat(["cgpa_at_n", "att_last_sem", "att_change_vs_prev", "active_backlogs_at_n", "submit_pct", "late_pct", "on_time_submit_pct", "round1_risk_flag", "interview_best"]));
const stray = studentRecs.filter((r) => r.triggeredBy.some((k) => !driverKeys(r.targetId).has(k)));
check("triggeredBy lists only that student's drivers or rule inputs", stray.length === 0, stray.length ? `${stray[0].id}: ${stray[0].triggeredBy}` : "");

console.log(failures ? `\n${failures} FAILED` : "\nALL RECOMMENDATION TESTS PASSED");
process.exit(failures ? 1 : 0);
