import { studentProfiles } from "@/lib/students";

export const DECLARED_RESULTS_STORAGE_KEY = "growthtrack-declared-results";
export const DECLARED_RESULTS_EVENT = "growthtrack-declared-results-changed";

export type DeclaredResultSubject = {
  name: string;
  score: number;
};

export type DeclaredStudentResult = {
  studentId: string;
  semester: string;
  subjects: DeclaredResultSubject[];
  declaredAt: string;
};

function isDeclaredResult(value: unknown): value is DeclaredStudentResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<DeclaredStudentResult>;
  return (
    typeof result.studentId === "string" &&
    studentProfiles.some((student) => student.id === result.studentId) &&
    typeof result.semester === "string" &&
    /^Semester [1-8]$/.test(result.semester) &&
    Array.isArray(result.subjects) &&
    result.subjects.length > 0 &&
    result.subjects.every(
      (subject) =>
        subject !== null &&
        typeof subject === "object" &&
        typeof subject.name === "string" &&
        subject.name.trim().length > 0 &&
        typeof subject.score === "number" &&
        Number.isFinite(subject.score) &&
        subject.score >= 0 &&
        subject.score <= 100,
    ) &&
    typeof result.declaredAt === "string" &&
    Number.isFinite(Date.parse(result.declaredAt))
  );
}

export function readDeclaredResults(): DeclaredStudentResult[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(DECLARED_RESULTS_STORAGE_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(isDeclaredResult) ||
    new Set(
      parsed.map(
        (result) => `${result.studentId}:${result.semester}`,
      ),
    ).size !== parsed.length
  ) {
    throw new Error("Saved declared results are invalid.");
  }
  return parsed;
}

export function saveDeclaredResult(
  studentId: string,
  semester: string,
  subjects: DeclaredResultSubject[],
) {
  if (!studentProfiles.some((student) => student.id === studentId)) {
    throw new Error("Choose a student from the directory.");
  }
  if (!/^Semester [1-8]$/.test(semester)) {
    throw new Error("Choose a valid semester.");
  }
  if (
    subjects.length === 0 ||
    subjects.some(
      ({ name, score }) =>
        !name.trim() ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > 100,
    )
  ) {
    throw new Error("Enter a valid mark from 0 to 100 for every subject.");
  }

  const nextResult: DeclaredStudentResult = {
    studentId,
    semester,
    subjects: subjects.map(({ name, score }) => ({
      name: name.trim(),
      score,
    })),
    declaredAt: new Date().toISOString(),
  };
  const next = [
    ...readDeclaredResults().filter(
      (result) =>
        result.studentId !== studentId || result.semester !== semester,
    ),
    nextResult,
  ];
  window.localStorage.setItem(
    DECLARED_RESULTS_STORAGE_KEY,
    JSON.stringify(next),
  );
  window.dispatchEvent(new Event(DECLARED_RESULTS_EVENT));
}

export function subscribeToDeclaredResults(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DECLARED_RESULTS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DECLARED_RESULTS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
