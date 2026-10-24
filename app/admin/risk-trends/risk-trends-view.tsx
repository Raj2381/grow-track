"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Flag, Percent, Users } from "lucide-react";
import { CHART_COLOR, TrendLines, type LinePoint } from "@/components/forecast/charts";
import { DataState, OUTCOME_META, OUTCOME_ORDER, PageHeader, Panel, StatCard, SyntheticNote, pct } from "@/components/forecast/ui";
import { useData } from "@/lib/data/hooks";
import { fetchRiskTrends } from "@/lib/data/insights";
import type { OutcomeKey, RiskTrendsFile, SgpaTrendPoint, TrendPoint } from "@/lib/ml-types";

const select = "rounded-md border border-[#dfe5dc] bg-white px-2.5 py-2 text-[14px] font-medium text-[#344037]";
type Scope = { kind: "institution" } | { kind: "department"; name: string } | { kind: "section"; name: string };

const seriesFor = (t: RiskTrendsFile, scope: Scope, key: OutcomeKey): TrendPoint[] =>
  scope.kind === "institution" ? t.institution[key] : scope.kind === "department" ? t.by_department[scope.name][key] : t.by_section[scope.name][key];
const sgpaFor = (t: RiskTrendsFile, scope: Scope): SgpaTrendPoint[] | null =>
  scope.kind === "institution" ? t.institution.sgpa : scope.kind === "department" ? t.by_department[scope.name].sgpa : null;

/** cut-off n = the forecast made after semester n, for semester n + 1 */
const label = (n: number) => `Sem ${n + 1}`;

export function RiskTrendsView() {
  const trends = useData(["trends"], fetchRiskTrends, { revalidateOnFocus: false });
  const [scopeKey, setScopeKey] = useState("institution");
  const [outcome, setOutcome] = useState<OutcomeKey>("backlog");

  return (
    <>
      <PageHeader
        eyebrow="RISK TRENDS"
        title="How risk is moving"
        subtitle="The share of students the model rates as high risk, semester by semester, and how well the forecasts matched what happened. The last point is the forecast for semester 6."
      />
      <DataState state={trends} skeletonRows={4}>
        {(t) => <Body t={t} scopeKey={scopeKey} setScopeKey={setScopeKey} outcome={outcome} setOutcome={setOutcome} />}
      </DataState>
      <SyntheticNote className="mt-4" />
    </>
  );
}

