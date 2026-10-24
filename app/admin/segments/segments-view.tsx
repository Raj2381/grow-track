"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, UsersRound } from "lucide-react";
import { RecommendationCard } from "@/components/forecast/recommendation-card";
import { DataState, LevelBadge, OUTCOME_META, PageHeader, Panel, ProbabilityBar, SyntheticNote, pct } from "@/components/forecast/ui";
import { useData, useDb } from "@/lib/data/hooks";
import { fetchSegmentMembers, fetchSegments } from "@/lib/data/insights";
import { fetchRecommendations, updateRecommendation } from "@/lib/data/recommendations";
import { useUrlParam } from "@/lib/use-url-param";
import { useSWRConfig } from "swr";
import type { RecStatus, SegmentRecord } from "@/lib/ml-types";

const PAGE_SIZE = 15;
type Seg = Omit<SegmentRecord, "members">;
const RISK_LABEL: Record<keyof SegmentRecord["mean_risk"], string> = {
  sgpa_below_6: OUTCOME_META.sgpa_below_6.label, backlog: OUTCOME_META.backlog.label, not_placement_ready: "Not placement-ready", engagement_drop: OUTCOME_META.engagement.label,
};

export function SegmentsView() {
  const segments = useData(["segments-list"], fetchSegments, { revalidateOnFocus: false });
  const [selected, setSelected] = useUrlParam("segment");

  return (
    <>
      <PageHeader
        eyebrow="SEGMENTS"
        title="Groups that need a shared response"
        subtitle="Students who share a pattern are grouped so one action can help many at once. Open a group to see who is in it, how it differs by department and the action recommended for it."
      />
      <DataState state={segments} skeletonRows={4} empty={{ when: (d) => d.length === 0, title: "No segments yet", hint: "Segments appear after the forecasts are loaded." }}>
        {(list) => (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Segments">
              {list.map((s) => {
                const active = selected === s.id;
                return (
                  <button key={s.id} type="button" aria-pressed={active} onClick={() => setSelected(active ? null : s.id)}
                    className={`rounded-md border bg-white p-5 text-left transition hover:border-[#9fc3b1] ${active ? "border-[#28684e] ring-1 ring-[#28684e]" : "border-[#e2e7df]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-[15px] font-semibold leading-[1.4] text-[#252f28]">{s.label.replace(/\s*\(\d+ students\)$/, "")}</h2>
                      <UsersRound size={16} className="mt-0.5 shrink-0 text-[#28684e]" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-[22px] font-semibold tabular-nums text-[#193f31]">{s.count.toLocaleString()} <span className="text-[14px] font-medium text-[#556057]">students · {pct(s.share_of_students, 1)} of campus</span></p>
                    <p className="mt-2 line-clamp-3 text-[14px] leading-5 text-[#59665c]">{s.definition}</p>
                  </button>
                );
              })}
            </section>
            {selected && list.find((s) => s.id === selected) ? <Detail key={selected} seg={list.find((s) => s.id === selected)!} /> : (
              <p className="mt-6 rounded-md border border-dashed border-[#d6ddd3] bg-white px-4 py-8 text-center text-[14.5px] text-[#4b564e]">Choose a segment above to see who is in it and what is recommended.</p>
            )}
          </>
        )}
      </DataState>
      <SyntheticNote className="mt-4" />
    </>
  );
}

function Detail({ seg }: { seg: Seg }) {
  const [page, setPage] = useState(0);
  const db = useDb();
  const { mutate } = useSWRConfig();
  const members = useData(["segment-members", seg.id, page], (d) => fetchSegmentMembers(d, seg.id, page, PAGE_SIZE));
  const recs = useData(["recs", "segment", seg.id], (d) => fetchRecommendations(d, { segment: seg.id, targetType: "segment" }, 0, 20));
  const total = members.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const departments = Object.entries(seg.by_department).sort((a, b) => b[1] - a[1]);
  const maxDept = Math.max(1, ...departments.map(([, n]) => n));
  const risks = Object.entries(seg.mean_risk) as [keyof SegmentRecord["mean_risk"], number | null][];

  async function onUpdate(id: string, patch: { status?: RecStatus; assignedTo?: string | null }) {
    await updateRecommendation(db, id, patch);
    await mutate((key) => Array.isArray(key) && key[0] === "gt" && key[1] === "recs");
  }

  return (
    <section className="mt-[18px] space-y-[18px]" aria-label={`Segment: ${seg.label}`}>
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        <Panel title="Where they are" subtitle="Students in this segment by department; a lift above 1 means the department has more than its fair share">
          <ul className="space-y-2.5">
            {departments.map(([name, n]) => (
              <li key={name}>
                <div className="flex items-baseline justify-between gap-3 text-[14px]"><span className="font-medium text-[#344037]">{name}</span><span className="tabular-nums text-[#4b564e]">{n} · lift {(seg.department_lift[name] ?? 0).toFixed(1)}</span></div>
                <div className="mt-1 h-[6px] rounded-full bg-[#eef1ec]"><div className="h-full rounded-full bg-[#28684e]" style={{ width: `${(n / maxDept) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="What they look like" subtitle="Averages for the segment">
          <dl className="grid grid-cols-2 gap-3 text-[14px]">
            <div className="rounded-md bg-[#f6f8f5] p-3"><dt className="text-[#556057]">Average CGPA</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#252f28]">{seg.mean_cgpa?.toFixed(2) ?? "-"}</dd></div>
            <div className="rounded-md bg-[#f6f8f5] p-3"><dt className="text-[#556057]">Average attendance</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#252f28]">{seg.mean_attendance !== null ? `${seg.mean_attendance.toFixed(0)}%` : "-"}</dd></div>
            <div className="rounded-md bg-[#f6f8f5] p-3"><dt className="text-[#556057]">Rated high overall</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#252f28]">{pct(seg.overall_high_share)}</dd></div>
            {risks.filter(([, v]) => v !== null).map(([k, v]) => (
              <div key={k} className="rounded-md bg-[#f6f8f5] p-3"><dt className="text-[#556057]">{RISK_LABEL[k]} (avg chance)</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#252f28]">{pct(v, 0)}</dd></div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Recommended for this segment" subtitle="One action for the whole group, with its owner and priority">
        <DataState state={recs} skeletonRows={2} empty={{ when: (d) => d.rows.length === 0, title: "No action recommended for this segment" }}>
          {(d) => <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{d.rows.map((r) => <RecommendationCard key={r.id} rec={r} canEdit onUpdate={(patch) => onUpdate(r.id, patch)} compact />)}</div>}
        </DataState>
      </Panel>

      <section className="overflow-hidden rounded-md border border-[#e2e7df] bg-white" aria-label="Members">
        <div className="border-b border-[#edf0eb] px-4 py-3.5"><h2 className="text-[15px] font-semibold text-[#252f28]">Who is in this segment</h2><p className="mt-0.5 text-[14px] text-[#556057]">Highest overall risk first. Open a student for the full forecast.</p></div>
        <DataState state={members} skeletonRows={4} empty={{ when: (d) => d.rows.length === 0, title: "No students in this segment" }}>
          {(d) => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[14px]">
                <thead><tr className="border-b border-[#edf0eb] bg-[#fafbf9] text-[13px] uppercase tracking-[0.8px] text-[#556057]"><th className="px-4 py-2.5 font-semibold">Student</th><th className="px-3 py-2.5 font-semibold">Department</th><th className="px-3 py-2.5 font-semibold">Overall</th><th className="px-3 py-2.5 font-semibold">Expected SGPA</th><th className="px-3 py-2.5 font-semibold">Backlog chance</th><th className="px-4 py-2.5 text-right font-semibold"><span className="sr-only">Open</span></th></tr></thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.student_id} className="border-b border-[#f1f4ef] last:border-0">
                      <td className="px-4 py-2.5"><p className="font-medium text-[#252f28]">{r.name}</p><p className="text-[13px] text-[#556057]">{r.student_id}</p></td>
                      <td className="px-3 py-2.5 text-[#59665c]">{r.department}</td>
                      <td className="px-3 py-2.5"><LevelBadge level={r.overall} /></td>
                      <td className="px-3 py-2.5 tabular-nums">{r.pred_sgpa.toFixed(1)}</td>
                      <td className="px-3 py-2.5"><ProbabilityBar value={r.backlog_p} level={r.backlog_level} /></td>
                      <td className="px-4 py-2.5 text-right"><Link href={`/admin/predictions?student=${encodeURIComponent(r.student_id)}`} className="inline-flex items-center gap-1 font-semibold text-[#28684e] hover:underline">Open <ExternalLink size={11} aria-hidden="true" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
        {total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0eb] px-4 py-3 text-[14px] text-[#4b564e]">
            <span>{(page * PAGE_SIZE + 1).toLocaleString()} to {Math.min(total, (page + 1) * PAGE_SIZE).toLocaleString()} of {total.toLocaleString()}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page" className="rounded-md border border-[#dfe5dc] p-1.5 disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span>Page {page + 1} of {pageCount}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} aria-label="Next page" className="rounded-md border border-[#dfe5dc] p-1.5 disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
