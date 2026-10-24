/**
 * End-to-end data checks against the LIVE Supabase project, as three real signed-in roles.   npm run test:e2e
 * Needs the temporary accounts:  npx tsx scripts/db/e2e-accounts.ts create   (and delete them afterwards).
 * It changes one recommendation's status to prove persistence and always puts it back.
 */
import { createClient } from "@supabase/supabase-js";
import type { Db } from "../lib/data/db";
import type { Database } from "../lib/supabase/database.types";
import { fetchPredictionDetail, fetchPredictionList, fetchPredictionSummary, fetchFilterOptions } from "../lib/data/predictions";
import { fetchRecommendations, fetchRecommendationSummary, fetchRecommendationsFor, updateRecommendation } from "../lib/data/recommendations";
import { fetchModelMetrics, fetchRiskTrends, fetchSegmentMembers, fetchSegments } from "../lib/data/insights";
import { fetchWhatIfInputs, fetchWhatIfModel } from "../lib/data/whatif";
import { fetchCurrentUser } from "../lib/data/current-user";
import { rescore } from "../lib/whatif";
import { readEnv } from "./db/env";
import { E2E_PASSWORD } from "./db/e2e-accounts";
import { readFileSync } from "node:fs";
import path from "node:path";
import { root } from "./db/migrations";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`); if (!ok) failures++; };
const throws = async (fn: () => Promise<unknown>) => { try { await fn(); return null; } catch (e) { return e instanceof Error ? e.message : String(e); } };

async function login(email: string): Promise<Db> {
  const env = readEnv();
  const db = createClient<Database>(env.url, env.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error) throw new Error(`cannot sign in as ${email}: run \`npx tsx scripts/db/e2e-accounts.ts create\` first`);
  return db as Db;
}