function Body({ t, scopeKey, setScopeKey, outcome, setOutcome }: { t: RiskTrendsFile; scopeKey: string; setScopeKey: (v: string) => void; outcome: OutcomeKey; setOutcome: (v: OutcomeKey) => void }) {
  const scope: Scope = useMemo(() => (scopeKey === "institution" ? { kind: "institution" } : scopeKey.startsWith("d:") ? { kind: "department", name: scopeKey.slice(2) } : { kind: "section", name: scopeKey.slice(2) }), [scopeKey]);
  const series = seriesFor(t, scope, outcome);
  const sgpa = sgpaFor(t, scope);
  const first = series[0];
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const change = last && prev ? last.share_high - prev.share_high : 0;
  const placement = outcome === "placement";

  const chart: LinePoint[] = series.map((p) => ({ label: label(p.n), predicted: p.mean_p, observed: p.observed_rate }));
  const share: LinePoint[] = series.map((p) => ({ label: label(p.n), high: p.share_high, flagged: p.share_flagged }));
  const sgpaChart: LinePoint[] | null = sgpa ? sgpa.map((p) => ({ label: label(p.n), predicted: p.predicted_mean, observed: p.observed_mean })) : null;

  const departments = Object.keys(t.by_department).sort();
  const sections = Object.keys(t.by_section).sort();
  const compare = departments.map((name) => ({ name, p: t.by_department[name][outcome][t.by_department[name][outcome].length - 1] }));

  return (
    <>
      <section className="rounded-md border border-[#e2e7df] bg-white p-4" aria-label="Choose what to look at">
        <div className="flex flex-wrap items-center gap-2.5">
          <select aria-label="Scope" value={scopeKey} onChange={(e) => setScopeKey(e.target.value)} className={select}>
            <option value="institution">Whole campus</option>
            <optgroup label="Department">{departments.map((d) => <option key={d} value={`d:${d}`}>{d}</option>)}</optgroup>
            <optgroup label="Section">{sections.map((s) => <option key={s} value={`s:${s}`}>{s}</option>)}</optgroup>
          </select>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Outcome">
            {OUTCOME_ORDER.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={outcome === k} onClick={() => setOutcome(k)}
                className={`rounded-md border px-3 py-2 text-[14px] font-semibold ${outcome === k ? "border-[#28684e] bg-[#eaf3ee] text-[#193f31]" : "border-[#dfe5dc] text-[#59665c] hover:bg-[#f5f7f4]"}`}>
                {OUTCOME_META[k].label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-5 text-[#4b564e]">{OUTCOME_META[outcome].meaning}{placement ? " Placement figures are for the NOT-ready group." : ""}</p>
      </section>

      <section className="mt-[18px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <StatCard title="High risk now" value={pct(last?.share_high)} note={`forecast for ${label(last?.n ?? 0)} · ${last?.students ?? 0} students`} icon={Users} tone="red" />
        <StatCard title={change > 0.0005 ? "Up from last semester" : change < -0.0005 ? "Down from last semester" : "Steady"} value={`${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)} pts`} note={`share rated high, versus ${label(prev?.n ?? 0)}`} icon={change > 0.0005 ? ArrowUpRight : ArrowDownRight} tone={change > 0.0005 ? "red" : "green"} />
        <StatCard title="Flagged for a check" value={pct(last?.share_flagged)} note="at or above the screening threshold" icon={Flag} tone="amber" />
        <StatCard title="Average chance" value={pct(last?.mean_p, 1)} note={first ? `was ${pct(first.mean_p, 1)} at ${label(first.n)}` : ""} icon={Percent} />
      </section>

      <section className="mt-[18px] grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        <Panel title="Forecast versus what happened" subtitle="Solid: the average forecast chance. Dashed: the share who actually had the outcome. The last point has no outcome yet.">
          <TrendLines data={chart} lines={[{ key: "predicted", name: "Forecast chance", color: CHART_COLOR.predicted }, { key: "observed", name: "Observed", color: CHART_COLOR.observed, dashed: true }]} />
        </Panel>
        <Panel title="Share of students at risk" subtitle="Rated High, and flagged for a check (High or Medium)">
          <TrendLines data={share} lines={[{ key: "high", name: "Rated High", color: CHART_COLOR.High }, { key: "flagged", name: "Flagged for a check", color: CHART_COLOR.Medium }]} />
        </Panel>
      </section>

      {sgpaChart && (
        <section className="mt-[18px]">
          <Panel title="Average SGPA: forecast versus actual" subtitle="Expected next-semester SGPA against what students scored">
            <TrendLines data={sgpaChart} percent={false} domain={[5, 8]} height={220} lines={[{ key: "predicted", name: "Forecast", color: CHART_COLOR.predicted }, { key: "observed", name: "Actual", color: CHART_COLOR.observed, dashed: true }]} />
          </Panel>
        </section>
      )}

      <section className="mt-[18px]">
        <Panel title="Departments side by side" subtitle={`Share rated High for ${OUTCOME_META[outcome].label.toLowerCase()}, latest forecast`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[14px]">
              <thead><tr className="border-b border-[#edf0eb] text-[13px] uppercase tracking-[0.8px] text-[#556057]"><th className="py-2 pr-3 font-semibold">Department</th><th className="px-3 py-2 font-semibold">Rated High</th><th className="px-3 py-2 font-semibold">Flagged</th><th className="px-3 py-2 font-semibold">Average chance</th></tr></thead>
              <tbody>
                {compare.sort((a, b) => b.p.share_high - a.p.share_high).map(({ name, p }) => (
                  <tr key={name} className="border-b border-[#f1f4ef] last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-[#252f28]">{name}</td>
                    <td className="px-3 py-2.5 tabular-nums">{pct(p.share_high, 1)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{pct(p.share_flagged, 1)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{pct(p.mean_p, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
      <p className="mt-4 text-[14px] leading-5 text-[#4b564e]">{t.note}</p>
    </>
  );
}
