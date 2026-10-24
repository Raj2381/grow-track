"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import type { OutcomeKey, Owner, Priority, RecStatus, RiskLevel } from "@/lib/ml-types";

/* Colours are the ones the dashboard already uses for risk badges and cards. */
export const LEVEL_STYLE: Record<RiskLevel, { badge: string; dot: string; bar: string; text: string }> = {
  High: { badge: "bg-[#f9e9e7] text-[#a33f38]", dot: "bg-[#bf5a52]", bar: "bg-[#d4665e]", text: "text-[#a33f38]" },
  Medium: { badge: "bg-[#fbf1dc] text-[#946417]", dot: "bg-[#c18a2c]", bar: "bg-[#dfa943]", text: "text-[#946417]" },
  Low: { badge: "bg-[#e8f1eb] text-[#28654d]", dot: "bg-[#4c9169]", bar: "bg-[#4b8b65]", text: "text-[#28654d]" },
};
export const LEVELS: RiskLevel[] = ["High", "Medium", "Low"];

export const OUTCOME_META: Record<OutcomeKey, { label: string; short: string; meaning: string }> = {
  sgpa_below_6: { label: "Semester performance", short: "SGPA", meaning: "Expected SGPA next semester, and the chance of falling below 6.0" },
  backlog: { label: "Backlog risk", short: "Backlog", meaning: "Chance of a new backlog, or of not clearing an existing one" },
  placement: { label: "Placement readiness", short: "Placement", meaning: "Chance of NOT being placement-ready before the season" },
  engagement: { label: "Engagement drop", short: "Engagement", meaning: "Chance of a significant fall in attendance or LMS activity" },
};
export const OUTCOME_ORDER: OutcomeKey[] = ["sgpa_below_6", "backlog", "placement", "engagement"];

/**
 * A probability for people. Calibration can output exactly 0 or 1 at the extremes, which would read as certainty, so the
 * ends are shown as ">99%" and "<1%" (a forecast is never a guarantee).
 */
export const pct = (p: number | null | undefined, digits = 0) => {
  if (p === null || p === undefined) return "-";
  if (digits === 0 && p > 0.995) return ">99%";
  if (digits === 0 && p < 0.005) return "<1%";
  return `${(p * 100).toFixed(digits)}%`;
};

/** Supportive wording for students: a level is a signal to act on, never a label for a person. */
export const STUDENT_LEVEL_LABEL: Record<RiskLevel, string> = { Low: "Low", Medium: "Watch", High: "High" };

