/**
 * ============================================================================
 *  SCORING ENGINE — the single source of truth for every number in the app.
 *  Home and all detail pages call these functions, so they can never disagree.
 *  All functions are pure: (student data, cohort stats) -> numbers.
 * ============================================================================
 */
import type { CohortStats, Level, SkillTestAttempt, SoftSkill, Student, TechSkill } from '@student/types'
import { CATALOG, subjectByCode } from '@student/data/catalog'
import { REQUIRED_PCT, canMiss, mustAttend, statusFor } from '@student/lib/attendance'

/* ------------------------------ CONFIGURATION ----------------------------- */

/** Component weights of the Student Success Score. Must sum to 1. Change here only. */
export const WEIGHTS = {
  academic: 0.25,
  attendance: 0.2,
  lms: 0.15,
  placement: 0.15,
  skills: 0.1,
  engagement: 0.1,
  faculty: 0.05,
} as const
export type ComponentKey = keyof typeof WEIGHTS

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  academic: 'Academics',
  attendance: 'Attendance',
  lms: 'LMS Activity',
  placement: 'Placement Readiness',
  skills: 'Skills',
  engagement: 'Engagement',
  faculty: 'Faculty Feedback',
}

/** Points per APPROVED engagement entry. Pending/Rejected entries never count. */
export const ENGAGEMENT_POINTS = { hackathon: 15, certification: 10, club: 10, event: 5 } as const
export const ATTENDANCE_REQUIREMENT = REQUIRED_PCT
export const BACKLOG_PENALTY = 10
/** Placement readiness weights (4.3) */
export const PLACEMENT_WEIGHTS = { aptitude: 0.35, coding: 0.3, interview: 0.25, technical: 0.1 } as const
export const ELIGIBILITY = { minCgpa: 7, maxActiveBacklogs: 0, minAttendance: 75 }
export const BANDS = { onTrack: 75, needsAttention: 50 }

export type Band = { label: 'On Track' | 'Needs Attention' | 'At Risk'; tone: Tone }
export type Tone = 'good' | 'warn' | 'bad'

/* -------------------------------- UTILITIES ------------------------------- */

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n))
export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const round1 = (n: number) => Math.round(n * 10) / 10
export const round2 = (n: number) => Math.round(n * 100) / 100

/* --------------------------------- GRADING -------------------------------- */

/** Grade scale: O 90+, A+ 80+, A 70+, B+ 60+, B 50+, C 40+, F below. Pass = total>=40 and external>=24. */
export function gradeFromTotal(total: number, passed: boolean): { grade: string; gradePoint: number } {
  if (!passed) return { grade: 'F', gradePoint: 0 }
  if (total >= 90) return { grade: 'O', gradePoint: 10 }
  if (total >= 80) return { grade: 'A+', gradePoint: 9 }
  if (total >= 70) return { grade: 'A', gradePoint: 8 }
  if (total >= 60) return { grade: 'B+', gradePoint: 7 }
  if (total >= 50) return { grade: 'B', gradePoint: 6 }
  return { grade: 'C', gradePoint: 5 }
}
export const isPass = (total: number, external: number) => total >= 40 && external >= 24

/* -------------------------------- ACADEMICS ------------------------------- */

const creditsOf = (code: string) => subjectByCode(code).credits

/** SGPA of one semester = Σ(gradePoint × credits) / Σ credits */
export function sgpa(s: Student, sem: number): number {
  const rs = s.results.filter((r) => r.semester === sem)
  const cr = rs.reduce((a, r) => a + creditsOf(r.code), 0)
  return cr ? round2(rs.reduce((a, r) => a + r.gradePoint * creditsOf(r.code), 0) / cr) : 0
}
/** CGPA up to (and including) a semester. */
export function cgpa(s: Student, upTo = 99): number {
  const rs = s.results.filter((r) => r.semester <= upTo)
  const cr = rs.reduce((a, r) => a + creditsOf(r.code), 0)
  return cr ? round2(rs.reduce((a, r) => a + r.gradePoint * creditsOf(r.code), 0) / cr) : 0
}
export const activeBacklogs = (s: Student) => s.backlogs.filter((b) => b.status === 'active')
export function creditTotals(s: Student) {
  const total = s.results.reduce((a, r) => a + creditsOf(r.code), 0)
  const earned = s.results.reduce((a, r) => a + r.creditsObtained, 0)
  return { total, earned }
}