async function main() {
  const index = JSON.parse(readFileSync(path.join(root, "data/students.index.json"), "utf8")) as { id: string; mentorId: string; branchCode: string; department: string }[];
  const mentees = index.filter((s) => s.mentorId === "FAC-CSE-3").map((s) => s.id);

  /* ------------------------------------------------------------------ admin */
  const admin = await login("e2e.admin@example.com");
  const me = await fetchCurrentUser(admin);
  check("admin: the profile says admin", me?.role === "admin");
  const all = await fetchPredictionList(admin, {}, 0, 25);
  check("admin: sees all 800 forecasts, 25 per page", all.count === 800 && all.rows.length === 25);
  check("admin: the default sort puts the highest risk first", all.rows.every((r, i) => i === 0 || r.risk_score <= all.rows[i - 1].risk_score));
  const page2 = await fetchPredictionList(admin, {}, 1, 25);
  check("admin: page 2 is different from page 1", page2.rows[0].student_id !== all.rows[0].student_id);
  const cse = await fetchPredictionList(admin, { branch: "CSE" }, 0, 100);
  check("admin: department filter returns only that department", cse.count > 200 && cse.rows.every((r) => r.branch_code === "CSE"), `${cse.count}`);
  const high = await fetchPredictionList(admin, { overall: "High" }, 0, 50);
  const summary = await fetchPredictionSummary(admin);
  check("admin: the High filter count equals the summary", high.count === summary.overall.High && high.count > 100, `${high.count}`);
  check("admin: summary totals add up", summary.total === 800 && summary.overall.Low + summary.overall.Medium + summary.overall.High === 800 && summary.by_department.length === 5 && summary.by_department.reduce((a, d) => a + d.total, 0) === 800);
  const byOutcome = await fetchPredictionList(admin, { outcome: { key: "backlog", level: "High" } }, 0, 10);
  check("admin: an outcome-level filter works", byOutcome.count === summary.outcomes.backlog.High && byOutcome.rows.every((r) => r.backlog_level === "High"));
  const found = await fetchPredictionList(admin, { search: "Naman Khan" }, 0, 10);
  check("admin: search by name finds the student", found.rows.some((r) => r.name === "Naman Khan"));
  const byId = await fetchPredictionList(admin, { search: "STU-0146" }, 0, 10);
  check("admin: search by id finds the student", byId.rows.length === 1 && byId.rows[0].student_id === "STU-0146");
  const weird = await fetchPredictionList(admin, { search: "a,b)%(" }, 0, 5);
  check("admin: punctuation in a search cannot break the query", weird.rows.length >= 0);
  const options = await fetchFilterOptions(admin);
  check("admin: filter menus list 5 departments and the sections", options.departments.length === 5 && options.sections.length >= 3 && options.mentors.length === 20);

  const detail = await fetchPredictionDetail(admin, "STU-0146");
  check("admin: the drill-down has forecast, facts, drivers and what-if inputs", detail.prediction.facts.cgpa > 0 && detail.prediction.backlog.drivers.length > 0 && detail.whatIf !== null && detail.summary.name.length > 0);
  check("admin: the drill-down lists that student's recommendations", detail.recommendations.length === 3 && detail.recommendations.every((r) => r.targetId === "STU-0146"));
  const { model } = await fetchWhatIfModel(admin);
  const base = rescore(model, detail.whatIf!);
  check("admin: the what-if model reproduces the stored forecast within 0.05", Math.abs(base.backlog.probability - detail.prediction.backlog.p) < 0.05 && Math.abs(base.sgpa_below_6.probability - detail.prediction.sgpa_below_6.p) < 0.05, `backlog ${base.backlog.probability.toFixed(3)} vs ${detail.prediction.backlog.p}`);
  const better = rescore(model, detail.whatIf!, { att_last_sem: 95 });
  check("admin: raising attendance never raises the backlog risk", better.backlog.probability <= base.backlog.probability + 1e-9);

  const recs = await fetchRecommendations(admin, {}, 0, 25);
  check("admin: sees all 1,027 recommendations, highest priority first", recs.count === 1027 && recs.rows.every((r, i) => i === 0 || r.priorityScore <= recs.rows[i - 1].priorityScore));
  const crit = await fetchRecommendations(admin, { priority: "Critical" }, 0, 10);
  check("admin: priority filter", crit.count > 0 && crit.rows.every((r) => r.priority === "Critical"));
  const owner = await fetchRecommendations(admin, { owner: "Training & Placement cell" }, 0, 10);
  check("admin: owner filter", owner.count > 100 && owner.rows.every((r) => r.owner === "Training & Placement cell"));
  const seg = await fetchRecommendations(admin, { segment: "falling_attendance_engagement" }, 0, 20);
  check("admin: a segment filter returns the segment item and its department items", seg.count >= 1 && seg.rows.every((r) => r.targetType === "segment" && r.targetId.startsWith("falling_attendance_engagement")), `${seg.count}`);
  const dept = await fetchRecommendations(admin, { department: "Computer Science", targetType: "student" }, 0, 10);
  check("admin: department filter", dept.count > 100 && dept.rows.every((r) => r.department === "Computer Science"));
  const recSummary = await fetchRecommendationSummary(admin);
  check("admin: recommendation summary matches", recSummary.total === 1027 && Object.values(recSummary.by_priority).reduce((a, b) => a + (b ?? 0), 0) === 1027);

  const trends = await fetchRiskTrends(admin);
  check("admin: risk trends cover semesters 2-5, all departments", trends.cutoffs.join() === "2,3,4,5" && Object.keys(trends.by_department).length === 5 && trends.institution.backlog.length === 4);
  const metrics = await fetchModelMetrics(admin);
  check("admin: model report has four outcomes with baselines and caveats", Object.keys(metrics.targets).length === 4 && metrics.caveats.length > 0 && metrics.targets.backlog.baselines.success_score.roc_auc > 0);
  const segments = await fetchSegments(admin);
  const members = await fetchSegmentMembers(admin, segments[0].id, 0, 10);
  check("admin: six segments, and members come with their forecast rows", segments.length === 6 && members.rows.length > 0 && members.count === segments[0].count);

  /* ------------------------------------------------------------------ faculty (FAC-CSE-3) */
  const fac = await login("e2e.faculty@example.com");
  const fMe = await fetchCurrentUser(fac);
  check("faculty: the profile says faculty with their id", fMe?.role === "faculty" && fMe.facultyId === "FAC-CSE-3");
  const fList = await fetchPredictionList(fac, {}, 0, 100);
  check("faculty: sees exactly their mentees", fList.count === mentees.length && fList.rows.every((r) => r.mentor_id === "FAC-CSE-3"), `${fList.count} of ${mentees.length}`);
  const fSummary = await fetchPredictionSummary(fac);
  check("faculty: the summary counts only their mentees", fSummary.total === mentees.length);
  check("faculty: another department's summary is empty", (await fetchPredictionSummary(fac, { branch: "MECH" })).total === 0);
  check("faculty: cannot open a student they do not mentor", (await throws(() => fetchPredictionDetail(fac, "STU-0001"))) !== null);
  const fRecs = await fetchRecommendations(fac, {}, 0, 500);
  check("faculty: recommendations are their mentees' plus segment ones", fRecs.rows.every((r) => r.targetType === "segment" || mentees.includes(r.targetId)) && fRecs.rows.some((r) => r.targetType === "segment"), `${fRecs.count}`);
  const fOpts = await fetchFilterOptions(fac);
  check("faculty: filter menus list only their own department and mentor id", fOpts.mentors.length === 1 && fOpts.departments.length === 1);

  /* ------------------------------------------------------------------ persistence and permissions of status changes */
  const target = detail.recommendations[0];
  const changed = await updateRecommendation(fac, target.id, { status: "accepted", assignedTo: "Dr. Test Mentor" });
  check("faculty: can accept a mentee's recommendation and assign it", changed.status === "accepted" && changed.assignedTo === "Dr. Test Mentor");
  const seenByAdmin = (await fetchRecommendationsFor(admin, "STU-0146")).find((r) => r.id === target.id)!;
  check("admin: sees the faculty member's change (persisted)", seenByAdmin.status === "accepted" && seenByAdmin.assignedTo === "Dr. Test Mentor");
  const others = await fetchRecommendations(admin, { targetType: "student", department: "Computer Science" }, 0, 200);
  const otherRec = others.rows.find((r) => !mentees.includes(r.targetId));
  check("faculty: cannot change another mentor's recommendation", otherRec !== undefined && (await throws(() => updateRecommendation(fac, otherRec.id, { status: "done" }))) !== null);
  check("faculty: that recommendation is still untouched", otherRec !== undefined && (await fetchRecommendationsFor(admin, otherRec.targetId)).find((r) => r.id === otherRec.id)?.status === "open");
  const tamper = await fac.from("recommendations").update({ action: "tampered" }).eq("id", target.id).select("id");
  check("faculty: cannot rewrite what a recommendation says", tamper.error !== null || (tamper.data ?? []).length === 0);

  /* ------------------------------------------------------------------ student STU-0146 */
  const stu = await login("e2e.student0146@example.com");
  const sMe = await fetchCurrentUser(stu);
  check("student: the profile says student STU-0146, with their mentor named", sMe?.role === "student" && sMe.studentId === "STU-0146" && sMe.mentor?.id === "FAC-CSE-3" && sMe.mentor.name.length > 3, sMe?.mentor?.name);
  const sList = await fetchPredictionList(stu, {}, 0, 25);
  check("student: exactly one forecast, their own", sList.count === 1 && sList.rows[0].student_id === "STU-0146");
  const sDetail = await fetchPredictionDetail(stu, "STU-0146");
  check("student: can open their own forecast, drivers and what-if inputs", sDetail.prediction.backlog.drivers.length > 0 && sDetail.whatIf !== null);
  check("student: cannot open another student's forecast", (await throws(() => fetchPredictionDetail(stu, "STU-0230"))) !== null);
  check("student: cannot read another student's what-if inputs", (await throws(() => fetchWhatIfInputs(stu, "STU-0230"))) !== null);
  const sRecs = await fetchRecommendations(stu, {}, 0, 50);
  check("student: sees only their own recommendations", sRecs.count === 3 && sRecs.rows.every((r) => r.targetId === "STU-0146"), `${sRecs.count}`);
  check("student: sees the faculty member's change on their own recommendation", sRecs.rows.find((r) => r.id === target.id)?.status === "accepted");
  check("student: cannot change a recommendation", (await throws(() => updateRecommendation(stu, target.id, { status: "done" }))) !== null);
  check("student: can read the model report and the what-if model", (await fetchModelMetrics(stu)).caveats.length > 0 && (await fetchWhatIfModel(stu)).model.editable.length === 5);
  check("student: cannot read risk trends", (await throws(() => fetchRiskTrends(stu))) !== null);
  check("student: sees no segments", (await fetchSegments(stu)).length === 0);
  check("student: the summary counts only themselves", (await fetchPredictionSummary(stu)).total === 1);

  /* ------------------------------------------------------------------ put it back */
  const restored = await updateRecommendation(admin, target.id, { status: "open", assignedTo: null });
  check("cleanup: the recommendation is open and unassigned again", restored.status === "open" && restored.assignedTo === null);

  console.log(failures ? `\n${failures} E2E CHECKS FAILED` : "\nALL E2E CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(String(e instanceof Error ? e.message : e).replace(/:[^:@\s]*@/, ":***@")); process.exit(1); });
