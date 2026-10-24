"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpenCheck, ClipboardCheck, ShieldAlert, UsersRound } from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { SimpleBars } from "@/components/forecast/charts";
import { DataState, EmptyBlock, LevelBadge, PageHeader, Panel, StatCard } from "@/components/forecast/ui";
import { useCurrentUser } from "@/lib/data/hooks";
import { useSWRConfig } from "swr";
import { Lock, LockOpen, MessageSquare } from "lucide-react";
import { useData, useDb } from "@/lib/data/hooks";
import { fetchFeedbackWindow, fetchMyDepartment, isWindowOpen, setFeedbackWindow } from "@/lib/data/feedback-window";
import type { ScopeStudent } from "@/lib/data/scope";
import { ATTENDANCE_LIMIT, byMentor, bySection, histogram, summarize } from "@/lib/role-analytics";
import { DataTable, pctText, studentCell, toneText, useFaculty, useScope, useStudentCounts, type Column } from "./shared";
import { countNote } from "@/lib/data/scope";

/** Every HOD page: the scope (their department) comes from the database, so these views only arrange what they are given. */
function HodPage({ title, eyebrow, heading, subtitle, children }: { title: string; eyebrow: string; heading: string; subtitle: string; children: (students: ScopeStudent[], department: string) => React.ReactNode }) {
  const scope = useScope();
  return (
    <AdminPageShell title={title}>
      <PageHeader eyebrow={eyebrow} title={heading} subtitle={subtitle} />
      <DataState state={scope} skeletonRows={4} empty={{ when: (d) => d.length === 0, title: "No students found for your department", hint: "Students appear here once they are in the database and their forecast is loaded." }}>
        {(students) => children(students, students[0]?.department ?? "")}
      </DataState>
    </AdminPageShell>
  );
}

