"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, CircleDashed, UsersRound } from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { SimpleBars } from "@/components/forecast/charts";
import { DataState, PageHeader, Panel, StatCard } from "@/components/forecast/ui";
import type { ScopeStudent } from "@/lib/data/scope";
import { histogram, placementRows, skillAverages, statusCounts, type PlacementRow, type TpoStatus } from "@/lib/role-analytics";
import { DataTable, studentCell, useScope, useStudentCounts, type Column } from "./shared";
import { countNote } from "@/lib/data/scope";

const STATUS_STYLE: Record<TpoStatus, string> = {
  Ready: "bg-[#e6f4ea] text-[#17603a]",
  "In preparation": "bg-[#fdf3dc] text-[#7a520a]",
  "Not ready": "bg-[#fbe6e4] text-[#a02420]",
  "Not assessed": "bg-[#eceff1] text-[#37424a]",
};
export const StatusPill = ({ status }: { status: TpoStatus }) => <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-semibold ${STATUS_STYLE[status]}`}>{status}</span>;

function TpoPage({ title, heading, subtitle, children }: { title: string; heading: string; subtitle: string; children: (rows: PlacementRow[], students: ScopeStudent[]) => React.ReactNode }) {
  const scope = useScope();
  return (
    <AdminPageShell title={title}>
      <PageHeader eyebrow="TPO WORKSPACE" title={heading} subtitle={subtitle} />
      <DataState state={scope} skeletonRows={4} empty={{ when: (d) => d.length === 0, title: "No students to show yet", hint: "Placement information appears once students and their forecasts are in the database." }}>
        {(students) => children(placementRows(students), students)}
      </DataState>
    </AdminPageShell>
  );
}

export function TpoOverview() {
  const counts = useStudentCounts();
  return (
    <TpoPage title="Placement overview" heading="Training and placement overview" subtitle="How ready students are for placements, where the skill gaps are, and who needs training first.">
      {(rows) => {
        const c = statusCounts(rows);
        const skills = skillAverages(rows);
        const readyList = rows.filter((r) => r.status === "Ready").sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0)).slice(0, 6);
        return (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Placement summary">
              <StatCard title="Students" value={(counts.data?.total ?? rows.length).toLocaleString()} note={counts.data ? countNote(counts.data, "all departments") : "all departments"} icon={UsersRound} />
              <StatCard title="Ready" value={String(c.Ready)} note="readiness 80 or more" icon={CheckCircle2} />
              <StatCard title="In preparation" value={String(c["In preparation"])} note="readiness 50 to 79" icon={BriefcaseBusiness} tone="amber" />
              <StatCard title="Not ready or not assessed" value={String(c["Not ready"] + c["Not assessed"])} note={`${c["Not ready"]} not ready · ${c["Not assessed"]} not assessed`} icon={AlertTriangle} tone="red" />
            </section>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel title="Average by skill" subtitle="Only students who have been assessed in that skill are counted" actions={<Link href="/tpo/strong-weak-areas" className="text-[14px] font-semibold text-[#28684e] hover:underline">Strong and weak areas</Link>}>
                <SimpleBars data={skills.map((s) => ({ label: s.label.replace("Mock interviews", "Interviews").replace("Technical skills", "Technical"), value: s.average ?? 0 }))} unit="%" />
              </Panel>
              <Panel title="Ready students" subtitle="Highest readiness first" actions={<Link href="/tpo/placement-readiness" className="text-[14px] font-semibold text-[#28684e] hover:underline">All students</Link>}>
                {readyList.length === 0 ? <p className="text-[14px] text-[#4b564e]">No student has reached the Ready level yet.</p> : (
                  <ul className="divide-y divide-[#eef1ec]">
                    {readyList.map((r) => <li key={r.student.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-[15px] font-semibold text-[#1f2c24]">{r.student.name}</p><p className="text-[13px] text-[#4b564e]">{r.student.id} · {r.student.department}</p></div><span className="text-[18px] font-semibold tabular-nums text-[#17603a]">{r.readiness}</span></li>)}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        );
      }}
    </TpoPage>
  );
}

export function TpoReadiness() {
  const [status, setStatus] = useState("");
  return (
    <TpoPage title="Placement readiness" heading="Student placement readiness" subtitle="Each student's readiness, built from the aptitude, coding, interview and skill assessments they have actually taken.">
      {(rows, students) => {
        const departments = [...new Set(students.map((s) => s.department))].sort();
        return <ReadinessTable rows={rows} departments={departments} status={status} setStatus={setStatus} />;
      }}
    </TpoPage>
  );
}

function ReadinessTable({ rows, departments, status, setStatus }: { rows: PlacementRow[]; departments: string[]; status: string; setStatus: (v: string) => void }) {
  const [dept, setDept] = useState("");
  const shown = rows.filter((r) => (!status || r.status === status) && (!dept || r.student.department === dept)).sort((a, b) => (b.readiness ?? -1) - (a.readiness ?? -1));
  const columns: Column<PlacementRow>[] = [
    { key: "s", header: "Student", render: (r) => studentCell(r.student) },
    { key: "r", header: "Readiness", render: (r) => (r.readiness === null ? "–" : r.readiness.toFixed(1)), align: "right" },
    { key: "st", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "a", header: "Aptitude", render: (r) => score(r, "Aptitude"), align: "right" },
    { key: "c", header: "Coding", render: (r) => score(r, "Coding"), align: "right" },
    { key: "i", header: "Interviews", render: (r) => score(r, "Mock interviews"), align: "right" },
  ];
  const sel = "rounded-md border border-[#cfd8cd] bg-white px-3 py-2.5 text-[14px] text-[#1f2c24]";
  return (
    <Panel>
      <DataTable rows={shown} columns={columns} nameOf={(r) => r.student.name} idOf={(r) => r.student.id} empty="No students match these filters."
        filter={<>
          <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className={sel}><option value="">All departments</option>{departments.map((d) => <option key={d}>{d}</option>)}</select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}><option value="">Any status</option>{(["Ready", "In preparation", "Not ready", "Not assessed"] as const).map((s) => <option key={s}>{s}</option>)}</select>
        </>} />
    </Panel>
  );
}
const score = (r: PlacementRow, label: string) => { const v = r.skills.find((k) => k.label === label)?.score; return v === null || v === undefined ? "–" : Math.round(v); };

export function TpoStrongWeak() {
  return (
    <TpoPage title="Strong and weak areas" heading="Strong and weak areas" subtitle="Where students are strong (75 or more) and where they need training (below 65), skill by skill.">
      {(rows) => {
        const skills = skillAverages(rows);
        return <StrongWeakBody rows={rows} skills={skills} />;
      }}
    </TpoPage>
  );
}

function StrongWeakBody({ rows, skills }: { rows: PlacementRow[]; skills: ReturnType<typeof skillAverages> }) {
  const [skill, setSkill] = useState("");
  const shown = useMemo(() => rows.filter((r) => (r.strengths.length || r.weaknesses.length) && (!skill || r.strengths.includes(skill) || r.weaknesses.includes(skill))), [rows, skill]);
  const columns: Column<PlacementRow>[] = [
    { key: "s", header: "Student", render: (r) => studentCell(r.student) },
    { key: "st", header: "Strong in", render: (r) => (r.strengths.length ? r.strengths.join(", ") : "–") },
    { key: "w", header: "Needs training in", render: (r) => (r.weaknesses.length ? <span className="font-semibold text-[#b42323]">{r.weaknesses.join(", ")}</span> : "–") },
  ];
  return (
    <div className="space-y-6">
      <Panel title="Skill by skill" subtitle="Students assessed, and how many are strong or weak">
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[14px]"><thead><tr className="border-b border-[#e2e7df] text-[12px] uppercase tracking-[0.8px] text-[#3b463e]"><th className="py-2.5 font-semibold">Skill</th><th className="px-3 py-2.5 font-semibold">Average</th><th className="px-3 py-2.5 font-semibold">Assessed</th><th className="px-3 py-2.5 font-semibold">Strong</th><th className="px-3 py-2.5 font-semibold">Weak</th></tr></thead>
          <tbody>{skills.map((k) => <tr key={k.label} className="border-b border-[#eef1ec] last:border-0"><td className="py-3 font-semibold">{k.label}</td><td className="px-3 py-3 tabular-nums">{k.average === null ? "–" : `${k.average}%`}</td><td className="px-3 py-3 tabular-nums">{k.assessed}</td><td className="px-3 py-3 tabular-nums text-[#17603a]">{k.strong}</td><td className="px-3 py-3 tabular-nums font-semibold text-[#b42323]">{k.weak}</td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="Student by student">
        <DataTable rows={shown} columns={columns} nameOf={(r) => r.student.name} idOf={(r) => r.student.id} empty="No student matches." filter={
          <select aria-label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} className="rounded-md border border-[#cfd8cd] bg-white px-3 py-2.5 text-[14px] text-[#1f2c24]"><option value="">Any skill</option>{skills.map((k) => <option key={k.label}>{k.label}</option>)}</select>
        } />
      </Panel>
    </div>
  );
}

export function TpoSupport() {
  return (
    <TpoPage title="Students needing support" heading="Students needing support" subtitle="Students who are not ready or have not been assessed, with the training that fits each one.">
      {(rows) => {
        const needs = rows.filter((r) => r.status === "Not ready" || r.status === "Not assessed").sort((a, b) => (a.readiness ?? -1) - (b.readiness ?? -1));
        const columns: Column<PlacementRow>[] = [
          { key: "s", header: "Student", render: (r) => studentCell(r.student) },
          { key: "st", header: "Status", render: (r) => <StatusPill status={r.status} /> },
          { key: "r", header: "Readiness", render: (r) => (r.readiness === null ? "–" : r.readiness.toFixed(1)), align: "right" },
          { key: "rec", header: "Suggested training", render: (r) => <ul className="list-disc pl-4">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ul> },
        ];
        return (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Support summary">
              <StatCard title="Not ready" value={String(needs.filter((r) => r.status === "Not ready").length)} note="readiness below 50" icon={AlertTriangle} tone="red" />
              <StatCard title="Not assessed" value={String(needs.filter((r) => r.status === "Not assessed").length)} note="no placement assessment yet" icon={CircleDashed} tone="amber" />
            </section>
            <Panel title="Who to help first" subtitle="Lowest readiness first, then students with no assessment">
              <DataTable rows={needs} columns={columns} nameOf={(r) => r.student.name} idOf={(r) => r.student.id} empty="Every student is in preparation or ready." />
            </Panel>
          </div>
        );
      }}
    </TpoPage>
  );
}

export function TpoAnalytics() {
  return (
    <TpoPage title="Placement analytics" heading="Placement analytics" subtitle="Readiness across the campus: how it is spread, how departments compare, and how each skill stands.">
      {(rows) => {
        const hist = histogram(rows.map((r) => r.readiness).filter((x): x is number => x !== null), [0, 20, 40, 50, 60, 70, 80, 90, 100]);
        const depts = [...new Set(rows.map((r) => r.student.department))].sort();
        const perDept = depts.map((d) => { const list = rows.filter((r) => r.student.department === d); const c = statusCounts(list); return { d, total: list.length, c }; });
        const skills = skillAverages(rows);
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel title="How readiness is spread" subtitle="Assessed students by readiness score"><SimpleBars data={hist.map((h) => ({ label: h.label, value: h.count }))} /></Panel>
              <Panel title="Average by skill" subtitle="Assessed students only"><SimpleBars data={skills.map((s) => ({ label: s.label.replace("Mock interviews", "Interviews").replace("Technical skills", "Technical"), value: s.average ?? 0 }))} unit="%" color="#8b6fb0" /></Panel>
            </div>
            <Panel title="Departments side by side" subtitle="Number of students at each placement status">
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[14px]"><thead><tr className="border-b border-[#e2e7df] text-[12px] uppercase tracking-[0.8px] text-[#3b463e]"><th className="py-2.5 font-semibold">Department</th><th className="px-3 py-2.5 font-semibold">Students</th><th className="px-3 py-2.5 font-semibold">Ready</th><th className="px-3 py-2.5 font-semibold">In preparation</th><th className="px-3 py-2.5 font-semibold">Not ready</th><th className="px-3 py-2.5 font-semibold">Not assessed</th></tr></thead>
                <tbody>{perDept.map(({ d, total, c }) => <tr key={d} className="border-b border-[#eef1ec] last:border-0"><td className="py-3 font-semibold">{d}</td><td className="px-3 py-3 tabular-nums">{total}</td><td className="px-3 py-3 tabular-nums text-[#17603a]">{c.Ready}</td><td className="px-3 py-3 tabular-nums">{c["In preparation"]}</td><td className="px-3 py-3 tabular-nums font-semibold text-[#b42323]">{c["Not ready"]}</td><td className="px-3 py-3 tabular-nums">{c["Not assessed"]}</td></tr>)}</tbody></table></div>
            </Panel>
          </div>
        );
      }}
    </TpoPage>
  );
}
