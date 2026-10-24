"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  CircleX,
  House,
  Users,
  ClipboardCheck,
} from "lucide-react";

import { StudentSelect } from "@/components/student-select";
import {
  attendanceStudents,
  attendanceSubjects,
  getAttendanceSessionsSnapshot,
  getStudentPercentage,
  subscribeToAttendanceSessions,
  type AttendanceSession,
} from "@/lib/attendance";

const REQUIRED_PERCENTAGE = 75;
const EMPTY_SESSIONS: AttendanceSession[] = [];

export default function StudentAttendancePage() {
  const [studentId, setStudentId] = useState(attendanceStudents[0].id);
  const sessionsSnapshot = useSyncExternalStore(
    subscribeToAttendanceSessions,
    getAttendanceSessionsSnapshot,
    () => null
  );
  const sessions = sessionsSnapshot ?? EMPTY_SESSIONS;
  const [subjectFilter, setSubjectFilter] = useState("All Subjects");

  const student = attendanceStudents.find((item) => item.id === studentId)!;

  const studentSessions = useMemo(
    () =>
      sessions
        .filter(
          (session) =>
            session.submitted &&
            session.records.some((record) => record.studentId === studentId)
        )
        .sort((a, b) => {
          const dateOrder = b.date.localeCompare(a.date);
          return dateOrder || b.startTime.localeCompare(a.startTime);
        }),
    [sessions, studentId]
  );

  const overall = getStudentPercentage(studentId, sessions);

  const subjectStats = useMemo(
    () =>
      attendanceSubjects
        .map((subject) => ({
          subject,
          ...getStudentPercentage(studentId, sessions, subject),
        }))
        .filter((item) => item.total > 0),
    [studentId, sessions]
  );

  const filteredHistory = studentSessions.filter(
    (session) =>
      subjectFilter === "All Subjects" || session.subject === subjectFilter
  );

  const attendanceRate = overall.percentage;
  const isBelowTarget = overall.total > 0 && attendanceRate < REQUIRED_PERCENTAGE;

  const cardClass =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

  if (sessionsSnapshot === null) {
    return <main className="min-h-screen bg-slate-50 p-8">Loading attendance...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-[15px] font-medium text-indigo-600">
                GrowthTrack / Student Portal
              </p>
              <h1 className="text-3xl font-bold tracking-tight">
                My Attendance
              </h1>
              <p className="mt-2 text-[15px] text-slate-500">
                Monitor attendance, review each subject, and stay on track.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <GraduationCap size={19} className="text-indigo-600" />
              <label htmlFor="student-select" className="sr-only">
                Select student
              </label>
              <StudentSelect
                id="student-select"
                students={attendanceStudents}
                value={studentId}
                onChange={(id) => id && setStudentId(id)}
                className="w-[230px] bg-transparent py-1 text-[15px] font-medium outline-none"
              />
            </div>
          </div>

          <nav
            aria-label="Main navigation"
            className="flex gap-2 overflow-x-auto border-y border-slate-200 py-2"
          >
            <Link
              href="/admin/dashboard"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-indigo-700"
            >
              <House size={17} />
              Dashboard
            </Link>
            <Link
              href="/students"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-indigo-700"
            >
              <Users size={17} />
              Students
            </Link>
            <Link
              href="/students/attendance"
              aria-current="page"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-[15px] font-semibold text-indigo-700"
            >
              <GraduationCap size={17} />
              My attendance
            </Link>
            <Link
              href="/attendance"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-indigo-700"
            >
              <CalendarDays size={17} />
              Attendance overview
            </Link>
            <Link
              href="/admin/attendance"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-indigo-700"
            >
              <ClipboardCheck size={17} />
              Manage attendance
            </Link>
          </nav>
        </header>

        <section className="rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-700 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-[15px] font-medium text-indigo-100">
                Attendance overview
              </p>
              <h2 className="mt-2 text-2xl font-bold">{student.name}</h2>
              <p className="mt-2 text-[15px] text-indigo-100">
                {student.rollNo} · {student.department} · {student.year}
              </p>
              <p className="mt-4 max-w-xl text-[15px] leading-6 text-indigo-100">
                Your attendance percentage is calculated from submitted
                attendance sessions. Late attendance counts as attended .
              </p>
            </div>

            <div className="flex items-center gap-5 self-start rounded-2xl bg-white/10 p-5 md:self-auto">
              <div>
                <p className="text-[15px] text-indigo-100">Overall attendance</p>
                <p className="mt-1 text-4xl font-bold">{attendanceRate}%</p>
                <p className="mt-2 text-xs text-indigo-100">
                  Target: {REQUIRED_PERCENTAGE}%
                </p>
              </div>

              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[8px] border-white/20">
                <svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 h-full w-full -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-white/20"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${attendanceRate * 2.639} 263.9`}
                    className="text-white"
                  />
                </svg>
                <span className="relative text-[15px] font-bold">{attendanceRate}%</span>
              </div>
            </div>
          </div>
        </section>

        {isBelowTarget && (
          <section className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle size={21} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Attendance below target</p>
              <p className="mt-1 text-[15px] leading-6">
                Your attendance is below {REQUIRED_PERCENTAGE}%. Review the
                subjects with the lowest percentages and plan to attend upcoming
                classes. This is a warning, not an official academic notice.
              </p>
            </div>
          </section>
        )}

        {overall.total === 0 && (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-[15px] leading-6 text-blue-900">
            <p className="font-semibold">No attendance records yet</p>
            <p className="mt-1">
              Once an administrator submits an attendance session for your
              department and year, your records and percentages will appear here.
            </p>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<CalendarDays size={20} />}
            title="Total classes"
            value={String(overall.total)}
            subtitle="Submitted sessions"
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            icon={<CheckCircle2 size={20} />}
            title="Classes attended"
            value={String(overall.attended)}
            subtitle={`${overall.late} late attendance record(s) included`}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            icon={<CircleX size={20} />}
            title="Classes missed"
            value={String(overall.absent)}
            subtitle="Marked absent"
            iconClass="bg-rose-50 text-rose-600"
          />

          <SummaryCard
            icon={<TrendingUp size={20} />}
            title="Attendance target"
            value={`${REQUIRED_PERCENTAGE}%`}
            subtitle={
              attendanceRate >= REQUIRED_PERCENTAGE
                ? "Current rate meets the target"
                : "Current rate is below target"
            }
            iconClass={
              attendanceRate >= REQUIRED_PERCENTAGE
                ? "bg-emerald-50 text-emerald-600"
                : "bg-amber-50 text-amber-700"
            }
          />
        </section>

        <section className={cardClass}>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Subject-wise attendance</h2>
              <p className="mt-1 text-[15px] text-slate-500">
                Compare your attendance across subjects.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              At or above target
              <span className="ml-2 h-2.5 w-2.5 rounded-full bg-rose-500" />
              Below target
            </div>
          </div>

          {subjectStats.length === 0 ? (
            <EmptyState message="Subject statistics will appear after attendance sessions are submitted." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {subjectStats.map((item) => {
                const belowTarget = item.percentage < REQUIRED_PERCENTAGE;

                return (
                  <div
                    key={item.subject}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                          <BookOpen size={19} />
                        </span>
                        <div>
                          <h3 className="font-semibold">{item.subject}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.attended} attended out of {item.total} classes
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xl font-bold ${
                          belowTarget ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {item.percentage}%
                      </span>
                    </div>

                    <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          belowTarget ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>

                    <div className="mt-3 flex justify-between text-xs text-slate-500">
                      <span>{item.absent} absent</span>
                      <span>{item.late} late</span>
                    </div>

                    {belowTarget && (
                      <p className="mt-3 text-xs font-medium text-rose-600">
                        Needs attention: below {REQUIRED_PERCENTAGE}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className={cardClass}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Attendance history</h2>
              <p className="mt-1 text-[15px] text-slate-500">
                Review each submitted class session and your recorded status.
              </p>
            </div>

            <select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-indigo-400 sm:w-auto"
              aria-label="Filter attendance history by subject"
            >
              <option>All Subjects</option>
              {attendanceSubjects.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyState message="No submitted attendance records match this selection." />
          ) : (
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date and time</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((session) => {
                    const record = session.records.find(
                      (item) => item.studentId === studentId
                    );

                    return (
                      <tr key={session.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <p className="font-medium">{session.date}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                            <Clock3 size={13} />
                            {session.startTime}–{session.endTime}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-medium">{session.title}</td>
                        <td className="px-4 py-4 text-slate-600">{session.subject}</td>
                        <td className="px-4 py-4">
                          <StatusBadge status={record?.status ?? "absent"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-slate-400">
          Percentages use submitted sessions only. Present and Late
          count as attended. These records are browser-local and are not official
          academic records.
        </p>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  subtitle,
  iconClass,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <span className={`rounded-xl p-3 ${iconClass}`}>{icon}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{subtitle}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    present: "bg-emerald-50 text-emerald-700",
    absent: "bg-rose-50 text-rose-700",
    late: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center p-6 text-center">
      <CalendarDays size={28} className="mb-3 text-slate-300" />
      <p className="max-w-md text-[15px] text-slate-500">{message}</p>
    </div>
  );
}