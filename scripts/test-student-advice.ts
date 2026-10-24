/** Student advice tests (every student, plus hand-built edge cases).  Run:  npm run test:advice */
import type { PredictionsFile, StudentPrediction } from "../lib/ml-types";
import { buildStudentAdvice, soundsBad, soundsGood } from "../lib/student-advice";
import { readJson } from "./ml-io";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
  if (!ok) failures++;
};

const file = readJson<PredictionsFile>("public/data/predictions.json");
const entries = Object.entries(file.students);
const advice = entries.map(([id, p]) => ({ id, p, a: buildStudentAdvice(p, "Dr. Rao") }));
const text = (a: ReturnType<typeof buildStudentAdvice>) =>
  [a.overall.message, a.support, ...a.outcomes.map((o) => o.message), ...a.strengths, ...a.plan.map((s) => s.text), ...a.targets.flatMap((t) => [t.now, t.goal]), ...a.focus.flatMap((f) => [f.evidence, f.why, ...f.steps])].join(" \n ");

check("advice is built for every student", advice.length === entries.length && entries.length > 700, `${advice.length} students`);
check("no text contains undefined, NaN, null or braces", advice.every(({ a }) => !/undefined|NaN|\bnull\b|[{}]/.test(text(a))));
check("same input gives the same advice (pure)", JSON.stringify(buildStudentAdvice(entries[0][1])) === JSON.stringify(buildStudentAdvice(entries[0][1])));
// the model's own sentences can quote a real score ("Best coding test score is 100%"); the advice we write never states a chance that way
const written = (a: ReturnType<typeof buildStudentAdvice>) => [a.overall.message, a.support, ...a.outcomes.map((o) => o.message), ...a.plan.map((s) => s.text), ...a.focus.flatMap((f) => [f.why, ...f.steps])].join(" \n ");
check("the advice we write never states 100% or 0% or uses judgemental words", advice.every(({ a }) => !/\b100%|\b0%|\b(fail(?:ing|ure)? you|hopeless|doomed|lazy|will fail|rejected)\b/i.test(written(a))));
check("every outcome has a plain label and a sentence", advice.every(({ a }) => a.outcomes.length === 4 && a.outcomes.every((o) => ["On track", "Worth watching", "Needs attention"].includes(o.label) && o.message.length > 20)));
check("the student-facing label never says High/Medium/Low risk", advice.every(({ a }) => !/\b(High|Medium|Low) risk\b/.test(text(a))));
check("a focus area never reads like good news and a strength never like bad news", advice.every(({ a }) => a.focus.every((f) => !soundsGood(f.evidence)) && a.strengths.every((s) => !soundsBad(s))));
check("focus areas are distinct families, at most 3", advice.every(({ a }) => a.focus.length <= 3 && new Set(a.focus.map((f) => f.family)).size === a.focus.length));
check("every strength reads as good news", advice.every(({ a }) => a.strengths.every((x) => soundsGood(x))) && advice.some(({ a }) => a.strengths.length > 0));
check("every focus area quotes the student's own record and has at least one step", advice.every(({ a }) => a.focus.every((f) => f.evidence.trim().length > 8 && f.steps.length > 0)));

const highs = advice.filter(({ p }) => (["sgpa_below_6", "backlog", "placement", "engagement"] as const).some((k) => p[k].level === "High"));
check("a student with any High outcome gets a plan and is told to talk to the mentor", highs.every(({ a }) => a.plan.length > 0 && /mentor/i.test(a.support) && /this week/i.test(a.support)), `${highs.length} students`);
const noneHigh = advice.filter(({ p }) => !(["sgpa_below_6", "backlog", "placement", "engagement"] as const).some((k) => p[k].level === "High"));
check("a student with no High outcome is not told it is urgent", noneHigh.every(({ a }) => !/this week/i.test(a.support)));
const lows = advice.filter(({ p }) => p.overall === "Low");
check("an On track student hears encouragement", lows.length > 0 && lows.every(({ a }) => a.overall.label === "On track" && /on track/i.test(a.overall.message)), `${lows.length} students`);
check("plan steps come in this-week, this-month, this-semester order", advice.every(({ a }) => {
  const order = ["This week", "This month", "This semester"];
  return a.plan.every((s, i) => i === 0 || order.indexOf(a.plan[i - 1].when) <= order.indexOf(s.when));
}));
check("no duplicate plan steps", advice.every(({ a }) => new Set(a.plan.map((s) => s.text)).size === a.plan.length));
check("attendance target appears exactly when attendance is below 75", advice.every(({ p, a }) => a.targets.some((t) => t.label === "Attendance") === (p.facts.att < 75)));
check("the mentor's name is used when given and absent otherwise", advice.every(({ a }) => a.support.includes("Dr. Rao")) && advice.slice(0, 20).every(({ p }) => !buildStudentAdvice(p).support.includes("undefined")));

// hand-built edge cases
const base = entries[0][1];
const blank = (level: "Low" | "Medium" | "High"): StudentPrediction => ({
  ...base,
  overall: level,
  sgpa_below_6: { p: 0.5, level, drivers: [], pred: 6.2, lo: 5.5, hi: 6.9 },
  backlog: { p: 0.5, level, drivers: [] },
  placement: { p: 0.5, level, drivers: [], p_ready: 0.5 },
  engagement: { p: 0.5, level, drivers: [] },
});
const empty = buildStudentAdvice(blank("High"));
check("a High student with no drivers still gets a calm message and a mentor prompt", empty.focus.length === 0 && empty.strengths.length === 0 && empty.support.includes("mentor") && empty.overall.message.length > 20);
const misleading = blank("High");
misleading.sgpa_below_6.drivers = [{ f: "Attendance trend", k: "x", t: "Attendance improved toward the end of the semester (last two months 89% against a 83% average)", c: 0.4 }, { f: "Attendance level", k: "y", t: "Attendance in semester 5 was 57%", c: 0.3 }];
const m = buildStudentAdvice(misleading);
check("an improving-sounding driver that raises risk is not shown as a problem", m.focus.length === 1 && m.focus[0].family === "Attendance level");
check("soundsGood / soundsBad on typical sentences", soundsGood("Attendance improved by 5 points") && soundsBad("Attendance fell 8 points since last semester (87% to 79%)") && !soundsGood("Attendance fell, then improved") && !soundsBad("Passed every subject in semester 5"));

console.log(failures === 0 ? "\nAll student-advice tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
