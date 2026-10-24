"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import {
  getStudentPercentage,
  readAttendanceSessions,
  subscribeToAttendanceSessions,
  type AttendanceSession,
} from "@/lib/attendance";
import { readAdminSettings } from "@/lib/admin-settings";
import {
  readInterventions,
  saveInterventions,
  subscribeToInterventions,
  type Intervention,
  type InterventionPriority as Priority,
  type InterventionStatus,
} from "@/lib/interventions";
import { studentProfiles } from "@/lib/students";
import { Pager, usePaged } from "@/components/pager";
import { StudentSelect } from "@/components/student-select";

type SupportStudent = {
  id: string;
  name: string;
  department: string;
  academicScore: number;
  attendance: number;
  priority: Priority;
  reason: string;
};

const statusOptions: InterventionStatus[] = [
  "Planned",
  "In Progress",
  "Completed",
];
const priorityOptions: Priority[] = ["High", "Medium", "Low"];

function getStudentAttendance(
  studentId: string,
  sessions: AttendanceSession[],
  fallback: number,
) {
  const result = getStudentPercentage(studentId, sessions);
  return result.total > 0 ? result.percentage : fallback;
}

function getStatusClass(status: InterventionStatus) {
  if (status === "Completed") return "bg-green-50 text-green-700";
  if (status === "In Progress") return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-700";
}

function getPriorityClass(priority: Priority) {
  if (priority === "High") return "bg-red-50 text-red-700";
  if (priority === "Medium") return "bg-amber-50 text-amber-700";
  return "bg-green-50 text-green-700";
}

function localDateString() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

const priorityRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [minimumAttendance, setMinimumAttendance] = useState(75);
  const [minimumAcademicScore, setMinimumAcademicScore] = useState(60);
  const [studentId, setStudentId] = useState("");
  const formRef = useRef<HTMLElement>(null);
  const [formFocus, setFormFocus] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const [reason, setReason] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [followUpDate, setFollowUpDate] = useState("");
  const [status, setStatus] = useState<InterventionStatus>("Planned");

  useEffect(() => {
    try {
      const loaded = readInterventions();
      if (loaded.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate browser-only saved data after the initial render.
        setInterventions(loaded);
      }

      const settings = readAdminSettings();
      setMinimumAttendance(settings.minimumAttendance);
      setMinimumAcademicScore(settings.minimumAcademicScore);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? `Could not load saved data: ${loadError.message}`
          : "Could not load saved data.",
      );
    }

    setSessions(readAttendanceSessions());
    setReady(true);
    const updateSessions = () => setSessions(readAttendanceSessions());
    const unsubscribe = subscribeToAttendanceSessions(updateSessions);
    const unsubscribeInterventions = subscribeToInterventions(() => {
      try {
        setInterventions(readInterventions());
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? `Could not refresh interventions: ${loadError.message}`
            : "Could not refresh interventions.",
        );
      }
    });
    return () => {
      unsubscribe();
      unsubscribeInterventions();
    };
  }, []);

  const supportStudents = useMemo<SupportStudent[]>(() => {
    return studentProfiles
      .map((student) => {
        const attendance = getStudentAttendance(
          student.id,
          sessions,
          student.attendance,
        );
        const attendanceAtRisk = attendance < minimumAttendance;
        const academicsAtRisk = student.academicScore < minimumAcademicScore;
        if (!attendanceAtRisk && !academicsAtRisk) return null;

        const priority: Priority =
          attendance < 65 || student.academicScore < 50
            ? "High"
            : attendance < 75 || student.academicScore < 60
              ? "Medium"
              : "Low";

        const reasons = [];
        if (attendanceAtRisk) {
          reasons.push(
            `Attendance is ${attendance}%, below the ${minimumAttendance}% minimum.`,
          );
        }
        if (academicsAtRisk) {
          reasons.push(
            `Academic score is ${student.academicScore}%, below the ${minimumAcademicScore}% minimum.`,
          );
        }

        return {
          id: student.id,
          name: student.name,
          department: student.department,
          academicScore: student.academicScore,
          attendance,
          priority,
          reason: reasons.join(" "),
        };
      })
      .filter((student): student is SupportStudent => student !== null)
      .sort(
        (a, b) =>
          priorityRank[a.priority] - priorityRank[b.priority] ||
          a.attendance - b.attendance,
      );
  }, [minimumAcademicScore, minimumAttendance, sessions]);

  const visibleSupportStudents = supportStudents.filter((student) => {
    const query = search.trim().toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.department.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query)
    );
  });
  const pagedSupport = usePaged(visibleSupportStudents, search, 15);
  const studentById = new Map(studentProfiles.map((student) => [student.id, student]));
  const completedCount = interventions.filter(
    (intervention) => intervention.status === "Completed",
  ).length;
  const pendingCount = interventions.length - completedCount;

  function persistInterventions(next: Intervention[]) {
    try {
      saveInterventions(next);
      setInterventions(next);
      setError("");
      return true;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? `Could not save intervention: ${saveError.message}`
          : "Could not save intervention.",
      );
      return false;
    }
  }

  function openCreateForm(selectedId = "") {
    const selectedStudent = supportStudents.find(
      (student) => student.id === selectedId,
    );
    setEditingId(null);
    setStudentId(selectedId);
    setReason(selectedStudent?.reason ?? "");
    setActionPlan("");
    setPriority(selectedStudent?.priority ?? "Medium");
    setFollowUpDate("");
    setStatus("Planned");
    setNotice("");
    setFormOpen(true);
    setFormFocus((n) => n + 1);
  }

  function openEditForm(intervention: Intervention) {
    setEditingId(intervention.id);
    setStudentId(intervention.studentId);
    setReason(intervention.reason);
    setActionPlan(intervention.actionPlan);
    setPriority(intervention.priority);
    setFollowUpDate(intervention.followUpDate);
    setStatus(intervention.status);
    setNotice("");
    setFormOpen(true);
    setFormFocus((n) => n + 1);
  }

  // Opening the form brings it into view and flashes its border so it is obvious where to continue.
  useEffect(() => {
    if (!formFocus || !formOpen) return;
    const el = formRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const focusTimer = window.setTimeout(() => { const areas = el.querySelectorAll<HTMLElement>("form textarea"); (areas[1] ?? areas[0])?.focus({ preventScroll: true }); }, reduce ? 0 : 450);
    const on = window.setTimeout(() => setHighlight(true), 0);
    const off = window.setTimeout(() => setHighlight(false), 2200);
    return () => { window.clearTimeout(focusTimer); window.clearTimeout(on); window.clearTimeout(off); };
  }, [formFocus, formOpen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    if (!studentById.has(studentId)) {
      setError("Select a student from the list.");
      return;
    }
    if (!reason.trim() || !actionPlan.trim() || !followUpDate) {
      setError("Enter a reason, action plan, and follow-up date.");
      return;
    }

    const existing = interventions.find(
      (intervention) => intervention.id === editingId,
    );
    const intervention: Intervention = {
      id: editingId ?? `INT-${Date.now()}`,
      studentId,
      reason: reason.trim(),
      actionPlan: actionPlan.trim(),
      priority,
      followUpDate,
      status,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const next = editingId
      ? interventions.map((item) =>
          item.id === editingId ? intervention : item,
        )
      : [intervention, ...interventions];

    if (!persistInterventions(next)) return;
    setFormOpen(false);
    setNotice(editingId ? "Intervention updated." : "Intervention created.");
  }

  function updateStatus(id: string, nextStatus: InterventionStatus) {
    const next = interventions.map((item) =>
      item.id === id ? { ...item, status: nextStatus } : item,
    );
    if (persistInterventions(next)) setNotice("Intervention status updated.");
  }

  function deleteIntervention(id: string) {
    if (!window.confirm("Delete this intervention? This cannot be undone.")) {
      return;
    }
    const next = interventions.filter((item) => item.id !== id);
    if (persistInterventions(next)) setNotice("Intervention deleted.");
  }

  const inputClass =
    "w-full rounded-md border border-[#dfe5dc] bg-white px-3 py-2.5 text-[15px] text-[#2b382e] outline-none focus:border-[#57906f] focus:ring-2 focus:ring-[#e0eee4]";

  return (
    <AdminPageShell title="Interventions">
      <section className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[13px] font-bold tracking-[1.7px] text-[#28684e]">
            STUDENT SUPPORT
          </p>
          <h1 className="text-[27px] font-semibold leading-tight tracking-[-1px] sm:text-[30px]">
            Intervention management
          </h1>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-5 text-[#7a847b]">
            Identify students who need academic support, plan follow-ups, and
            track intervention progress.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateForm()}
          className="inline-flex items-center gap-2 rounded-md bg-[#28684e] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#1e573f]"
        >
          <Plus size={17} />
          Create intervention
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-800"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between rounded-md border border-[#dce8df] bg-[#f5faf6] px-4 py-3 text-[15px] text-[#28654d]"
        >
          {notice}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total interventions"
          value={interventions.length}
          icon={ClipboardList}
        />
        <SummaryCard
          label="Pending interventions"
          value={pendingCount}
          icon={Clock3}
        />
        <SummaryCard
          label="Completed interventions"
          value={completedCount}
          icon={CheckCircle2}
        />
      </section>

      {formOpen && (
        <section
          ref={formRef}
          aria-label={editingId ? "Edit intervention" : "Action plan form"}
          className={`mb-6 scroll-mt-24 rounded-lg border bg-white p-5 transition-shadow duration-500 sm:p-6 ${highlight ? "border-[#28684e] shadow-[0_0_0_4px_rgba(40,104,78,0.25)]" : "border-[#e2e7df]"}`}
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#2c4031]">
                {editingId ? "Edit intervention" : "Action plan"}
              </h2>
              <p className="mt-1 text-[13.5px] text-[#556057]">
                Save a clear support plan and follow-up date for the selected
                student.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Close intervention form"
              className="rounded-md p-1 text-[#66736a] hover:bg-[#f2f5f1]"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Student">
              <StudentSelect
                className={inputClass}
                students={studentProfiles}
                value={studentId}
                onChange={setStudentId}
                required
              />
            </Field>
            <Field label="Priority">
              <select
                className={inputClass}
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {priorityOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Reason for intervention">
              <textarea
                className={inputClass}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </Field>
            <Field label="Action plan">
              <textarea
                className={inputClass}
                rows={3}
                value={actionPlan}
                onChange={(event) => setActionPlan(event.target.value)}
                required
              />
            </Field>
            <Field label="Follow-up date">
              <input
                className={inputClass}
                type="date"
                min={localDateString()}
                value={followUpDate}
                onChange={(event) => setFollowUpDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as InterventionStatus)
                }
              >
                {statusOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-[#28684e] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#1e573f]"
              >
                {editingId ? "Save changes" : "Save intervention"}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-md border border-[#dfe5dc] px-4 py-2.5 text-[15px] font-semibold text-[#46564a] hover:bg-[#f5f7f4]"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="mb-6 rounded-lg border border-[#e2e7df] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#2c4031]">
              Students needing support
            </h2>
            <p className="mt-1 text-[13.5px] text-[#556057]">
              High priority: attendance below 65% or score below 50. Medium:
              below 75% attendance or 60 score. Lower-priority alerts follow
              your saved settings thresholds.
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b968d]"
            />
            <input
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search students"
              aria-label="Search students needing support"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[15px]">
            <thead className="border-b border-[#e8ece6] text-[13.5px] text-[#748075]">
              <tr>
                <th className="px-3 py-3 font-semibold">Student</th>
                <th className="px-3 py-3 font-semibold">Department</th>
                <th className="px-3 py-3 font-semibold">Academic score</th>
                <th className="px-3 py-3 font-semibold">Attendance</th>
                <th className="px-3 py-3 font-semibold">Priority / reason</th>
                <th className="px-3 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {pagedSupport.pageItems.map((student) => (
                <tr key={student.id}>
                  <td className="px-3 py-4">
                    <p className="font-semibold text-[#2c4031]">
                      {student.name}
                    </p>
                    <p className="mt-1 text-[13.5px] text-[#556057]">{student.id}</p>
                  </td>
                  <td className="px-3 py-4 text-[#56645a]">
                    {student.department}
                  </td>
                  <td className="px-3 py-4">{student.academicScore}%</td>
                  <td className="px-3 py-4">{student.attendance}%</td>
                  <td className="max-w-[310px] px-3 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[13.5px] font-semibold ${getPriorityClass(student.priority)}`}
                    >
                      {student.priority}
                    </span>
                    <p className="mt-2 text-[13.5px] leading-5 text-[#748075]">
                      {student.reason}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      onClick={() => openCreateForm(student.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#cfe1d3] px-3 py-2 text-[13.5px] font-semibold text-[#28684e] hover:bg-[#f2f8f3]"
                    >
                      <Plus size={14} />
                      Create action plan
                    </button>
                  </td>
                </tr>
              ))}
              {ready && visibleSupportStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-[15px] text-[#556057]"
                  >
                    {supportStudents.length === 0
                      ? "No students currently fall below the saved support thresholds."
                      : "No students match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager paged={pagedSupport} noun="students" />
        <p className="mt-3 flex items-center gap-1.5 text-[14px] text-[#556057]">
          <Users size={14} />
          Attendance uses submitted attendance sessions when a directory
          student can be matched by name; otherwise the recorded
          percentage is shown.
        </p>
      </section>

      <section className="rounded-lg border border-[#e2e7df] bg-white p-5">
        <h2 className="mb-4 font-semibold text-[#2c4031]">
          Intervention plans
        </h2>
        {interventions.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#dfe5dc] px-4 py-8 text-center">
            <ClipboardList className="mx-auto text-[#819085]" size={24} />
            <p className="mt-2 text-[15px] font-medium text-[#46564a]">
              No interventions created yet
            </p>
            <p className="mt-1 text-[13.5px] text-[#556057]">
              Create a plan from the student list above or start a new one.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {interventions.map((intervention) => {
              const student = studentById.get(intervention.studentId);
              return (
                <article
                  key={intervention.id}
                  className="rounded-md border border-[#e8ece6] p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[#2c4031]">
                          {student?.name ?? "Unknown student"}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[14px] font-semibold ${getPriorityClass(intervention.priority)}`}
                        >
                          {intervention.priority} priority
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[14px] font-semibold ${getStatusClass(intervention.status)}`}
                        >
                          {intervention.status}
                        </span>
                      </div>
                      <p className="mt-2 text-[15px] text-[#56645a]">
                        {intervention.reason}
                      </p>
                      <p className="mt-1 text-[15px] leading-5 text-[#748075]">
                        Action plan: {intervention.actionPlan}
                      </p>
                      <p className="mt-2 text-[13.5px] text-[#556057]">
                        Follow-up: {intervention.followUpDate}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <select
                        aria-label={`Update status for ${student?.name ?? "intervention"}`}
                        value={intervention.status}
                        onChange={(event) =>
                          updateStatus(
                            intervention.id,
                            event.target.value as InterventionStatus,
                          )
                        }
                        className="rounded-md border border-[#dfe5dc] bg-white px-2.5 py-2 text-[13.5px]"
                      >
                        {statusOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => openEditForm(intervention)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#dfe5dc] px-2.5 py-2 text-[13.5px] font-semibold text-[#46564a] hover:bg-[#f5f7f4]"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteIntervention(intervention.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-2 text-[13.5px] font-semibold text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <section className="rounded-md border border-[#e2e7df] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14.5px] text-[#4b564e]">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#edf4ef] text-[#28684e]">
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-3 text-[29px] font-semibold tracking-[-1px] text-[#252f28]">
        {value}
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[15px] font-medium text-[#46564a]">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
