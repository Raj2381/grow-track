
/** One student as the assistant reasons about them (built from the signed-in person's own scope in the database). */
export type AnalyticsStudent = {
  id: string; name: string; department: string;
  academicScore: number; attendance: number; assignmentCompletion: number; skillsScore: number; placementScore: number; engagementScore: number;
  successScore: number; risk: "High" | "Medium" | "Low"; riskReasons: string[]; cgpa?: number; sgpa?: number;
};

export type AdminAnalyticsAnswer = {
  title: string;
  summary: string;
  evidence: string[];
  students: AnalyticsStudent[];
  recommendation: string;
  includeGpaDetails: boolean;
};

type ScoreField =
  | "academicScore"
  | "attendance"
  | "assignmentCompletion"
  | "skillsScore"
  | "engagementScore";

const scoreFactors: { field: ScoreField; label: string }[] = [
  { field: "academicScore", label: "Academic score" },
  { field: "attendance", label: "Attendance" },
  { field: "assignmentCompletion", label: "Assignment completion" },
  { field: "skillsScore", label: "Skills score" },
  { field: "engagementScore", label: "Engagement score" },
];

function average(students: AnalyticsStudent[], field: ScoreField | "placementScore") {
  if (students.length === 0) return 0;
  return Math.round(
    students.reduce((total, student) => total + student[field], 0) /
      students.length,
  );
}

