/**
 * Synthetic student generator.
 *
 * Every student gets a hidden latent profile and an archetype. All observable signals (attendance, marks,
 * LMS, activities, skills, placement attempts) are derived from the latent profile plus noise, so features
 * correlate with outcomes without any single rule determining them. Output is a pure function of the seed.
 */
import type {
  Activity,
  ActivityType,
  AptitudeAttempt,
  AptitudeSection,
  Backlog,
  BacklogAttempt,
  CodingAttempt,
  CodingLanguage,
  EntryBand,
  FacultyRemark,
  Gender,
  IncomeBand,
  InterviewAttempt,
  SoftSkill,
  Student,
  SkillTestAttempt,
  SubjectResult,
  TechSkill,
  VerificationStatus,
} from "../../student-portal/types";
import { gradeFromTotal, isPass } from "../../student-portal/lib/scoring";
import { subjectByCode, subjectsOfSemester } from "../../student-portal/data/catalog";
import { SEM_DATES, SEM_MONTHS, SEMESTERS, CURRENT_SEM, BATCH_YEAR, TODAY, addDays } from "./calendar";
import { lectureDates } from "./schedule";
import { rebuildAttendance } from "./attendance-rebuild";
import {
  ACTIVITY_BANK,
  APTITUDE_PATTERNS,
  ARCHETYPES,
  DATASET_SEED,
  DEPARTMENTS,
  FEMALE_NAMES,
  INTERVIEW_FEEDBACK,
  MALE_NAMES,
  MENTORS,
  REMARK_LOW,
  REMARK_MID,
  REMARK_POS,
  STUDENT_COUNT,
  SURNAMES,
  type ArchetypeId,
  type Department,
} from "./config";
import { between, chance, clamp, hash01, int, mulberry32, normal, pick, poisson, weighted, type Rng } from "./rng";

export const TECH_SKILLS: TechSkill[] = ["DSA", "Web Dev", "DBMS", "Python", "Java", "C", "SQL"];
export const SOFT_SKILLS: SoftSkill[] = ["Communication", "Teamwork", "Problem Solving", "Leadership", "Time Management"];
const APTITUDE_SECTIONS: AptitudeSection[] = ["Quantitative", "Logical Reasoning", "Verbal"];

export type AttendanceMonthlyRow = { semester: number; code: string; month: string; held: number; attended: number };
export type LmsMonthlyRow = {
  semester: number;
  month: string;
  logins: number;
  hours: number;
  assigned: number;
  submitted: number;
  late: number;
  avgQuiz: number;
  quizCount: number;
};
export type AssignmentRow = {
  id: string;
  semester: number;
  code: string;
  assignedDate: string;
  dueDate: string;
  submitted: boolean;
  submittedDate: string;
  late: boolean;
  score: number | null;
};
export type SkillAssessmentRow = {
  id: string;
  semester: number;
  kind: "technical" | "soft";
  skill: string;
  score: number;
  date: string;
};
export type FacultyRemarkRow = FacultyRemark & { semester: number };
export type BacklogRow = { code: string; semester: number; attempt: number; date: string; marks: number; result: "Fail" | "Pass" };

export type Latent = {
  ability: number;
  consistency: number;
  employability: number;
  extRisk: number;
};

export type Trajectory = {
  /** Per semester (index 0 = semester 1): mean attendance %, academic effort, LMS engagement, placement prep, social activity. */
  att: number[];
  eff: number[];
  lms: number[];
  prep: number[];
  soc: number[];
  attSlope: number[];
  dropSemester: number | null;
};

export type GeneratedStudent = {
  student: Student;
  /** Per-subject presence strings for the current semester (1 = present), in timetable order. */
  lecturePresence: Record<string, string>;
  archetype: ArchetypeId;
  latent: Latent;
  firstAttempt: SubjectResult[];
  attendanceMonthly: AttendanceMonthlyRow[];
  lmsMonthly: LmsMonthlyRow[];
  assignments: AssignmentRow[];
  skillAssessments: SkillAssessmentRow[];
  facultyRemarksAll: FacultyRemarkRow[];
  backlogRows: BacklogRow[];
  semesterAttendance: Record<number, number>;
};

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function semesterOfDate(date: string): number {
  for (const sem of SEMESTERS) {
    const [from, to] = SEM_DATES[sem];
    if (date >= from && date <= to) return sem;
  }
  // dates in a break belong to the preceding semester
  let last = 1;
  for (const sem of SEMESTERS) if (date > SEM_DATES[sem][1]) last = Math.min(sem + 1, CURRENT_SEM);
  return last;
}

