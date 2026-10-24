/**
 * Import the supplied CSV snapshot into the history tables.
 *
 * The CSV files are deliberately messy (see data/DATASET.md). Repairs are
 * deterministic and reported: missing numeric values use that student's
 * median, attendance is capped at lectures held, and score outliers are
 * clipped to the database's documented range. This script never deletes rows.
 */
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";
import { DEPARTMENTS, MENTORS } from "../../lib/dataset/config";
import { SEM_DATES } from "../../lib/dataset/calendar";

type CsvRow = Record<string, string>;
type DbRow = Record<string, unknown>;
type Report = { table: string; source: number; imported: number; skipped: number };

loadEnv();
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const root = process.cwd();
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
const repairs = new Map<string, number>();
const reports: Report[] = [];

function reportRepair(name: string, count = 1) {
  repairs.set(name, (repairs.get(name) ?? 0) + count);
}

function parseCSV(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = []; field = "";
    } else field += ch;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()])));
}

function csv(name: string): CsvRow[] {
  return parseCSV(readFileSync(path.join(root, "data/csv", `${name}.csv`), "utf8"));
}

function required(value: string, field: string, row: number): string {
  if (!value) throw new Error(`${field} is empty at source row ${row}`);
  return value;
}

function integer(value: string, field: string, row: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${field} is not an integer at source row ${row}`);
  return parsed;
}

function decimal(value: string, field: string, row: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} is not numeric at source row ${row}`);
  return parsed;
}

function bool(value: string, field: string, row: number): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${field} must be true or false at source row ${row}`);
}

function date(value: string, field: string, row: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${field} is not an ISO date at source row ${row}`);
  }
  return value;
}