function departmentFromQuestion(
  question: string,
  students: AnalyticsStudent[],
): string | undefined {
  const departments = [...new Set(students.map((student) => student.department))];
  const aliases: Record<string, string[]> = {
    "Computer Science": ["cse", "computer science", "computer science engineering"],
    "Civil Engineering": ["civil engineering", "civil"],
    "Information Technology": ["information technology", "information tech"],
    Electronics: ["electronics", "ece"],
    "Mechanical Engineering": ["mechanical engineering", "mechanical", "mech"],
  };

  return departments.find((department) => {
    const candidates = aliases[department] ?? [department.toLowerCase()];
    return candidates.some((alias) => {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escapedAlias}\\b`, "i").test(question);
    });
  });
}

function answer(
  title: string,
  summary: string,
  evidence: string[],
  students: AnalyticsStudent[],
  recommendation: string,
  includeGpaDetails = false,
): AdminAnalyticsAnswer {
  return {
    title,
    summary,
    evidence,
    students,
    recommendation,
    includeGpaDetails,
  };
}

export function getAdminAnalyticsAnswer(
  question: string,
  profiles: AnalyticsStudent[],
): AdminAnalyticsAnswer {
  const normalizedQuestion = question.trim().toLowerCase();
  const department = departmentFromQuestion(normalizedQuestion, profiles);
  const asksGpa = /\b(cgpa|sgpa|gpa)\b/.test(normalizedQuestion);
  const asksRisk =
    /(risk|at[- ]risk|struggl|most vulnerable|needs? (support|attention))/.test(
      normalizedQuestion,
    );
  const requestsAcademicPlacementMismatch =
    /(cgpa|good marks|high academic|good academic|strong academic)/.test(
      normalizedQuestion,
    ) &&
    /(placement|employab|readiness)/.test(normalizedQuestion);

  if (requestsAcademicPlacementMismatch) {
    // CGPA is on record for every student, so "good CGPA" means a recorded CGPA of 7.0 or more
    const matches = profiles
      .filter((student) => (student.cgpa ?? student.academicScore / 10) >= 7 && student.placementScore < 65)
      .sort(
        (left, right) =>
          left.placementScore - right.placementScore ||
          (right.cgpa ?? 0) - (left.cgpa ?? 0),
      );

    return answer(
      "Strong CGPA, lower placement readiness",
      `${matches.length} of ${profiles.length} students have a recorded CGPA of 7.0 or more and a placement readiness score below 65.`,
      [
        "CGPA is the recorded cumulative grade point average; placement readiness is built from the aptitude, coding, interview and skill assessments the student has taken.",
        "Match criteria: CGPA ≥ 7.0 and placement readiness < 65.",
      ],
      matches.slice(0, 20),
      "Offer these students role-focused skills practice and a mock interview, then review their placement readiness after the next preparation cycle.",
      true,
    );
  }

  if (asksGpa) {
    const scopedStudents = profiles.filter(
      (student) =>
        (!department || student.department === department) &&
        (!asksRisk || student.risk !== "Low"),
    );
    const matchingStudents = scopedStudents.filter(
      (student) => (student.cgpa !== undefined || student.sgpa !== undefined),
    );
    const recordedCount = matchingStudents.length;
    const students =
      department ||
      asksRisk ||
      /(students?|names?|show|list|which)/.test(normalizedQuestion)
        ? scopedStudents
        : matchingStudents;

    return answer(
      "CGPA and SGPA records",
      recordedCount > 0
        ? `${recordedCount} of ${scopedStudents.length} matching student records have officially recorded CGPA or SGPA values.`
        : `No official CGPA or SGPA values are recorded for the ${scopedStudents.length} matching student records.`,
      [
        "CGPA and SGPA are shown only when officially stored on the student profile.",
        "Academic score is not converted into CGPA or SGPA.",
        ...(department
          ? [`Showing records for ${department}.`]
          : []),
      ],
      students.slice(0, 20),
      recordedCount > 0
        ? "Review the recorded values with the student's academic history and use your institution's criteria for any follow-up."
        : "Add verified CGPA and SGPA values to the official student records to make them available here.",
      true,
    );
  }

  if (asksRisk) {
    const matches = profiles
      .filter((student) => student.risk !== "Low")
      .sort((left, right) => {
        const riskOrder = { High: 0, Medium: 1, Low: 2 };
        return (
          riskOrder[left.risk] - riskOrder[right.risk] ||
          left.successScore - right.successScore
        );
      });
    const highRiskCount = matches.filter(
      (student) => student.risk === "High",
    ).length;

    return answer(
      "Students to prioritize for a supportive review",
      `${matches.length} of ${profiles.length} students are marked medium or high risk, including ${highRiskCount} at high risk. The list is ordered by risk level, then lower success score.`,
      [
        "Risk labels and success scores come from the student profiles.",
        "Review the listed attendance, academic and placement scores alongside each student's recorded risk reasons.",
        "These flags help prioritize support; they are not a substitute for a faculty review.",
      ],
      matches.slice(0, 8),
      "Start with the high-risk students, validate their latest records, and agree on an individual academic or attendance follow-up with each student.",
      asksGpa,
    );
  }

  const asksPlacementDrivers =
    /(factor|driv|why|cause|poor placement|placement readiness|employab|readiness)/.test(
      normalizedQuestion,
    );

  if (asksPlacementDrivers && !department) {
    const lowerReadiness = profiles.filter(
      (student) => student.placementScore < 65,
    );
    const otherStudents = profiles.filter(
      (student) => student.placementScore >= 65,
    );
    const factors = scoreFactors
      .map(({ field, label }) => ({
        label,
        lowerAverage: average(lowerReadiness, field),
        comparisonAverage: average(otherStudents, field),
        gap:
          average(otherStudents, field) - average(lowerReadiness, field),
      }))
      .sort((left, right) => right.gap - left.gap);
    const weakestFactor = factors[0];

    return answer(
      "Signals associated with lower placement readiness",
      `${lowerReadiness.length} of ${profiles.length} students have a placement score below 65. The comparisons below show cohort averages; they indicate associations, not proven causes.`,
      [
        ...factors.slice(0, 3).map(
          (factor) =>
            `${factor.label}: ${factor.lowerAverage}/100 for students below 65 placement readiness vs. ${factor.comparisonAverage}/100 for the rest (difference: ${factor.gap} points).`,
        ),
        `Placement-readiness comparison: ${average(lowerReadiness, "placementScore")}/100 vs. ${average(otherStudents, "placementScore")}/100.`,
      ],
      lowerReadiness
        .slice()
        .sort((left, right) => left.placementScore - right.placementScore)
        .slice(0, 8),
      weakestFactor
        ? `Prioritize a targeted placement support cycle around ${weakestFactor.label.toLowerCase()}, the largest observed gap. Pair it with role-specific practice and a follow-up readiness check; verify individual needs before assigning support.`
        : "Review the placement-readiness records and speak with students to identify an appropriate support action.",
      asksGpa,
    );
  }

  if (department) {
    const departmentStudents = profiles.filter(
      (student) => student.department === department,
    );

    if (departmentStudents.length === 0) {
      return answer(
        `${department} analytics`,
        `No student records were found for ${department}.`,
        ["Department results are computed from the student profiles currently loaded in the dashboard."],
        [],
        "Confirm that this department is present in the current student dataset before planning an intervention.",
      );
    }

    const lowReadiness = departmentStudents.filter(
      (student) => student.placementScore < 65,
    );
    const weakestFactor = scoreFactors
      .map(({ field, label }) => ({
        field,
        label,
        score: average(departmentStudents, field),
      }))
      .sort((left, right) => left.score - right.score)[0];
    const studentsToReview = departmentStudents
      .slice()
      .sort((left, right) => left.placementScore - right.placementScore)
      .slice(0, 8);

    return answer(
      `${department}: intervention priority`,
      `${lowReadiness.length} of ${departmentStudents.length} students have placement scores below 65. The department's average placement score is ${average(departmentStudents, "placementScore")}/100.`,
      [
        `Average academic score: ${average(departmentStudents, "academicScore")}/100.`,
        `Average skills score: ${average(departmentStudents, "skillsScore")}/100.`,
        `Average attendance: ${average(departmentStudents, "attendance")}%.`,
        weakestFactor
          ? `Lowest measured department signal: ${weakestFactor.label.toLowerCase()} at ${weakestFactor.score}/100.`
          : "No additional department performance signals are available.",
      ],
      studentsToReview,
      weakestFactor
        ? `Pilot a short ${weakestFactor.label.toLowerCase()} support cycle for the students listed, pair it with placement practice, and review progress before expanding the intervention.`
        : "Review the department's individual student records and agree on a focused support plan.",
      asksGpa,
    );
  }

  if (asksPlacementDrivers) {
    return answer(
      "Placement-readiness signals",
      "Ask about the factors associated with lower placement readiness, or name a department to see its intervention priority.",
      ["The copilot compares the student profiles' placement, academic, attendance, skills, assignment, and engagement scores."],
      [],
      "Try “What factors are driving poor placement readiness?” or “What intervention should we prioritize for CSE?”",
    );
  }

  return answer(
    "I couldn't match that question to a supported analysis",
    "I can answer questions about at-risk students, placement-readiness drivers, academic/placement mismatches, or a department's intervention priority.",
    [
      "Answers are computed from the student profiles currently loaded in this dashboard.",
      "Use one of the suggested questions or name a department such as CSE, Electronics, or Mechanical Engineering.",
    ],
    [],
    "Try “Which students are most at risk this semester?”, “What factors are driving poor placement readiness?”, or “What intervention should we prioritize for CSE?”",
  );
}
