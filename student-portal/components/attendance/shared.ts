import { AlertTriangle, ShieldAlert, ShieldCheck, CircleSlash } from 'lucide-react'
import type { Status, SubjectStat } from '@student/lib/attendance'
import { REQUIRED_PCT } from '@student/lib/attendance'
import { TONE } from '@student/lib/utils'

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Visual style for a status band. Status is always shown with text + icon, never colour alone. */
export function statusStyle(s: Status) {
  if (s.tone === 'none') return { Icon: CircleSlash, text: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', borderL: 'border-l-border', hex: 'var(--chart-cohort)', solid: 'bg-muted-foreground' }
  const t = TONE[s.tone]
  const Icon = s.label === 'Critical' ? ShieldAlert : s.label === 'At risk' ? AlertTriangle : ShieldCheck
  return { Icon, text: t.text, bg: t.bg, border: t.border, borderL: s.tone === 'good' ? 'border-l-success' : s.tone === 'warn' ? 'border-l-warning' : 'border-l-danger', hex: t.hex, solid: t.solid }
}

/** The action sentence for a subject — computed from its numbers only. */
export function actionLine(s: SubjectStat): string {
  if (s.total === 0) return 'No lectures recorded yet'
  if (s.status.label === 'Critical') return `Attend the next ${plural(s.mustAttend, 'lecture')} in a row to reach ${REQUIRED_PCT}%`
  if (s.canMiss === 0) return `You can't miss any more lectures without dropping below ${REQUIRED_PCT}%`
  return `You can miss up to ${s.canMiss} more ${s.canMiss === 1 ? 'lecture' : 'lectures'} and stay above ${REQUIRED_PCT}%`
}

export const fmtPct = (n: number | null) => (n === null ? 'No data yet' : `${n}%`)
export const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
