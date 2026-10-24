"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Gauge, Search, ShieldAlert, TrendingDown, UsersRound, X } from "lucide-react";
import { DepartmentStackChart, LevelStack } from "@/components/forecast/charts";
import { StudentSheet } from "@/components/forecast/student-sheet";
import { DataState, LevelBadge, OUTCOME_META, OUTCOME_ORDER, PageHeader, Panel, ProbabilityBar, StatCard, SyntheticNote, pct } from "@/components/forecast/ui";
import { useCurrentUser, useData } from "@/lib/data/hooks";
import { countNote, fetchStudentCounts } from "@/lib/data/scope";
import { useUrlParam } from "@/lib/use-url-param";
import { fetchFilterOptions, fetchPredictionList, fetchPredictionSummary, type PredictionFilters, type PredictionSort } from "@/lib/data/predictions";
import type { OutcomeKey, RiskLevel } from "@/lib/ml-types";

const PAGE_SIZE = 25;
const select = "rounded-md border border-[#dfe5dc] bg-white px-2.5 py-2 text-[14px] font-medium text-[#344037]";

export function ForecastView() {
  // The selected student lives in the URL (?student=) so a drill-down can be shared.
  const [selected, openStudent] = useUrlParam("student");
  const me = useCurrentUser();
  const role = me.data?.role;
  const isFaculty = role === "faculty";

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [branch, setBranch] = useState("");
  const [section, setSection] = useState("");
  const [mentor, setMentor] = useState("");
  const [overall, setOverall] = useState<RiskLevel | "">("");
  const [outcomeKey, setOutcomeKey] = useState<OutcomeKey | "">("");
  const [outcomeLevel, setOutcomeLevel] = useState<RiskLevel>("High");
  const [sort, setSort] = useState<PredictionSort>("risk");
  const [pageState, setPageState] = useState({ sig: "", page: 0 });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters: PredictionFilters = useMemo(() => ({
    search: debounced || undefined, branch: branch || undefined, section: section || undefined, mentor: mentor || undefined,
    overall: overall || undefined, outcome: outcomeKey ? { key: outcomeKey, level: outcomeLevel } : undefined,
  }), [debounced, branch, section, mentor, overall, outcomeKey, outcomeLevel]);
  const sig = JSON.stringify([filters, sort]);
  const page = pageState.sig === sig ? pageState.page : 0;

  const list = useData(["list", sig, page], (db) => fetchPredictionList(db, filters, page, PAGE_SIZE, sort));
  const summary = useData(["summary", branch, section, mentor], (db) => fetchPredictionSummary(db, { branch: branch || undefined, section: section || undefined, mentor: mentor || undefined }));
  const counts = useData(["student-counts"], fetchStudentCounts);
  const options = useData(["options"], fetchFilterOptions, { revalidateOnFocus: false });

  const filtered = Boolean(debounced || branch || section || mentor || overall || outcomeKey);
  const clear = () => { setSearch(""); setBranch(""); setSection(""); setMentor(""); setOverall(""); setOutcomeKey(""); };
  const total = list.data?.count ?? 0;
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const go = (p: number) => setPageState({ sig, page: Math.max(0, Math.min(pageCount - 1, p)) });

  return (
    <>
      <PageHeader
        eyebrow="FORECAST · SEMESTER 6"
        title={isFaculty ? "My mentees" : "Student forecast"}
        subtitle={isFaculty
          ? "What the model expects for each student you mentor next semester, why, and what to do about it. You see only your own mentees."
          : "What the model expects for every student next semester, why, and what to do about it. Open a student for the reasons, a what-if, and their recommended actions."}
      />

      <DataState state={summary} skeletonRows={3}>
        {(s) => (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
              <StatCard title={isFaculty ? "Mentees" : "Students"} value={(counts.data?.total ?? s.total).toLocaleString()} note={counts.data ? countNote(counts.data, "all forecast for semester 6") : "semester 6 forecast"} icon={UsersRound} />
              <StatCard title="High overall risk" value={String(s.overall.High)} note={`${s.total ? Math.round((s.overall.High / s.total) * 100) : 0}% of students · ${s.overall.Medium} more at medium`} icon={ShieldAlert} tone="red" />
              <StatCard title="High backlog risk" value={String(s.outcomes.backlog.High)} note={`average chance ${pct(s.outcomes.backlog.mean_p)}`} icon={TrendingDown} tone="amber" />
              <StatCard title="Expected average SGPA" value={s.outcomes.sgpa_below_6.mean_sgpa?.toFixed(2) ?? "-"} note={`${pct(s.outcomes.placement.mean_ready)} expected to be placement-ready`} icon={Gauge} />
            </section>

            <section className="mt-[18px] grid grid-cols-1 gap-[18px] xl:grid-cols-[1fr_1.2fr]">
              <Panel title="Risk level by outcome" subtitle="Students at each level, for each of the four forecasts">
                <div className="space-y-5">
                  {OUTCOME_ORDER.map((k) => <LevelStack key={k} label={OUTCOME_META[k].label} counts={s.outcomes[k]} />)}
                  <LevelStack label="Overall (the worst picture across outcomes)" counts={s.overall} />
                </div>
              </Panel>
              <Panel title={s.by_department.length > 1 ? "Overall risk by department" : "Overall risk"} subtitle={s.by_department.length > 1 ? "Compare departments at a glance" : "Your department only"}>
                <DepartmentStackChart data={s.by_department.map((d) => ({ name: d.branch_code, High: d.High, Medium: d.Medium, Low: d.Low }))} />
              </Panel>
            </section>
          </>
        )}
      </DataState>

      <section className="mt-[18px] overflow-hidden rounded-md border border-[#e2e7df] bg-white" aria-label="Students">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#edf0eb] p-4">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Search by name, ID or roll number</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#556057]" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID or roll number" className="w-full rounded-md border border-[#dfe5dc] bg-white py-2 pl-8 pr-3 text-[14px] text-[#252f28] placeholder:text-[#556057]" />
          </label>
          {!isFaculty && (
            <select aria-label="Department" value={branch} onChange={(e) => setBranch(e.target.value)} className={select}>
              <option value="">All departments</option>
              {options.data?.departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          )}
          <select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className={select}>
            <option value="">All sections</option>
            {options.data?.sections.map((x) => <option key={x} value={x}>Section {x}</option>)}
          </select>
          {!isFaculty && (
            <select aria-label="Mentor" value={mentor} onChange={(e) => setMentor(e.target.value)} className={select}>
              <option value="">All mentors</option>
              {options.data?.mentors.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <select aria-label="Overall risk level" value={overall} onChange={(e) => setOverall(e.target.value as RiskLevel | "")} className={select}>
            <option value="">Any overall risk</option>
            <option value="High">High overall</option><option value="Medium">Medium overall</option><option value="Low">Low overall</option>
          </select>
          <select aria-label="Outcome" value={outcomeKey} onChange={(e) => setOutcomeKey(e.target.value as OutcomeKey | "")} className={select}>
            <option value="">Any outcome</option>
            {OUTCOME_ORDER.map((k) => <option key={k} value={k}>{OUTCOME_META[k].label}</option>)}
          </select>
          {outcomeKey && (
            <select aria-label="Level on that outcome" value={outcomeLevel} onChange={(e) => setOutcomeLevel(e.target.value as RiskLevel)} className={select}>
              <option value="High">is High</option><option value="Medium">is Medium</option><option value="Low">is Low</option>
            </select>
          )}
          <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as PredictionSort)} className={select}>
            <option value="risk">Highest risk first</option><option value="name">Name (A to Z)</option><option value="sgpa">Lowest expected SGPA</option>
            <option value="backlog">Highest backlog chance</option><option value="ready">Lowest placement-ready chance</option><option value="engagement">Highest engagement-drop chance</option>
          </select>
          {filtered && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-md border border-[#dfe5dc] px-2.5 py-2 text-[14px] font-medium text-[#47564b] hover:bg-[#f5f7f4]">
              <X size={12} aria-hidden="true" /> Clear
            </button>
          )}
        </div>

        <div className="p-0">
          <DataState state={list} skeletonRows={8} empty={{ when: (d) => d.rows.length === 0, title: "No students match these filters", hint: "Try removing a filter or searching for something else." }}>
            {(d) => (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left">
                  <thead>
                    <tr className="text-[12.5px] font-semibold tracking-[0.4px] text-[#818a81]">
                      <th scope="col" className="px-5 py-3">STUDENT</th>
                      <th scope="col" className="px-3 py-3">OVERALL</th>
                      <th scope="col" className="px-3 py-3">EXPECTED SGPA</th>
                      <th scope="col" className="px-3 py-3">BACKLOG CHANCE</th>
                      <th scope="col" className="px-3 py-3">PLACEMENT-READY CHANCE</th>
                      <th scope="col" className="px-3 py-3">ENGAGEMENT-DROP CHANCE</th>
                      <th scope="col" className="px-3 py-3"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.student_id} className="cursor-pointer border-t border-[#edf0eb] hover:bg-[#fafbf9]" onClick={() => openStudent(r.student_id)}>
                        <td className="px-5 py-3">
                          <button type="button" onClick={(e) => { e.stopPropagation(); openStudent(r.student_id); }} className="text-left">
                            <span className="block text-[14.5px] font-semibold text-[#344037]">{r.name}</span>
                            <span className="mt-0.5 block text-[13px] text-[#929a92]">{r.student_id} · {r.department} · Sec {r.section}</span>
                          </button>
                        </td>
                        <td className="px-3 py-3"><LevelBadge level={r.overall} /></td>
                        <td className="px-3 py-3">
                          <span className="text-[14.5px] font-semibold tabular-nums text-[#344037]">{Number(r.pred_sgpa).toFixed(1)}</span>
                          <span className="ml-1.5 text-[13px] text-[#929a92]">{r.sgpa_band} band · {pct(Number(r.sgpa_p))} below 6</span>
                        </td>
                        <td className="px-3 py-3"><ProbabilityBar value={Number(r.backlog_p)} level={r.backlog_level} /></td>
                        <td className="px-3 py-3"><ProbabilityBar value={Number(r.ready_p)} level={r.placement_level} /></td>
                        <td className="px-3 py-3"><ProbabilityBar value={Number(r.engagement_p)} level={r.engagement_level} /></td>
                        <td className="px-3 py-3 text-right"><span className="text-[13px] font-semibold text-[#28684e]">View</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataState>
        </div>

        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0eb] px-5 py-3 text-[14px] text-[#59675b]">
          <span aria-live="polite">{total === 0 ? "No students" : `${from}–${to} of ${total.toLocaleString()} students`}{list.refreshing ? " · updating…" : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(page - 1)} disabled={page === 0} className="inline-flex items-center gap-1 rounded-md border border-[#dfe5dc] bg-white px-2.5 py-1.5 font-medium text-[#315c47] hover:bg-[#f0f5f1] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={13} aria-hidden="true" /> Previous</button>
            <span>Page {page + 1} of {pageCount}</span>
            <button type="button" onClick={() => go(page + 1)} disabled={page >= pageCount - 1} className="inline-flex items-center gap-1 rounded-md border border-[#dfe5dc] bg-white px-2.5 py-1.5 font-medium text-[#315c47] hover:bg-[#f0f5f1] disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={13} aria-hidden="true" /></button>
          </div>
        </nav>
      </section>
      <SyntheticNote className="mt-4" />

      <StudentSheet studentId={selected} onClose={() => openStudent(null)} canEdit={role === "admin" || role === "faculty"} />
    </>
  );
}
