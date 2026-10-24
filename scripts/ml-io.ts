/** File helpers shared by the recommendation scripts. */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PredictionsFile, SegmentsFile } from "../lib/ml-types";
import type { OpenIntervention, StudentInfo } from "../lib/recommendations";

export const root = path.resolve(__dirname, "..");
export const readJson = <T,>(file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8")) as T;

/** Minimal RFC-4180 CSV reader (quoted cells, doubled quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

export function loadInputs() {
  const predictions = readJson<PredictionsFile>("public/data/predictions.json");
  const segments = readJson<SegmentsFile>("public/data/segments.json");
  const index = readJson<{ id: string; name: string; department: string; mentorId: string }[]>("data/students.index.json");
  const info: Record<string, StudentInfo> = Object.fromEntries(index.map((s) => [s.id, { id: s.id, name: s.name, department: s.department, mentorId: s.mentorId }]));
  // semester-5 plans that are still open (Planned / In Progress); earlier plans are history
  const open: Record<string, OpenIntervention> = {};
  for (const r of parseCsv(readFileSync(path.join(root, "data/csv/interventions.csv"), "utf8"))) {
    if (r.semester !== "5" || !["Planned", "In Progress"].includes(r.status)) continue;
    open[r.student_id] = { id: r.intervention_id, priority: r.priority, status: r.status, actionPlan: r.action_plan, reason: r.reason };
  }
  return { predictions, segments, info, open };
}
