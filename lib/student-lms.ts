import { studentProfiles } from "@/lib/students";

export const LMS_UPDATED_EVENT = "campusiq-lms-activity-updated";
const LMS_STORAGE_PREFIX = "campusiq-lms-activity";
const LMS_SESSION_PREFIX = "campusiq-lms-session";

export const demoAssignments = [
  { id: "programming-basics", title: "Programming fundamentals", course: "Programming" },
  { id: "data-structures", title: "Data structures practice", course: "Computer Science" },
  { id: "database-design", title: "Database design exercise", course: "Databases" },
  { id: "web-layout", title: "Responsive web layout", course: "Web Development" },
  { id: "algorithm-analysis", title: "Algorithm analysis worksheet", course: "Algorithms" },
  { id: "operating-systems", title: "Process scheduling problems", course: "Operating Systems" },
  { id: "networking", title: "Network protocols review", course: "Computer Networks" },
  { id: "software-testing", title: "Software testing plan", course: "Software Engineering" },
  { id: "capstone-proposal", title: "Capstone project proposal", course: "Project Work" },
  { id: "technical-reflection", title: "Technical learning reflection", course: "Professional Skills" },
] as const;

export type StudentLmsActivity = {
  loginTimestamps: string[];
  completedAssignmentIds: string[];
  solvedChallengeIds: string[];
};

function getStudent(studentId: string) {
  const student = studentProfiles.find((item) => item.id === studentId);
  if (!student) throw new Error("Unknown student profile.");
  return student;
}

function storageKey(studentId: string) {
  getStudent(studentId);
  return `${LMS_STORAGE_PREFIX}:${studentId}`;
}

function sessionKey(studentId: string) {
  getStudent(studentId);
  return `${LMS_SESSION_PREFIX}:${studentId}`;
}

function getDefaultActivity(studentId: string): StudentLmsActivity {
  const student = getStudent(studentId);
  const completedCount = Math.round(
    (student.assignmentCompletion / 100) * demoAssignments.length,
  );
  return {
    loginTimestamps: [],
    completedAssignmentIds: demoAssignments
      .slice(0, completedCount)
      .map((assignment) => assignment.id),
    solvedChallengeIds: [],
  };
}

function isActivity(value: unknown): value is StudentLmsActivity {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StudentLmsActivity>;
  return (
    Array.isArray(item.loginTimestamps) &&
    item.loginTimestamps.every((timestamp) => typeof timestamp === "string") &&
    Array.isArray(item.completedAssignmentIds) &&
    item.completedAssignmentIds.every(
      (id) =>
        typeof id === "string" &&
        demoAssignments.some((assignment) => assignment.id === id),
    ) &&
    Array.isArray(item.solvedChallengeIds) &&
    item.solvedChallengeIds.every((id) => typeof id === "string")
  );
}

export function readStudentLmsActivity(studentId: string): StudentLmsActivity {
  if (typeof window === "undefined") return getDefaultActivity(studentId);
  const stored = window.localStorage.getItem(storageKey(studentId));
  if (!stored) return getDefaultActivity(studentId);
  const parsed: unknown = JSON.parse(stored);
  if (!isActivity(parsed)) {
    throw new Error("Saved LMS activity data is invalid.");
  }
  return parsed;
}

function writeStudentLmsActivity(
  studentId: string,
  activity: StudentLmsActivity,
) {
  window.localStorage.setItem(storageKey(studentId), JSON.stringify(activity));
  window.dispatchEvent(new Event(LMS_UPDATED_EVENT));
}

export function recordStudentLmsVisit(studentId: string) {
  const current = readStudentLmsActivity(studentId);
  const visitSessionKey = sessionKey(studentId);
  if (window.sessionStorage.getItem(visitSessionKey) === "recorded") return;

  writeStudentLmsActivity(studentId, {
    ...current,
    loginTimestamps: [...current.loginTimestamps, new Date().toISOString()],
  });
  window.sessionStorage.setItem(visitSessionKey, "recorded");
}

export function setStudentAssignmentCompleted(
  studentId: string,
  assignmentId: string,
  completed: boolean,
) {
  if (!demoAssignments.some((assignment) => assignment.id === assignmentId)) {
    throw new Error("Unknown assignment.");
  }
  const current = readStudentLmsActivity(studentId);
  const completedAssignmentIds = new Set(current.completedAssignmentIds);
  if (completed) completedAssignmentIds.add(assignmentId);
  else completedAssignmentIds.delete(assignmentId);
  writeStudentLmsActivity(studentId, {
    ...current,
    completedAssignmentIds: [...completedAssignmentIds],
  });
}

export function markCodingChallengeSolved(
  studentId: string,
  challengeId: string,
) {
  const current = readStudentLmsActivity(studentId);
  if (current.solvedChallengeIds.includes(challengeId)) return;
  writeStudentLmsActivity(studentId, {
    ...current,
    solvedChallengeIds: [...current.solvedChallengeIds, challengeId],
  });
}

export function subscribeToStudentLmsActivity(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LMS_UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LMS_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
