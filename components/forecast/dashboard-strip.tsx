"use client";

import Link from "next/link";
import { ArrowRight, ListChecks, ShieldAlert, TrendingUp, UsersRound } from "lucide-react";
import { DataState, LevelBadge, PriorityBadge, ProbabilityBar, StatCard, pct } from "./ui";
import { CHART_COLOR, TrendLines } from "./charts";
import { useCurrentUser, useData } from "@/lib/data/hooks";
import { fetchPredictionList, fetchPredictionSummary } from "@/lib/data/predictions";
import { fetchRecommendationSummary, fetchRecommendations } from "@/lib/data/recommendations";
import { fetchRiskTrends } from "@/lib/data/insights";
import { countNote, fetchStudentCounts } from "@/lib/data/scope";

const linkCls = "inline-flex items-center gap-1 text-[14px] font-semibold text-[#28684e] hover:underline";

/**
 * The forecast on the admin overview. A dean sees campus-wide totals, the departments that need most help and the most urgent
 * actions; a faculty mentor sees the same cards for their own mentees only (the database already limits what each role can read)
 * and a "this week" list of the mentees to talk to first.
 */
export function DashboardStrip() {
  const me = useCurrentUser();
  const role = me.data?.role;
  const isFaculty = role === "faculty";
  const summary = useData(["strip", "summary"], (db) => fetchPredictionSummary(db, {}));
  const recSummary = useData(["strip", "recs"], (db) => fetchRecommendationSummary(db));
  const top = useData(["strip", "top"], (db) => fetchPredictionList(db, {}, 0, 5, "risk"));
  const urgent = useData(["strip", "urgent", isFaculty], (db) => fetchRecommendations(db, isFaculty ? { status: "open" } : { status: "open", priority: "Critical" }, 0, 4));
  const counts = useData(["student-counts"], fetchStudentCounts);
  const trends = useData(["trends"], fetchRiskTrends, { revalidateOnFocus: false });

  // nothing to show when the visitor is not signed in or no forecast has been loaded yet: the page below is unaffected
  if (summary.error && !summary.data) return null;

  return (
    <section className="mb-7" aria-label={isFaculty ? "Forecast for my mentees" : "Forecast for next semester"}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold tracking-[1.5px] text-[#4b564e]">FORECAST · SEMESTER 6</p>
          <h2 className="mt-0.5 text-[16px] font-semibold tracking-[-0.3px] text-[#252f28]">{isFaculty ? "My mentees next semester" : "Next semester at a glance"}</h2>
        </div>
        <Link href="/admin/predictions" className={linkCls}>Open the full forecast <ArrowRight size={12} aria-hidden="true" /></Link>
      </div>

      <DataState state={summary} skeletonRows={2}>
        {(s) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={isFaculty ? "Mentees" : "Students"} value={(counts.data?.total ?? s.total).toLocaleString()} note={counts.data ? countNote(counts.data, "all have a semester 6 forecast") : "from data up to semester 5"} icon={UsersRound} />
            <StatCard title="High overall risk" value={String(s.overall.High)} note={`${s.total ? Math.round((s.overall.High / s.total) * 100) : 0}% · ${s.overall.Medium} more at medium`} icon={ShieldAlert} tone="red" />
            <DataState state={recSummary}>
              {(r) => <StatCard title="Open urgent actions" value={String(r.open_critical_or_high)} note={`${r.by_status.accepted ?? 0} already in progress`} icon={ListChecks} tone="amber" />}
            </DataState>
            <StatCard title="Expected average SGPA" value={s.outcomes.sgpa_below_6.mean_sgpa?.toFixed(2) ?? "-"} note={`${pct(s.outcomes.placement.mean_ready)} expected placement-ready`} icon={TrendingUp} />
          </div>
        )}
      </DataState>

      <div className="mt-[18px] grid grid-cols-1 gap-[18px] xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-md border border-[#e2e7df] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-[#252f28]">{isFaculty ? "Talk to these mentees first" : "Students to look at first"}</h3>
            <Link href="/admin/predictions" className={linkCls}>See all <ArrowRight size={12} aria-hidden="true" /></Link>
          </div>
          <DataState state={top} skeletonRows={3} empty={{ when: (d) => d.rows.length === 0, title: "No forecasts to show" }}>
            {(d) => (
              <ul className="mt-3 divide-y divide-[#f1f4ef]">
                {d.rows.map((r) => (
                  <li key={r.student_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/predictions?student=${encodeURIComponent(r.student_id)}`} className="text-[14.5px] font-semibold text-[#252f28] hover:underline">{r.name}</Link>
                      <p className="mt-0.5 line-clamp-1 text-[10.5px] text-[#556057]">{r.student_id} · {r.reason}</p>
                    </div>
                    <div className="flex items-center gap-3"><ProbabilityBar value={r.backlog_p} level={r.backlog_level} width="w-16" /><LevelBadge level={r.overall} suffix="overall" /></div>
                  </li>
                ))}
              </ul>
            )}
          </DataState>
        </div>

        <div className="rounded-md border border-[#e2e7df] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-[#252f28]">{isFaculty ? "This week" : "Most urgent actions"}</h3>
            <Link href="/admin/recommendations" className={linkCls}>All actions <ArrowRight size={12} aria-hidden="true" /></Link>
          </div>
          <DataState state={urgent} skeletonRows={3} empty={{ when: (d) => d.rows.length === 0, title: "No critical actions are open", hint: "Nice. Check the high-priority list for what is next." }}>
            {(d) => (
              <ul className="mt-3 space-y-3">
                {d.rows.map((r) => (
                  <li key={r.id} className="rounded-md border border-[#edf0eb] p-3">
                    <div className="flex items-center justify-between gap-2"><PriorityBadge priority={r.priority} /><span className="text-[13px] text-[#556057]">{r.owner} · within {r.dueInDays} days</span></div>
                    <p className="mt-1.5 text-[11.5px] font-semibold text-[#252f28]">{r.targetLabel}</p>
                    <p className="mt-0.5 line-clamp-2 text-[14px] leading-[1.5] text-[#59665c]">{r.action}</p>
                  </li>
                ))}
              </ul>
            )}
          </DataState>
        </div>
      </div>

      {!isFaculty && (
        <div className="mt-[18px] rounded-md border border-[#e2e7df] bg-white p-5">
          <h3 className="text-[15px] font-semibold text-[#252f28]">Share of students rated high on backlog risk</h3>
          <p className="mt-0.5 text-[10.5px] text-[#556057]">Forecast versus what happened, by semester. <Link href="/admin/risk-trends" className={linkCls}>More trends</Link></p>
          <DataState state={trends} skeletonRows={2}>
            {(t) => (
              <TrendLines
                height={180}
                data={t.institution.backlog.map((p) => ({ label: `Sem ${p.n + 1}`, predicted: p.mean_p, observed: p.observed_rate }))}
                lines={[{ key: "predicted", name: "Forecast chance", color: CHART_COLOR.predicted }, { key: "observed", name: "Observed", color: CHART_COLOR.observed, dashed: true }]}
              />
            )}
          </DataState>
        </div>
      )}
    </section>
  );
}
