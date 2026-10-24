import type { StudentProfile } from "@/lib/students";

export const DEMO_PASS_MARK = 40;

const subjectsByDepartment: Record<string, string[]> = {
  "Computer Science": [
    "Data Structures",
    "Database Management Systems",
    "Operating Systems",
    "Computer Networks",
    "Software Engineering",
  ],
  "Information Technology": [
    "Data Structures",
    "Database Management Systems",
    "Web Development",
    "Computer Networks",
    "Software Engineering",
  ],
  Electronics: [
    "Digital Electronics",
    "Circuit Theory",
    "Signals and Systems",
    "Communication Systems",
    "Engineering Mathematics",
  ],
  "Mechanical Engineering": [
    "Engineering Mechanics",
    "Thermodynamics",
    "Manufacturing Processes",
    "Material Science",
    "Engineering Mathematics",
  ],
};

const scoreOffsets = [-8, -2, 2, 4, 4];

export type StudentSubjectMark = {
  subject: string;
  marks: number;
  previousMarks: number;
  maxMarks: 100;
  passed: boolean;
};

export function getDemoSubjectMarks(
  student: StudentProfile,
  currentOverallScore: number,
  previousOverallScore: number,
): StudentSubjectMark[] {
  const subjects =
    subjectsByDepartment[student.department] ?? subjectsByDepartment["Computer Science"];

  return subjects.map((subject, index) => {
    const marks = Math.max(
      0,
      Math.min(100, Math.round(currentOverallScore + scoreOffsets[index])),
    );
    const previousMarks = Math.max(
      0,
      Math.min(100, Math.round(previousOverallScore + scoreOffsets[index])),
    );

    return {
      subject,
      marks,
      previousMarks,
      maxMarks: 100,
      passed: marks >= DEMO_PASS_MARK,
    };
  });
}

export function getDemoGrade(marks: number) {
  if (marks >= 90) return "A+";
  if (marks >= 80) return "A";
  if (marks >= 70) return "B";
  if (marks >= 60) return "C";
  if (marks >= DEMO_PASS_MARK) return "D";
  return "F";
}
