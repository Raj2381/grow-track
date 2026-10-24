"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDot, ExternalLink, ListChecks, Search, TriangleAlert, X } from "lucide-react";
import { RecommendationCard } from "@/components/forecast/recommendation-card";
import { DataState, OUTCOME_META, OUTCOME_ORDER, OWNER_SHORT, PageHeader, StatCard, STATUS_LABEL, SyntheticNote } from "@/components/forecast/ui";
import { useCurrentUser, useData, useDb, useRealtimeRefresh } from "@/lib/data/hooks";
import { fetchFilterOptions } from "@/lib/data/predictions";
import { fetchRecommendationSummary, fetchRecommendations, updateRecommendation, type RecommendationFilters } from "@/lib/data/recommendations";
import { fetchSegments } from "@/lib/data/insights";
import { useSWRConfig } from "swr";
import type { OutcomeKey, Owner, Priority, RecStatus } from "@/lib/ml-types";

const PAGE_SIZE = 20;
const select = "rounded-md border border-[#dfe5dc] bg-white px-2.5 py-2 text-[14px] font-medium text-[#344037]";
const PRIORITY_DOT: Record<Priority, string> = { Critical: "bg-[#c0392b]", High: "bg-[#e0823a]", Medium: "bg-[#dfa943]", Low: "bg-[#4b8b65]" };
const OWNERS = Object.keys(OWNER_SHORT) as Owner[];
const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];
const STATUSES: RecStatus[] = ["open", "accepted", "done", "dismissed"];
type Tab = "all" | "student" | "segment";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "student", label: "Individual students" },
  { id: "segment", label: "Segments & departments" },
];

