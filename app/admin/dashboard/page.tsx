
"use client";

import { DashboardStrip } from "@/components/forecast/dashboard-strip";
import { AdminPageShell } from "@/components/admin-page-shell";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  GraduationCap,
  Search,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { DataState, PageHeader, Panel } from "@/components/forecast/ui";
import { LevelStack } from "@/components/forecast/charts";
import { useScope } from "@/components/role/shared";
import { toAnalyticsStudent } from "@/lib/role-analytics";
import type { ScopeStudent } from "@/lib/data/scope";
import { Pager, usePaged } from "@/components/pager";


const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Every figure on this page, computed from the students the database returns for the signed-in person (forecast directory plus
 * the facts stored with each forecast), never from files bundled with the app.
 */
function buildDashboard(students: ScopeStudent[]) {
  const people = students.map((s) => ({ s, a: toAnalyticsStudent(s) }));
  const overview = {
    total: students.length,
    averageSuccess: round1(mean(students.map((s) => s.successScore))),
    averageAttendance: round1(mean(students.map((s) => s.attendance))),
    highRisk: students.filter((s) => s.overall === "High").length,
    mediumRisk: students.filter((s) => s.overall === "Medium").length,
  };
  const riskDistribution = [
    { label: "Low risk", level: "Low", color: "bg-[#4b8b65]" },
    { label: "Medium risk", level: "Medium", color: "bg-[#dfa943]" },
    { label: "High risk", level: "High", color: "bg-[#d4665e]" },
  ].map((item) => {
    const count = students.filter((s) => s.overall === item.level).length;
    return { ...item, count, percentage: round1((count / Math.max(1, students.length)) * 100) };
  });
  const attentionStudents = students
    .filter((s) => s.overall === "High")
    .sort((x, y) => x.successScore - y.successScore)
    .map((s) => ({ id: s.id, name: s.name, department: s.department, reason: s.reason || "Low overall success score", score: Math.round(s.successScore), attendance: Math.round(s.attendance), risk: s.overall }));
  const names = [...new Set(students.map((s) => s.department))].sort();
  const departments = names.map((name) => {
    const rows = students.filter((s) => s.department === name);
    return { name, score: Math.round(mean(rows.map((s) => s.successScore))), attendance: Math.round(mean(rows.map((s) => s.attendance))), students: rows.length };
  });
  const rowOf = ({ s, a }: (typeof people)[number]) => ({ id: s.id, name: s.name, department: s.department, risk: s.overall, academicScore: a.academicScore, placementScore: a.placementScore, attendance: a.attendance, engagementScore: a.engagementScore, assignmentCompletion: a.assignmentCompletion });
  const studentSegments = [
    {
      id: "placement", title: "Good marks but weak placement prep", description: "CGPA of 7.0 or more and placement readiness below 65",
      action: "Create a placement-readiness plan: role-focused practice, a mock interview, and a review with the student.",
      actionLabel: "Open placement readiness", href: "/placement-readiness", icon: GraduationCap, color: "border-[#dce8df] bg-[#f5faf6] text-[#28654d]",
      students: people.filter(({ a }) => a.academicScore >= 70 && a.placementScore < 65).map(rowOf),
    },
    {
      id: "disengaged", title: "Disengaged", description: "Engagement below 65, assignments below 60%, or attendance below 65%",
      action: "Arrange a supportive check-in, find the barrier, and agree one small attendance or coursework goal for next week.",
      actionLabel: "Open student directory", href: "/students", icon: Activity, color: "border-[#f1e6ca] bg-[#fffaf0] text-[#946417]",
      students: people.filter(({ a }) => a.engagementScore < 65 || a.assignmentCompletion < 60 || a.attendance < 65).map(rowOf),
    },
    {
      id: "critical", title: "Needs critical support", description: "High forecast risk, CGPA below 5.0, or attendance below 60%",
      action: "Prioritise an advisor review, contact the student promptly, and record a specific support and attendance plan.",
      actionLabel: "Open interventions", href: "/interventions", icon: ShieldAlert, color: "border-[#f0d8d5] bg-[#fff6f5] text-[#a33f38]",
      students: people.filter(({ s, a }) => s.overall === "High" || a.academicScore < 50 || a.attendance < 60).map(rowOf),
    },
  ];
  return { overview, riskDistribution, attentionStudents, departments, studentSegments };
}

