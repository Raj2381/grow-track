/**
 * Rows for every history table, built from the dataset generator (CLEAN values, not the deliberately messy CSVs).
 * Keys are snake_case = column names, so the same rows feed the Postgres and the REST loaders.
 */
import { generateAllStudents, semesterOfDate } from "../../lib/dataset/generate";
import { generateInterventions } from "../../lib/dataset/export";
import { DEPARTMENTS, MENTORS } from "../../lib/dataset/config";
import { SEM_DATES } from "../../lib/dataset/calendar";
import { BRANCH_SUBJECT_CODES, CATALOG } from "../../student-portal/data/catalog";

export type Row = Record<string, unknown>;
export type TableSpec = { table: string; conflict: string[]; mode: "update" | "keep"; rows: Row[] };

export const ISO_DAY = (value: string) => value.slice(0, 10);

export function buildSeed(): TableSpec[] {
  const all = generateAllStudents();
  const spec: TableSpec[] = [];
  const add = (table: string, conflict: string[], rows: Row[], mode: "update" | "keep" = "update") => spec.push({ table, conflict, mode, rows });

  add("departments", ["code"], DEPARTMENTS.map((d) => ({ code: d.code, name: d.name, branch: d.branch })));
  add("faculty", ["id"], Object.entries(MENTORS).flatMap(([branch, list]) => list.map((m) => ({ id: m.id, name: m.name, branch_code: branch }))));
  add("semesters", ["semester"], [
    ...Object.entries(SEM_DATES).map(([semester, [start, end]]) => ({ semester: Number(semester), start_date: start, end_date: end })),
    { semester: 6, start_date: "2027-01-11", end_date: "2027-05-28" },
  ]);
  add("subjects", ["code"], CATALOG.map((s) => ({ code: s.code, name: s.name, short_name: s.short, credits: s.credits, semester: s.semester, teacher: s.teacher })));
  add("branch_subjects", ["branch_code", "semester", "position"], Object.entries(BRANCH_SUBJECT_CODES).flatMap(([branch, semesters]) =>
    semesters.flatMap((codes, i) => codes.map((code, position) => ({ branch_code: branch, semester: i + 1, position, subject_code: code })))));

  add("students", ["id"], all.map(({ student: s }) => ({
    id: s.id, name: s.name, roll_no: s.rollNo, email: s.email, branch_code: s.branchCode, section: s.profile.section, mentor_id: s.profile.mentorId,
    gender: s.profile.gender, residence: s.profile.residence, scholarship: s.profile.scholarship, entry_band: s.profile.entryBand,
    income_band: s.profile.incomeBand, batch: s.profile.batch, current_semester: s.semester,
  })));

  add("semester_results", ["student_id", "subject_code"], all.flatMap((g) => {
    const first = new Map(g.firstAttempt.map((r) => [r.code, r]));
    return g.student.results.map((r) => ({
      student_id: g.student.id, subject_code: r.code, semester: r.semester, internal: r.internal, external: r.external, total: r.total,
      grade: r.grade, grade_point: r.gradePoint, passed: r.passed, credits_obtained: r.creditsObtained,
      first_attempt_total: first.get(r.code)!.total, first_attempt_passed: first.get(r.code)!.passed,
    }));
  }));
  add("backlogs", ["student_id", "subject_code", "attempt"], all.flatMap((g) => g.backlogRows.map((b) => ({
    student_id: g.student.id, subject_code: b.code, semester: b.semester, attempt: b.attempt, attempt_date: b.date, marks: b.marks, result: b.result,
  }))));
  add("attendance_monthly", ["student_id", "semester", "subject_code", "month"], all.flatMap((g) => g.attendanceMonthly.map((a) => ({
    student_id: g.student.id, semester: a.semester, subject_code: a.code, month: a.month, lectures_held: a.held, lectures_attended: a.attended,
  }))));
  add("lecture_presence", ["student_id", "semester", "subject_code"], all.flatMap((g) => Object.entries(g.lecturePresence).map(([code, presence]) => ({
    student_id: g.student.id, semester: g.student.semester, subject_code: code, presence,
  }))));
  add("lms_monthly", ["student_id", "semester", "month"], all.flatMap((g) => g.lmsMonthly.map((m) => ({
    student_id: g.student.id, semester: m.semester, month: m.month, logins: m.logins, hours_online: m.hours, assignments_due: m.assigned,
    assignments_submitted: m.submitted, assignments_late: m.late, avg_quiz_score: m.avgQuiz, quizzes_taken: m.quizCount,
  }))));
  add("assignments", ["id"], all.flatMap((g) => g.assignments.map((a) => ({
    id: a.id, student_id: g.student.id, semester: a.semester, subject_code: a.code, assigned_date: a.assignedDate, due_date: a.dueDate,
    submitted: a.submitted, submitted_date: a.submittedDate ? a.submittedDate : null, late: a.late, score: a.score,
  }))));
  add("aptitude_attempts", ["id"], all.flatMap((g) => g.student.placement.aptitude.map((a) => ({
    id: a.id, student_id: g.student.id, semester: semesterOfDate(a.date), attempt_date: a.date, pattern: a.pattern,
    quantitative: a.sections.Quantitative.score, logical_reasoning: a.sections["Logical Reasoning"].score, verbal: a.sections.Verbal.score,
    total_percent: a.totalPercent, time_taken_sec: a.timeTakenSec, source: "historical",
  }))));
  add("coding_attempts", ["id"], all.flatMap((g) => g.student.skills.codingAttempts.map((c) => ({
    id: c.id, student_id: g.student.id, semester: semesterOfDate(c.date), attempt_date: c.date, language: c.language, difficulty: c.difficulty,
    score_percent: c.score, questions: c.questionCount, correct: c.correct, wrong: c.wrong, skipped: c.skipped, time_taken_sec: c.timeTakenSec,
    topic_scores: c.topicScores, source: "historical",
  }))));
  add("interview_attempts", ["id"], all.flatMap((g) => g.student.placement.interviews.map((i) => ({
    id: i.id, student_id: g.student.id, semester: semesterOfDate(i.date), attempt_date: i.date, type: i.type, difficulty: i.difficulty, score: i.score,
    communication: i.ratings.communication, technical: i.ratings.technical, confidence: i.ratings.confidence, feedback: i.feedback, source: "historical",
  }))));
  // activities and interventions can be edited by staff: re-seeding must not undo their decisions
  add("activities", ["id"], all.flatMap((g) => g.student.activities.map((a) => ({
    id: a.id, student_id: g.student.id, semester: a.semester, activity_date: a.date, type: a.type, title: a.title, organizer: a.organizer,
    category: a.category, role: a.role, proof: a.proof, status: a.status, source: "historical",
  }))), "keep");
  add("skill_assessments", ["id"], all.flatMap((g) => g.skillAssessments.map((s) => ({
    id: s.id, student_id: g.student.id, semester: s.semester, kind: s.kind, skill: s.skill, score: s.score, assessed_on: s.date, source: "historical",
  }))));
  add("faculty_remarks", ["student_id", "semester", "subject_code"], all.flatMap((g) => g.facultyRemarksAll.map((r) => ({
    student_id: g.student.id, semester: r.semester, subject_code: r.code, teacher: r.teacher, remark_date: r.date,
    participation: r.participation, discipline: r.discipline, attitude: r.attitude, comment: r.comment,
  }))));
  add("interventions", ["id"], generateInterventions(all).map((i) => ({
    id: i.id, student_id: i.studentId, semester: i.semester, reason: i.reason, action_plan: i.actionPlan, priority: i.priority, status: i.status,
    follow_up_date: i.followUpDate, created_at: i.createdAt, source: "historical",
  })), "keep");
  return spec;
}

/** Tables a re-seed rewrites, leaves to staff edits, and how rows are counted (history rows only for mixed tables). */
export const MIXED_SOURCE_TABLES = ["aptitude_attempts", "coding_attempts", "interview_attempts", "activities", "skill_assessments", "interventions"];

/** Every table that holds data, children first (the order used to clear them). */
export const CLEAR_ORDER = [
  "recommendations", "segment_members", "segments", "whatif_inputs", "predictions", "risk_trends", "model_metrics", "whatif_model", "cohort_stats", "model_runs",
  "faculty_evaluation_receipts", "faculty_evaluations", "surveys", "portal_intro", "feedback_entries", "admin_settings", "lms_solved_challenges",
  "lms_completed_assignments", "lms_logins", "mock_interview_results", "academic_updates", "declared_result_subjects", "declared_results",
  "attendance_records", "attendance_sessions", "interventions", "faculty_remarks", "skill_assessments", "activities", "interview_attempts",
  "coding_attempts", "aptitude_attempts", "assignments", "lms_monthly", "lecture_presence", "attendance_monthly", "backlogs", "semester_results",
  "profiles", "students", "branch_subjects", "subjects", "semesters", "faculty", "departments",
];