function dateInSemester(r: Rng, sem: number, from = 0, to = 1) {
  const [start, end] = SEM_DATES[sem];
  const span = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
  return addDays(start, int(r, span * from, span * to));
}

const ratingFromScore = (score: number, r: Rng) => clamp(Math.round(score + between(r, -9, 9)));

/* -------------------------------------------------------------------------- */
/* latent profile and trajectories                                            */
/* -------------------------------------------------------------------------- */

const ARCHETYPE_BASE: Record<ArchetypeId, { ability: [number, number]; employability: [number, number]; extRisk: number; consistency: [number, number] }> = {
  high_achiever: { ability: [0.84, 0.06], employability: [0.7, 0.14], extRisk: 0.12, consistency: [0.85, 0.08] },
  consistent_average: { ability: [0.62, 0.1], employability: [0.5, 0.17], extRisk: 0.22, consistency: [0.7, 0.12] },
  high_cgpa_low_placement: { ability: [0.8, 0.07], employability: [0.18, 0.08], extRisk: 0.15, consistency: [0.8, 0.1] },
  skilled_poor_attendance: { ability: [0.6, 0.1], employability: [0.78, 0.1], extRisk: 0.4, consistency: [0.45, 0.14] },
  late_bloomer: { ability: [0.5, 0.1], employability: [0.5, 0.15], extRisk: 0.28, consistency: [0.5, 0.14] },
  slow_decliner: { ability: [0.66, 0.1], employability: [0.5, 0.15], extRisk: 0.5, consistency: [0.4, 0.12] },
  sudden_drop: { ability: [0.66, 0.1], employability: [0.55, 0.15], extRisk: 0.72, consistency: [0.5, 0.15] },
  chronic_backlog: { ability: [0.42, 0.08], employability: [0.28, 0.12], extRisk: 0.6, consistency: [0.35, 0.12] },
  disengaged_capable: { ability: [0.76, 0.08], employability: [0.3, 0.14], extRisk: 0.45, consistency: [0.4, 0.13] },
};

function sampleLatent(arch: ArchetypeId, r: Rng, incomeBand: IncomeBand): Latent {
  const base = ARCHETYPE_BASE[arch];
  const incomeRisk = incomeBand === "Low" ? 0.12 : incomeBand === "Lower-middle" ? 0.05 : incomeBand === "High" ? -0.05 : 0;
  return {
    ability: clamp(normal(r, base.ability[0], base.ability[1]), 0.12, 0.98),
    consistency: clamp(normal(r, base.consistency[0], base.consistency[1]), 0.1, 0.98),
    employability: clamp(normal(r, base.employability[0], base.employability[1]), 0.03, 0.98),
    extRisk: clamp(base.extRisk + incomeRisk + normal(r, 0, 0.08), 0.02, 0.98),
  };
}

