"use client";

import { useState } from "react";
import { AlertTriangle, BadgeCheck, Scale, Target } from "lucide-react";
import { ReliabilityChart } from "@/components/forecast/charts";
import { DataState, OUTCOME_META, OUTCOME_ORDER, PageHeader, Panel, StatCard, SyntheticNote } from "@/components/forecast/ui";
import { useData } from "@/lib/data/hooks";
import { fetchModelMetrics } from "@/lib/data/insights";
import type { ClassifierMetrics, ModelMetricsFile, OutcomeKey, TargetReport } from "@/lib/ml-types";

const f2 = (n: number | null | undefined) => (n === null || n === undefined ? "-" : n.toFixed(2));
const p0 = (n: number | null | undefined) => (n === null || n === undefined ? "-" : `${Math.round(n * 100)}%`);
type Choice = OutcomeKey | "sgpa_regression";

export function ModelView() {
  const metrics = useData(["model-metrics"], fetchModelMetrics, { revalidateOnFocus: false });
  const [choice, setChoice] = useState<Choice>("sgpa_below_6");
  return (
    <>
      <PageHeader
        eyebrow="MODEL PERFORMANCE"
        title="How good are the forecasts?"
        subtitle="Scores measured on students the model never saw, compared with simple rules a school could use without a model, plus calibration, fairness checks and the main drivers."
      />
      <DataState state={metrics} skeletonRows={4}>
        {(m) => (
          <>
            <section className="rounded-md border border-[#f0d9a8] bg-[#fffaf0] p-4" aria-label="Read this first">
              <p className="flex items-center gap-2 text-[14.5px] font-semibold text-[#7a5a14]"><AlertTriangle size={14} aria-hidden="true" /> Read this first</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[11.5px] leading-5 text-[#6a5320]">{m.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
            </section>

            <div className="mt-[18px] flex flex-wrap gap-1.5" role="tablist" aria-label="Forecast">
              {OUTCOME_ORDER.map((k) => (
                <Tab key={k} active={choice === k} onClick={() => setChoice(k)}>{OUTCOME_META[k].label}</Tab>
              ))}
              <Tab active={choice === "sgpa_regression"} onClick={() => setChoice("sgpa_regression")}>Expected SGPA</Tab>
            </div>

            {choice === "sgpa_regression" ? <Regression m={m} /> : <Classifier key={choice} outcome={choice} report={m.targets[choice]} />}

            <section className="mt-[18px] flex items-start gap-3 rounded-md border border-[#e2e7df] bg-white p-4" aria-label="Explanation check">
              <BadgeCheck size={18} className="mt-0.5 shrink-0 text-[#28684e]" aria-hidden="true" />
              <div>
                <p className="text-[14.5px] font-semibold text-[#252f28]">The reasons shown are the model&apos;s real arithmetic{m.explanation_faithfulness.passed ? "" : " (check failed)"}</p>
                <p className="mt-1 text-[14px] leading-5 text-[#59665c]">{m.explanation_faithfulness.driver_display_rule}</p>
              </div>
            </section>
          </>
        )}
      </DataState>
      <SyntheticNote className="mt-4" />
    </>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      className={`rounded-md border px-3 py-2 text-[14px] font-semibold ${active ? "border-[#28684e] bg-[#eaf3ee] text-[#193f31]" : "border-[#dfe5dc] bg-white text-[#59665c] hover:bg-[#f5f7f4]"}`}>
      {children}
    </button>
  );
}

function Classifier({ outcome, report }: { outcome: OutcomeKey; report: TargetReport }) {
  const t = report.test_metrics;
  const cm = t.confusion_matrix;
  const rows: { name: string; m: ClassifierMetrics; us?: boolean }[] = [
    { name: "This model", m: t, us: true },
    { name: report.baselines.success_score.name, m: report.baselines.success_score },
    { name: report.baselines.round1_risk_flag.name, m: report.baselines.round1_risk_flag },
    { name: report.baselines.no_skill.name, m: report.baselines.no_skill },
  ];
  const early = report.early_detection;
  const groups = report.global_drivers.by_group;
  const groupList = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const maxGroup = Math.max(1e-9, ...groupList.map(([, v]) => v));
  return (
    <div className="mt-[18px] space-y-[18px]">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Headline scores">
        <StatCard title="Ranking quality (ROC AUC)" value={f2(t.roc_auc)} note={t.roc_auc_ci95 ? `95% range ${f2(t.roc_auc_ci95[0])} to ${f2(t.roc_auc_ci95[1])}` : "1.00 is perfect, 0.50 is a coin flip"} icon={Target} />
        <StatCard title="Catches (recall)" value={p0(t.recall)} note="of students who really had the outcome" icon={BadgeCheck} />
        <StatCard title="Right when it flags (precision)" value={p0(t.precision)} note={`false alarms: ${p0(t.false_positive_rate)} of the rest`} icon={Scale} tone="amber" />
        <StatCard title="Tested on" value={t.n.toLocaleString()} note={`${t.positives} had the outcome · test students: ${report.n_test_students}`} icon={Target} />
      </section>

      <Panel title={report.title} subtitle={`${report.model.family}: ${report.model.chosen_because}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead><tr className="border-b border-[#edf0eb] text-[13px] uppercase tracking-[0.8px] text-[#556057]"><th className="py-2 pr-3 font-semibold">Compared with</th><th className="px-3 py-2 font-semibold">ROC AUC</th><th className="px-3 py-2 font-semibold">PR AUC</th><th className="px-3 py-2 font-semibold">Precision</th><th className="px-3 py-2 font-semibold">Recall</th><th className="px-3 py-2 font-semibold">F1</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={`border-b border-[#f1f4ef] last:border-0 ${r.us ? "bg-[#f1f7f3] font-semibold" : ""}`}>
                  <td className="py-2.5 pr-3 text-[#252f28]">{r.name}</td>
                  <td className="px-3 py-2.5 tabular-nums">{f2(r.m.roc_auc)}</td><td className="px-3 py-2.5 tabular-nums">{f2(r.m.pr_auc)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{p0(r.m.precision)}</td><td className="px-3 py-2.5 tabular-nums">{p0(r.m.recall)}</td><td className="px-3 py-2.5 tabular-nums">{f2(r.m.f1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px] leading-5 text-[#59665c]">
          At the same precision as the existing success score ({p0(report.gain_over_success_score.success_score_precision)}), this model catches {p0(report.gain_over_success_score.recall_at_success_score_precision)} instead of {p0(report.gain_over_success_score.success_score_recall)}.
          Flagging rule: {report.threshold_rule}.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        <Panel title="Does 30% really mean 30%?" subtitle={`Calibration (${report.calibration.method}). Points near the dashed line mean the stated chances can be trusted. Brier score ${report.calibration.brier_test.toFixed(3)}, lower is better.`}>
          <ReliabilityChart bins={report.calibration.reliability_test} />
        </Panel>
        <Panel title="Right and wrong calls" subtitle="On the held-out students, at the flagging threshold">
          <dl className="grid grid-cols-2 gap-3 text-[14px]">
            <Cell label="Flagged, and it happened" value={cm.tp} tone="good" />
            <Cell label="Flagged, but it did not happen" value={cm.fp} tone="warn" />
            <Cell label="Missed: it happened" value={cm.fn} tone="bad" />
            <Cell label="Not flagged, and it did not happen" value={cm.tn} tone="good" />
          </dl>
          <p className="mt-4 rounded-md bg-[#f6f8f5] p-3 text-[14px] leading-5 text-[#59665c]">
            <span className="font-semibold text-[#3a473e]">Early warning: </span>{early.definition} The model caught {early.caught_by_model} of {early.n_rows}
            {early.share_caught_by_model !== null ? ` (${p0(early.share_caught_by_model)})` : ""}; the existing success score caught {p0(early.share_caught_by_success_score)}. {early.n_rows < 30 ? "That is too few cases to say more." : ""}
          </p>
        </Panel>
      </div>

      <Panel title="What drives the forecast overall" subtitle="Share of the model's signal by area (how much shuffling that area hurts the score)">
        <ul className="space-y-2.5">
          {groupList.map(([name, v]) => (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]"><span className="font-medium text-[#344037]">{name}</span><span className="tabular-nums text-[#4b564e]">{v.toFixed(3)}</span></div>
              <div className="mt-1 h-[6px] rounded-full bg-[#eef1ec]"><div className="h-full rounded-full bg-[#28684e]" style={{ width: `${(v / maxGroup) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10.5px] leading-5 text-[#556057]">{report.global_drivers.method}. Top single inputs: {report.global_drivers.top_features.slice(0, 5).map((f) => f.label).join(", ")}.</p>
      </Panel>

      <Fairness outcome={outcome} report={report} />
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "bad" }) {
  const c = { good: "bg-[#eef6f1] text-[#1f5a43]", warn: "bg-[#fdf6e6] text-[#7a5a14]", bad: "bg-[#fceeed] text-[#8f2f29]" }[tone];
  return <div className={`rounded-md p-3 ${c}`}><dt className="text-[10.5px] opacity-80">{label}</dt><dd className="mt-0.5 text-[20px] font-semibold tabular-nums">{value}</dd></div>;
}

function Fairness({ outcome, report }: { outcome: OutcomeKey; report: TargetReport }) {
  const attrs = Object.entries(report.fairness_out_of_sample);
  return (
    <Panel title="Is it fair across groups?" subtitle={`${OUTCOME_META[outcome].label}: how often the model catches real cases, and how often it raises a false alarm, for each group (out-of-sample)`}>
      <div className="space-y-5">
        {attrs.map(([attr, groups]) => (
          <div key={attr}>
            <h4 className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.8px] text-[#4b564e]">{attr}</h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[14px]">
                <thead><tr className="border-b border-[#edf0eb] text-[13px] text-[#556057]"><th className="py-1.5 pr-3 font-semibold">Group</th><th className="px-3 py-1.5 font-semibold">Students</th><th className="px-3 py-1.5 font-semibold">Catches</th><th className="px-3 py-1.5 font-semibold">False alarms</th><th className="px-3 py-1.5 font-semibold">Flagged</th></tr></thead>
                <tbody>
                  {Object.entries(groups).map(([g, v]) => (
                    <tr key={g} className="border-b border-[#f1f4ef] last:border-0"><td className="py-2 pr-3 font-medium text-[#252f28]">{g}</td><td className="px-3 py-2 tabular-nums">{v.n}</td><td className="px-3 py-2 tabular-nums">{p0(v.recall)}</td><td className="px-3 py-2 tabular-nums">{p0(v.false_positive_rate)}</td><td className="px-3 py-2 tabular-nums">{p0(v.flagged_share)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10.5px] leading-5 text-[#556057]">Groups with few students give noisy numbers. Large gaps between groups are a reason to review the model, not proof of bias on their own.</p>
    </Panel>
  );
}

function Regression({ m }: { m: ModelMetricsFile }) {
  const r = m.regression;
  const t = r.test_metrics;
  const rows = [
    { name: "This model", ...t, us: true },
    { name: "Repeat last semester's SGPA", ...r.baselines.persistence_last_sgpa },
    { name: "Always guess the campus average", ...r.baselines.cohort_mean },
  ];
  const groups = Object.entries(r.global_drivers.by_group).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1e-9, ...groups.map(([, v]) => v));
  return (
    <div className="mt-[18px] space-y-[18px]">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Headline scores">
        <StatCard title="Typical miss (MAE)" value={f2(t.mae)} note="SGPA points, on average" icon={Target} />
        <StatCard title="Variance explained (R²)" value={f2(t.r2)} note="1.00 would be perfect" icon={BadgeCheck} />
        <StatCard title="Right grade band" value={p0(t.band_accuracy)} note="forecast band equals actual band" icon={Scale} tone="amber" />
        <StatCard title="80% range holds" value={p0(t.interval80_coverage)} note="actual SGPA fell inside the stated range" icon={Target} />
      </section>
      <Panel title={r.title} subtitle={`${r.model.family}: ${r.model.chosen_because}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[14px]">
            <thead><tr className="border-b border-[#edf0eb] text-[13px] uppercase tracking-[0.8px] text-[#556057]"><th className="py-2 pr-3 font-semibold">Compared with</th><th className="px-3 py-2 font-semibold">MAE</th><th className="px-3 py-2 font-semibold">RMSE</th><th className="px-3 py-2 font-semibold">R²</th><th className="px-3 py-2 font-semibold">Band accuracy</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.name} className={`border-b border-[#f1f4ef] last:border-0 ${"us" in x ? "bg-[#f1f7f3] font-semibold" : ""}`}>
                  <td className="py-2.5 pr-3 text-[#252f28]">{x.name}</td><td className="px-3 py-2.5 tabular-nums">{f2(x.mae)}</td><td className="px-3 py-2.5 tabular-nums">{f2(x.rmse)}</td><td className="px-3 py-2.5 tabular-nums">{f2(x.r2)}</td><td className="px-3 py-2.5 tabular-nums">{p0(x.band_accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="What drives the SGPA forecast overall" subtitle="Share of the model's signal by area">
        <ul className="space-y-2.5">
          {groups.map(([name, v]) => (
            <li key={name}><div className="flex items-baseline justify-between gap-3 text-[14px]"><span className="font-medium text-[#344037]">{name}</span><span className="tabular-nums text-[#4b564e]">{v.toFixed(3)}</span></div><div className="mt-1 h-[6px] rounded-full bg-[#eef1ec]"><div className="h-full rounded-full bg-[#28684e]" style={{ width: `${(v / max) * 100}%` }} /></div></li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
