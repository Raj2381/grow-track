/**
 * Engagement page helpers: display categories, date ranges and distribution.
 * Every number on the Engagement page is derived from student.activities through these functions.
 *
 * Scoring is unchanged: only APPROVED activities earn points (ENGAGEMENT_POINTS by scoring type).
 * The finer "display category" (Workshop, Competition, Volunteering…) is stored as `activity.kind`
 * and mapped to one of the four scoring types when the student submits it.
 */
import type { Activity, ActivityType, VerificationStatus } from '@student/types'
import { ENGAGEMENT_POINTS } from './scoring'

export const TYPE_CATEGORY: Record<ActivityType, string> = { event: 'Events', club: 'Clubs', hackathon: 'Hackathons', certification: 'Certifications' }
export const TYPE_LABEL: Record<ActivityType, string> = { event: 'Event', club: 'Club role', hackathon: 'Hackathon', certification: 'Certification' }

/** Options in the Add Activity form → display category + scoring type. */
export const CATEGORY_OPTIONS: { value: string; category: string; type: ActivityType }[] = [
  { value: 'Event', category: 'Events', type: 'event' },
  { value: 'Club', category: 'Clubs', type: 'club' },
  { value: 'Hackathon', category: 'Hackathons', type: 'hackathon' },
  { value: 'Competition', category: 'Competitions', type: 'hackathon' },
  { value: 'Workshop', category: 'Workshops', type: 'event' },
  { value: 'Certification', category: 'Certifications', type: 'certification' },
  { value: 'Volunteering', category: 'Volunteering', type: 'event' },
  { value: 'Seminar or Conference', category: 'Seminars', type: 'event' },
  { value: 'Leadership Activity', category: 'Leadership', type: 'club' },
  { value: 'Other', category: 'Other', type: 'event' },
]

export const PARTICIPATION_OPTIONS = ['Participant', 'Organizer', 'Volunteer', 'Member', 'Team Leader', 'Finalist', 'Winner', 'Speaker', 'Other']

export const CATEGORY_COLORS: Record<string, string> = {
  Events: '#2563EB',
  Clubs: '#0EA5E9',
  Hackathons: '#6366F1',
  Competitions: '#A855F7',
  Workshops: '#14B8A6',
  Certifications: '#EC4899',
  Volunteering: '#F97316',
  Seminars: '#64748B',
  Leadership: '#0F766E',
  Other: '#94A3B8',
}
const EXTRA = ['#0284C7', '#7C3AED', '#0891B2', '#475569']
export function colorOf(category: string) {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category]
  let h = 0
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return EXTRA[h % EXTRA.length]
}

const DESCRIPTIONS: Record<string, string> = {
  Events: 'Campus events, fests and sessions you took part in.',
  Clubs: 'Club memberships and roles you have held.',
  Hackathons: 'Hackathons and challenge-based team events.',
  Competitions: 'Coding contests, quizzes and other competitions.',
  Workshops: 'Hands-on workshops and practical learning sessions.',
  Certifications: 'Courses and certifications you have completed.',
  Volunteering: 'Volunteer and community service activities.',
  Seminars: 'Seminars, talks and conferences you attended or spoke at.',
  Leadership: 'Leadership roles and responsibilities.',
}
export const describeCategory = (c: string) => DESCRIPTIONS[c] ?? 'Activities recorded under this category.'

export const categoryOf = (a: Activity) => a.kind || TYPE_CATEGORY[a.type]
export const pointsOf = (a: Activity) => ENGAGEMENT_POINTS[a.type]
export const earnedPoints = (a: Activity) => (a.status === 'Approved' ? pointsOf(a) : 0)

/** Outcome text: the explicit achievement, or a role that is itself an outcome (Winner, Finalist, Certified…). */
export function outcomeOf(a: Activity) {
  if (a.achievement?.trim()) return a.achievement.trim()
  return /(winner|finalist|place|elite|certified|lead)/i.test(a.role) ? a.role : ''
}

export const statusTone = (s: VerificationStatus) => (s === 'Approved' ? 'good' : s === 'Pending' ? 'warn' : 'bad') as 'good' | 'warn' | 'bad'

/* ------------------------------- date ranges ------------------------------- */
export type DateRange = 'all' | 'semester' | '7d' | '30d' | '90d' | 'custom'
export const RANGE_LABEL: Record<DateRange, string> = {
  all: 'All time', semester: 'This semester', '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', custom: 'Custom range',
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function shiftDays(isoDate: string, days: number) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return iso(d)
}

/** Filters activities by range. `today` comes from the data layer so demo data and ranges stay consistent. */
export function filterByRange(acts: Activity[], range: DateRange, opts: { today: string; semester: number; from?: string; to?: string }) {
  if (range === 'all') return acts
  if (range === 'semester') return acts.filter((a) => a.semester === opts.semester)
  const days = { '7d': 6, '30d': 29, '90d': 89 }[range as '7d' | '30d' | '90d']
  const from = range === 'custom' ? opts.from ?? '' : shiftDays(opts.today, -days)
  const to = range === 'custom' ? opts.to ?? '' : opts.today
  return acts.filter((a) => (!from || a.date >= from) && (!to || a.date <= to))
}

/* ------------------------------- distribution ------------------------------ */
export interface Slice { label: string; count: number; percentage: number; color: string }

/** Share of submitted activities per category. Rejected entries are excluded. */
export function distribution(acts: Activity[]): Slice[] {
  const counted = acts.filter((a) => a.status !== 'Rejected')
  const counts = new Map<string, number>()
  counted.forEach((a) => counts.set(categoryOf(a), (counts.get(categoryOf(a)) ?? 0) + 1))
  const total = counted.length
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percentage: total ? Math.round((count / total) * 1000) / 10 : 0, color: colorOf(label) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
