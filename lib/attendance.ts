import { studentProfiles } from "@/lib/students";
import { BRANCH_CODES, subjectsOfSemester, type BranchCode } from "@student/data/catalog";

export type AttendanceStatus = "present" | "absent" | "late";

export type AttendanceStudent = {
  id: string;
  name: string;
  rollNo: string;
  department: string;
  year: string;
  section: string;
};

export type AttendanceRecord = {
  studentId: string;
  status: AttendanceStatus;
};

export type AttendanceSession = {
  id: string;
  title: string;
  subject: string;
  department: string;
  year: string;
  /** Class section; absent on sessions saved before sections existed. */
  section?: string;
  date: string;
  startTime: string;
  endTime: string;
  submitted: boolean;
  createdAt: string;
  records: AttendanceRecord[];
};

export const ATTENDANCE_STORAGE_KEY = "campusiq-attendance-sessions";

const EMPTY_ATTENDANCE_SESSIONS: AttendanceSession[] = [];
let cachedStorageValue: string | null | undefined;
let cachedAttendanceSessions = EMPTY_ATTENDANCE_SESSIONS;

export function subscribeToAttendanceSessions(
  onStoreChange: () => void
): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("campusiq-attendance-updated", onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener("campusiq-attendance-updated", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function getAttendanceSessionsSnapshot(): AttendanceSession[] {
  if (typeof window === "undefined") return EMPTY_ATTENDANCE_SESSIONS;

  try {
    const stored = window.localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (stored === cachedStorageValue) return cachedAttendanceSessions;

    cachedStorageValue = stored;
    if (!stored) {
      cachedAttendanceSessions = EMPTY_ATTENDANCE_SESSIONS;
      return cachedAttendanceSessions;
    }

    const parsed: unknown = JSON.parse(stored);
    cachedAttendanceSessions = Array.isArray(parsed)
      ? normalizeAttendanceSessions(parsed as AttendanceSession[])
      : EMPTY_ATTENDANCE_SESSIONS;
    return cachedAttendanceSessions;
  } catch {
    cachedAttendanceSessions = EMPTY_ATTENDANCE_SESSIONS;
    return cachedAttendanceSessions;
  }
}

export const attendanceStudents: AttendanceStudent[] = studentProfiles.map(
  (student) => ({
    id: student.id,
    name: student.name,
    rollNo: student.id,
    department: student.department,
    year: student.year,
    section: student.section,
  }),
);

const departmentBranch = new Map<string, BranchCode>(
  studentProfiles.map((student) => [student.department, student.branchCode as BranchCode]),
);

/** Subjects taught to a department in the latest semester (from the subject catalog). */
export function attendanceSubjectsFor(department: string): string[] {
  const branch = departmentBranch.get(department) ?? "CSE";
  const semester = studentProfiles.find((student) => student.department === department)?.semester ?? 5;
  return subjectsOfSemester(semester, branch).map((subject) => subject.name);
}

/** Class sections of a department. */
export function attendanceSectionsFor(department: string): string[] {
  return Array.from(
    new Set(attendanceStudents.filter((student) => student.department === department).map((student) => student.section)),
  ).sort();
}

/** Every subject of the latest semester across all departments. */
export const attendanceSubjects = Array.from(
  new Set(
    BRANCH_CODES.flatMap((branch) => subjectsOfSemester(5, branch).map((subject) => subject.name)),
  ),
).sort();

export const attendanceDepartments = Array.from(
  new Set(attendanceStudents.map((student) => student.department)),
);

export const attendanceYears = Array.from(
  new Set(attendanceStudents.map((student) => student.year)),
);

const legacyAttendanceStudentIds: Record<string, string> = {
  STU001: "STU-1024",
  STU002: "STU-1087",
};

function normalizeAttendanceSessions(
  sessions: AttendanceSession[],
): AttendanceSession[] {
  return sessions.map((session) => ({
    ...session,
    records: session.records.map((record) => ({
      ...record,
      studentId: legacyAttendanceStudentIds[record.studentId] ?? record.studentId,
    })),
  }));
}

export function readAttendanceSessions(): AttendanceSession[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? normalizeAttendanceSessions(parsed as AttendanceSession[])
      : [];
  } catch {
    return [];
  }
}

export function saveAttendanceSessions(
  sessions: AttendanceSession[]
): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    ATTENDANCE_STORAGE_KEY,
    JSON.stringify(sessions)
  );

  window.dispatchEvent(new Event("campusiq-attendance-updated"));
}

export function getStudentPercentage(
  studentId: string,
  sessions: AttendanceSession[],
  subject?: string
): {
  total: number;
  attended: number;
  absent: number;
  late: number;
  percentage: number;
} {
  const relevantSessions = sessions.filter(
    (session) =>
      session.submitted &&
      (!subject || session.subject === subject) &&
      session.records.some((record) => record.studentId === studentId)
  );

  let attended = 0;
  let absent = 0;
  let late = 0;

  relevantSessions.forEach((session) => {
    const record = session.records.find(
      (item) => item.studentId === studentId
    );

    if (!record) return;

    if (record.status === "present") attended++;
    if (record.status === "late") {
      late++;
      attended++;
    }
    if (record.status === "absent") absent++;
  });

  const total = relevantSessions.length;

  return {
    total,
    attended,
    absent,
    late,
    percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
  };
}