type MetricCardProps = {
  title: string;
  value: string;
  description: string;
  change?: string;
  positive?: boolean;
  icon: typeof Users;
};

function MetricCard({
  title,
  value,
  description,
  change,
  positive = true,
  icon: Icon,
}: MetricCardProps) {
  return (
    <section className="rounded-md border border-[#e2e7df] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14.5px] text-[#4b564e]">{title}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#edf4ef] text-[#28684e]">
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>

      <p className="mt-3 text-[29px] font-semibold tracking-[-1px] text-[#252f28]">
        {value}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
        {change && (
          <span
            className={`inline-flex items-center gap-0.5 font-semibold ${
              positive ? "text-[#26724e]" : "text-[#bd5149]"
            }`}
          >
            {positive ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}
            {change}
          </span>
        )}
        <span className="text-[#556057]">{description}</span>
      </div>
    </section>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const classes =
    risk === "High"
      ? "bg-[#f9e9e7] text-[#a33f38]"
      : risk === "Medium"
        ? "bg-[#fbf1dc] text-[#946417]"
        : "bg-[#e8f1eb] text-[#28654d]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[13px] font-semibold ${classes}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          risk === "High"
            ? "bg-[#bf5a52]"
            : risk === "Medium"
              ? "bg-[#c18a2c]"
              : "bg-[#4c9169]"
        }`}
      />
      {risk} risk
    </span>
  );
}

export default function AdminDashboard() {
  const scope = useScope();
  return (
    <AdminPageShell title="Overview">
      <PageHeader
        eyebrow="INSTITUTIONAL OVERVIEW"
        title="Student success dashboard"
        subtitle="Monitor performance, identify risk early, and help every student progress."
      />
      <DashboardStrip />
      <DataState state={scope} skeletonRows={4} empty={{ when: (d) => d.length === 0, title: "No student data yet", hint: "Students appear here once they are in the database and their forecast is loaded." }}>
        {(students) => <DashboardBody students={students} />}
      </DataState>
    </AdminPageShell>
  );
}

function DashboardBody({ students }: { students: ScopeStudent[] }) {
  const { overview, riskDistribution, attentionStudents, departments, studentSegments } = useMemo(() => buildDashboard(students), [students]);
  const [search, setSearch] = useState("");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const filteredStudents = attentionStudents.filter((student) => {
    const query = search.trim().toLowerCase();
    return student.name.toLowerCase().includes(query) || student.id.toLowerCase().includes(query) || student.department.toLowerCase().includes(query);
  });
  const pagedAttention = usePaged(filteredStudents, search, 10);
  const selectedSegment = studentSegments.find((segment) => segment.id === selectedSegmentId);
  const pagedSegment = usePaged(selectedSegment?.students ?? [], selectedSegmentId ?? "", 12);

  return (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricCard
                title="Average success score"
                value={String(overview.averageSuccess)}
                description="out of 100 points"
                icon={GraduationCap}
              />
              <MetricCard
                title="Attendance rate"
                value={`${overview.averageAttendance}%`}
                description="average across all students, semester 5"
                icon={CalendarCheck}
              />
            </section>

            {/* Distribution */}
            <section className="mt-[18px]">
              <Panel title="Student distribution" subtitle="Students at each overall forecast risk level. Risk levels help prioritise support; they do not label students.">
                <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-center">
                  <div>
                    <p className="text-[44px] font-bold leading-none text-[#1f2c24]">{overview.total.toLocaleString()}</p>
                    <p className="mt-1 text-[15px] text-[#4b564e]">students assessed</p>
                  </div>
                  <LevelStack
                    label="Overall risk"
                    counts={{ Low: riskDistribution[0].count, Medium: riskDistribution[1].count, High: riskDistribution[2].count }}
                  />
                </div>
              </Panel>
            </section>

            {/* Student groups */}
            <section className="mt-[18px] overflow-hidden rounded-md border border-[#e2e7df] bg-white">
              <div className="border-b border-[#edf0eb] px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold">
                      Student groups (segments)
                    </h2>
                    <p className="mt-2 max-w-2xl text-[14px] leading-5 text-[#4b564e]">
                      Select a group to review matching students and a suggested
                      support action. Students can appear in more than one
                      segment because the signals are independent.
                    </p>
                  </div>
                  <span className="rounded bg-[#f0f2ee] px-2 py-1 text-[12.5px] text-[#637066]">
                    {overview.total} students
                  </span>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {studentSegments.map((segment) => {
                  const Icon = segment.icon;
                  const selected = selectedSegmentId === segment.id;
                  return (
                    <button
                      key={segment.id}
                      type="button"
                      aria-expanded={selected}
                      onClick={() =>
                        setSelectedSegmentId(selected ? null : segment.id)
                      }
                      className={`rounded-md border p-4 text-left transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57906f] ${
                        selected
                          ? "border-[#28684e] ring-1 ring-[#28684e]"
                          : "border-[#e5e9e3]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14.5px] font-semibold text-[#344037]">
                            {segment.title}
                          </p>
                          <p className="mt-2 text-[13px] leading-4 text-[#4b564e]">
                            {segment.description}
                          </p>
                        </div>
                        <span className={`rounded-md p-2 ${segment.color}`}>
                          <Icon size={18} />
                        </span>
                      </div>
                      <div className="mt-5 flex items-end justify-between">
                        <span className="text-[28px] font-semibold tracking-[-0.8px] text-[#25352a]">
                          {segment.students.length}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#28684e]">
                          {selected ? "Hide students" : "View students"}
                          <ArrowRight size={13} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedSegment && (
                <div className="border-t border-[#edf0eb] bg-[#fbfcfa] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-semibold text-[#344037]">
                        {selectedSegment.title} ·{" "}
                        {selectedSegment.students.length} students
                      </p>
                      <div className="mt-3 max-w-4xl rounded-md border border-[#dce9df] bg-[#f5faf6] p-4">
                        <p className="text-[13px] font-bold uppercase tracking-wide text-[#28654d]">
                          Suggested action
                        </p>
                        <p className="mt-1.5 text-[14px] leading-5 text-[#536056]">
                          {selectedSegment.action}
                        </p>
                        <Link
                          href={selectedSegment.href}
                          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#28684e] hover:underline"
                        >
                          {selectedSegment.actionLabel}
                          <ArrowUpRight size={13} />
                        </Link>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSegmentId(null)}
                      className="rounded-md border border-[#dfe5dc] px-3 py-2 text-[13px] font-medium text-[#536056] hover:bg-white"
                    >
                      Close group
                    </button>
                  </div>

                  {selectedSegment.students.length > 0 ? (
                    <ul className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {pagedSegment.pageItems.map((student) => (
                        <li
                          key={student.id}
                          className="rounded-md border border-[#e5e9e3] bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[14px] font-semibold text-[#344037]">
                                {student.name}
                              </p>
                              <p className="mt-1 text-[13px] text-[#556057]">
                                {student.id} · {student.department}
                              </p>
                            </div>
                            <span className="whitespace-nowrap rounded bg-[#f0f2ee] px-2 py-1 text-[12.5px] text-[#637066]">
                              {student.risk} risk
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#4b564e]">
                            <span>Academic {student.academicScore}</span>
                            <span>Placement {student.placementScore}</span>
                            <span>Attendance {student.attendance}%</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 rounded-md border border-[#e5e9e3] bg-white p-4 text-[14px] text-[#4b564e]">
                      No students currently match this segment.
                    </p>
                  )}
                  <Pager paged={pagedSegment} noun="students" />
                </div>
              )}
            </section>

            {/* Students needing attention */}
            <section className="mt-[18px] overflow-hidden rounded-md border border-[#e2e7df] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0eb] px-5 py-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold">
                      Students requiring attention
                    </h2>
                    <span className="rounded bg-[#f0f2ee] px-2 py-1 text-[12.5px] text-[#637066]">
                      {attentionStudents.length} high risk
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[#4b564e]">
                    Review early signals and plan appropriate interventions.
                  </p>
                </div>

                <Link
                  href="/students"
                  className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#28684e] hover:underline"
                >
                  View all students <ArrowUpRight size={14} />
                </Link>
              </div>

              <div className="border-b border-[#edf0eb] bg-[#fbfcfa] p-3 sm:px-5">
                <label className="flex h-9 max-w-md items-center gap-2 rounded border border-[#dfe4dd] bg-white px-3 text-[#556057]">
                  <Search size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search students, IDs or departments"
                    className="w-full bg-transparent text-[14px] text-[#303b32] outline-none placeholder:text-[#929a92]"
                    aria-label="Search students requiring attention"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Clear student search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="text-[12.5px] font-semibold tracking-[0.4px] text-[#818a81]">
                      <th className="px-5 py-3">STUDENT</th>
                      <th className="px-4 py-3">REASON FOR REVIEW</th>
                      <th className="px-4 py-3">SUCCESS SCORE</th>
                      <th className="px-4 py-3">ATTENDANCE</th>
                      <th className="px-4 py-3">RISK</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAttention.pageItems.map((student) => (
                      <tr
                        key={student.id}
                        className="border-t border-[#edf0eb] hover:bg-[#fafbf9]"
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-[#344037] text-[14px]">
                            {student.name}
                          </div>
                          <div className="mt-1 text-[12.5px] text-[#929a92]">
                            {student.id} · {student.department}
                          </div>
                        </td>
                        <td className="max-w-[240px] whitespace-normal px-4 py-3.5 text-[13px] leading-5 text-[#4b564e]">
                          {student.reason}
                        </td>
                        <td className="px-4 py-3.5">
                          <strong className="text-[14.5px] text-[#344037]">
                            {student.score}
                          </strong>
                          <span className="text-[13px] text-[#929a92]">
                            {" "}
                            / 100
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={
                              student.attendance < 75
                                ? "text-[14px] font-semibold text-[#b94f47]"
                                : "text-[14px] text-[#536056]"
                            }
                          >
                            {student.attendance}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <RiskBadge risk={student.risk} />
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            href="/students"
                            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#28684e] hover:underline"
                          >
                            Review <ArrowRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}

                    {filteredStudents.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-10 text-center text-[14.5px] text-[#4b564e]"
                        >
                          No matching students found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[#edf0eb] px-4">
                <Pager paged={pagedAttention} noun="students" />
              </div>
            </section>

            {/* Department performance */}
            <section className="mt-[18px] overflow-hidden rounded-md border border-[#e2e7df] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] px-5 py-5">
                <div>
                  <h2 className="text-[15px] font-semibold">
                    Department performance
                  </h2>
                  <p className="mt-2 text-[14px] text-[#4b564e]">
                    Compare student success and attendance across departments.
                  </p>
                </div>
                <span className="text-[13px] text-[#556057]">
                  Computed from {overview.total} student records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[570px] border-collapse text-left">
                  <thead>
                    <tr className="text-[12.5px] font-semibold tracking-[0.4px] text-[#818a81]">
                      <th className="px-5 py-3">DEPARTMENT</th>
                      <th className="px-4 py-3">STUDENTS</th>
                      <th className="px-4 py-3">SUCCESS SCORE</th>
                      <th className="px-4 py-3">ATTENDANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((department) => (
                      <tr
                        key={department.name}
                        className="border-t border-[#edf0eb]"
                      >
                        <td className="px-5 py-4 text-[14px] font-medium text-[#344037]">
                          {department.name}
                        </td>
                        <td className="px-4 py-4 text-[14px] text-[#536056]">
                          {department.students.toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="w-7 text-[14px] font-semibold text-[#344037]">
                              {department.score}
                            </span>
                            <div className="h-[5px] w-24 overflow-hidden rounded bg-[#edf0eb]">
                              <div
                                className="h-full rounded bg-[#689578]"
                                style={{ width: `${department.score}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[14px] text-[#536056]">
                          {department.attendance}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e7df] pt-4 text-[13px] text-[#556057]">
              <span>GrowthTrack · Student Success Platform</span>
              <span>Academic year 2026–27</span>
            </footer>
          </>
  );
}