export function RecommendationsView() {
  const me = useCurrentUser();
  const isFaculty = me.data?.role === "faculty";
  const { mutate } = useSWRConfig();
  const db = useDb();
  useRealtimeRefresh("recommendations", "recs");

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [department, setDepartment] = useState("");
  const [segment, setSegment] = useState("");
  const [owner, setOwner] = useState<Owner | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [status, setStatus] = useState<RecStatus | "">("open");
  const [outcome, setOutcome] = useState<OutcomeKey | "">("");
  const [pageState, setPageState] = useState({ sig: "", page: 0 });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters: RecommendationFilters = useMemo(() => ({
    targetType: tab === "all" ? undefined : tab,
    department: department || undefined, owner: owner || undefined, priority: priority || undefined, status: status || undefined,
    outcome: outcome || undefined, segment: segment || undefined, search: debounced || undefined,
  }), [tab, department, owner, priority, status, outcome, segment, debounced]);
  const sig = JSON.stringify(filters);
  const page = pageState.sig === sig ? pageState.page : 0;

  const list = useData(["recs", "list", sig, page], (d) => fetchRecommendations(d, filters, page, PAGE_SIZE));
  const summary = useData(["recs", "summary"], (d) => fetchRecommendationSummary(d));
  const options = useData(["options"], fetchFilterOptions, { revalidateOnFocus: false });
  const segments = useData(["segments-list"], fetchSegments, { revalidateOnFocus: false });

  const total = list.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const go = (p: number) => setPageState({ sig, page: Math.max(0, Math.min(pageCount - 1, p)) });
  const filtered = Boolean(debounced || department || segment || owner || priority || outcome || status !== "open");
  const clear = () => { setSearch(""); setDepartment(""); setSegment(""); setOwner(""); setPriority(""); setOutcome(""); setStatus("open"); };

  async function onUpdate(id: string, patch: { status?: RecStatus; assignedTo?: string | null }) {
    await updateRecommendation(db, id, patch);
    await mutate((key) => Array.isArray(key) && key[0] === "gt" && key[1] === "recs");
  }

  return (
    <>
      <PageHeader
        eyebrow="RECOMMENDATIONS"
        title={isFaculty ? "Actions for my mentees" : "Recommended actions"}
        subtitle="Who needs help, why, and what to do. Update the status as you go; everyone sees the change."
      />

      <DataState state={summary} skeletonRows={2}>
        {(s) => (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
            <StatCard title="Actions in view" value={s.total.toLocaleString()} note={`${s.by_target_type.student ?? 0} for students · ${s.by_target_type.segment ?? 0} for groups`} icon={ListChecks} />
            <StatCard title="Open, critical or high" value={String(s.open_critical_or_high)} note="act on these first" icon={TriangleAlert} tone="red" />
            <StatCard title="Open" value={String(s.by_status.open ?? 0)} note={`${s.by_status.accepted ?? 0} accepted, in progress`} icon={CircleDot} tone="amber" />
            <StatCard title="Done" value={String(s.by_status.done ?? 0)} note={`${s.by_status.dismissed ?? 0} dismissed`} icon={CheckCircle2} />
          </section>
        )}
      </DataState>

      <section className="mt-[18px] rounded-md border border-[#e2e7df] bg-white" aria-label="Recommendations">
        <div className="flex flex-wrap gap-1.5 border-b border-[#edf0eb] px-4 pt-3" role="tablist" aria-label="Who the action is for">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px rounded-t-md border-b-2 px-3.5 py-2 text-[11.5px] font-semibold ${tab === t.id ? "border-[#28684e] text-[#193f31]" : "border-transparent text-[#7a857c] hover:text-[#344037]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#edf0eb] p-4">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Search by student, group or action</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#556057]" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student ID, name or action" className="w-full rounded-md border border-[#dfe5dc] bg-white py-2 pl-8 pr-3 text-[14px] text-[#252f28] placeholder:text-[#556057]" />
          </label>
          {!isFaculty && (
            <select aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className={select}>
              <option value="">All departments</option>
              {options.data?.departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          )}
          {!isFaculty && (
            <select aria-label="Segment" value={segment} onChange={(e) => setSegment(e.target.value)} className={select}>
              <option value="">All segments</option>
              {segments.data?.map((s) => <option key={s.id} value={s.id}>{s.label.replace(/\s*\(\d+ students\)$/, "")}</option>)}
            </select>
          )}
          <select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value as Owner | "")} className={select}>
            <option value="">Any owner</option>
            {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} className={select}>
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as RecStatus | "")} className={select}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as OutcomeKey | "")} className={select}>
            <option value="">Any outcome</option>
            {OUTCOME_ORDER.map((k) => <option key={k} value={k}>{OUTCOME_META[k].label}</option>)}
          </select>
          {filtered && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-md border border-[#dfe5dc] px-2.5 py-2 text-[14px] font-medium text-[#47564b] hover:bg-[#f5f7f4]">
              <X size={12} aria-hidden="true" /> Reset filters
            </button>
          )}
        </div>

        <div className="p-4">
          <DataState state={list} skeletonRows={4} empty={{ when: (d) => d.rows.length === 0, title: "No actions match these filters", hint: "Try a different status or clear the filters." }}>
            {(d) => (
              <div className="space-y-7">
                {PRIORITIES.map((pr) => {
                  const rows = d.rows.filter((r) => r.priority === pr);
                  if (!rows.length) return null;
                  return (
                    <section key={pr} aria-label={`${pr} priority`}>
                      <h3 className="mb-3 flex items-center gap-2.5 text-[17px] font-bold text-[#1f2c24]">
                        <span className={`h-3.5 w-3.5 rounded-full ${PRIORITY_DOT[pr]}`} aria-hidden="true" />
                        {pr} priority <span className="rounded-full bg-[#eef1ec] px-2.5 py-0.5 text-[14px] font-semibold text-[#344037]">{rows.length}</span>
                      </h3>
                      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {rows.map((r) => (
                          <li key={r.id} className="flex flex-col gap-1.5">
                            <RecommendationCard rec={r} canEdit onUpdate={(patch) => onUpdate(r.id, patch)} compact />
                            {r.targetType === "student" && (
                              <Link href={`/admin/predictions?student=${encodeURIComponent(r.targetId)}`} className="inline-flex items-center gap-1.5 self-start px-1 text-[14px] font-semibold text-[#28684e] hover:underline">
                                Open {r.targetId} forecast <ExternalLink size={13} aria-hidden="true" />
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </DataState>
        </div>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0eb] px-4 py-3 text-[14px] text-[#4b564e]">
            <span>Showing {from.toLocaleString()} to {to.toLocaleString()} of {total.toLocaleString()}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => go(page - 1)} disabled={page === 0} aria-label="Previous page" className="rounded-md border border-[#dfe5dc] p-1.5 disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span>Page {page + 1} of {pageCount}</span>
              <button type="button" onClick={() => go(page + 1)} disabled={page >= pageCount - 1} aria-label="Next page" className="rounded-md border border-[#dfe5dc] p-1.5 disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </section>
      <SyntheticNote className="mt-4" />
    </>
  );
}
