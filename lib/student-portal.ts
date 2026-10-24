import { studentProfiles } from "@/lib/students";
import {
  isMockInterviewAttempt,
  type MockInterviewAttempt,
} from "@/lib/mock-interviews";

export const STUDENT_DEMO_ID_STORAGE_KEY = "campusiq-demo-student-id";
export const STUDENT_DEMO_ID_UPDATED_EVENT = "campusiq-demo-student-id-updated";
export const ACADEMIC_UPDATES_STORAGE_KEY = "campusiq-academic-updates";
export const ACADEMIC_UPDATES_EVENT = "campusiq-academic-updates-changed";
export const MOCK_INTERVIEW_RESULTS_STORAGE_KEY =
  "campusiq-mock-interview-results";
export const MOCK_INTERVIEW_RESULTS_EVENT =
  "campusiq-mock-interview-results-changed";

export type AcademicUpdate = {
  studentId: string;
  currentScore: number;
  previousScore: number;
  feedback: string;
  updatedAt: string;
};

export type MockInterviewResult = {
  id: string;
  studentId: string;
  role: string;
  averageScore: number;
  completedAt: string;
  attempt?: MockInterviewAttempt;
};

const previousScores: Record<string, number> = {
  "STU-1024": 55,
  "STU-1087": 72,
  "STU-1132": 49,
  "STU-1169": 78,
};

export function getAcademicRecord(
  studentId: string,
  updates: AcademicUpdate[],
) {
  const profile = studentProfiles.find((student) => student.id === studentId);
  const update = updates.find((item) => item.studentId === studentId);
  const currentScore = update?.currentScore ?? profile?.academicScore ?? 0;

  return {
    currentScore,
    previousScore:
      update?.previousScore ?? previousScores[studentId] ?? currentScore,
    feedback: update?.feedback ?? "",
    updatedAt: update?.updatedAt ?? "",
  };
}

export function isStudentId(value: string | null): value is string {
  return value !== null && studentProfiles.some((student) => student.id === value);
}

export function readSelectedDemoStudentId() {
  if (typeof window === "undefined") return studentProfiles[0]?.id ?? "";

  const selected = window.localStorage.getItem(STUDENT_DEMO_ID_STORAGE_KEY);
  return isStudentId(selected) ? selected : studentProfiles[0]?.id ?? "";
}

export function saveSelectedDemoStudentId(studentId: string) {
  if (!isStudentId(studentId)) {
    throw new Error("Choose a student from the demo directory.");
  }
  window.localStorage.setItem(STUDENT_DEMO_ID_STORAGE_KEY, studentId);
  window.dispatchEvent(new Event(STUDENT_DEMO_ID_UPDATED_EVENT));
}

export function subscribeToSelectedDemoStudentId(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STUDENT_DEMO_ID_UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STUDENT_DEMO_ID_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getDefaultDemoStudentId() {
  return studentProfiles[0]?.id ?? "";
}

export function isAcademicUpdate(value: unknown): value is AcademicUpdate {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AcademicUpdate>;
  return (
    typeof item.studentId === "string" &&
    isStudentId(item.studentId) &&
    typeof item.currentScore === "number" &&
    item.currentScore >= 0 &&
    item.currentScore <= 100 &&
    typeof item.previousScore === "number" &&
    item.previousScore >= 0 &&
    item.previousScore <= 100 &&
    typeof item.feedback === "string" &&
    typeof item.updatedAt === "string"
  );
}

export function readAcademicUpdates(): AcademicUpdate[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(ACADEMIC_UPDATES_STORAGE_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isAcademicUpdate)) {
    throw new Error("Saved academic updates are invalid.");
  }
  return parsed;
}

export function saveAcademicUpdate(
  studentId: string,
  currentScore: number,
  feedback: string,
) {
  if (!isStudentId(studentId)) throw new Error("Unknown student ID.");
  if (!Number.isFinite(currentScore) || currentScore < 0 || currentScore > 100) {
    throw new Error("Academic score must be between 0 and 100.");
  }

  const current = readAcademicUpdates();
  const previous =
    current.find((item) => item.studentId === studentId)?.currentScore ??
    studentProfiles.find((student) => student.id === studentId)?.academicScore ??
    0;
  const next: AcademicUpdate = {
    studentId,
    currentScore,
    previousScore: previous,
    feedback: feedback.trim(),
    updatedAt: new Date().toISOString(),
  };
  const updated = [
    ...current.filter((item) => item.studentId !== studentId),
    next,
  ];
  window.localStorage.setItem(
    ACADEMIC_UPDATES_STORAGE_KEY,
    JSON.stringify(updated),
  );
  window.dispatchEvent(new Event(ACADEMIC_UPDATES_EVENT));
}

export function subscribeToAcademicUpdates(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ACADEMIC_UPDATES_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ACADEMIC_UPDATES_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function isMockInterviewResult(
  value: unknown,
): value is MockInterviewResult {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MockInterviewResult>;
  return (
    typeof item.id === "string" &&
    typeof item.studentId === "string" &&
    isStudentId(item.studentId) &&
    typeof item.role === "string" &&
    typeof item.averageScore === "number" &&
    item.averageScore >= 0 &&
    item.averageScore <= 100 &&
    typeof item.completedAt === "string" &&
    (item.attempt === undefined ||
      (isMockInterviewAttempt(item.attempt) &&
        item.attempt.id === item.id &&
        item.attempt.studentId === item.studentId &&
        item.attempt.role === item.role &&
        item.attempt.averageScore === item.averageScore &&
        item.attempt.completedAt === item.completedAt &&
        item.attempt.questions.length === item.attempt.answers.length &&
        item.attempt.questions.length === item.attempt.answerEvaluations.length))
  );
}

export function readMockInterviewResults() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(
    MOCK_INTERVIEW_RESULTS_STORAGE_KEY,
  );
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isMockInterviewResult)) {
    throw new Error("Saved mock interview results are invalid.");
  }
  return parsed as MockInterviewResult[];
}

export function saveMockInterviewResult(result: MockInterviewResult) {
  if (!isMockInterviewResult(result)) {
    throw new Error("Mock interview result has invalid data.");
  }
  const next = [
    result,
    ...readMockInterviewResults().filter((item) => item.id !== result.id),
  ];
  window.localStorage.setItem(
    MOCK_INTERVIEW_RESULTS_STORAGE_KEY,
    JSON.stringify(next),
  );
  window.dispatchEvent(new Event(MOCK_INTERVIEW_RESULTS_EVENT));
}

export function subscribeToMockInterviewResults(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MOCK_INTERVIEW_RESULTS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(MOCK_INTERVIEW_RESULTS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
