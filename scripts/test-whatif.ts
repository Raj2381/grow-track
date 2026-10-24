/** Proves lib/whatif.ts matches the Python models.  Run:  npx tsx scripts/test-whatif.ts */
import { readFileSync } from "node:fs";
import path from "node:path";
import { rescore, toFeatureMap, type WhatIfInputs, type WhatIfModel } from "../lib/whatif";
import { OUTCOME_KEYS } from "../lib/ml-types";

const root = path.resolve(__dirname, "..");
const read = <T,>(file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8")) as T;
const model = read<WhatIfModel>("public/data/whatif-model.json");
const inputs = read<WhatIfInputs>("public/data/whatif-inputs.json");
const parity = read<Record<string, Record<string, number>>>("ml/out/whatif_parity.json");

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
  if (!ok) failures++;
};

// 1. no edits == Python probabilities, within 0.005
let worst = 0;
for (const [id, expected] of Object.entries(parity)) {
  const result = rescore(model, toFeatureMap(inputs, id));
  for (const key of OUTCOME_KEYS) worst = Math.max(worst, Math.abs(result[key].probability - expected[key]));
}
check(`50 students x 4 outcomes match Python without edits`, worst <= 0.005, `max |diff| = ${worst.toExponential(2)}`);

// 2. editing moves risk in the sensible direction for (nearly) everyone
const ids = Object.keys(inputs.students);
const direction = (edit: Record<string, number>, outcome: (typeof OUTCOME_KEYS)[number], sign: 1 | -1, absolute: boolean) => {
  let ok = 0;
  let total = 0;
  for (const id of ids) {
    const student = toFeatureMap(inputs, id);
    const before = rescore(model, student)[outcome].probability;
    const edits = Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, absolute ? v : Number(student.values[k]) + v]));
    const after = rescore(model, student, edits)[outcome].probability;
    total++;
    if ((after - before) * sign >= -1e-9) ok++;
  }
  return ok / total;
};
const shareAttendance = direction({ att_last_sem: 10 }, "backlog", -1, false);
check("+10 attendance points does not raise backlog risk for >= 95% of students", shareAttendance >= 0.95, `${(shareAttendance * 100).toFixed(1)}%`);
const shareInterview = direction({ interview_best: 75 }, "placement", -1, true);
check("a 75-point mock interview does not raise NOT-ready probability for >= 90% of students", shareInterview >= 0.9, `${(shareInterview * 100).toFixed(1)}%`);
const shareCoding = direction({ coding_best: 80 }, "placement", -1, true);
check("an 80-point coding score does not raise NOT-ready probability for >= 90% of students", shareCoding >= 0.9, `${(shareCoding * 100).toFixed(1)}%`);

// 3. an edit that sets the value it already has changes nothing
const sample = toFeatureMap(inputs, ids[0]);
const same = rescore(model, sample, { att_last_sem: Number(sample.values.att_last_sem) });
const base = rescore(model, sample);
check("setting an input to its current value changes nothing", OUTCOME_KEYS.every((k) => Math.abs(same[k].probability - base[k].probability) < 1e-9));

// 4. bounds are enforced
const clamped = rescore(model, sample, { att_last_sem: 500 });
const atMax = rescore(model, sample, { att_last_sem: 100 });
check("values above the slider maximum are clamped", OUTCOME_KEYS.every((k) => Math.abs(clamped[k].probability - atMax[k].probability) < 1e-9));

console.log(failures ? `\n${failures} FAILED` : "\nALL WHAT-IF TESTS PASSED");
process.exit(failures ? 1 : 0);