/* ------------------------------- ATTENDANCE ------------------------------- */

export interface SubjectAttendance {
  code: string
  name: string
  short: string
  attended: number
  total: number
  missed: number
  percent: number
  status: Tone
  /** lectures to attend (consecutively) to reach 75%; 0 if already there */
  needed: number
  /** lectures that can still be skipped while staying >= 75% */
  canMiss: number
}

/** Attendance maths lives in src/lib/attendance.ts; these aliases keep older imports working. */
export const lecturesNeeded = mustAttend
export const lecturesCanMiss = canMiss

export function attendanceBySubject(s: Student): SubjectAttendance[] {
  return s.attendance.map((rec) => {
    const total = rec.lectures.length
    const attended = rec.lectures.filter((l) => l.present).length
    const percent = total ? round1((attended / total) * 100) : 0
    const sub = subjectByCode(rec.code)
    return {
      code: rec.code, name: sub.name, short: sub.short, attended, total, missed: total - attended, percent,
      status: (statusFor(percent).tone === 'none' ? 'bad' : statusFor(percent).tone) as Tone,
      needed: lecturesNeeded(attended, total),
      canMiss: lecturesCanMiss(attended, total),
    }
  })
}
export function attendanceOverall(s: Student) {
  const subs = attendanceBySubject(s)
  const total = subs.reduce((a, x) => a + x.total, 0)
  const attended = subs.reduce((a, x) => a + x.attended, 0)
  return { total, attended, missed: total - attended, percent: total ? round1((attended / total) * 100) : 0 }
}

/* ---------------------------------- LMS ----------------------------------- */

export const assignmentCompletion = (s: Student) =>
  s.lms.assignments.assigned ? (s.lms.assignments.submitted / s.lms.assignments.assigned) * 100 : 0

/** LMS score = 50% assignment completion + 30% login activity vs cohort max + 20% avg quiz */
export function lmsScore(s: Student, cohort: CohortStats): number {
  const login = cohort.maxLogins ? (s.lms.loginsLast30 / cohort.maxLogins) * 100 : 0
  return clamp(0.5 * assignmentCompletion(s) + 0.3 * login + 0.2 * s.lms.avgQuiz)
}

/* ------------------------------- ENGAGEMENT ------------------------------- */

export function engagementPoints(s: Student, upToSem = 99): number {
  return s.activities
    .filter((a) => a.status === 'Approved' && a.semester <= upToSem)
    .reduce((p, a) => p + ENGAGEMENT_POINTS[a.type], 0)
}

/* -------------------------------- SKILLS ---------------------------------- */

export const techAvg = (s: Student) => avg(Object.values(s.skills.technical).filter((v): v is number => v !== undefined))
export const softAvg = (s: Student) => avg(Object.values(s.skills.soft))
export const skillsScore = (s: Student) => (techAvg(s) + softAvg(s)) / 2

export function skillLevel(score: number): 'Beginner' | 'Intermediate' | 'Advanced' {
  return score >= 75 ? 'Advanced' : score >= 50 ? 'Intermediate' : 'Beginner'
}

/* ------------------------------- PLACEMENT -------------------------------- */

export const latestAptitude = (s: Student) => {
  const a = [...s.placement.aptitude].sort((x, y) => x.date.localeCompare(y.date))
  return a.length ? a[a.length - 1] : null
}
export const bestInterview = (s: Student) => Math.max(0, ...s.placement.interviews.map((i) => i.score))

export interface PlacementBreakdown { aptitude: number; coding: number; interview: number; technical: number }

