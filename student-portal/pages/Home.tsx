import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, BookOpen, Compass, Gauge, ListChecks, Sparkles, Target, Zap } from 'lucide-react'
import { WithData } from '@student/components/common'
import {
  activeBacklogs, assignmentCompletion, attendanceBySubject, cgpa, COMPONENT_LABELS, roman, skillsScore, type Analysis,
} from '@student/lib/scoring'
import { subjectsOfSemester } from '@student/data/catalog'
import { useLocalFeedback } from '@student/hooks/useLocalFeedback'
import { usePageTitle } from '@student/hooks/usePageTitle'
import { countPendingFacultyEvaluations } from '@student/services/localFeedback'
import { facultyAvgRating } from '@student/lib/scoring'
import { cn } from '@student/lib/utils'
import { useStudent } from '@student/hooks/useStudent'
import type { Student } from '@student/types'

/**
 * Home: one calm page. Every number appears once, related things are grouped in one card, and colour is used softly
 * (tinted backgrounds; coral only for numbers that are genuinely at risk).
 */

const C = {
  navy: '#1E3A5F', indigo: '#4F46E5', muted: '#374151',
  good: { fg: '#0B6F66', bg: '#E6FAF7', solid: '#14B8A6' },
  warn: { fg: '#8A5A0B', bg: '#FEF5E7', solid: '#F59E0B' },
  risk: { fg: '#B42323', bg: '#FDECEC', solid: '#F06A6A' },
} as const
type Soft = keyof Pick<typeof C, 'good' | 'warn' | 'risk'>

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1)
const signed = (n: number, d = 1) => `${n > 0 ? '↑' : n < 0 ? '↓' : '→'} ${Math.abs(n).toFixed(d)}`
const scoreSoft = (n: number): Soft => (n >= 70 ? 'good' : n >= 50 ? 'warn' : 'risk')
const bandSoft = (n: number): Soft => (n >= 75 ? 'good' : n >= 50 ? 'warn' : 'risk')
const bandLabel = (n: number) => (n >= 75 ? 'On track' : n >= 50 ? 'Needs attention' : 'At risk')

const card = 'flex flex-col overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.10)] [.dark_&]:border-border [.dark_&]:bg-card'
const body = 'flex flex-1 flex-col p-5'
const tile = 'rounded-xl border border-[#E2E8F0] bg-[#F5F8FC] p-4 [.dark_&]:border-border [.dark_&]:bg-muted/40'
const label = 'text-[13px] font-bold uppercase tracking-[0.08em] text-[#475569] [.dark_&]:text-muted-foreground'
const link = 'inline-flex items-center gap-1 text-[16px] font-semibold text-[#4F46E5] hover:underline [.dark_&]:text-indigo-300'

export default function Home() {
  return <WithData>{({ student, analysis }) => <HomeView s={student} a={analysis} />}</WithData>
}

function HomeView({ s, a }: { s: Student; a: Analysis }) {
  const { base } = useStudent()
  const to = (p: string) => base + p || '/'
  const first = s.name.split(' ')[0]
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  usePageTitle(`${greet}, ${first}`)

  return (
    <div className="rounded-2xl bg-[#EAF0F7] p-4 font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[16px] text-[#111827] sm:p-6 [.dark_&]:bg-transparent [.dark_&]:text-foreground">
      <header className="mb-6">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1E3A5F] [.dark_&]:text-foreground">{greet}, {first}</h1>
        <p className="mt-1 text-[16px] text-[#374151]">Semester {roman(s.semester)} · {s.branch}</p>
        <ActionStrip s={s} to={to} />
      </header>

      <PlanCard a={a} to={to} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_3fr]">
        <ScoreCard a={a} />
        <BreakdownCard a={a} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <AcademicsCard s={s} a={a} to={to} />
        <CareerCard a={a} to={to} s={s} />
        <EngagementCard s={s} a={a} to={to} />
      </div>

      <SkillTests s={s} to={to} />
    </div>
  )
}


