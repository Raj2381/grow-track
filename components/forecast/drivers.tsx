"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Driver } from "@/lib/ml-types";

/**
 * Drivers as readable sentences with the student's own numbers. An up arrow raises the risk, a down arrow holds it down;
 * the words "raises" and "lowers" are in the accessible text so colour is never the only signal.
 */
export function DriverList({ drivers, showFamily = true, empty = "No single factor stands out." }: { drivers: Driver[]; showFamily?: boolean; empty?: string }) {
  if (!drivers.length) return <p className="text-[14px] text-[#556057]">{empty}</p>;
  const up = drivers.filter((d) => d.c > 0);
  const down = drivers.filter((d) => d.c < 0);
  const group = (items: Driver[], raising: boolean) =>
    items.length === 0 ? null : (
      <div>
        <p className={`mb-1.5 text-[13px] font-semibold uppercase tracking-[0.8px] ${raising ? "text-[#a33f38]" : "text-[#28654d]"}`}>
          {raising ? "Pushing the risk up" : "Holding the risk down"}
        </p>
        <ul className="space-y-1.5">
          {items.map((d) => (
            <li key={`${d.k}-${d.f}`} className="flex items-start gap-2 text-[11.5px] leading-5 text-[#3a473e]">
              {raising ? <ArrowUpRight size={14} className="mt-[3px] shrink-0 text-[#bf5a52]" aria-hidden="true" /> : <ArrowDownRight size={14} className="mt-[3px] shrink-0 text-[#4c9169]" aria-hidden="true" />}
              <span>
                <span className="sr-only">{raising ? "Raises the risk: " : "Lowers the risk: "}</span>
                {d.t}
                {showFamily && <span className="ml-1.5 text-[13px] text-[#556057]">· {d.f}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  return <div className="space-y-4">{group(up, true)}{group(down, false)}</div>;
}
