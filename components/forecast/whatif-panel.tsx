"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { OutcomeKey } from "@/lib/ml-types";
import { rescore, type StudentFeatureMap, type WhatIfModel } from "@/lib/whatif";
import { LevelBadge, OUTCOME_ORDER, pct } from "./ui";

/**
 * "Try it": move a few real inputs and see how the logistic forecast would change. An edit also moves the numbers computed
 * from it (for example attendance moves the attendance trend); everything else is held fixed. It is an estimate, not a promise.
 * view="risk" shows probabilities of the at-risk class (staff); view="friendly" shows the chance of a good outcome (students).
 */
/**
 * Engagement drop is deliberately NOT part of the what-if. That outcome measures a FALL from the recent level, so a student who
 * is already very engaged has the most room to fall: raising attendance would "raise" the forecast, which is true of the label
 * but misleading as advice. The other three outcomes respond in the direction people expect.
 */
export const WHATIF_OUTCOMES: OutcomeKey[] = ["sgpa_below_6", "backlog", "placement"];

export function WhatIfPanel({ model, student, view = "risk", onChange }: {
  model: WhatIfModel;
  student: StudentFeatureMap;
  view?: "risk" | "friendly";
  onChange?: (edits: Record<string, number>) => void;
}) {
  const [edits, setEdits] = useState<Record<string, number>>({});
  const before = useMemo(() => rescore(model, student), [model, student]);
  const after = useMemo(() => rescore(model, student, edits), [model, student, edits]);
  const dirty = Object.keys(edits).length > 0;

  function set(key: string, value: number) {
    const next = { ...edits, [key]: value };
    setEdits(next);
    onChange?.(next);
  }
  function reset() {
    setEdits({});
    onChange?.({});
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {model.editable.map((spec) => {
          const current = Number(student.values[spec.key]);
          const value = edits[spec.key] ?? current;
          const id = `whatif-${spec.key}`;
          return (
            <div key={spec.key} className="rounded-md border border-[#edf0eb] bg-[#fbfcfa] p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={id} className="text-[14px] font-semibold text-[#3a473e]">{spec.label}</label>
                <span className="text-[14.5px] font-semibold tabular-nums text-[#28684e]" aria-live="polite">{Math.round(value)}</span>
              </div>
              <input
                id={id}
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={value}
                onChange={(e) => set(spec.key, Number(e.target.value))}
                aria-valuetext={`${Math.round(value)}`}
                className="mt-2 w-full accent-[#28684e]"
              />
              <p className="mt-1 text-[13px] text-[#556057]">Now {Math.round(current)}{value !== current ? ` · changed by ${value > current ? "+" : ""}${Math.round(value - current)}` : ""}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h4 className="text-[14px] font-semibold uppercase tracking-[0.8px] text-[#4b564e]">{dirty ? "With your changes" : "Current forecast"}</h4>
        <button type="button" onClick={reset} disabled={!dirty} className="inline-flex items-center gap-1.5 rounded-md border border-[#dfe5dc] px-2.5 py-1.5 text-[14px] font-medium text-[#47564b] hover:bg-[#f5f7f4] disabled:cursor-not-allowed disabled:opacity-50">
          <RotateCcw size={12} aria-hidden="true" /> Reset
        </button>
      </div>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {OUTCOME_ORDER.filter((k) => WHATIF_OUTCOMES.includes(k)).map((key) => <ResultRow key={key} outcome={key} before={before[key]} after={after[key]} dirty={dirty} view={view} />)}
      </ul>
      <p className="mt-3 text-[13px] leading-4 text-[#556057]">
        An estimate from a statistical model. It holds everything else fixed and is no guarantee. The engagement forecast is not shown here:
        it depends mostly on how engaged the student already is, so a what-if on it would mislead.
      </p>
    </div>
  );
}

/** Each row says exactly what its percentage is: [risk wording, friendly wording]. */
const RESULT_LABEL: Record<OutcomeKey, [string, string]> = {
  sgpa_below_6: ["Chance of an SGPA below 6", "Chance of an SGPA below 6"],
  backlog: ["Chance of a backlog", "Chance of a backlog"],
  placement: ["Chance of NOT being placement-ready", "Chance of being placement-ready"],
  engagement: ["Chance of an engagement drop", "Chance of an engagement drop"],
};

function ResultRow({ outcome, before, after, dirty, view }: { outcome: OutcomeKey; before: { probability: number; level: "Low" | "Medium" | "High" }; after: { probability: number; level: "Low" | "Medium" | "High" }; dirty: boolean; view: "risk" | "friendly" }) {
  const friendly = view === "friendly";
  const flip = outcome === "placement" && friendly;                       // show the chance of BEING ready
  const b = flip ? 1 - before.probability : before.probability;
  const a = flip ? 1 - after.probability : after.probability;
  const better = flip ? a > b + 0.0005 : a < b - 0.0005;
  const worse = flip ? a < b - 0.0005 : a > b + 0.0005;
  const label = RESULT_LABEL[outcome][flip ? 1 : 0];
  return (
    <li className="rounded-md border border-[#edf0eb] p-3">
      <p className="text-[14px] font-semibold text-[#3a473e]">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[16px] font-semibold tabular-nums text-[#252f28]">{pct(dirty ? a : b)}</span>
        {dirty && <span className="text-[13px] text-[#556057]">was {pct(b)}</span>}
        {dirty && (better || worse) && (
          <span className={`text-[13px] font-semibold ${better ? "text-[#28654d]" : "text-[#a33f38]"}`}>{better ? "better" : "worse"} by {Math.abs(Math.round((a - b) * 100))} points</span>
        )}
        {!friendly && <LevelBadge level={dirty ? after.level : before.level} />}
      </div>
    </li>
  );
}