/** 4.3 — readiness = 35% latest aptitude + 30% coding + 25% best mock interview + 10% technical skills avg */
export function placementReadiness(s: Student): { score: number; breakdown: PlacementBreakdown } {
  const breakdown = {
    aptitude: latestAptitude(s)?.totalPercent ?? 0,
    coding: s.placement.codingScore,
    interview: bestInterview(s),
    technical: techAvg(s),
  }
  const score =
    PLACEMENT_WEIGHTS.aptitude * breakdown.aptitude +
    PLACEMENT_WEIGHTS.coding * breakdown.coding +
    PLACEMENT_WEIGHTS.interview * breakdown.interview +
    PLACEMENT_WEIGHTS.technical * breakdown.technical
  return { score: round1(clamp(score)), breakdown }
}

export interface EligibilityItem { label: string; ok: boolean; actual: string; required: string }
export function eligibility(s: Student): { items: EligibilityItem[]; eligible: boolean } {
  const c = cgpa(s)
  const b = activeBacklogs(s).length
  const att = attendanceOverall(s).percent
  const items: EligibilityItem[] = [
    { label: `CGPA ≥ ${ELIGIBILITY.minCgpa}`, ok: c >= ELIGIBILITY.minCgpa, actual: c.toFixed(2), required: `${ELIGIBILITY.minCgpa}` },
    { label: 'Zero active backlogs', ok: b <= ELIGIBILITY.maxActiveBacklogs, actual: `${b}`, required: '0' },
    { label: `Attendance ≥ ${ELIGIBILITY.minAttendance}%`, ok: att >= ELIGIBILITY.minAttendance, actual: `${att}%`, required: `${ELIGIBILITY.minAttendance}%` },
  ]
  return { items, eligible: items.every((i) => i.ok) }
}

/* -------------------------------- FACULTY --------------------------------- */

export function facultyAvgRating(s: Student): number {
  const all = s.feedback.remarks.flatMap((r) => [r.participation, r.discipline, r.attitude])
  return avg(all)
}

/* ----------------------- 4.1 STUDENT SUCCESS SCORE ------------------------ */

export type ComponentScores = Record<ComponentKey, number>

/** Each component normalised to 0–100. */
export function componentScores(s: Student, cohort: CohortStats): ComponentScores {
  return {
    academic: clamp((cgpa(s) / 10) * 100 - BACKLOG_PENALTY * activeBacklogs(s).length),
    attendance: attendanceOverall(s).percent,
    lms: lmsScore(s, cohort),
    placement: placementReadiness(s).score,
    skills: skillsScore(s),
    engagement: clamp(engagementPoints(s)),
    faculty: clamp((facultyAvgRating(s) / 5) * 100),
  }
}

export const weightedScore = (c: ComponentScores) =>
  round1(clamp((Object.keys(WEIGHTS) as ComponentKey[]).reduce((t, k) => t + WEIGHTS[k] * c[k], 0)))

export function bandFor(score: number): Band {
  if (score >= BANDS.onTrack) return { label: 'On Track', tone: 'good' }
  if (score >= BANDS.needsAttention) return { label: 'Needs Attention', tone: 'warn' }
  return { label: 'At Risk', tone: 'bad' }
}

/** Average component scores across the cohort (used for "impact vs cohort"). */
export function cohortAverageComponents(students: Student[], cohortLike: CohortStats): ComponentScores {
  const keys = Object.keys(WEIGHTS) as ComponentKey[]
  const sums = Object.fromEntries(keys.map((k) => [k, 0])) as ComponentScores
  for (const st of students) {
    const c = componentScores(st, cohortLike)
    keys.forEach((k) => (sums[k] += c[k]))
  }
  keys.forEach((k) => (sums[k] /= students.length || 1))
  return sums
}

/* ------------------------------ 4.2 RISK FLAGS ---------------------------- */

export interface Indicator { label: string; value: string; threshold: string; status: Tone | 'ok'; detail: string }
export interface RiskFlag { level: Level; reasons: string[]; indicators: Indicator[] }

const levelFrom = (inds: Indicator[]): Level =>
  inds.some((i) => i.status === 'bad') ? 'High' : inds.some((i) => i.status === 'warn') ? 'Medium' : 'Low'

