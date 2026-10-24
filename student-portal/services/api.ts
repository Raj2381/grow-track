/**
 * Service layer. The UI only talks to these async functions.
 * To use a real backend (Express + MongoDB / Supabase) re-implement the bodies with fetch()/supabase calls —
 * keep the signatures and no UI code changes. See README → "Replacing mock data".
 *
 * Mock persistence: activities, test attempts, and legacy satisfaction/teacher feedback are stored per
 * student in localStorage as an overlay merged onto the seeded mock record. General feedback submissions
 * use the separate local-only store in localFeedback.ts.
 */
import type {
  Activity, AptitudeAttempt, CodingAttempt, CohortStats, InterviewAttempt, SoftSkill, SkillTestAttempt, Student, SurveyResponse,
  TeacherFeedback, TechSkill,
} from '@student/types'
import { clearLocalFeedbackData } from '@student/services/localFeedback'
import { DEFAULT_STUDENT_ID } from '@student/data/students'
import { rebuildAttendance } from '@/lib/dataset/attendance-rebuild'

interface Overlay {
  activities: Activity[]
  aptitude: AptitudeAttempt[]
  interviews: InterviewAttempt[]
  skillTests: SkillTestAttempt[]
  coding: CodingAttempt[]
  soft: Partial<Record<SoftSkill, number>>
  survey: SurveyResponse | null
  teacherFeedback: TeacherFeedback[]
  intro?: { date: string; score: number; feedback: string }
}

import { MIN_QUESTIONS_FOR_SKILL } from '@student/lib/coding'
const emptyOverlay = (): Overlay => ({ activities: [], aptitude: [], interviews: [], skillTests: [], coding: [], soft: {}, survey: null, teacherFeedback: [] })

const LS_KEY = 'scap.overlay.v1'
const latency = (ms = 450) => new Promise((r) => setTimeout(r, ms))

function loadAll(): Record<string, Overlay> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function saveOverlay(id: string, fn: (o: Overlay) => void) {
  const all = loadAll()
  const o = { ...emptyOverlay(), ...(all[id] ?? {}) }
  fn(o)
  all[id] = o
  localStorage.setItem(LS_KEY, JSON.stringify(all))
  listeners.forEach((l) => l())
}

/* ------------------------------ change events ----------------------------- */
const listeners = new Set<() => void>()
export function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }

/* ------------------------------- read APIs -------------------------------- */
function merge(base: Student): Student {
  const o = { ...emptyOverlay(), ...(loadAll()[base.id] ?? {}) }
  const technical = { ...base.skills.technical }
  // the latest skill test per skill overrides the stored score
  const latest: Partial<Record<TechSkill, SkillTestAttempt>> = {}
  for (const t of o.skillTests) if (!latest[t.skill] || latest[t.skill]!.date <= t.date) latest[t.skill] = t
  ;(Object.keys(latest) as TechSkill[]).forEach((k) => (technical[k] = latest[k]!.score))
  // best coding-test score per language overrides the skill (only attempts with enough questions count)
  const best: Partial<Record<TechSkill, number>> = {}
  for (const c of o.coding) if (c.questionCount >= MIN_QUESTIONS_FOR_SKILL) best[c.language] = Math.max(best[c.language] ?? 0, c.score)
  ;(Object.keys(best) as TechSkill[]).forEach((k) => (technical[k] = best[k]))
  return {
    ...base,
    activities: [...base.activities, ...o.activities],
    placement: { ...base.placement, aptitude: [...base.placement.aptitude, ...o.aptitude], interviews: [...base.placement.interviews, ...o.interviews] },
    skills: { ...base.skills, technical, codingAttempts: [...base.skills.codingAttempts, ...o.coding], soft: { ...base.skills.soft, ...o.soft }, technicalTests: [...base.skills.technicalTests, ...o.skillTests], introScore: o.intro ?? base.skills.introScore },
    feedback: { ...base.feedback, survey: o.survey ?? base.feedback.survey, teacherFeedback: [...base.feedback.teacherFeedback, ...o.teacherFeedback] },
  }
}

/* --------------------------- unified dataset files --------------------------- */
// Records are static JSON written by `npm run generate:data` (see data/DATASET.md). One file per student keeps
// the page light: the browser only ever downloads the students it opens.
type StudentFile = Omit<Student, 'attendance'> & { lecturePresence: Record<string, string> }
const studentCache = new Map<string, Promise<Student>>()
let cohortPromise: Promise<CohortStats> | null = null
let listPromise: Promise<{ id: string; name: string; rollNo: string; branch: string }[]> | null = null

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.json() as Promise<T>
}
function loadBase(id: string): Promise<Student> {
  let hit = studentCache.get(id)
  if (!hit) {
    hit = fetchJson<StudentFile>(`/data/students/${encodeURIComponent(id)}.json`).then(({ lecturePresence, ...rest }) => ({
      ...rest, attendance: rebuildAttendance(rest, lecturePresence),
    }))
    hit.catch(() => studentCache.delete(id))
    studentCache.set(id, hit)
  }
  return hit
}

export async function getStudent(id: string = DEFAULT_STUDENT_ID): Promise<Student> {
  return merge(await loadBase(id))
}
export function getCohort(): Promise<CohortStats> { return (cohortPromise ??= fetchJson<CohortStats>('/data/cohort.json')) }
export function listStudents(): Promise<{ id: string; name: string; rollNo: string; branch: string }[]> {
  return (listPromise ??= fetchJson('/data/students-lite.json'))
}

/* ------------------------------- write APIs -------------------------------- */
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export async function addActivity(studentId: string, a: Omit<Activity, 'id' | 'status'>) {
  await latency(300)
  saveOverlay(studentId, (o) => o.activities.push({ ...a, id: uid('act'), status: 'Pending' }))
}
export async function saveAptitudeAttempt(studentId: string, a: Omit<AptitudeAttempt, 'id'>) {
  saveOverlay(studentId, (o) => o.aptitude.push({ ...a, id: uid('apt') }))
}
export async function saveInterviewAttempt(studentId: string, a: Omit<InterviewAttempt, 'id'>) {
  saveOverlay(studentId, (o) => o.interviews.push({ ...a, id: uid('int') }))
}
export async function saveSkillTest(studentId: string, skill: TechSkill, score: number, date: string) {
  saveOverlay(studentId, (o) => o.skillTests.push({ id: uid('sk'), skill, score, date }))
}
export async function saveCodingAttempt(studentId: string, a: Omit<CodingAttempt, 'id'>) {
  saveOverlay(studentId, (o) => o.coding.push({ ...a, id: uid('code') }))
}
export async function saveSoftSkills(studentId: string, scores: Partial<Record<SoftSkill, number>>) {
  saveOverlay(studentId, (o) => { o.soft = { ...o.soft, ...scores } })
}
export async function saveIntro(studentId: string, v: { date: string; score: number; feedback: string }) {
  saveOverlay(studentId, (o) => { o.intro = v })
}
export async function submitSurvey(studentId: string, s: SurveyResponse) {
  await latency(300)
  saveOverlay(studentId, (o) => { o.survey = s })
}
export async function submitTeacherFeedback(studentId: string, f: TeacherFeedback) {
  await latency(300)
  // NOTE: anonymous — in a real backend store this WITHOUT the student id.
  saveOverlay(studentId, (o) => { o.teacherFeedback = o.teacherFeedback.filter((x) => x.code !== f.code).concat(f) })
}
export function resetDemoData() {
  localStorage.removeItem(LS_KEY)
  clearLocalFeedbackData()
  listeners.forEach((l) => l())
}