export function HodDashboard() {
  const me = useCurrentUser();
  const faculty = useFaculty();
  const counts = useStudentCounts();
  return (
    <HodPage title="Department overview" eyebrow="HOD WORKSPACE" heading="Department overview" subtitle="How your department is doing: attendance, results, risk and the mentors who look after your students.">
      {(students, department) => {
        const t = summarize(students);
        const mentors = byMentor(students, (faculty.data ?? []).filter((f) => students.some((s) => s.mentorId === f.id)));
        const atRisk = students.filter((s) => s.overall === "High").sort((a, b) => b.backlogP - a.backlogP).slice(0, 8);
        return (
          <div className="space-y-6">
            <p className="text-[15px] text-[#4b564e]">{department}{me.data?.displayName ? ` · ${me.data.displayName}` : ""}</p>
            <FeedbackControl compact />
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Department summary">
              <StatCard title="Students" value={(counts.data?.total ?? t.students).toLocaleString()} note={counts.data ? countNote(counts.data, "in your department") : "in your department"} icon={UsersRound} />
              <StatCard title="Average attendance" value={t.avgAttendance === null ? "–" : `${t.avgAttendance}%`} note={`${t.belowAttendance} below ${ATTENDANCE_LIMIT}%`} icon={ClipboardCheck} tone={t.belowAttendance ? "amber" : "green"} />
              <StatCard title="Average CGPA" value={t.avgCgpa === null ? "–" : t.avgCgpa.toFixed(2)} note={`${t.withBacklog} with an active backlog`} icon={BookOpenCheck} />
              <StatCard title="High overall risk" value={String(t.highRisk)} note={`${t.mediumRisk} more at medium`} icon={ShieldAlert} tone="red" />
            </section>
            <Panel title="Students to look at first" subtitle="Highest chance of a backlog among those rated high overall" actions={<Link href="/hod/students" className="text-[14px] font-semibold text-[#28684e] hover:underline">All students</Link>}>
              {atRisk.length === 0 ? <EmptyBlock title="No student is rated high risk" hint="Nothing needs urgent attention right now." /> : (
                <ul className="divide-y divide-[#eef1ec]">
                  {atRisk.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0"><p className="text-[15px] font-semibold text-[#1f2c24]">{s.name}</p><p className="text-[13px] text-[#4b564e]">{s.id} · {s.reason}</p></div>
                      <LevelBadge level={s.overall} suffix="overall" />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Mentors" subtitle="Who looks after how many students, and where the risk sits" actions={<Link href="/hod/faculty" className="text-[14px] font-semibold text-[#28684e] hover:underline">Faculty overview</Link>}>
              <MentorTable rows={mentors} />
            </Panel>
          </div>
        );
      }}
    </HodPage>
  );
}

function MentorTable({ rows }: { rows: ReturnType<typeof byMentor> }) {
  if (!rows.length) return <EmptyBlock title="No mentors found" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[14px]">
        <thead><tr className="border-b border-[#e2e7df] text-[12px] uppercase tracking-[0.8px] text-[#3b463e]"><th className="py-2.5 pr-3 font-semibold">Mentor</th><th className="px-3 py-2.5 font-semibold">Mentees</th><th className="px-3 py-2.5 font-semibold">High risk</th><th className="px-3 py-2.5 font-semibold">Avg attendance</th><th className="px-3 py-2.5 font-semibold">Avg CGPA</th><th className="px-3 py-2.5 font-semibold">With backlog</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[#eef1ec] last:border-0">
              <td className="py-3 pr-3"><p className="font-semibold text-[#1f2c24]">{r.name}</p><p className="text-[12.5px] text-[#4b564e]">{r.id}</p></td>
              <td className="px-3 py-3 tabular-nums">{r.mentees}</td><td className={`px-3 py-3 tabular-nums ${toneText(r.highRisk > 0)}`}>{r.highRisk}</td>
              <td className="px-3 py-3 tabular-nums">{pctText(r.avgAttendance)}</td><td className="px-3 py-3 tabular-nums">{r.avgCgpa === null ? "–" : r.avgCgpa.toFixed(2)}</td><td className="px-3 py-3 tabular-nums">{r.withBacklog}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HodFaculty() {
  const faculty = useFaculty();
  return (
    <HodPage title="Faculty overview" eyebrow="HOD WORKSPACE" heading="Faculty overview" subtitle="Each mentor in your department with the students they look after.">
      {(students) => {
        const dept = students[0]?.branchCode;
        const rows = byMentor(students, (faculty.data ?? []).filter((f) => f.branchCode === dept));
        return <Panel title={`${rows.length} mentors`} subtitle="Mentees, risk and averages per mentor"><MentorTable rows={rows} /></Panel>;
      }}
    </HodPage>
  );
}

export function HodStudents() {
  return (
    <HodPage title="Student performance" eyebrow="HOD WORKSPACE" heading="Student performance" subtitle="Every student in your department with their results, attendance and forecast.">
      {(students) => <StudentsPanel students={students} />}
    </HodPage>
  );
}

function StudentsPanel({ students }: { students: ScopeStudent[] }) {
  const [level, setLevel] = useState("");
  const sections = useMemo(() => [...new Set(students.map((s) => s.section))].sort(), [students]);
  const [section, setSection] = useState("");
  const rows = students.filter((s) => (!level || s.overall === level) && (!section || s.section === section));
  const columns: Column<ScopeStudent>[] = [
    { key: "s", header: "Student", render: studentCell },
    { key: "cgpa", header: "CGPA", render: (s) => s.cgpa.toFixed(2), align: "right" },
    { key: "att", header: "Attendance", render: (s) => <span className={toneText(s.attendance < ATTENDANCE_LIMIT)}>{s.attendance.toFixed(1)}%</span>, align: "right" },
    { key: "bk", header: "Backlogs", render: (s) => <span className={toneText(s.backlogs > 0)}>{s.backlogs}</span>, align: "right" },
    { key: "sg", header: "Expected SGPA", render: (s) => s.predSgpa.toFixed(1), align: "right" },
    { key: "risk", header: "Overall", render: (s) => <LevelBadge level={s.overall} suffix="" /> },
  ];
  const sel = "rounded-md border border-[#cfd8cd] bg-white px-3 py-2.5 text-[14px] text-[#1f2c24]";
  return (
    <Panel>
      <DataTable rows={rows} columns={columns} nameOf={(s) => s.name} idOf={(s) => s.id} empty="No students match these filters."
        filter={<>
          <select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className={sel}><option value="">All sections</option>{sections.map((x) => <option key={x} value={x}>Section {x}</option>)}</select>
          <select aria-label="Overall risk" value={level} onChange={(e) => setLevel(e.target.value)} className={sel}><option value="">Any risk</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>
        </>} />
    </Panel>
  );
}

export function HodAttendance() {
  return (
    <HodPage title="Attendance analytics" eyebrow="HOD WORKSPACE" heading="Attendance analytics" subtitle={`Attendance across your department and the students below the ${ATTENDANCE_LIMIT}% exam-eligibility line.`}>
      {(students) => {
        const t = summarize(students);
        const low = students.filter((s) => s.attendance < ATTENDANCE_LIMIT).sort((a, b) => a.attendance - b.attendance);
        const hist = histogram(students.map((s) => s.attendance), [0, 50, 60, 70, 75, 80, 90, 100]);
        const sections = bySection(students);
        const columns: Column<ScopeStudent>[] = [
          { key: "s", header: "Student", render: studentCell },
          { key: "att", header: "Attendance", render: (s) => <span className="font-semibold text-[#b42323]">{s.attendance.toFixed(1)}%</span>, align: "right" },
          { key: "ch", header: "Change vs last semester", render: (s) => `${s.attChange > 0 ? "+" : ""}${s.attChange.toFixed(1)} pts`, align: "right" },
          { key: "m", header: "Mentor", render: (s) => s.mentorId },
        ];
        return (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Attendance summary">
              <StatCard title="Average attendance" value={t.avgAttendance === null ? "–" : `${t.avgAttendance}%`} note={`${t.students} students`} icon={ClipboardCheck} />
              <StatCard title={`Below ${ATTENDANCE_LIMIT}%`} value={String(t.belowAttendance)} note={`${t.students ? Math.round((t.belowAttendance / t.students) * 100) : 0}% of the department`} icon={AlertTriangle} tone="red" />
              <StatCard title="Sections" value={String(sections.length)} note="compared below" icon={UsersRound} />
            </section>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel title="How attendance is spread" subtitle="Students by attendance band (%)"><SimpleBars data={hist.map((h) => ({ label: h.label, value: h.count }))} /></Panel>
              <Panel title="By section" subtitle="Average attendance and students below the line">
                <table className="w-full text-left text-[14px]"><thead><tr className="border-b border-[#e2e7df] text-[12px] uppercase tracking-[0.8px] text-[#3b463e]"><th className="py-2.5 font-semibold">Section</th><th className="px-3 py-2.5 font-semibold">Students</th><th className="px-3 py-2.5 font-semibold">Average</th><th className="px-3 py-2.5 font-semibold">Below {ATTENDANCE_LIMIT}%</th></tr></thead>
                  <tbody>{sections.map((r) => <tr key={r.section} className="border-b border-[#eef1ec] last:border-0"><td className="py-3 font-semibold">Section {r.section}</td><td className="px-3 py-3 tabular-nums">{r.students}</td><td className="px-3 py-3 tabular-nums">{pctText(r.avgAttendance)}</td><td className={`px-3 py-3 tabular-nums ${toneText(r.belowAttendance > 0)}`}>{r.belowAttendance}</td></tr>)}</tbody></table>
              </Panel>
            </div>
            <Panel title="Students below the line" subtitle="Lowest attendance first">
              <DataTable rows={low} columns={columns} nameOf={(s) => s.name} idOf={(s) => s.id} empty={`Every student is at or above ${ATTENDANCE_LIMIT}%.`} />
            </Panel>
          </div>
        );
      }}
    </HodPage>
  );
}

export function HodResults() {
  return (
    <HodPage title="Academic results" eyebrow="HOD WORKSPACE" heading="Academic results" subtitle="CGPA and backlogs across the department, and the students whose results need support.">
      {(students) => {
        const t = summarize(students);
        const hist = histogram(students.map((s) => s.cgpa), [0, 5, 6, 7, 8, 9, 10]);
        const sections = bySection(students);
        const needs = students.filter((s) => s.backlogs > 0 || s.cgpa < 6).sort((a, b) => b.backlogs - a.backlogs || a.cgpa - b.cgpa);
        const columns: Column<ScopeStudent>[] = [
          { key: "s", header: "Student", render: studentCell },
          { key: "cgpa", header: "CGPA", render: (s) => <span className={toneText(s.cgpa < 6)}>{s.cgpa.toFixed(2)}</span>, align: "right" },
          { key: "last", header: "Last SGPA", render: (s) => s.sgpaLast.toFixed(2), align: "right" },
          { key: "bk", header: "Active backlogs", render: (s) => <span className={toneText(s.backlogs > 0)}>{s.backlogs}</span>, align: "right" },
          { key: "sg", header: "Expected SGPA", render: (s) => s.predSgpa.toFixed(1), align: "right" },
        ];
        return (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Results summary">
              <StatCard title="Average CGPA" value={t.avgCgpa === null ? "–" : t.avgCgpa.toFixed(2)} note={`${t.students} students`} icon={BookOpenCheck} />
              <StatCard title="With an active backlog" value={String(t.withBacklog)} note="need a clearance plan" icon={AlertTriangle} tone="amber" />
              <StatCard title="Expected SGPA next semester" value={t.avgSgpaForecast === null ? "–" : t.avgSgpaForecast.toFixed(2)} note="department average, from the forecast" icon={ShieldAlert} />
            </section>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel title="CGPA spread" subtitle="Students by CGPA band"><SimpleBars data={hist.map((h) => ({ label: h.label, value: h.count }))} color="#4b8b65" /></Panel>
              <Panel title="By section" subtitle="Average CGPA and students at high risk">
                <table className="w-full text-left text-[14px]"><thead><tr className="border-b border-[#e2e7df] text-[12px] uppercase tracking-[0.8px] text-[#3b463e]"><th className="py-2.5 font-semibold">Section</th><th className="px-3 py-2.5 font-semibold">Students</th><th className="px-3 py-2.5 font-semibold">Avg CGPA</th><th className="px-3 py-2.5 font-semibold">High risk</th></tr></thead>
                  <tbody>{sections.map((r) => <tr key={r.section} className="border-b border-[#eef1ec] last:border-0"><td className="py-3 font-semibold">Section {r.section}</td><td className="px-3 py-3 tabular-nums">{r.students}</td><td className="px-3 py-3 tabular-nums">{r.avgCgpa === null ? "–" : r.avgCgpa.toFixed(2)}</td><td className={`px-3 py-3 tabular-nums ${toneText(r.highRisk > 0)}`}>{r.highRisk}</td></tr>)}</tbody></table>
              </Panel>
            </div>
            <Panel title="Students whose results need support" subtitle="An active backlog or a CGPA below 6">
              <DataTable rows={needs} columns={columns} nameOf={(s) => s.name} idOf={(s) => s.id} empty="No student has an active backlog or a CGPA below 6." />
            </Panel>
          </div>
        );
      }}
    </HodPage>
  );
}

/* ------------------------------------------------------------------------------------------------ student feedback */

/** The HOD decides when students may give feedback. Closed by default; students are told as soon as it opens. */
export function FeedbackControl({ compact = false }: { compact?: boolean }) {
  const db = useDb();
  const { mutate } = useSWRConfig();
  const dept = useData(["my-department"], fetchMyDepartment, { revalidateOnFocus: false });
  const win = useData(dept.data ? ["feedback-window", dept.data.code] : null, (d) => fetchFeedbackWindow(d, dept.data!.code));
  const [message, setMessage] = useState<string | null>(null);
  const [closes, setCloses] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const open = isWindowOpen(win.data ?? null);
  const text = message ?? win.data?.message ?? "";
  const closesValue = closes ?? (win.data?.closesAt ? win.data.closesAt.slice(0, 10) : "");

  async function apply(isOpen: boolean) {
    if (!dept.data) return;
    setBusy(true);
    setError("");
    setDone("");
    try {
      // a closing date means the end of that day, local time
      const closesAt = isOpen && closesValue ? new Date(`${closesValue}T23:59:59`).toISOString() : null;
      if (closesAt && new Date(closesAt).getTime() < Date.now()) throw new Error("Choose a closing date from today onward.");
      await setFeedbackWindow(db, dept.data.code, { isOpen, message: text, closesAt });
      await mutate((key) => Array.isArray(key) && key[0] === "gt" && key[1] === "feedback-window");
      setDone(isOpen ? `Feedback is now open for ${dept.data.name} students. They see it in their notifications and on the Feedback page.` : `Feedback is now closed for ${dept.data.name} students.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const messageFields = (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
      <label className="text-[14px] font-semibold text-[#1f2c24]">
        <span className="inline-flex items-center gap-2"><MessageSquare size={15} aria-hidden="true" />Message to students</span>
        <textarea value={text} onChange={(e) => setMessage(e.target.value)} maxLength={300} rows={3} placeholder="For example: Please rate this semester's courses and teachers." className="mt-2 w-full rounded-md border border-[#cfd8cd] bg-white px-3 py-2.5 text-[15px] font-normal text-[#1f2c24] placeholder:text-[#6b756c]" />
        <span className="mt-1 block text-[12.5px] font-normal text-[#4b564e]">{text.length}/300</span>
      </label>
      <label className="text-[14px] font-semibold text-[#1f2c24]">
        Close automatically on
        <input type="date" value={closesValue} onChange={(e) => setCloses(e.target.value)} className="mt-2 w-full rounded-md border border-[#cfd8cd] bg-white px-3 py-2.5 text-[15px] font-normal text-[#1f2c24]" />
        <span className="mt-1 block text-[12.5px] font-normal text-[#4b564e]">Leave empty to keep it open until you lock it.</span>
      </label>
    </div>
  );

  return (
      <DataState state={dept} skeletonRows={2} empty={{ when: (d) => d === null, title: "Your department could not be found", hint: "This page is for a Head of Department account." }}>
        {(d) => (
          <div className="space-y-6">
            <section className={`overflow-hidden rounded-md border bg-white p-6 shadow-[0_4px_14px_rgba(15,42,95,0.10)] ${open ? "border-[#9fd3b0]" : "border-[#e2b9b4]"}`} aria-label="Student feedback control">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`grid h-12 w-12 place-items-center rounded-lg ${open ? "bg-[#e6f4ea] text-[#17603a]" : "bg-[#fbe6e4] text-[#a02420]"}`}>{open ? <LockOpen size={24} aria-hidden="true" /> : <Lock size={24} aria-hidden="true" />}</span>
                  <div>
                    <p className="text-[13px] font-semibold uppercase tracking-wide text-[#4b564e]">{d!.name}</p>
                    <p className="text-[22px] font-semibold text-[#1f2c24]">Feedback is {open ? "open" : "locked"}</p>
                    {open && win.data?.closesAt && <p className="text-[14px] text-[#4b564e]">Closes {new Date(win.data.closesAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
                    {win.data?.isOpen && !open && <p className="text-[14px] text-[#a02420]">The closing date has passed, so it closed itself.</p>}
                  </div>
                </div>
                {open
                  ? <button type="button" disabled={busy} onClick={() => apply(false)} className="inline-flex items-center gap-2 rounded-md border border-[#a02420] bg-white px-5 py-2.5 text-[15px] font-semibold text-[#a02420] hover:bg-[#fbe6e4] disabled:opacity-60"><Lock size={16} aria-hidden="true" />Lock feedback</button>
                  : <button type="button" disabled={busy} onClick={() => apply(true)} className="inline-flex items-center gap-2 rounded-md bg-[#28684e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#1f5340] disabled:opacity-60"><LockOpen size={16} aria-hidden="true" />Open feedback and notify students</button>}
              </div>
              {done && <p role="status" className="mt-4 rounded bg-[#eef6f1] px-4 py-3 text-[14px] text-[#1f5a43]">{done}</p>}
              {error && <p role="alert" className="mt-4 rounded bg-[#fff6f5] px-4 py-3 text-[14px] text-[#8f2f29]">{error}</p>}
            </section>

            {compact ? (
              <details className="rounded-md border border-[#e2e7df] bg-white px-5 py-3.5">
                <summary className="cursor-pointer text-[15px] font-semibold text-[#1f2c24]">Message and closing date (optional)</summary>
                <div className="mt-4">{messageFields}</div>
              </details>
            ) : (
            <Panel title="What students see" subtitle="Optional. Both are sent with the notification and shown on the Feedback page.">
              {messageFields}
              {open && <p className="mt-4 text-[13.5px] text-[#4b564e]">Changes to the message or date are applied the next time you open feedback.</p>}
            </Panel>
            )}
          </div>
        )}
      </DataState>
  );
}

export function HodFeedback() {
  return (
    <AdminPageShell title="Student feedback">
      <PageHeader eyebrow="HOD WORKSPACE" title="Student feedback" subtitle="Feedback is locked for students until you open it. When you open it, every student in your department is notified and can fill in the feedback form." />
      <FeedbackControl />
    </AdminPageShell>
  );
}