export function academicRisk(s: Student): RiskFlag {
  const c = cgpa(s)
  const b = activeBacklogs(s).length
  const att = attendanceOverall(s).percent
  const indicators: Indicator[] = [
    {
      label: 'CGPA', value: c.toFixed(2), threshold: 'High < 6 · Medium < 7',
      status: c < 6 ? 'bad' : c < 7 ? 'warn' : 'ok',
      detail: c < 6 ? `CGPA ${c.toFixed(2)} is below 6.0` : c < 7 ? `CGPA ${c.toFixed(2)} is below 7.0` : `CGPA ${c.toFixed(2)} is healthy`,
    },
    {
      label: 'Active backlogs', value: `${b}`, threshold: 'High ≥ 2 · Medium = 1',
      status: b >= 2 ? 'bad' : b === 1 ? 'warn' : 'ok',
      detail: b >= 2 ? `${b} active backlogs (2 or more)` : b === 1 ? '1 active backlog' : 'No active backlogs',
    },
    {
      label: 'Overall attendance', value: `${att}%`, threshold: 'High < 65% · Medium < 75%',
      status: att < 65 ? 'bad' : att < 75 ? 'warn' : 'ok',
      detail: att < 65 ? `Attendance ${att}% is below 65%` : att < 75 ? `Attendance ${att}% is below 75%` : `Attendance ${att}% meets the requirement`,
    },
  ]
  const level = levelFrom(indicators)
  const reasons = indicators.filter((i) => i.status !== 'ok').map((i) => i.detail)
  return { level, reasons: reasons.length ? reasons : ['All academic indicators are within safe limits.'], indicators }
}

export function placementRisk(s: Student): RiskFlag {
  const { score } = placementReadiness(s)
  const el = eligibility(s)
  const failed = el.items.filter((i) => !i.ok)
  const indicators: Indicator[] = [
    {
      label: 'Placement readiness', value: `${score}`, threshold: 'High < 40 · Medium < 60',
      status: score < 40 ? 'bad' : score < 60 ? 'warn' : 'ok',
      detail: score < 40 ? `Readiness ${score} is below 40` : score < 60 ? `Readiness ${score} is below 60` : `Readiness ${score} is solid`,
    },
    {
      label: 'Eligibility', value: el.eligible ? 'Eligible' : 'Not eligible', threshold: 'All 3 criteria must pass',
      status: el.eligible ? 'ok' : 'bad',
      detail: el.eligible ? 'Meets all eligibility criteria' : `Not eligible: ${failed.map((f) => f.label).join(', ')}`,
    },
  ]
  const level = levelFrom(indicators)
  const reasons = indicators.filter((i) => i.status !== 'ok').map((i) => i.detail)
  return { level, reasons: reasons.length ? reasons : ['Placement indicators are healthy.'], indicators }
}

/* ----------------------------- 4.5 SEGMENTATION --------------------------- */

export interface Segment { name: string; tone: Tone; description: string; actions: string[] }

/** First match wins. */
export function segmentFor(score: number, s: Student, comps: ComponentScores): Segment {
  const c = cgpa(s)
  const ready = comps.placement
  const att = comps.attendance
  if (score < 40)
    return { name: 'Critical Support Needed', tone: 'bad', description: 'Multiple areas are below the safe range and early intervention is needed.',
      actions: ['Book a one-to-one session with your mentor this week', 'Create a recovery plan for attendance and backlogs', 'Join a peer-study group for your weakest subject'] }
  if (c >= 8 && ready < 50)
    return { name: 'Academic Star, Placement Gap', tone: 'warn', description: 'Strong grades, but placement preparation has not caught up yet.',
      actions: ['Take one aptitude test every week', 'Solve 2 coding problems daily', 'Schedule a mock interview every fortnight'] }
  if (ready >= 60 && c < 7)
    return { name: 'Skilled but Academically Weak', tone: 'warn', description: 'You have strong practical skills, but grades are holding you back.',
      actions: ['Prioritise clearing backlogs and low-scoring subjects', 'Ask faculty for doubt-clearing slots', 'Use your skill strengths to build project-based understanding of theory'] }
  if (att < 70 && comps.lms < 50)
    return { name: 'Disengaged', tone: 'bad', description: 'Low class attendance and low LMS activity suggest you may be drifting away.',
      actions: ['Attend every lecture for the next 2 weeks', 'Submit all pending LMS assignments', 'Talk to your mentor about what is getting in the way'] }
  if (score >= 75)
    return { name: 'All-Rounder', tone: 'good', description: 'Balanced performance across academics, skills and engagement.',
      actions: ['Mentor a peer in your strongest subject', 'Aim for a leadership role in a club', 'Target top-tier company preparation'] }
  return { name: 'Steady Performer', tone: 'warn', description: 'You are doing okay, with clear room to improve in a few areas.',
    actions: ['Focus on your lowest component this week', 'Keep attendance above 80%', 'Add one approved activity this semester'] }
}

