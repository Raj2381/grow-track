import type { AttendanceRecord, Student } from "../../student-portal/types";
import { subjectsOfSemester, topicsFor } from "../../student-portal/data/catalog";
import { lectureDates } from "./schedule";

/** Rebuilds the lecture-level attendance records of the current semester from presence strings. */
export function rebuildAttendance(
  student: Pick<Student, "branchCode" | "semester">,
  presence: Record<string, string>,
): AttendanceRecord[] {
  return subjectsOfSemester(student.semester, student.branchCode).map((subject, i) => {
    const bits = presence[subject.code] ?? "";
    const dates = lectureDates(student.semester, i);
    const topics = topicsFor(subject.code);
    return {
      code: subject.code,
      lectures: dates.map((date, k) => ({
        date,
        slot: `${9 + ((i + k) % 6)}:00`,
        topic: topics[k % topics.length],
        present: bits[k] !== "0",
      })),
    };
  });
}

