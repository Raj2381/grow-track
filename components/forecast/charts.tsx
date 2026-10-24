"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LevelCounts } from "@/lib/ml-types";
import { LEVEL_STYLE, LEVELS } from "./ui";

export const CHART_COLOR = { High: "#d4665e", Medium: "#dfa943", Low: "#4b8b65", predicted: "#28684e", observed: "#8b6fb0", axis: "#3f4a42", grid: "#e8ece6" };
const tick = { fill: "#3f4a42", fontSize: 13 };
const tip = { border: "1px solid #cfd8cd", borderRadius: "6px", fontSize: "14px" };

/**
 * One horizontal stacked bar of High / Medium / Low, large enough to read from across a desk: the label above, the share
 * of each level written inside its segment, and a legend underneath with the counts (colour is never the only signal).
 */
export function LevelStack({ counts, label }: { counts: LevelCounts; label: string }) {
  const total = counts.Low + counts.Medium + counts.High || 1;
  const share = (n: number) => Math.round((n / total) * 100);
  const text: Record<string, string> = { High: "text-white", Medium: "text-[#3d2c05]", Low: "text-white" };
  return (
    <div>
      <p className="mb-2 text-[16px] font-semibold text-[#1f2c24]">{label}</p>
      <div className="flex h-[34px] gap-[3px] overflow-hidden rounded-md" role="img" aria-label={`${label}: ${counts.High} high (${share(counts.High)}%), ${counts.Medium} medium (${share(counts.Medium)}%), ${counts.Low} low (${share(counts.Low)}%)`}>
        {LEVELS.map((l) => counts[l] > 0 && (
          <div key={l} className={`${LEVEL_STYLE[l].bar} flex items-center justify-center text-[14px] font-bold ${text[l]}`} style={{ width: `${(counts[l] / total) * 100}%` }}>
            {share(counts[l]) >= 7 ? `${share(counts[l])}%` : ""}
          </div>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-[#344037]">
        {LEVELS.map((l) => (
          <li key={l} className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${LEVEL_STYLE[l].bar}`} aria-hidden="true" /><b>{l}</b> {counts[l].toLocaleString()} <span className="text-[#4b564e]">({share(counts[l])}%)</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Students per department, split by overall risk level, with the counts printed on the bars. */
export function DepartmentStackChart({ data }: { data: { name: string; High: number; Medium: number; Low: number }[] }) {
  const bigTick = { fill: "#344037", fontSize: 14, fontWeight: 600 };
  const label = (fill: string) => ({ position: "center" as const, fill, fontSize: 13, fontWeight: 700, formatter: (v: unknown) => (Number(v) >= 12 ? String(v) : "") });
  return (
    <div className="h-[380px] w-full" role="img" aria-label={`Students by department and overall risk level. ${data.map((d) => `${d.name}: ${d.High} high, ${d.Medium} medium, ${d.Low} low`).join("; ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={CHART_COLOR.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={bigTick} interval={0} />
          <YAxis axisLine={false} tickLine={false} tick={{ ...bigTick, fontWeight: 500, fontSize: 13 }} allowDecimals={false} width={44} />
          <Tooltip contentStyle={{ ...tip, fontSize: "14px", padding: "10px 12px" }} cursor={{ fill: "#f5f7f3" }} />
          <Legend iconType="circle" iconSize={12} wrapperStyle={{ fontSize: 14, paddingTop: 8 }} />
          <Bar dataKey="High" stackId="a" fill={CHART_COLOR.High} label={label("#ffffff")} />
          <Bar dataKey="Medium" stackId="a" fill={CHART_COLOR.Medium} label={label("#3d2c05")} />
          <Bar dataKey="Low" stackId="a" fill={CHART_COLOR.Low} radius={[4, 4, 0, 0]} label={label("#ffffff")} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type LinePoint = { label: string } & Record<string, number | string | null>;

/** Predicted (solid) versus observed (dashed) over semesters; gaps are left where nothing was observed yet. */
export function TrendLines({ data, lines, percent = true, height = 240, domain }: {
  data: LinePoint[];
  lines: { key: string; name: string; color: string; dashed?: boolean }[];
  percent?: boolean;
  height?: number;
  domain?: [number, number];
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Trend: ${lines.map((l) => l.name).join(" and ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLOR.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} />
          <YAxis axisLine={false} tickLine={false} tick={tick} domain={domain} tickFormatter={percent ? (v) => `${Math.round(Number(v) * 100)}%` : undefined} />
          <Tooltip contentStyle={tip} formatter={(v) => (percent ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toFixed(2))} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5} strokeDasharray={l.dashed ? "5 4" : undefined} dot={{ r: 3, fill: l.color, stroke: "#fff", strokeWidth: 1.5 }} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Reliability: when the model says X%, how often did it happen? Points on the dashed diagonal mean "well calibrated". */
export function ReliabilityChart({ bins }: { bins: { n: number; mean_predicted: number; observed_rate: number }[] }) {
  const data = bins.filter((b) => b.n > 0).map((b) => ({ predicted: b.mean_predicted, observed: b.observed_rate }));
  return (
    <div className="h-[240px] w-full" role="img" aria-label="Calibration: predicted chance against observed rate">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLOR.grid} strokeDasharray="3 4" />
          <XAxis dataKey="predicted" type="number" domain={[0, 1]} axisLine={false} tickLine={false} tick={tick} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
          <YAxis type="number" domain={[0, 1]} axisLine={false} tickLine={false} tick={tick} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
          <Tooltip contentStyle={tip} formatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} labelFormatter={(v) => `Forecast ${(Number(v) * 100).toFixed(0)}%`} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#b7c0b6" strokeDasharray="5 4" />
          <Line type="monotone" dataKey="observed" name="Observed" stroke={CHART_COLOR.predicted} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLOR.predicted, stroke: "#fff", strokeWidth: 1.5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One series of bars with a label under each (counts per bucket, per department...). */
export function SimpleBars({ data, color = CHART_COLOR.predicted, height = 240, unit = "" }: { data: { label: string; value: number }[]; color?: string; height?: number; unit?: string }) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLOR.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ ...tick, fontSize: 12 }} interval={0} />
          <YAxis axisLine={false} tickLine={false} tick={{ ...tick, fontSize: 12 }} allowDecimals={false} />
          <Tooltip contentStyle={tip} cursor={{ fill: "#f5f7f3" }} formatter={(v) => `${v}${unit}`} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