/* ------------------------- 4.4 EXPLAINABLE SCORE -------------------------- */

export interface Contribution {
  key: ComponentKey
  label: string
  weight: number
  score: number
  contribution: number // weight × score
  cohortAvg: number
  impact: number // weight × (score − cohortAvg)
}

export function explain(comps: ComponentScores, cohortAvg: ComponentScores) {
  const keys = Object.keys(WEIGHTS) as ComponentKey[]
  const contributions: Contribution[] = keys.map((k) => ({
    key: k, label: COMPONENT_LABELS[k], weight: WEIGHTS[k], score: round1(comps[k]),
    contribution: round1(WEIGHTS[k] * comps[k]), cohortAvg: round1(cohortAvg[k]),
    impact: round2(WEIGHTS[k] * (comps[k] - cohortAvg[k])),
  }))
  const sorted = [...contributions].sort((a, b) => b.impact - a.impact)
  return { contributions, topHelping: sorted[0], topPulling: sorted[sorted.length - 1] }
}

/* ------------------------------ ACTIONS ----------------------------------- */

export interface ActionItem { key: ComponentKey; title: string; detail: string; href: string; potential: number }

/** "Top 3 actions this week" — biggest upside = weight × (100 − score) for the weakest components. */
export function topActions(s: Student, comps: ComponentScores, n = 3): ActionItem[] {
  const keys = Object.keys(WEIGHTS) as ComponentKey[]
  const ranked = keys.map((k) => ({ k, gap: WEIGHTS[k] * (100 - comps[k]) })).sort((a, b) => b.gap - a.gap)
  return ranked.slice(0, n).map(({ k }) => {
    const potential = round1(WEIGHTS[k] * Math.min(20, 100 - comps[k]))
    return { key: k, potential, ...actionText(k, s, comps) }
  })
}

