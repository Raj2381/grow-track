/**
 * Runs the whole Round 2 pipeline in order.
 *
 *   npm run ml:all               features -> baseline gate -> leakage tests -> train -> explain -> predict -> segments
 *                                -> recommendations -> every test
 *   npm run ml:all -- --check    runs the pipeline twice and fails if any output file differs between the runs
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(__dirname, "..");
type Step = { name: string; cmd: string[] };

const PIPELINE: Step[] = [
  { name: "features", cmd: ["python3", "ml/features.py"] },
  { name: "baseline gate", cmd: ["python3", "ml/check_baseline.py"] },
  { name: "leakage tests", cmd: ["python3", "ml/test_leakage.py"] },
  { name: "train + evaluate", cmd: ["python3", "ml/train.py"] },
  { name: "explain", cmd: ["python3", "ml/explain.py"] },
  { name: "predict + trends + what-if", cmd: ["python3", "ml/predict.py"] },
  { name: "segments", cmd: ["python3", "ml/segments.py"] },
  { name: "recommendations", cmd: ["npx", "tsx", "scripts/build-recommendations.ts"] },
];
const TESTS: Step[] = [
  { name: "ml tests", cmd: ["python3", "ml/test_ml.py"] },
  { name: "what-if parity", cmd: ["npx", "tsx", "scripts/test-whatif.ts"] },
  { name: "recommendation tests", cmd: ["npx", "tsx", "scripts/test-recommendations.ts"] },
];
const OUTPUTS = [
  "ml/out/features.csv", "ml/out/cleaning_report.json", "ml/out/feature_columns.json", "ml/out/drivers_n5.json", "ml/out/whatif_parity.json",
  "ml/FEATURES.md", "public/data/model-metrics.json", "public/data/predictions.json", "public/data/risk-trends.json", "public/data/segments.json",
  "public/data/whatif-model.json", "public/data/whatif-inputs.json", "public/data/recommendations.json", "data/predictions.index.json",
];

function run(step: Step, quiet: boolean): boolean {
  const started = Date.now();
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), { cwd: root, stdio: quiet ? "pipe" : "inherit", encoding: "utf8" });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const ok = result.status === 0;
  console.log(`${ok ? "ok  " : "FAIL"} ${step.name} (${seconds}s)`);
  if (!ok && quiet) console.log(`${result.stdout ?? ""}${result.stderr ?? ""}`.split("\n").slice(-25).join("\n"));
  return ok;
}

const hashes = () => Object.fromEntries(OUTPUTS.map((f) => [f, createHash("sha256").update(readFileSync(path.join(root, f))).digest("hex")]));

function runPipeline(quiet: boolean, steps: Step[] = PIPELINE): boolean {
  for (const step of steps) if (!run(step, quiet)) return false;
  return true;
}

const started = Date.now();
if (process.argv.includes("--check")) {
  console.log("determinism check: running the pipeline twice\n--- run 1");
  if (!runPipeline(true)) process.exit(1);
  const first = hashes();
  console.log("--- run 2");
  if (!runPipeline(true)) process.exit(1);
  const second = hashes();
  const differing = OUTPUTS.filter((f) => first[f] !== second[f]);
  for (const f of OUTPUTS) console.log(`${first[f] === second[f] ? "same" : "DIFF"} ${first[f].slice(0, 12)} ${f}`);
  console.log(differing.length ? `\nNOT deterministic: ${differing.join(", ")}` : `\ndeterministic: all ${OUTPUTS.length} output files are byte-identical across two runs`);
  console.log(`total ${((Date.now() - started) / 60000).toFixed(1)} min`);
  process.exit(differing.length ? 1 : 0);
}

const ok = runPipeline(false) && runPipeline(false, TESTS);
console.log(`\n${ok ? "pipeline and tests passed" : "pipeline FAILED"} in ${((Date.now() - started) / 60000).toFixed(1)} min`);
process.exit(ok ? 0 : 1);