function buildTrajectory(arch: ArchetypeId, latent: Latent, r: Rng): Trajectory {
  const idx = [0, 1, 2, 3, 4];
  const emp = 0.55 + 0.9 * latent.employability;
  const dropSemester = arch === "sudden_drop" ? weighted(r, [{ value: 3, weight: 0.25 }, { value: 4, weight: 0.4 }, { value: 5, weight: 0.35 }]) : null;
  let att: number[];
  let eff: number[];
  let lms: number[];
  let prep: number[];
  let soc: number[];
  let attSlope = idx.map(() => 0);

  switch (arch) {
    case "high_achiever":
      att = idx.map((i) => 94 - 0.6 * i);
      eff = idx.map(() => 0.84);
      lms = idx.map(() => 0.8);
      prep = idx.map((i) => 0.34 + 0.12 * i);
      soc = idx.map(() => 0.55);
      break;
    case "consistent_average":
      att = idx.map(() => 84);
      eff = idx.map((i) => 0.54 + 0.015 * i);
      lms = idx.map(() => 0.55);
      prep = idx.map((i) => 0.27 + 0.085 * i);
      soc = idx.map(() => 0.3);
      break;
    case "high_cgpa_low_placement":
      att = idx.map(() => 90);
      eff = idx.map(() => 0.88);
      lms = idx.map(() => 0.62);
      prep = idx.map((i) => 0.07 + 0.018 * i);
      soc = idx.map(() => 0.14);
      break;
    case "skilled_poor_attendance":
      att = idx.map((i) => 81 - 4.5 * i);
      eff = idx.map((i) => 0.5 - 0.02 * i);
      lms = idx.map(() => 0.5);
      prep = idx.map((i) => 0.45 + 0.1 * i);
      soc = idx.map(() => 0.45);
      break;
    case "late_bloomer":
      att = idx.map((i) => 66 + 6 * i);
      eff = idx.map((i) => 0.3 + (i >= 2 ? 0.13 * (i - 1) : 0.02 * i));
      lms = idx.map((i) => 0.3 + 0.09 * i);
      prep = idx.map((i) => 0.1 + 0.1 * i);
      soc = idx.map((i) => 0.15 + 0.07 * i);
      break;
    case "slow_decliner":
      att = idx.map((i) => 93 - 6.5 * i);
      eff = idx.map((i) => 0.78 - Math.max(0, i - 1) * 0.13);
      lms = idx.map((i) => 0.72 - 0.12 * i);
      prep = idx.map((i) => 0.46 - 0.03 * i);
      soc = idx.map((i) => 0.5 - 0.08 * i);
      attSlope = idx.map(() => -5);
      break;
    case "sudden_drop": {
      const d = dropSemester ?? 4;
      att = idx.map((i) => (i + 1 < d ? 90 : 64));
      eff = idx.map((i) => (i + 1 < d ? 0.78 : 0.42));
      lms = idx.map((i) => (i + 1 < d ? 0.7 : 0.3));
      prep = idx.map((i) => (i + 1 < d ? 0.3 + 0.08 * i : 0.2));
      soc = idx.map((i) => (i + 1 < d ? 0.45 : 0.12));
      attSlope = idx.map((i) => (i + 1 === d ? -7 : 0));
      break;
    }
    case "chronic_backlog":
      att = idx.map(() => 72);
      eff = idx.map(() => 0.35);
      lms = idx.map(() => 0.3);
      prep = idx.map(() => 0.1);
      soc = idx.map(() => 0.14);
      break;
    case "disengaged_capable":
      att = idx.map(() => 74);
      eff = idx.map(() => 0.5);
      lms = idx.map(() => 0.15);
      prep = idx.map(() => 0.32);
      soc = idx.map(() => 0.05);
      break;
  }

  // one-semester dips caused by external events; more likely for students with high external risk
  const dip = idx.map(() => (chance(r, 0.07 * latent.extRisk * 2) ? between(r, 0.1, 0.22) : 0));
  const semNoise = (scale: number) => idx.map(() => normal(r, 0, scale * (1 + (1 - latent.consistency))));
  const nAtt = semNoise(2.5);
  const nEff = semNoise(0.035);
  const nLms = semNoise(0.05);
  return {
    att: att.map((v, i) => clamp(v + nAtt[i] - dip[i] * 60, 25, 99)),
    eff: eff.map((v, i) => clamp(v + nEff[i] - dip[i], 0.05, 0.98)),
    lms: lms.map((v, i) => clamp(v + nLms[i] - dip[i] * 0.6, 0.03, 0.98)),
    prep: prep.map((v) => clamp(v * emp, 0.02, 0.95)),
    soc: soc.map((v) => clamp(v + normal(r, 0, 0.04), 0, 0.9)),
    attSlope: attSlope.map((v) => v + normal(r, 0, 1.5)),
    dropSemester,
  };
}

/* -------------------------------------------------------------------------- */
/* results                                                                    */
/* -------------------------------------------------------------------------- */

function makeResult(code: string, semester: number, total: number, r: Rng): SubjectResult {
  let external = clamp(Math.round(total * 0.6 + between(r, -4, 4)), 0, 60);
  if (total >= 40) external = Math.max(external, 24);
  let internal = total - external;
  if (internal > 40) {
    internal = 40;
    external = total - 40;
  }
  if (internal < 0) {
    internal = 0;
    external = total;
  }
  const passed = isPass(total, external);
  const { grade, gradePoint } = gradeFromTotal(total, passed);
  const credits = subjectByCode(code).credits;
  return { code, semester, internal, external, total, grade, gradePoint, passed, creditsObtained: passed ? credits : 0 };
}

/* -------------------------------------------------------------------------- */
/* one student                                                                */
/* -------------------------------------------------------------------------- */

