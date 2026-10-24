/**
 * What-if scoring in the browser (or Node). Re-scores a student with the same logistic models, scalers and calibration
 * maps that ml/predict.py exports to public/data/whatif-model.json. With no edits it reproduces the Python
 * probabilities (scripts/test-whatif.ts proves it to within 0.005).
 *
 * An edit also moves the features that are computed from the edited one (see `dependents` in the model file), for
 * example attendance changes the attendance trend and the Round 1 score; everything else is held fixed.
 */
import type { OutcomeKey, RiskLevel } from "./ml-types";

export type Calibration =
  | { type: "isotonic"; x: number[]; y: number[] }
  | { type: "sigmoid"; a: number; b: number };

export type NumericTerm = { name: string; median: number; mean: number; scale: number; coef: number };
export type CategoricalTerm = { name: string; levels: Record<string, number> };

export type WhatIfTarget = {
  label: string;
  probability_is: string;
  intercept: number;
  numeric: NumericTerm[];
  categorical: CategoricalTerm[];
  calibration: Calibration;
  thresholds: { screen: number; high: number };
};

export type Dependent =
  | { feature: string; mode: "delta"; factor: number }
  | { feature: string; mode: "at_least"; value: number }
  | { feature: string; mode: "relative_to_prev"; aux: string };

export type EditableInput = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  dependents: Dependent[];
  derive?: string[];
};

export type WhatIfModel = {
  editable: EditableInput[];
  round1_rule: {
    high: { cgpa_below: number; backlogs_at_least: number; attendance_below: number };
    medium: { cgpa_below: number; backlogs_equal: number; attendance_below: number };
  };
  targets: Record<OutcomeKey, WhatIfTarget>;
};

export type WhatIfInputs = {
  numeric: string[];
  categorical: string[];
  students: Record<string, { n: number[]; c: string[]; aux: Record<string, number> }>;
};

export type StudentFeatureMap = { values: Record<string, number | string>; aux: Record<string, number> };

export type WhatIfResult = Record<OutcomeKey, { probability: number; level: RiskLevel }>;

const RANGE_100 = (name: string) => name.endsWith("_pct") || name === "success_score_proxy" || name === "engagement_index_recent" || name.startsWith("att_last");

export function toFeatureMap(inputs: WhatIfInputs, studentId: string): StudentFeatureMap {
  const row = inputs.students[studentId];
  if (!row) throw new Error(`Unknown student ${studentId}`);
  const values: Record<string, number | string> = {};
  inputs.numeric.forEach((name, i) => (values[name] = row.n[i]));
  inputs.categorical.forEach((name, i) => (values[name] = row.c[i]));
  return { values, aux: row.aux };
}

function round1Flag(model: WhatIfModel, v: Record<string, number | string>): string {
  const { high, medium } = model.round1_rule;
  const cgpa = Number(v.cgpa_at_n);
  const backlogs = Number(v.active_backlogs_at_n);
  const attendance = Number(v.att_last_sem);
  if (cgpa < high.cgpa_below || backlogs >= high.backlogs_at_least || attendance < high.attendance_below) return "High";
  if (cgpa < medium.cgpa_below || backlogs === medium.backlogs_equal || attendance < medium.attendance_below) return "Medium";
  return "Low";
}

/** Applies edits (feature key -> new value) together with their dependents. Returns a new feature map. */
export function applyEdits(model: WhatIfModel, student: StudentFeatureMap, edits: Record<string, number>): StudentFeatureMap {
  const values = { ...student.values };
  for (const spec of model.editable) {
    if (!(spec.key in edits)) continue;
    const next = Math.min(spec.max, Math.max(spec.min, edits[spec.key]));
    const previous = Number(values[spec.key]);
    const delta = next - previous;
    values[spec.key] = next;
    for (const dep of spec.dependents) {
      if (!(dep.feature in values)) continue;
      if (dep.mode === "delta") {
        const moved = Number(values[dep.feature]) + dep.factor * delta;
        values[dep.feature] = RANGE_100(dep.feature) ? Math.min(100, Math.max(0, moved)) : moved;
      } else if (dep.mode === "at_least") {
        values[dep.feature] = Math.max(Number(values[dep.feature]), dep.value);
      } else {
        const prev = student.aux[dep.aux] ?? 0;
        values[dep.feature] = (next - prev) / Math.max(prev, 1);
      }
    }
    if (spec.derive?.includes("round1_risk_flag") && "round1_risk_flag" in values) values.round1_risk_flag = round1Flag(model, values);
  }
  return { values, aux: student.aux };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function interpolate(x: number[], y: number[], at: number): number {
  if (at <= x[0]) return y[0];
  if (at >= x[x.length - 1]) return y[y.length - 1];
  let lo = 0;
  let hi = x.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x[mid] <= at) lo = mid;
    else hi = mid;
  }
  const t = (at - x[lo]) / (x[hi] - x[lo]);
  return y[lo] + t * (y[hi] - y[lo]);
}

export function calibrate(calibration: Calibration, raw: number): number {
  if (calibration.type === "isotonic") return interpolate(calibration.x, calibration.y, raw);
  const clipped = Math.min(1 - 1e-6, Math.max(1e-6, raw));
  return sigmoid(calibration.a * Math.log(clipped / (1 - clipped)) + calibration.b);
}

export function levelOf(p: number, thresholds: { screen: number; high: number }): RiskLevel {
  return p >= thresholds.high ? "High" : p >= thresholds.screen ? "Medium" : "Low";
}

export function scoreTarget(target: WhatIfTarget, values: Record<string, number | string>): number {
  let logit = target.intercept;
  for (const term of target.numeric) {
    const raw = values[term.name];
    const x = typeof raw === "number" && Number.isFinite(raw) ? raw : term.median;
    logit += ((x - term.mean) / term.scale) * term.coef;
  }
  for (const term of target.categorical) logit += term.levels[String(values[term.name])] ?? 0;
  return calibrate(target.calibration, sigmoid(logit));
}

/** Probability and level for each outcome after applying `edits` (none = the model's own forecast). */
export function rescore(model: WhatIfModel, student: StudentFeatureMap, edits: Record<string, number> = {}): WhatIfResult {
  const edited = applyEdits(model, student, edits);
  const out = {} as WhatIfResult;
  (Object.keys(model.targets) as OutcomeKey[]).forEach((key) => {
    const target = model.targets[key];
    const probability = scoreTarget(target, edited.values);
    out[key] = { probability, level: levelOf(probability, target.thresholds) };
  });
  return out;
}