/* ------------------------------ Row 0: action strip ------------------------------ */

function ActionStrip({ s, to }: { s: Student; to: (p: string) => string }) {
  const feedback = useLocalFeedback(s.id)
  const evals = countPendingFacultyEvaluations(feedback.items, subjectsOfSemester(s.semester, s.branchCode).map((x) => x.code))
  const low = attendanceBySubject(s).filter((x) => x.percent < 75).length
  const pending = s.lms.assignments.pending
  const chips: { text: string; href?: string }[] = []
  if (low) chips.push({ text: `${low} ${low === 1 ? 'subject' : 'subjects'} below 75% attendance`, href: to('/attendance') })
  if (pending) chips.push({ text: `${pending} ${pending === 1 ? 'assignment' : 'assignments'} pending` })
  if (!feedback.loading && !feedback.error && evals) chips.push({ text: `${evals} faculty ${evals === 1 ? 'evaluation' : 'evaluations'}`, href: to('/feedback') })
  if (!chips.length) return null
  return (
    <div role="region" aria-label="Action required" className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-[#FEF5E7] px-4 py-2.5 [.dark_&]:bg-amber-500/10">
      <span className="mr-1 text-[15px] font-semibold uppercase tracking-wide text-[#B7791F]">Action required</span>
      {chips.map((c) => {
        const cls = 'rounded-full bg-white/80 px-3 py-1 text-[15px] font-medium text-[#6B4A0A] [.dark_&]:bg-card [.dark_&]:text-amber-300'
        return c.href ? <Link key={c.text} to={c.href} className={cn(cls, 'hover:bg-white')}>{c.text}</Link> : <span key={c.text} className={cls}>{c.text}</span>
      })}
    </div>
  )
}

/* ------------------------------ shared pieces ------------------------------ */

function CardHead({ icon, title, tint = 'indigo', right }: { icon: ReactNode; title: string; tint?: 'indigo' | 'teal' | 'amber' | 'violet'; right?: ReactNode }) {
  const chip = { indigo: 'bg-[#E0E7FF] text-[#3730A3]', teal: 'bg-[#CCFBF1] text-[#0F766E]', amber: 'bg-[#FEF3C7] text-[#92400E]', violet: 'bg-[#EDE9FE] text-[#5B21B6]' }[tint]
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5 [.dark_&]:border-border [.dark_&]:bg-muted/30">
      <h2 className="flex items-center gap-3 text-[18px] font-bold text-[#0F172A] [.dark_&]:text-foreground">
        <span className={cn('grid h-9 w-9 place-items-center rounded-lg [&_svg]:h-[19px] [&_svg]:w-[19px]', chip)}>{icon}</span>{title}
      </h2>
      {right}
    </div>
  )
}
const Bar = ({ value, tone, h = 'h-2.5' }: { value: number; tone: Soft; h?: string }) => (
  <div className={cn('rounded-full bg-[#DDE5EF] [.dark_&]:bg-muted', h)}><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(3, value))}%`, background: C[tone].solid }} /></div>
)
const Footer = ({ to, children }: { to: string; children: ReactNode }) => (
  <div className="mt-auto flex justify-end border-t border-[#E2E8F0] pt-3.5 [.dark_&]:border-border"><Link to={to} className={link}>{children}<ArrowRight className="h-4 w-4" /></Link></div>
)
const Value = ({ children, unit }: { children: ReactNode; unit?: string }) => (
  <p className="mt-1 text-[36px] font-bold leading-none tabular-nums text-[#0F172A] [.dark_&]:text-foreground">{children}{unit && <span className="ml-1 text-[16px] font-semibold text-[#475569]">{unit}</span>}</p>
)

/* ------------------------------ plan (top) ------------------------------ */

const CTA: Record<string, string> = { '/results': 'View results', '/attendance': 'View attendance', '/placement': 'Start preparation', '/placement/aptitude': 'Start aptitude test',
  '/placement/interview': 'Start mock interview', '/skills': 'Take skill assessment', '/engagement': 'Add activity', '/feedback': 'Open feedback', '/': 'See assignments' }

function PlanCard({ a, to }: { a: Analysis; to: (p: string) => string }) {
  const focus = COMPONENT_LABELS[a.explain.topPulling.key as keyof typeof COMPONENT_LABELS] ?? a.explain.topPulling.label
  return (
    <section className={card} aria-label="Success plan">
      <CardHead icon={<Target />} title="Your success plan" tint="indigo" right={<p className="text-[15px] text-[#334155]">Focus area: <b className="font-bold text-[#0F172A] [.dark_&]:text-foreground">{focus}</b></p>} />
      <ol className="grid gap-4 p-5 md:grid-cols-3">
        {a.actions.map((x, i) => (
          <li key={x.key} className="flex flex-col rounded-xl border border-[#E2E8F0] border-l-4 border-l-[#4F46E5] bg-white p-4 [.dark_&]:border-border [.dark_&]:border-l-[#818CF8] [.dark_&]:bg-transparent">
            <div className="flex items-center justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#4F46E5] text-[14px] font-bold text-white">{i + 1}</span>
              <span className="rounded-full px-3 py-1 text-[14px] font-bold" style={{ background: C.good.bg, color: C.good.fg }}>+{x.potential} pts</span>
            </div>
            <h3 className="mt-3 text-[17px] font-bold leading-snug text-[#0F172A] [.dark_&]:text-foreground">{x.title}</h3>
            <p className="mt-1.5 flex-1 text-[15px] leading-6 text-[#334155] [.dark_&]:text-muted-foreground">{x.detail}</p>
            <div className="mt-4 flex justify-end"><Link to={to(x.href)} className={link}>{CTA[x.href] ?? 'Open'}<ArrowRight className="h-4 w-4" /></Link></div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------ score ------------------------------ */

function ScoreCard({ a }: { a: Analysis }) {
  const size = 188, stroke = 16, r = (size - stroke) / 2, circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, a.score))
  const tone = bandSoft(a.score)
  const prev = a.trend.length > 1 ? a.trend[a.trend.length - 2] : null
  const delta = prev ? Math.round((a.score - prev.score) * 10) / 10 : null
  return (
    <section className={card} aria-label="Success score">
      <CardHead icon={<Gauge />} title="Success score" tint="teal" />
      <div className={cn(body, 'items-center justify-center gap-4 text-center')}>
        <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Success score ${fmt1(a.score)} out of 100, ${bandLabel(a.score)}`}>
          <svg width={size} height={size} className="-rotate-90">
            <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={C[tone].solid} /><stop offset="100%" stopColor={C[tone].fg} /></linearGradient></defs>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.navy} strokeOpacity={0.1} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div><div className="text-[46px] font-bold leading-none tabular-nums text-[#0F172A] [.dark_&]:text-foreground">{fmt1(a.score)}</div><div className="mt-1 text-[14px] text-[#475569]">out of 100</div></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full px-4 py-1.5 text-[15px] font-bold" style={{ background: C[tone].bg, color: C[tone].fg }}>{bandLabel(a.score)}</span>
          {delta !== null && prev && <span className="text-[15px] font-medium text-[#334155] [.dark_&]:text-muted-foreground">{signed(delta)} vs {prev.semester}</span>}
        </div>
        {a.trend.length > 1 && (
          <div className="h-[80px] w-full" role="img" aria-label={`Score history: ${a.trend.map((t) => `${t.semester} ${fmt1(t.score)}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={a.trend} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                <XAxis dataKey="semester" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => v.replace('Sem ', '')} />
                <YAxis hide domain={['dataMin - 3', 'dataMax + 3']} />
                <Tooltip formatter={(v) => [fmt1(Number(v ?? 0)), 'Score']} contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                <Line type="monotone" isAnimationActive={false} dataKey="score" stroke={C.navy} strokeWidth={2.5} dot={{ r: 3, fill: C.navy }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-[14px] text-[#475569]">On track 75+ · Needs attention 50–74 · At risk &lt;50</p>
      </div>
    </section>
  )
}

/* ------------------------------ breakdown ------------------------------ */

function BreakdownCard({ a }: { a: Analysis }) {
  const rows = [...a.explain.contributions].sort((x, y) => y.weight - x.weight)
  const { topHelping, topPulling } = a.explain
  const name = (key: string) => COMPONENT_LABELS[key as keyof typeof COMPONENT_LABELS] ?? key
  return (
    <section className={card} aria-label="Score breakdown">
      <CardHead icon={<ListChecks />} title="Score breakdown" tint="violet" />
      <div className={body}>
        <ul className="flex-1 space-y-4">
          {rows.map((c) => {
            const t = scoreSoft(c.score)
            return (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-semibold text-[#0F172A] [.dark_&]:text-foreground">{name(c.key)} <span className="text-[14px] font-medium text-[#475569]">· {Math.round(c.weight * 100)}% weight</span></span>
                  <span className="text-[15px] font-bold tabular-nums" style={{ color: C[t].fg }}>+{(c.weight * c.score).toFixed(1)} pts</span>
                </div>
                <div className="mt-1.5" role="img" aria-label={`${name(c.key)} ${Math.round(c.score)} out of 100`}><Bar value={c.score} tone={t} h="h-3" /></div>
              </li>
            )
          })}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3 border-t border-[#E2E8F0] pt-4 text-[14px] font-semibold [.dark_&]:border-border">
          <span className="rounded-full px-3.5 py-1.5" style={{ background: C.good.bg, color: C.good.fg }}>Strongest: {name(topHelping.key)}</span>
          <span className="rounded-full px-3.5 py-1.5" style={{ background: C.risk.bg, color: C.risk.fg }}>Focus area: {name(topPulling.key)}</span>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------ grouped cards ------------------------------ */

function AcademicsCard({ s, a, to }: { s: Student; a: Analysis; to: (p: string) => string }) {
  const prev = s.semester > 1 ? cgpa(s, s.semester - 1) : null
  const d = prev !== null ? Math.round((a.cgpa - prev) * 100) / 100 : null
  const backlogs = activeBacklogs(s).length
  const low = attendanceBySubject(s).filter((x) => x.percent < 75)
  const pct = Math.round(assignmentCompletion(s))
  const { submitted, late, pending } = s.lms.assignments
  return (
    <section className={card} aria-label="Academics">
      <CardHead icon={<BookOpen />} title="Academics" tint="indigo" />
      <div className={cn(body, 'gap-3')}>
        <div className={tile}>
          <p className={label}>CGPA</p>
          <Value unit="/10">{a.cgpa.toFixed(2)}</Value>
          <p className="mt-1.5 text-[15px] text-[#334155] [.dark_&]:text-muted-foreground">{d !== null && <>{signed(d, 2)} vs Sem {roman(s.semester - 1)} · </>}{backlogs ? <b style={{ color: C.risk.fg }}>{backlogs} active {backlogs === 1 ? 'backlog' : 'backlogs'}</b> : 'No active backlogs'}</p>
        </div>
        <div className={tile}>
          <p className={label}>Attendance</p>
          <Value>{fmt1(a.attendance.percent)}%</Value>
          <p className="mt-1.5 text-[15px] text-[#334155] [.dark_&]:text-muted-foreground">{a.attendance.attended} of {a.attendance.total} lectures</p>
          {low.length > 0 && <p className="mt-1 text-[14px] font-semibold" style={{ color: C.risk.fg }}>Below 75%: {low.map((x) => `${x.short} ${Math.round(x.percent)}%`).join(', ')}</p>}
        </div>
        <div className={tile}>
          <div className="flex items-baseline justify-between"><p className={label}>Assignments</p><span className="text-[18px] font-bold tabular-nums text-[#0F172A] [.dark_&]:text-foreground">{pct}%</span></div>
          <div className="mt-2"><Bar value={pct} tone={scoreSoft(pct)} /></div>
          <p className="mt-2 text-[15px] text-[#334155] [.dark_&]:text-muted-foreground">{submitted - late} on time · {late} late · {pending} pending</p>
        </div>
        <Footer to={to('/results')}>View results</Footer>
      </div>
    </section>
  )
}

function CareerCard({ s, a, to }: { s: Student; a: Analysis; to: (p: string) => string }) {
  const failing = a.eligibility.items.filter((i) => !i.ok)
  const skills = Math.round(skillsScore(s))
  return (
    <section className={card} aria-label="Career readiness">
      <CardHead icon={<Compass />} title="Career readiness" tint="teal" />
      <div className={cn(body, 'gap-3')}>
        <div className={tile}>
          <p className={label}>Placement readiness</p>
          <Value unit="/100">{fmt1(a.readiness.score)}</Value>
          <p className="mt-1.5 text-[15px] text-[#334155] [.dark_&]:text-muted-foreground">
            {a.eligibility.eligible ? 'Eligible for placements' : <><b style={{ color: C.risk.fg }}>Not yet eligible</b>{failing.length > 0 && <> · Needs {failing.map((i) => i.label.toLowerCase()).join(' and ')}</>}</>}
          </p>
        </div>
        <div className={tile}>
          <p className={label}>Skills average</p>
          <Value unit="/100">{skills}</Value>
          <div className="mt-2"><Bar value={skills} tone={scoreSoft(skills)} /></div>
        </div>
        <Footer to={to('/placement')}>View roadmap</Footer>
      </div>
    </section>
  )
}

function EngagementCard({ s, a, to }: { s: Student; a: Analysis; to: (p: string) => string }) {
  const points = Math.min(100, a.points)
  const rating = facultyAvgRating(s)
  return (
    <section className={card} aria-label="Engagement">
      <CardHead icon={<Sparkles />} title="Engagement" tint="amber" />
      <div className={cn(body, 'gap-3')}>
        <div className={tile}>
          <p className={label}>Approved activity points</p>
          <Value unit="/100">{points}</Value>
          <div className="mt-2"><Bar value={points} tone={scoreSoft(points)} /></div>
        </div>
        <div className={tile}>
          <p className={label}>Faculty feedback</p>
          <Value unit="/5">{Number.isFinite(rating) ? rating.toFixed(1) : '–'}</Value>
        </div>
        <Footer to={to('/engagement')}>Add activity</Footer>
      </div>
    </section>
  )
}

/* ------------------------------ recent skill tests ------------------------------ */

function SkillTests({ s, to }: { s: Student; to: (p: string) => string }) {
  const latest = new Map<string, { skill: string; score: number; date: string }>()
  for (const t of s.skills.technicalTests) {
    const cur = latest.get(t.skill)
    if (!cur || t.date > cur.date) latest.set(t.skill, t)
  }
  const tests = [...latest.values()].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5)
  if (!tests.length) return null
  return (
    <section className={cn(card, 'mt-6')} aria-label="Recent skill tests">
      <CardHead icon={<Zap />} title="Recent skill tests" tint="violet" right={<Link to={to('/skills')} className={link}>All skills<ArrowRight className="h-4 w-4" /></Link>} />
      <ul className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
        {tests.map((t) => (
          <li key={t.skill} className={tile}>
            <div className="flex items-baseline justify-between"><span className="text-[16px] font-bold text-[#0F172A] [.dark_&]:text-foreground">{t.skill}</span><span className="text-[16px] font-bold tabular-nums" style={{ color: C[scoreSoft(t.score)].fg }}>{Math.round(t.score)}%</span></div>
            <div className="mt-2.5"><Bar value={t.score} tone={scoreSoft(t.score)} /></div>
          </li>
        ))}
      </ul>
    </section>
  )
}