function actionText(k: ComponentKey, s: Student, comps: ComponentScores): { title: string; detail: string; href: string } {
  switch (k) {
    case 'academic': {
      const b = activeBacklogs(s)
      if (b.length) return { title: `Clear your backlog in ${subjectByCode(b[0].code).name}`, detail: `Each active backlog costs ${BACKLOG_PENALTY} points of academic score and blocks placement eligibility.`, href: '/results' }
      const weakest = [...s.results.filter((r) => r.semester === s.semester)].sort((a, b) => a.total - b.total)[0]
      return { title: `Improve ${weakest ? subjectByCode(weakest.code).short : 'your weakest subject'}`, detail: 'Raising your lowest-scoring subject lifts CGPA the fastest.', href: '/results' }
    }
    case 'attendance': {
      const low = attendanceBySubject(s).sort((a, b) => a.percent - b.percent)[0]
      return low && low.needed > 0
        ? { title: `Attend the next ${low.needed} ${low.short} lectures`, detail: `Your ${low.name} attendance is ${low.percent}%. Reaching 75% protects you from detention.`, href: '/attendance' }
        : { title: 'Keep attendance above 80%', detail: 'Extra buffer lets you handle emergencies without dropping below 75%.', href: '/attendance' }
    }
    case 'lms': {
      const p = s.lms.assignments.pending
      return { title: p ? `Submit ${p} pending assignments` : 'Log into the LMS 3× per week', detail: `Assignment completion is ${Math.round(assignmentCompletion(s))}% and you logged in ${s.lms.loginsLast30} times in 30 days.`, href: '/' }
    }
    case 'placement': {
      const { breakdown } = placementReadiness(s)
      const weakest = Object.entries(breakdown).sort((a, b) => a[1] - b[1])[0]
      const map: Record<string, { title: string; href: string }> = {
        aptitude: { title: 'Take a full aptitude test', href: '/placement/aptitude' },
        coding: { title: 'Solve 2 coding problems daily', href: '/placement' },
        interview: { title: 'Practise a mock interview', href: '/placement/interview' },
        technical: { title: 'Take a technical skill test', href: '/skills' },
      }
      return { ...map[weakest[0]], detail: `Your ${weakest[0]} score is ${Math.round(weakest[1])}% — the weakest part of placement readiness (${Math.round(comps.placement)}).` }
    }
    case 'skills': {
      const t = Object.entries(s.skills.technical).sort((a, b) => a[1] - b[1])[0]
      const so = Object.entries(s.skills.soft).sort((a, b) => a[1] - b[1])[0]
      return t[1] <= so[1]
        ? { title: `Level up ${t[0]}`, detail: `${t[0]} is at ${t[1]}%. Take a timed test and follow the suggested resources.`, href: '/skills' }
        : { title: `Work on ${so[0]}`, detail: `${so[0]} is at ${so[1]}%. Try the situational judgment test and join a club role.`, href: '/skills' }
    }
    case 'engagement':
      return { title: 'Log an approved activity', detail: `You have ${engagementPoints(s)} approved points. A certification (+10) or hackathon (+15) moves the needle most.`, href: '/engagement' }
    case 'faculty':
      return { title: 'Participate more in class', detail: 'Faculty remarks on participation and attitude feed 5% of your score.', href: '/feedback' }
  }
}

/* ------------------------------ SCORE TREND -------------------------------- */

/**
 * Success Score per semester. For earlier semesters we use the historical CGPA,
 * backlogs, attendance and approved engagement of that time; the components with no
 * stored history (LMS, placement, skills, faculty) are held at current values.
 * The final point equals the live score exactly.
 */
export function scoreTrend(s: Student, cohort: CohortStats) {
  const current = componentScores(s, cohort)
  const out: { semester: string; score: number }[] = []
  for (let k = 1; k <= s.semester; k++) {
    if (k === s.semester) { out.push({ semester: `Sem ${roman(k)}`, score: weightedScore(current) }); continue }
    const backlogsThen = activeBacklogs(s).filter((b) => b.semester <= k).length
    const c: ComponentScores = {
      ...current,
      academic: clamp((cgpa(s, k) / 10) * 100 - BACKLOG_PENALTY * backlogsThen),
      attendance: s.semesterAttendance[k] ?? current.attendance,
      engagement: clamp(engagementPoints(s, k)),
    }
    out.push({ semester: `Sem ${roman(k)}`, score: weightedScore(c) })
  }
  return out
}
export const roman = (n: number) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n]

/* ------------------------------ FULL ANALYSIS ------------------------------ */

export function analyze(s: Student, cohort: CohortStats) {
  const comps = componentScores(s, cohort)
  const score = weightedScore(comps)
  const cohortAvg = cohort.avgComponents as ComponentScores
  return {
    comps,
    score,
    band: bandFor(score),
    academicRisk: academicRisk(s),
    placementRisk: placementRisk(s),
    segment: segmentFor(score, s, comps),
    explain: explain(comps, cohortAvg),
    actions: topActions(s, comps),
    trend: scoreTrend(s, cohort),
    readiness: placementReadiness(s),
    eligibility: eligibility(s),
    attendance: attendanceOverall(s),
    cgpa: cgpa(s),
    points: engagementPoints(s),
  }
}
export type Analysis = ReturnType<typeof analyze>

/** Re-export so pages can fetch weakest attendance etc. without importing catalog. */
export { CATALOG }
export type { SkillTestAttempt, SoftSkill, TechSkill }