function median(values: number[]): number {
  if (!values.length) throw new Error("Cannot impute a numeric field without any observed values");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function imputeByStudent(rows: CsvRow[], field: string, integerResult = true): Map<string, number> {
  const values = new Map<string, number[]>();
  for (const row of rows) {
    if (row[field] !== "") {
      const value = Number(row[field]);
      if (Number.isFinite(value)) values.set(row.student_id, [...(values.get(row.student_id) ?? []), value]);
    }
  }
  const result = new Map<string, number>();
  for (const [student, numbers] of values) result.set(student, integerResult ? Math.round(median(numbers)) : median(numbers));
  return result;
}

function repairedNumber(
  row: CsvRow, field: string, rowNumber: number, fallback: Map<string, number>, repairName: string, integerResult = true,
): number {
  if (row[field] !== "") return integerResult ? integer(row[field], field, rowNumber) : decimal(row[field], field, rowNumber);
  const value = fallback.get(row.student_id);
  if (value !== undefined) {
    reportRepair(repairName);
    return value;
  }
  const global = median([...fallback.values()]);
  reportRepair(`${repairName} (global median; student had no observed value)`);
  return global;
}

function q(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

async function upsert(table: string, columns: string[], rows: DbRow[], conflict: string[]) {
  if (!rows.length) return;
  const cols = columns.map(q).join(", ");
  const updates = columns.filter((column) => !conflict.includes(column))
    .map((column) => `${q(column)} = excluded.${q(column)}`).join(", ");
  const sql = `insert into public.${q(table)} (${cols})
    select ${cols} from jsonb_populate_recordset(null::public.${q(table)}, $1::jsonb)
    on conflict (${conflict.map(q).join(", ")}) do update set ${updates}`;
  for (let i = 0; i < rows.length; i += 5000) {
    await client.query(sql, [JSON.stringify(rows.slice(i, i + 5000))]);
  }
}

async function loadTable(table: string, source: CsvRow[], columns: string[], rows: DbRow[], conflict: string[]) {
  await upsert(table, columns, rows, conflict);
  reports.push({ table, source: source.length, imported: rows.length, skipped: source.length - rows.length });
  console.log(`ok   ${table.padEnd(20)} ${String(rows.length).padStart(7)} rows`);
}

function sourceRowsWithSubjectNames(results: CsvRow[], remarks: CsvRow[]): DbRow[] {
  const teachers = new Map<string, string>();
  for (const row of remarks) if (!teachers.has(row.subject_code)) teachers.set(row.subject_code, row.teacher);
  const subjects = new Map<string, DbRow>();
  for (const row of results) {
    if (subjects.has(row.subject_code)) continue;
    const code = required(row.subject_code, "subject_code", 0);
    subjects.set(code, {
      code,
      name: required(row.subject_name, "subject_name", 0),
      short_name: code,
      credits: integer(row.credits, "credits", 0),
      semester: integer(row.semester, "semester", 0),
      teacher: teachers.get(code) ?? "Academic faculty",
    });
  }
  return [...subjects.values()];
}

async function main() {
  const students = csv("students");
  const results = csv("semester_results");
  const remarks = csv("faculty_remarks");
  const attendance = csv("attendance_monthly");
  const lms = csv("lms_monthly");
  const coding = csv("coding_attempts");
  const interviews = csv("interview_attempts");
  const skills = csv("skill_assessments");
  if (students.length !== 800) throw new Error(`Expected 800 students; found ${students.length}.`);

  const studentIds = new Set<string>();
  const branches = new Set<string>();
  const mentors = new Set<string>();
  for (let i = 0; i < students.length; i++) {
    const row = students[i];
    const sourceRow = i + 2;
    const id = required(row.student_id, "student_id", sourceRow);
    if (studentIds.has(id)) throw new Error(`Duplicate student ID: ${id}`);
    studentIds.add(id);
    branches.add(required(row.branch_code, "branch_code", sourceRow));
    mentors.add(required(row.mentor_id, "mentor_id", sourceRow));
  }

  const knownDepartmentCodes = new Set<string>(DEPARTMENTS.map((department) => department.code));
  const unknownBranches = [...branches].filter((code) => !knownDepartmentCodes.has(code));
  if (unknownBranches.length) throw new Error(`CSV contains unsupported department codes: ${unknownBranches.join(", ")}`);
  const mentorRows = Object.values(MENTORS).flatMap((list) => list)
    .filter((mentor) => mentors.has(mentor.id))
    .map((mentor) => ({ id: mentor.id, name: mentor.name, branch_code: mentor.id.split("-")[1] }));
  const unknownMentors = [...mentors].filter((id) => !mentorRows.some((mentor) => mentor.id === id));
  if (unknownMentors.length) throw new Error(`CSV contains mentor IDs without known faculty records: ${unknownMentors.join(", ")}`);

  const attendanceFallback = imputeByStudent(attendance, "lectures_attended");
  const lmsHoursFallback = imputeByStudent(lms, "hours_online", false);
  const lmsLoginsFallback = imputeByStudent(lms, "logins");
  const lmsQuizFallback = imputeByStudent(lms, "avg_quiz_score");
  const codingTimeFallback = imputeByStudent(coding, "time_taken_sec");
  const interviewConfidenceFallback = imputeByStudent(interviews, "confidence");
  const skillScoreFallback = imputeByStudent(skills, "score");

  await client.connect();
  try {
    await client.query("begin");
    await upsert("departments", ["code", "name", "branch"], DEPARTMENTS.map(({ code, name, branch }) => ({ code, name, branch })), ["code"]);
    await upsert("semesters", ["semester", "start_date", "end_date"],
      Object.entries(SEM_DATES).map(([semester, [start_date, end_date]]) => ({ semester: Number(semester), start_date, end_date })),
      ["semester"]);
    await upsert("faculty", ["id", "name", "branch_code"], mentorRows, ["id"]);
    await upsert("subjects", ["code", "name", "short_name", "credits", "semester", "teacher"],
      sourceRowsWithSubjectNames(results, remarks), ["code"]);

    const studentRows = students.map((row, i) => ({
      id: required(row.student_id, "student_id", i + 2),
      name: required(row.name, "name", i + 2),
      roll_no: required(row.roll_no, "roll_no", i + 2),
      email: `growtrack.${row.student_id.toLowerCase()}@example.com`,
      branch_code: row.branch_code,
      section: required(row.section, "section", i + 2),
      mentor_id: row.mentor_id,
      gender: required(row.gender, "gender", i + 2),
      residence: required(row.residence, "residence", i + 2),
      scholarship: bool(row.scholarship, "scholarship", i + 2),
      entry_band: row.entry_band || (reportRepair("students.entry_band -> Bottom 50%"), "Bottom 50%"),
      income_band: row.income_band || (reportRepair("students.income_band -> Middle"), "Middle"),
      batch: integer(row.batch, "batch", i + 2),
      current_semester: integer(row.current_semester, "current_semester", i + 2),
    }));
    await loadTable("students", students, Object.keys(studentRows[0]), studentRows, ["id"]);

    const resultRows = results.map((row, i) => {
      const internal = row.internal === "" ? integer(row.total, "total", i + 2) - integer(row.external, "external", i + 2) : integer(row.internal, "internal", i + 2);
      if (row.internal === "") reportRepair("semester_results.internal derived from total - external");
      const total = integer(row.total, "total", i + 2);
      const passed = bool(row.passed, "passed", i + 2);
      return {
        student_id: row.student_id, subject_code: row.subject_code, semester: integer(row.semester, "semester", i + 2),
        internal, external: integer(row.external, "external", i + 2), total, grade: required(row.grade, "grade", i + 2),
        grade_point: integer(row.grade_point, "grade_point", i + 2), passed, credits_obtained: passed ? integer(row.credits, "credits", i + 2) : 0,
        first_attempt_total: total, first_attempt_passed: passed,
      };
    });
    await loadTable("semester_results", results, Object.keys(resultRows[0]), resultRows, ["student_id", "subject_code"]);

    const backlogRows = csv("backlogs").map((row, i) => ({
      student_id: row.student_id, subject_code: row.subject_code, semester: integer(row.semester, "semester", i + 2),
      attempt: integer(row.attempt, "attempt", i + 2), attempt_date: date(row.attempt_date, "attempt_date", i + 2),
      marks: integer(row.marks, "marks", i + 2), result: required(row.result, "result", i + 2),
    }));
    await loadTable("backlogs", csv("backlogs"), Object.keys(backlogRows[0]), backlogRows, ["student_id", "subject_code", "attempt"]);

    const attendanceRows = attendance.map((row, i) => {
      const held = integer(row.lectures_held, "lectures_held", i + 2);
      let attended = repairedNumber(row, "lectures_attended", i + 2, attendanceFallback, "attendance_monthly.lectures_attended imputed");
      if (attended > held) { attended = held; reportRepair("attendance_monthly.lectures_attended capped at lectures_held"); }
      return { student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), subject_code: row.subject_code, month: row.month, lectures_held: held, lectures_attended: attended };
    });
    await loadTable("attendance_monthly", attendance, Object.keys(attendanceRows[0]), attendanceRows, ["student_id", "semester", "subject_code", "month"]);

    const lmsRows = lms.map((row, i) => {
      let logins = repairedNumber(row, "logins", i + 2, lmsLoginsFallback, "lms_monthly.logins imputed");
      if (logins > 100) { logins = Math.round(logins / 8); reportRepair("lms_monthly.logins outlier divided by 8"); }
      return {
        student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), month: row.month, logins,
        hours_online: repairedNumber(row, "hours_online", i + 2, lmsHoursFallback, "lms_monthly.hours_online imputed", false),
        assignments_due: integer(row.assignments_due, "assignments_due", i + 2), assignments_submitted: integer(row.assignments_submitted, "assignments_submitted", i + 2),
        assignments_late: integer(row.assignments_late, "assignments_late", i + 2),
        avg_quiz_score: Math.max(0, Math.min(100, repairedNumber(row, "avg_quiz_score", i + 2, lmsQuizFallback, "lms_monthly.avg_quiz_score imputed"))),
        quizzes_taken: integer(row.quizzes_taken, "quizzes_taken", i + 2),
      };
    });
    await loadTable("lms_monthly", lms, Object.keys(lmsRows[0]), lmsRows, ["student_id", "semester", "month"]);

    const assignments = csv("assignments").map((row, i) => ({
      id: row.assignment_id, student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), subject_code: row.subject_code,
      assigned_date: date(row.assigned_date, "assigned_date", i + 2), due_date: date(row.due_date, "due_date", i + 2), submitted: bool(row.submitted, "submitted", i + 2),
      submitted_date: row.submitted_date ? date(row.submitted_date, "submitted_date", i + 2) : null, late: bool(row.late, "late", i + 2), score: row.score ? integer(row.score, "score", i + 2) : null,
    }));
    await loadTable("assignments", csv("assignments"), Object.keys(assignments[0]), assignments, ["id"]);

    const aptitude = csv("aptitude_attempts").map((row, i) => ({
      id: row.attempt_id, student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), attempt_date: date(row.date, "date", i + 2),
      pattern: row.pattern, quantitative: integer(row.quantitative, "quantitative", i + 2), logical_reasoning: integer(row.logical_reasoning, "logical_reasoning", i + 2),
      verbal: integer(row.verbal, "verbal", i + 2), total_percent: integer(row.total_percent, "total_percent", i + 2), time_taken_sec: integer(row.time_taken_sec, "time_taken_sec", i + 2), source: "historical",
    }));
    await loadTable("aptitude_attempts", csv("aptitude_attempts"), Object.keys(aptitude[0]), aptitude, ["id"]);

    const codingRows = coding.map((row, i) => {
      const score = Math.max(0, Math.min(100, integer(row.score_percent, "score_percent", i + 2)));
      if (score !== integer(row.score_percent, "score_percent", i + 2)) reportRepair("coding_attempts.score_percent clipped to 0-100");
      return {
        id: row.attempt_id, student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), attempt_date: date(row.date, "date", i + 2),
        language: row.language, difficulty: row.difficulty, score_percent: score, questions: integer(row.questions, "questions", i + 2), correct: integer(row.correct, "correct", i + 2),
        wrong: integer(row.wrong, "wrong", i + 2), skipped: integer(row.skipped, "skipped", i + 2),
        time_taken_sec: repairedNumber(row, "time_taken_sec", i + 2, codingTimeFallback, "coding_attempts.time_taken_sec imputed"), topic_scores: {}, source: "historical",
      };
    });
    await loadTable("coding_attempts", coding, Object.keys(codingRows[0]), codingRows, ["id"]);

    const interviewRows = interviews.map((row, i) => ({
      id: row.attempt_id, student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), attempt_date: date(row.date, "date", i + 2),
      type: row.type, difficulty: row.difficulty, score: integer(row.score, "score", i + 2), communication: integer(row.communication, "communication", i + 2),
      technical: integer(row.technical, "technical", i + 2), confidence: repairedNumber(row, "confidence", i + 2, interviewConfidenceFallback, "interview_attempts.confidence imputed"),
      feedback: "", source: "historical",
    }));
    await loadTable("interview_attempts", interviews, Object.keys(interviewRows[0]), interviewRows, ["id"]);

    const activitySource = csv("activities");
    const activities = activitySource.map((row, i) => ({
      id: row.activity_id, student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), activity_date: date(row.date, "date", i + 2),
      type: row.type, title: row.title, organizer: row.organizer, category: row.category, role: row.role, proof: "", status: row.status, source: "historical",
    }));
    await loadTable("activities", activitySource, Object.keys(activities[0]), activities, ["id"]);

    const skillRows = skills.map((row, i) => {
      const original = row.score === "" ? repairedNumber(row, "score", i + 2, skillScoreFallback, "skill_assessments.score imputed") : integer(row.score, "score", i + 2);
      const score = Math.max(0, Math.min(100, original));
      if (score !== original) reportRepair("skill_assessments.score clipped to 0-100");
      return { id: row.assessment_id, student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), kind: row.kind, skill: row.skill, score, assessed_on: date(row.date, "date", i + 2), source: "historical" };
    });
    await loadTable("skill_assessments", skills, Object.keys(skillRows[0]), skillRows, ["id"]);

    const remarkRows = remarks.map((row, i) => ({
      student_id: row.student_id, semester: integer(row.semester, "semester", i + 2), subject_code: row.subject_code, teacher: row.teacher,
      remark_date: date(row.date, "date", i + 2), participation: integer(row.participation, "participation", i + 2),
      discipline: integer(row.discipline, "discipline", i + 2), attitude: integer(row.attitude, "attitude", i + 2), comment: "",
    }));
    await loadTable("faculty_remarks", remarks, Object.keys(remarkRows[0]), remarkRows, ["student_id", "semester", "subject_code"]);

    const interventionSource = csv("interventions");
    const interventions = interventionSource.map((row, i) => ({
      id: row.intervention_id, student_id: row.student_id, semester: integer(row.semester, "semester", i + 2),
      created_at: date(row.created_at.slice(0, 10), "created_at", i + 2), reason: row.reason, action_plan: row.action_plan, priority: row.priority,
      status: row.status, follow_up_date: date(row.follow_up_date, "follow_up_date", i + 2), source: "historical",
    }));
    await loadTable("interventions", interventionSource, Object.keys(interventions[0]), interventions, ["id"]);

    await client.query("commit");
    console.log("\nSource-only tables not imported: semester_summary.csv and outcomes.csv (no corresponding public tables).");
    console.log("Synthetic student emails use the non-deliverable example.com domain.");
    for (const [name, count] of repairs) console.log(`repair ${name}: ${count}`);
    console.log("\nImport completed transactionally. Rerunning updates these source rows and does not delete unrelated data.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