export function LevelBadge({ level, suffix = "risk", label }: { level: RiskLevel; suffix?: string; label?: string }) {
  const s = LEVEL_STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {label ?? level}
      {!label && suffix ? ` ${suffix}` : ""}
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  Critical: "bg-[#f4dedb] text-[#8f2f29]",
  High: "bg-[#f9e9e7] text-[#a33f38]",
  Medium: "bg-[#fbf1dc] text-[#946417]",
  Low: "bg-[#eef0ec] text-[#59665c]",
};
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold ${PRIORITY_STYLE[priority]}`}>{priority}</span>;
}

const STATUS_STYLE: Record<RecStatus, string> = {
  open: "bg-[#eef0ec] text-[#59665c]",
  accepted: "bg-[#e3edf8] text-[#2c5f94]",
  done: "bg-[#e8f1eb] text-[#28654d]",
  dismissed: "bg-[#f1ecec] text-[#7a6866]",
};
export const STATUS_LABEL: Record<RecStatus, string> = { open: "Open", accepted: "Accepted", done: "Done", dismissed: "Dismissed" };
export function StatusBadge({ status }: { status: RecStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export const OWNER_SHORT: Record<Owner, string> = {
  "Faculty mentor": "Mentor",
  "Training & Placement cell": "T&P cell",
  Counsellor: "Counsellor",
  "Dean / Administrator": "Dean",
  "Department head": "Dept head",
};

/** A probability as a thin bar plus a number (colour is never the only signal: the number and the badge say it too). */
export function ProbabilityBar({ value, level, width = "w-24" }: { value: number; level: RiskLevel; width?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-10 text-[11px] font-semibold tabular-nums text-[#344037]">{pct(value)}</span>
      <div className={`h-[5px] ${width} overflow-hidden rounded bg-[#edf0eb]`} role="img" aria-label={`${pct(value)} chance, ${level} level`}>
        <div className={`h-full rounded ${LEVEL_STYLE[level].bar}`} style={{ width: `${Math.max(2, Math.round(value * 100))}%` }} />
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[12px] font-bold tracking-[1.8px] text-[#2f6a4f]">{eyebrow}</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.8px] text-[#1f2c24]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-[15px] leading-6 text-[#4b564e]">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, subtitle, actions, children, className = "" }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-[#e2e7df] bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf0eb] px-5 py-4">
          <div>
            {title && <h2 className="text-[16px] font-semibold text-[#1f2c24]">{title}</h2>}
            {subtitle && <p className="mt-1.5 text-[13px] text-[#4b564e]">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({ title, value, note, icon: Icon, tone = "green" }: { title: string; value: string; note?: string; icon: LucideIcon; tone?: "green" | "red" | "amber" }) {
  const box = tone === "red" ? "bg-[#f9e9e7] text-[#a33f38]" : tone === "amber" ? "bg-[#fbf1dc] text-[#946417]" : "bg-[#edf4ef] text-[#28684e]";
  return (
    <section className="rounded-md border border-[#e2e7df] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-medium text-[#4b564e]">{title}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${box}`}>
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-[34px] font-semibold tracking-[-1px] text-[#1f2c24]">{value}</p>
      {note && <p className="mt-2 text-[12.5px] text-[#4b564e]">{note}</p>}
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#e9eee8] ${className}`} aria-hidden="true" />;
}

export function LoadingBlock({ rows = 5, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-[#f0d8d5] bg-[#fff6f5] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#a33f38]" aria-hidden="true" />
        <p className="text-[12px] leading-5 text-[#6f2f2a]">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-md border border-[#e3bfba] bg-white px-3 py-2 text-[11px] font-semibold text-[#8f2f29] hover:bg-[#fdf0ee]">
          <RefreshCw size={13} aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-[#dfe5dc] px-6 py-12 text-center">
      <Inbox size={22} className="text-[#819085]" aria-hidden="true" />
      <p className="text-[12px] font-medium text-[#46564a]">{title}</p>
      {hint && <p className="max-w-sm text-[11px] text-[#556057]">{hint}</p>}
    </div>
  );
}

/** One place that decides what to show for a query: skeleton, friendly error with retry, empty state, or the data. */
export function DataState<T>({ state, empty, skeletonRows, children }: {
  state: { data: T | undefined; error: string | null; loading: boolean; retry: () => void };
  empty?: { when: (data: T) => boolean; title: string; hint?: string };
  skeletonRows?: number;
  children: (data: T) => ReactNode;
}) {
  if (state.error && !state.data) return <ErrorBlock message={state.error} onRetry={state.retry} />;
  if (state.loading && !state.data) return <LoadingBlock rows={skeletonRows} />;
  if (state.data === undefined) return null;
  if (empty?.when(state.data)) return <EmptyBlock title={empty.title} hint={empty.hint} />;
  return (
    <>
      {state.error && <div className="mb-4"><ErrorBlock message={state.error} onRetry={state.retry} /></div>}
      {children(state.data)}
    </>
  );
}

export const SYNTHETIC_NOTE = "Forecasts are estimates for a mentor to review, never decisions.";
export function SyntheticNote({ className = "" }: { className?: string }) {
  return <p className={`text-[10px] text-[#556057] ${className}`}>{SYNTHETIC_NOTE}</p>;
}
