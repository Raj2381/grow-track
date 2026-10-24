"use client";

import { useState } from "react";
import { CalendarClock, Target, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { RecStatus, StoredRecommendation } from "@/lib/ml-types";
import { PriorityBadge, STATUS_LABEL, StatusBadge } from "./ui";


/** Long generated sentences become short scannable points: split at full stops and semicolons, keep the first few. */
export function toBullets(text: string, max = 3): string[] {
  return text
    .split(/(?<=[a-z0-9%)])\.\s+|;\s+/i)
    .map((t) => t.trim().replace(/\.$/, ""))
    .filter((t) => t.length > 2)
    .slice(0, max);
}

/** Bold the facts a reader scans for: numbers, percentages, risk levels and priorities. */
export function Highlight({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\b\d+(?:\.\d+)?%?|\bHigh\b|\bMedium\b|\bCritical\b|>99%|<1%)/g);
  return parts.map((part, i) => (i % 2 === 1 ? <b key={i} className="font-bold text-[#1f2c24]">{part}</b> : part));
}

const STATUSES: RecStatus[] = ["open", "accepted", "done", "dismissed"];

/**
 * One recommendation: who it is for, the action, why (with the driver), who owns it, how urgent, and the controls to move it
 * through open / accepted / done / dismissed and to assign it. The database decides who may change what; a refused change is
 * shown here as a plain message.
 */
export function RecommendationCard({ rec, canEdit, onUpdate, compact = false }: {
  rec: StoredRecommendation;
  canEdit: boolean;
  onUpdate: (patch: { status?: RecStatus; assignedTo?: string | null }) => Promise<void>;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assignee, setAssignee] = useState(rec.assignedTo ?? "");

  async function change(patch: { status?: RecStatus; assignedTo?: string | null }) {
    setBusy(true);
    setError("");
    try {
      await onUpdate(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change could not be saved.");
      setAssignee(rec.assignedTo ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`rounded-md border border-[#e2e7df] bg-white ${compact ? "p-4" : "p-5"} ${rec.status === "dismissed" ? "opacity-70" : ""}`} aria-label={`Recommendation for ${rec.targetLabel}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={rec.priority} />
          <StatusBadge status={rec.status} />
          <span className="rounded bg-[#eef0ec] px-2 py-1 text-[13px] font-semibold text-[#59665c]">{rec.owner}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-[#556057]">
          <CalendarClock size={12} aria-hidden="true" /> within {rec.dueInDays} days
        </span>
      </div>
      <p className="mt-3 text-[17px] font-bold leading-snug text-[#1f2c24]">{rec.targetLabel}{rec.department && rec.targetType === "segment" ? <span className="font-medium text-[#4b564e]"> · {rec.department}</span> : null}</p>
      <div className="mt-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-[#28684e]">What to do</p>
        <ul className="mt-1.5 space-y-1.5">
          {toBullets(rec.action, 3).map((b) => (
            <li key={b} className="flex gap-2 text-[15px] leading-snug text-[#1f2c24]"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#28684e]" aria-hidden="true" /><span className="line-clamp-2"><Highlight text={b} /></span></li>
          ))}
        </ul>
      </div>
      <div className="mt-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-[#8f2f29]">Why</p>
        <ul className="mt-1.5 space-y-1.5">
          {toBullets(rec.reason, 3).map((b) => (
            <li key={b} className="flex gap-2 text-[14.5px] leading-snug text-[#344037]"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#c18a2c]" aria-hidden="true" /><span className="line-clamp-2"><Highlight text={b} /></span></li>
          ))}
        </ul>
      </div>
      <p className="mt-3 flex items-start gap-1.5 rounded-md bg-[#eef6f1] px-3 py-2 text-[14px] leading-snug text-[#1f3a2c]">
        <Target size={15} className="mt-[2px] shrink-0 text-[#28684e]" aria-hidden="true" />
        <span className="line-clamp-2"><b>Expected effect:</b> {rec.expectedImpact}</span>
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#edf0eb] pt-3.5">
        <label className="text-[13px] font-semibold text-[#4b564e]">
          Status
          <select
            value={rec.status}
            disabled={!canEdit || busy}
            onChange={(e) => change({ status: e.target.value as RecStatus })}
            className="mt-1 block rounded-md border border-[#dfe5dc] bg-white px-2.5 py-1.5 text-[14px] font-medium text-[#344037] disabled:cursor-not-allowed disabled:bg-[#f5f7f4]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[160px] flex-1 text-[13px] font-semibold text-[#4b564e]">
          <span className="inline-flex items-center gap-1"><UserRound size={11} aria-hidden="true" /> Assigned to</span>
          <input
            value={assignee}
            disabled={!canEdit || busy}
            maxLength={80}
            placeholder={canEdit ? "Name of the person responsible" : "Not assigned"}
            onChange={(e) => setAssignee(e.target.value)}
            onBlur={() => assignee.trim() !== (rec.assignedTo ?? "") && change({ assignedTo: assignee.trim() || null })}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="mt-1 block w-full rounded-md border border-[#dfe5dc] bg-white px-2.5 py-1.5 text-[14px] font-medium text-[#344037] placeholder:font-normal disabled:cursor-not-allowed disabled:bg-[#f5f7f4]"
          />
        </label>
        {busy && <span className="pb-2 text-[13px] text-[#556057]" role="status">Saving…</span>}
      </div>
      {error && <p role="alert" className="mt-2.5 rounded bg-[#fff6f5] px-3 py-2 text-[14px] text-[#8f2f29]">{error}</p>}
    </article>
  );
}