type Identity = {
  index: number;
  id: string;
  name: string;
  gender: Gender;
  department: Department;
  deptSeq: number;
  archetype: ArchetypeId;
};

const ROLL_CODES: Record<string, string> = { CSE: "CSE", IT: "IT", ECE: "ECE", MECH: "MEC", CIVIL: "CIV" };

function buildStudent(identity: Identity): GeneratedStudent {
  const r = mulberry32(DATASET_SEED + identity.index * 7919);
  const { department, archetype } = identity;
  const incomeBand = weighted<IncomeBand>(r, [
    { value: "Low", weight: 0.18 },
    { value: "Lower-middle", weight: 0.32 },
    { value: "Middle", weight: 0.34 },
    { value: "High", weight: 0.16 },
  ]);
  const latent = sampleLatent(archetype, r, incomeBand);
  const traj = buildTrajectory(archetype, latent, r);

  const entryZ = latent.ability + normal(r, 0, 0.18);
  const entryBand: EntryBand = entryZ > 0.78 ? "Top 10%" : entryZ > 0.62 ? "Top 25%" : entryZ > 0.42 ? "Top 50%" : "Bottom 50%";
  const scholarship = chance(r, entryBand === "Top 10%" ? 0.55 : entryBand === "Top 25%" ? 0.3 : incomeBand === "Low" ? 0.25 : 0.08);
  const residence = chance(r, 0.45) ? "Hostel" : "Day scholar";
  const mentors = MENTORS[department.code];
  const mentor = mentors[identity.deptSeq % mentors.length];
  const section = department.sections[identity.deptSeq % department.sections.length];

  const attendanceMonthly: AttendanceMonthlyRow[] = [];
  const lmsMonthly: LmsMonthlyRow[] = [];
  const assignments: AssignmentRow[] = [];
  const skillAssessments: SkillAssessmentRow[] = [];
  const facultyRemarksAll: FacultyRemarkRow[] = [];
  const firstAttempt: SubjectResult[] = [];
  const activities: Activity[] = [];
  const aptitude: AptitudeAttempt[] = [];
  const codingAttempts: CodingAttempt[] = [];
  const interviews: InterviewAttempt[] = [];
  const technicalTests: SkillTestAttempt[] = [];
  const semesterAttendance: Record<number, number> = {};
  let lecturePresence: Record<string, string> = {};
  const semSummary: { attPct: number; q: number }[] = [];
  let cumPrep = 0;
  const techNow = {} as Record<TechSkill, number>;
  const softNow = {} as Record<SoftSkill, number>;
  let lastSoftComm = 50;
  let lmsSem5Quiz = 50;
  const lmsSemLoginTail: number[] = [];

  for (const sem of SEMESTERS) {
    const i = sem - 1;
    const subjects = subjectsOfSemester(sem, department.code);

    /* ---------------- attendance (lecture level -> monthly) ---------------- */
    const held = new Map<string, { held: number; attended: number }>();
    let semHeld = 0;
    let semAttended = 0;
    const presence: Record<string, string> = {};
    subjects.forEach((subject, k) => {
      const offset = normal(r, 0, 4);
      const dates = lectureDates(sem, k);
      let bits = "";
      dates.forEach((date, j) => {
        const progress = dates.length > 1 ? j / (dates.length - 1) : 0.5;
        const p = clamp((traj.att[i] + offset + traj.attSlope[i] * (progress - 0.5)) / 100, 0.1, 0.995);
        const present = r() < p;
        bits += present ? "1" : "0";
        const key = `${subject.code}|${date.slice(0, 7)}`;
        const cell = held.get(key) ?? { held: 0, attended: 0 };
        cell.held++;
        if (present) cell.attended++;
        held.set(key, cell);
        semHeld++;
        if (present) semAttended++;
      });
      presence[subject.code] = bits;
    });
    for (const [key, cell] of held) {
      const [code, month] = key.split("|");
      attendanceMonthly.push({ semester: sem, code, month, held: cell.held, attended: cell.attended });
    }
    const attPct = semHeld ? (semAttended / semHeld) * 100 : 0;
    semesterAttendance[sem] = Math.round(attPct);
    if (sem === CURRENT_SEM) lecturePresence = presence;

    /* ------------------------------ marks --------------------------------- */
    const semShock = normal(r, 0, 0.025 * (1 + (1 - latent.consistency)));
    const q = clamp(0.5 * latent.ability + 0.35 * traj.eff[i] + 0.15 * clamp((attPct - 60) / 40, 0, 1.2) + semShock, 0.05, 1);
    const sdMarks = 5 + (1 - latent.consistency) * 5 + (archetype === "chronic_backlog" ? 2 : 0);
    subjects.forEach((subject) => {
      const difficulty = (hash01(subject.code) - 0.5) * 0.1;
      const total = clamp(Math.round(15 + 80 * (q + difficulty) + normal(r, 0, sdMarks)), 12, 99);
      firstAttempt.push(makeResult(subject.code, sem, total, r));
    });
    semSummary.push({ attPct, q });

    /* ----------------- assignments and LMS (per month) --------------------- */
    const months = SEM_MONTHS[sem];
    const monthlyAssigned = new Map<string, { assigned: number; submitted: number; late: number }>();
    const lmsLevel = traj.lms[i];
    subjects.forEach((subject, k) => {
      const dates = lectureDates(sem, k);
      const count = int(r, 3, 4);
      for (let j = 0; j < count; j++) {
        const dueDate = dates[Math.min(dates.length - 1, Math.floor(((j + 1) / (count + 1)) * dates.length))];
        const pSubmit = clamp(0.3 + 0.64 * (0.6 * lmsLevel + 0.4 * traj.eff[i]) + normal(r, 0, 0.06), 0.03, 0.99);
        const submitted = r() < pSubmit;
        const late = submitted && r() < clamp(0.4 * (1 - latent.consistency) + 0.12 * (1 - lmsLevel), 0, 0.8);
        const submittedDate = submitted ? addDays(dueDate, late ? int(r, 1, 6) : -int(r, 0, 3)) : "";
        const row: AssignmentRow = {
          id: `${identity.id}-s${sem}-${subject.code}-${j + 1}`,
          semester: sem,
          code: subject.code,
          assignedDate: addDays(dueDate, -10),
          dueDate,
          submitted,
          submittedDate,
          late,
          score: submitted ? Math.round(clamp(35 + 55 * q + normal(r, 0, 9) - (late ? 6 : 0))) : null,
        };
        assignments.push(row);
        const month = dueDate.slice(0, 7);
        const cell = monthlyAssigned.get(month) ?? { assigned: 0, submitted: 0, late: 0 };
        cell.assigned++;
        if (submitted) cell.submitted++;
        if (late) cell.late++;
        monthlyAssigned.set(month, cell);
      }
    });
    const loginsThisSem: number[] = [];
    const quizThisSem: number[] = [];
    months.forEach((month) => {
      const level = clamp(lmsLevel + normal(r, 0, 0.03), 0.02, 0.99);
      const logins = Math.max(0, Math.round((3 + 24 * level) * (1 + normal(r, 0, 0.1))));
      const quizCount = int(r, 1, 3);
      const avgQuiz = Math.round(clamp(22 + 62 * (0.55 * q + 0.3 * level + 0.15 * latent.ability) + normal(r, 0, 7)));
      const assigned = monthlyAssigned.get(month) ?? { assigned: 0, submitted: 0, late: 0 };
      lmsMonthly.push({
        semester: sem,
        month,
        logins,
        hours: Math.round(logins * between(r, 0.5, 1.1) * 10) / 10,
        assigned: assigned.assigned,
        submitted: assigned.submitted,
        late: assigned.late,
        avgQuiz,
        quizCount,
      });
      loginsThisSem.push(logins);
      quizThisSem.push(avgQuiz);
    });
    if (sem === CURRENT_SEM) {
      lmsSem5Quiz = Math.round(quizThisSem.reduce((a, b) => a + b, 0) / quizThisSem.length);
      lmsSemLoginTail.push(...loginsThisSem.slice(-2));
    }

    /* ------------------------------ engagement ----------------------------- */
    const activityCount = poisson(r, traj.soc[i] * 3.6);
    for (let a = 0; a < activityCount; a++) {
      const type = weighted<ActivityType>(r, [
        { value: "event", weight: 0.38 },
        { value: "club", weight: 0.2 },
        { value: "certification", weight: 0.28 },
        { value: "hackathon", weight: department.code === "CSE" || department.code === "IT" ? 0.14 : 0.07 },
      ]);
      const bank = pick(r, ACTIVITY_BANK[type]);
      const rr = r();
      const pendingShare = sem === CURRENT_SEM ? 0.2 : 0.04;
      const status: VerificationStatus = rr < 0.07 ? "Rejected" : rr < 0.07 + pendingShare ? "Pending" : "Approved";
      activities.push({
        id: `${identity.id}-act-${sem}-${a}`,
        type,
        ...bank,
        date: dateInSemester(r, sem, 0.05, 0.95),
        proof: `${bank.title.split(" ")[0].toLowerCase()}_proof_${sem}_${a}.pdf`,
        status,
        semester: sem,
      });
    }

    /* ------------------------ skills (end of semester) --------------------- */
    cumPrep += traj.prep[i] * 0.31;
    const techOffset = 40 * department.techAffinity;
    const softBase = 30 + 62 * (0.5 * mean(traj.soc.slice(0, sem)) + 0.3 * mean(traj.prep.slice(0, sem)) + 0.2 * latent.ability);
    if (sem >= 2) {
      for (const skill of TECH_SKILLS) {
        const score = Math.round(clamp(20 + 16 * latent.ability + 74 * cumPrep + techOffset + normal(r, 0, 6.5)));
        techNow[skill] = score;
        const date = addDays(SEM_DATES[sem][1], -int(r, 5, 40));
        skillAssessments.push({ id: `${identity.id}-sk-t-${sem}-${skill}`, semester: sem, kind: "technical", skill, score, date });
        technicalTests.push({ id: `${identity.id}-sk-${sem}-${skill}`, skill, date, score });
      }
      for (const skill of SOFT_SKILLS) {
        const score = Math.round(clamp(softBase + normal(r, 0, 7)));
        softNow[skill] = score;
        if (skill === "Communication") lastSoftComm = score;
        skillAssessments.push({
          id: `${identity.id}-sk-s-${sem}-${skill}`,
          semester: sem,
          kind: "soft",
          skill,
          score,
          date: addDays(SEM_DATES[sem][1], -int(r, 5, 40)),
        });
      }
    }
    const techMean = mean(Object.values(techNow));

    /* ---------------------------- placement -------------------------------- */
    const prepIntensity = traj.prep[i];
    if (sem >= 2) {
      let attempts = Math.min(4, poisson(r, 0.3 + 1.8 * prepIntensity));
      // the Training & Placement cell runs one compulsory aptitude screening in the final semester
      if (sem === CURRENT_SEM && aptitude.length === 0 && attempts === 0) attempts = 1;
      for (let a = 0; a < attempts; a++) {
        const pct = () => clamp(24 + 26 * latent.ability + 64 * cumPrep + normal(r, 0, 8));
        const pcts = APTITUDE_SECTIONS.map(() => pct());
        const sections = {} as AptitudeAttempt["sections"];
        let scored = 0;
        APTITUDE_SECTIONS.forEach((section, k) => {
          const score = clamp(Math.round((pcts[k] / 100) * 10), 0, 10);
          sections[section] = { score, total: 10 };
          scored += score;
        });
        aptitude.push({
          id: `${identity.id}-ap-${sem}-${a}`,
          date: dateInSemester(r, sem, 0.15, 0.95),
          pattern: pick(r, APTITUDE_PATTERNS),
          sections,
          totalPercent: Math.round((scored / 30) * 100),
          timeTakenSec: int(r, 1100, 1700),
        });
      }
    }
    if (sem >= 2) {
      const attempts = Math.min(4, poisson(r, 0.25 + 1.8 * prepIntensity));
      for (let a = 0; a < attempts; a++) {
        const language = weighted<CodingLanguage>(r, [
          { value: "Python", weight: 0.35 },
          { value: "Java", weight: 0.25 },
          { value: "C", weight: 0.2 },
          { value: "SQL", weight: 0.2 },
        ]);
        const skill = (techNow[language === "SQL" ? "SQL" : (language as TechSkill)] ?? techMean) as number;
        const questionCount = int(r, 5, 10);
        const score = Math.round(clamp(skill + normal(r, 0, 10)));
        const correct = Math.round((score / 100) * questionCount);
        const skipped = chance(r, 0.25) ? Math.min(questionCount - correct, int(r, 0, 2)) : 0;
        codingAttempts.push({
          id: `${identity.id}-code-${sem}-${a}`,
          language,
          date: dateInSemester(r, sem, 0.2, 0.95),
          difficulty: pick(r, ["Easy", "Medium", "Hard"]),
          score,
          questionCount,
          correct,
          wrong: questionCount - correct - skipped,
          skipped,
          timeTakenSec: int(r, 600, 2400),
          topicScores: {
            Basics: { correct: Math.min(correct, Math.ceil(questionCount / 3)), total: Math.ceil(questionCount / 3) },
            Logic: { correct: Math.max(0, correct - Math.ceil(questionCount / 3)), total: questionCount - Math.ceil(questionCount / 3) },
          },
        });
      }
    }
    if (sem >= 3) {
      const attempts = Math.min(3, poisson(r, 0.2 + 1.5 * prepIntensity));
      for (let a = 0; a < attempts; a++) {
        const conf = 34 + 52 * (latent.ability * 0.3 + traj.soc[i] * 0.7) + normal(r, 0, 6);
        const score = Math.round(clamp(0.35 * lastSoftComm + 0.35 * techMean + 0.3 * conf + normal(r, 0, 5)));
        interviews.push({
          id: `${identity.id}-int-${sem}-${a}`,
          date: dateInSemester(r, sem, 0.3, 0.95),
          type: pick(r, ["HR", "Technical", "Mixed"]),
          difficulty: pick(r, ["Easy", "Medium", "Standard"]),
          score,
          ratings: {
            communication: ratingFromScore(lastSoftComm, r),
            technical: ratingFromScore(techMean, r),
            confidence: ratingFromScore(conf, r),
          },
          feedback: score < 50 ? INTERVIEW_FEEDBACK.low : score < 70 ? INTERVIEW_FEEDBACK.mid : INTERVIEW_FEEDBACK.high,
        });
      }
    }

    /* --------------------------- faculty remarks --------------------------- */
    const level = clamp(0.4 * traj.eff[i] + 0.3 * (attPct / 100) + 0.3 * latent.consistency, 0, 1);
    subjects.forEach((subject, k) => {
      const rate = () => clamp(Math.round(1 + level * 4 + between(r, -0.8, 0.8)), 1, 5);
      const [participation, discipline, attitude] = [rate(), rate(), rate()];
      const m = (participation + discipline + attitude) / 3;
      facultyRemarksAll.push({
        semester: sem,
        code: subject.code,
        teacher: subject.teacher,
        date: addDays(SEM_DATES[sem][0], 45 + k),
        participation,
        discipline,
        attitude,
        comment: m >= 3.8 ? pick(r, REMARK_POS) : m >= 2.8 ? pick(r, REMARK_MID) : pick(r, REMARK_LOW),
      });
    });
  }

  /* -------------------- supplementary exams and backlogs ------------------- */
  const results: SubjectResult[] = firstAttempt.map((x) => ({ ...x }));
  const backlogs: Backlog[] = [];
  const backlogRows: BacklogRow[] = [];
  for (const failed of firstAttempt.filter((x) => !x.passed)) {
    const first: BacklogAttempt = { attempt: 1, date: addDays(SEM_DATES[failed.semester][1], -6), marks: failed.total, result: "Fail" };
    const attempts: BacklogAttempt[] = [first];
    let cleared = false;
    for (let k = 1; failed.semester + k <= CURRENT_SEM && !cleared; k++) {
      const examSem = failed.semester + k;
      const pPass = clamp(0.35 + 0.5 * traj.eff[examSem - 1] + 0.2 * latent.ability - 0.15 * (k - 1), 0.05, 0.92);
      cleared = r() < pPass;
      attempts.push({
        attempt: k + 1,
        date: addDays(SEM_DATES[examSem][1], -5),
        marks: cleared ? int(r, 40, 58) : int(r, 22, 39),
        result: cleared ? "Pass" : "Fail",
      });
    }
    backlogs.push({ code: failed.code, semester: failed.semester, status: cleared ? "cleared" : "active", attempts });
    attempts.forEach((a) => backlogRows.push({ code: failed.code, semester: failed.semester, ...a }));
    if (cleared) {
      const passing = attempts[attempts.length - 1].marks;
      const index = results.findIndex((x) => x.code === failed.code);
      results[index] = makeResult(failed.code, failed.semester, passing, r);
    }
  }

  /* ----------------------- current-state portal fields --------------------- */
  const latestSem5Months = lmsMonthly.filter((m) => m.semester === CURRENT_SEM);
  const assigned = latestSem5Months.reduce((a, m) => a + m.assigned, 0);
  const submitted = latestSem5Months.reduce((a, m) => a + m.submitted, 0);
  const late = latestSem5Months.reduce((a, m) => a + m.late, 0);
  const loginsTail = lmsSemLoginTail.length ? Math.round(mean(lmsSemLoginTail)) : 0;

  const bestCoding = codingAttempts.filter((c) => c.questionCount >= 5).map((c) => c.score);
  const codingScore = bestCoding.length
    ? Math.max(...bestCoding)
    : Math.round(clamp(mean(["Python", "Java", "C"].map((k) => techNow[k as TechSkill] ?? 40)) * 0.85));

  const lastRemarks = facultyRemarksAll
    .filter((x) => x.semester === CURRENT_SEM)
    .map((x) => ({ code: x.code, teacher: x.teacher, date: x.date, participation: x.participation, discipline: x.discipline, attitude: x.attitude, comment: x.comment }));

  const first = identity.name.split(" ")[0].toLowerCase();
  const last = identity.name.split(" ").slice(1).join("").toLowerCase();
  const student: Student = {
    id: identity.id,
    name: identity.name,
    rollNo: `${String(BATCH_YEAR % 100)}${ROLL_CODES[department.code]}${String(identity.deptSeq + 1).padStart(3, "0")}`,
    branch: department.branch,
    branchCode: department.code,
    semester: CURRENT_SEM,
    email: `${first}.${last}@campus.edu`,
    profile: {
      department: department.name,
      section,
      mentorId: mentor.id,
      mentorName: mentor.name,
      gender: identity.gender,
      residence,
      scholarship,
      entryBand,
      incomeBand,
      batch: BATCH_YEAR,
    },
    results,
    backlogs,
    attendance: [],
    semesterAttendance: Object.fromEntries([1, 2, 3, 4].map((k) => [k, semesterAttendance[k]])),
    lms: {
      loginsLast30: loginsTail,
      lastLogin: addDays(TODAY, -int(r, 21 + Math.round(latent.consistency * -10), 60 - Math.round(latent.consistency * 25))),
      assignments: { assigned, submitted, late, pending: assigned - submitted },
      avgQuiz: lmsSem5Quiz,
    },
    activities,
    placement: { aptitude, codingScore, interviews },
    skills: {
      technical: { ...techNow },
      codingAttempts,
      soft: { ...softNow },
      technicalTests,
    },
    feedback: { survey: null, teacherFeedback: [], remarks: lastRemarks },
  };
  student.attendance = rebuildAttendance(student, lecturePresence);

  return {
    student,
    lecturePresence,
    archetype,
    latent,
    firstAttempt,
    attendanceMonthly,
    lmsMonthly,
    assignments,
    skillAssessments,
    facultyRemarksAll,
    backlogRows,
    semesterAttendance,
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/* -------------------------------------------------------------------------- */
/* cohort                                                                     */
/* -------------------------------------------------------------------------- */

function sampleNames(r: Rng, count: number) {
  const used = new Set<string>(["Aarav Mehta"]);
  const names: { name: string; gender: Gender }[] = [{ name: "Aarav Mehta", gender: "Male" }];
  while (names.length < count) {
    const female = chance(r, 0.42);
    const first = pick(r, female ? FEMALE_NAMES : MALE_NAMES);
    const name = `${first} ${pick(r, SURNAMES)}`;
    if (used.has(name)) continue;
    used.add(name);
    names.push({ name, gender: female ? "Female" : "Male" });
  }
  return names;
}

export function generateAllStudents(count = STUDENT_COUNT): GeneratedStudent[] {
  const r = mulberry32(DATASET_SEED);
  const names = sampleNames(r, count);
  const deptCounters: Record<string, number> = {};
  const students: GeneratedStudent[] = [];
  for (let index = 0; index < count; index++) {
    // student 1 is the default demo student: a department-CSE consistent-average profile
    const department = index === 0 ? DEPARTMENTS[0] : weighted(r, DEPARTMENTS.map((d) => ({ value: d, weight: d.weight })));
    const archetype = index === 0 ? "consistent_average" : weighted(r, ARCHETYPES.map((a) => ({ value: a.id, weight: a.share })));
    const deptSeq = deptCounters[department.code] ?? 0;
    deptCounters[department.code] = deptSeq + 1;
    students.push(
      buildStudent({
        index,
        id: `STU-${String(index + 1).padStart(4, "0")}`,
        name: names[index].name,
        gender: names[index].gender,
        department,
        deptSeq,
        archetype,
      }),
    );
  }
  return students;
}
