"use client";

import { Gauge, ShieldCheck, TrendingDown, Waves } from "lucide-react";
import type { OutcomeKey, OutcomePrediction } from "@/lib/ml-types";
import { LEVEL_STYLE, LevelBadge, OUTCOME_META, STUDENT_LEVEL_LABEL, pct } from "./ui";

const ICON = { sgpa_below_6: Gauge, backlog: ShieldCheck, placement: TrendingDown, engagement: Waves } as const;

/** The forecast for one outcome. tone="staff" speaks of risk; tone="student" is supportive and says what the number means. */
export function OutcomeCard({ outcome, pred, tone = "staff", note }: { outcome: OutcomeKey; pred: OutcomePrediction; tone?: "staff" | "student"; note?: string }) {
  const meta = OUTCOME_META[outcome];
  const Icon = ICON[outcome];
  const student = tone === "student";
  const ready = outcome === "placement";
  const headline = student && ready ? pred.p_ready ?? 1 - pred.p : pred.p;
  const headlineLabel = student ? (ready ? "chance of being ready" : outcome === "sgpa_below_6" ? "chance of an SGPA below 6" : "chance") : "chance";
  const gaugeValue = student && ready ? 1 - (pred.p_ready ?? 1 - pred.p) : pred.p;       // the bar always shows the RISK, so its colour matches the badge
  const sentence = student ? studentSentence(outcome, pred) : meta.meaning;

  return (
    <section className="rounded-md border border-[#e2e7df] bg-white p-4" aria-label={meta.label}>
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#edf4ef] text-[#28684e]"><Icon size={16} aria-hidden="true" /></span>
          <h3 className="text-[14.5px] font-semibold text-[#252f28]">{meta.label}</h3>
        </div>
        <LevelBadge level={pred.level} label={student ? STUDENT_LEVEL_LABEL[pred.level] : undefined} />
      </div>
      {outcome === "sgpa_below_6" && pred.pred !== undefined ? (
        <div className="mt-3">
          <p className="text-[26px] font-semibold tracking-[-0.8px] text-[#252f28]">{pred.pred.toFixed(1)}<span className="ml-1.5 text-[14px] font-normal tracking-normal text-[#556057]">expected SGPA</span></p>
          <p className="text-[13px] text-[#556057]">likely range {pred.lo?.toFixed(1)} to {pred.hi?.toFixed(1)} · band {pred.band}</p>
        </div>
      ) : (
        <p className="mt-3 text-[26px] font-semibold tracking-[-0.8px] text-[#252f28]">{pct(headline)}<span className="ml-1.5 text-[14px] font-normal tracking-normal text-[#556057]">{headlineLabel}</span></p>
      )}
      <div className="mt-2.5 h-[6px] overflow-hidden rounded bg-[#edf0eb]" role="img" aria-label={`${pct(gaugeValue)} risk, ${pred.level} level`}>
        <div className={`h-full rounded ${LEVEL_STYLE[pred.level].bar}`} style={{ width: `${Math.max(2, Math.round(gaugeValue * 100))}%` }} />
      </div>
      <p className="mt-2.5 text-[14px] leading-5 text-[#4b564e]">{sentence}</p>
      {outcome === "sgpa_below_6" && <p className="mt-1 text-[14px] text-[#4b564e]">{student ? `There is a ${pct(pred.p)} chance it falls below 6.` : `Chance of an SGPA below 6.0: ${pct(pred.p)}.`}</p>}
      {note && <p className="mt-2 rounded bg-[#fbf1dc] px-2.5 py-1.5 text-[13px] leading-4 text-[#7a5410]">{note}</p>}
    </section>
  );
}

function studentSentence(outcome: OutcomeKey, p: OutcomePrediction): string {
  switch (outcome) {
    case "sgpa_below_6": return `We expect your SGPA next semester to be about ${p.pred?.toFixed(1)}, most likely between ${p.lo?.toFixed(1)} and ${p.hi?.toFixed(1)}.`;
    case "backlog": return "How likely it is that you get a new backlog, or do not clear one you already have.";
    case "placement": return "How likely it is that your aptitude, coding and mock-interview scores all reach 60 before the placement season.";
    case "engagement": return "How likely it is that your attendance or LMS activity dips noticeably in the coming weeks.";
  }
}
