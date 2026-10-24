/**
 * Attendance calculations — pure functions, the single source for every attendance number in the app.
 * Nothing here touches the UI. All inputs are attendance records (attended / total / dated lectures).
 */
import type { AttendanceRecord, Lecture } from '@student/types'
import { subjectByCode } from '@student/data/catalog'

export type AttTone = 'good' | 'warn' | 'bad'

/** Configuration: the requirement and the status bands live here only. */
export const ATTENDANCE_CONFIG = {
  /** Minimum attendance as a fraction (75%). */
  required: 0.75,
  /** Highest band first. `min` is the lowest percentage (inclusive) that earns the band. */
  bands: [
    { min: 90, label: 'Excellent', tone: 'good' },
    { min: 80, label: 'Good', tone: 'good' },
    { min: 75, label: 'At risk', tone: 'warn' },
    { min: -Infinity, label: 'Critical', tone: 'bad' },
  ],
} as const
export const REQUIRED = ATTENDANCE_CONFIG.required
export const REQUIRED_PCT = REQUIRED * 100

export type StatusLabel = 'Excellent' | 'Good' | 'At risk' | 'Critical'
export type Status = { label: StatusLabel | 'No data'; tone: AttTone | 'none' }

const EPS = 1e-9
const round1 = (n: number) => Math.round(n * 10) / 10

/** Subject % = attended / total × 100, rounded to 1 decimal. `null` when there are no lectures (never 0%). */
export function percent(attended: number, total: number): number | null {
  return total > 0 ? round1((attended / total) * 100) : null
}

/** Overall % = Σ attended / Σ total × 100 — weighted by lectures, NOT the mean of subject percentages. */
export function overallPercent(subjects: { attended: number; total: number }[]): number | null {
  const a = subjects.reduce((s, x) => s + x.attended, 0)
  const t = subjects.reduce((s, x) => s + x.total, 0)
  return percent(a, t)
}

/** Lectures that can still be missed and stay at/above the requirement, assuming no lectures are attended in between.
 *  can miss = max(0, floor(A / p − T)) */
export function canMiss(attended: number, total: number, p = REQUIRED): number {
  return Math.max(0, Math.floor(attended / p - total + EPS))
}

/** Consecutive lectures that must be attended to reach the requirement.
 *  must attend = max(0, ceil((p×T − A) / (1 − p))) */
export function mustAttend(attended: number, total: number, p = REQUIRED): number {
  return Math.max(0, Math.ceil((p * total - attended) / (1 - p) - EPS))
}

/** Buffer = overall % − requirement, in percentage points. `null` without data. */
export function bufferPoints(overall: number | null): number | null {
  return overall === null ? null : round1(overall - REQUIRED_PCT)
}

/** Status band for a percentage: ≥90 Excellent, 80–89.99 Good, 75–79.99 At risk, <75 Critical. */
export function statusFor(pct: number | null): Status {
  if (pct === null) return { label: 'No data', tone: 'none' }
  const b = ATTENDANCE_CONFIG.bands.find((x) => pct >= x.min)!
  return { label: b.label, tone: b.tone }
}

export interface SubjectSummary {
  attended: number
  total: number
  missed: number
  percent: number | null
  status: Status
  canMiss: number
  mustAttend: number
}
/** One call for everything a subject card needs. total = 0 → percent null and status "No data". */
export function summarize(attended: number, total: number): SubjectSummary {
  const p = percent(attended, total)
  return {
    attended, total, missed: total - attended, percent: p, status: statusFor(p),
    canMiss: total > 0 ? canMiss(attended, total) : 0,
    mustAttend: total > 0 ? mustAttend(attended, total) : 0,
  }
}

/** What-if: projected % after attending `x` and missing `y` more lectures. */
export function projected(attended: number, total: number, attend: number, miss: number): number | null {
  return percent(attended + attend, total + attend + miss)
}

/* ------------------------------ per-subject stats ----------------------------- */
export interface SubjectStat extends SubjectSummary {
  code: string
  short: string
  name: string
  teacher: string
  lectures: Lecture[]
}
export const SEVERITY: Record<string, number> = { Critical: 0, 'At risk': 1, Good: 2, Excellent: 3, 'No data': 4 }

export function subjectStats(records: AttendanceRecord[]): SubjectStat[] {
  return records.map((r) => {
    const sub = subjectByCode(r.code)
    const attended = r.lectures.filter((l) => l.present).length
    return { code: r.code, short: sub.short, name: sub.name, teacher: sub.teacher, lectures: r.lectures, ...summarize(attended, r.lectures.length) }
  })
}
/** Sort Critical → At risk → Good → Excellent, then lowest % first. */
export const bySeverity = (a: SubjectStat, b: SubjectStat) =>
  SEVERITY[a.status.label] - SEVERITY[b.status.label] || (a.percent ?? 101) - (b.percent ?? 101)

/* ------------------------------------ trend ----------------------------------- */
export interface TrendPoint { key: string; label: string; percent: number; attended: number; total: number }
type Dated = { date: string; present: boolean }

const parse = (iso: string) => new Date(iso + 'T00:00:00Z')
const fmtDay = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
/** Monday of the week containing the date (ISO yyyy-mm-dd). */
export function weekStart(iso: string): string {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function group(lectures: Dated[], keyOf: (iso: string) => string) {
  const m = new Map<string, { attended: number; total: number }>()
  for (const l of lectures) {
    const k = keyOf(l.date)
    const g = m.get(k) ?? { attended: 0, total: 0 }
    g.total++; if (l.present) g.attended++
    m.set(k, g)
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/** Attendance % for each calendar week that has lectures (that week's lectures only). */
export function weeklyTrend(lectures: Dated[]): TrendPoint[] {
  return group(lectures, weekStart).map(([k, g]) => ({ key: k, label: fmtDay(parse(k)), percent: percent(g.attended, g.total)!, ...g }))
}
/** Attendance % for each calendar month that has lectures. */
export function monthlyTrend(lectures: Dated[]): TrendPoint[] {
  return group(lectures, (d) => d.slice(0, 7)).map(([k, g]) => ({ key: k, label: parse(k + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }), percent: percent(g.attended, g.total)!, ...g }))
}
/** Running (cumulative) attendance % at the end of each week of the semester. */
export function cumulativeTrend(lectures: Dated[]): TrendPoint[] {
  let a = 0, t = 0
  return group(lectures, weekStart).map(([k, g]) => { a += g.attended; t += g.total; return { key: k, label: fmtDay(parse(k)), percent: percent(a, t)!, attended: a, total: t } })
}
/** Needs at least 2 periods; otherwise the UI shows an empty state instead of fake points. */
export const hasTrend = (pts: TrendPoint[]) => pts.length >= 2

/** Change in % between the last `n` weeks and the `n` weeks before them (pooled by lectures). null if either window is empty. */
export function trendDelta(weekly: TrendPoint[], n = 4): number | null {
  if (weekly.length < n + 1) return null
  const pool = (pts: TrendPoint[]) => percent(pts.reduce((s, p) => s + p.attended, 0), pts.reduce((s, p) => s + p.total, 0))
  const recent = pool(weekly.slice(-n))
  const before = pool(weekly.slice(-2 * n, -n))
  return recent === null || before === null ? null : round1(recent - before)
}
/** Number of consecutive weekly decreases at the end of the series. */
export function consecutiveDeclines(weekly: TrendPoint[]): number {
  let c = 0
  for (let i = weekly.length - 1; i > 0 && weekly[i].percent < weekly[i - 1].percent; i--) c++
  return c
}
