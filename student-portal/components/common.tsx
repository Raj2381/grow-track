import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Clock, Lightbulb, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { usePageTitle } from '@student/hooks/usePageTitle'
import { Button } from '@student/components/ui/button'
import {
  PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Skeleton } from '@student/components/ui/misc'
import { Badge } from '@student/components/ui/badge'
import { cn, levelTone, TONE } from '@student/lib/utils'
import { useStudent } from '@student/hooks/useStudent'
import type { RiskFlag, Tone } from '@student/lib/scoring'
import type { Level } from '@student/types'

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  usePageTitle(title)
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  )
}

const seenCounts = new Set<string>()
/** Counts a number up once per session (0.8s). Falls back to static text for non-numeric values / reduced motion. */
function CountUp({ value, id }: { value: ReactNode; id: string }) {
  const reduce = useReducedMotion()
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : null
  const m = text?.match(/^(\D*)(-?\d+(?:\.\d+)?)(.*)$/)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!m || reduce || seenCounts.has(id)) return
    seenCounts.add(id)
    const target = parseFloat(m[2]); const dec = (m[2].split('.')[1] ?? '').length
    const ctl = animate(0, target, { duration: 0.8, ease: 'easeOut', onUpdate: (v) => { if (ref.current) ref.current.textContent = `${m[1]}${v.toFixed(dec)}${m[3]}` } })
    return () => ctl.stop()
  }, [text, id, reduce]) // eslint-disable-line
  return <span ref={ref}>{value}</span>
}

export function StatCard({ label, value, sub, tone, icon, to, className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: ReactNode; to?: string; className?: string }) {
  const { base } = useStudent()
  const body = (
    <Card className={cn('h-full p-5 transition', to && 'hover:border-brand-400 hover:shadow-md', className)}>
      {icon && <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-800 dark:text-brand-100 [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</div>}
      <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-[28px] font-bold leading-tight tabular-nums', tone && TONE[tone].text)}><CountUp value={value} id={`${label}`} /></div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  )
  return to ? <Link to={base + to || '/'} className="block h-full rounded-xl">{body}</Link> : body
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 6 }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' }[cols]
  const reduce = useReducedMotion()
  const items = Array.isArray(children) ? children : [children]
  return (
    <div className={cn('mb-6 grid grid-cols-1 gap-4', c)}>
      {items.map((ch, i) => reduce ? <div key={i}>{ch}</div> : (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }}>{ch}</motion.div>
      ))}
    </div>
  )
}

export function ChartCard({ title, description, children, className, height = 280 }: { title: string; description?: string; children: ReactNode; className?: string; height?: number }) {
  return (
    <Card className={className}>
      <CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent><div style={{ height }}>{children}</div></CardContent>
    </Card>
  )
}

/** "Insights & Actions" card shown at the bottom of every page */
export function InsightsCard({ items }: { items: { text: ReactNode; tone?: Tone }[] }) {
  return (
    <Card className="mt-6 border-primary/20 bg-primary/[0.03]">
      <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" />Insights &amp; Actions</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to flag right now — keep it up!</p> : (
          <ul className="space-y-2.5">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', it.tone ? TONE[it.tone].solid : 'bg-primary')} />
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div><Skeleton className="h-8 w-56" /><Skeleton className="mt-2 h-4 w-80" /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  )
}

/** Wrap a page: shows a skeleton until data is ready, then passes data to children. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-warning" />
      <div className="text-lg font-semibold">Something went wrong</div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message ?? "We couldn't load this data. Please check your connection and try again."}</p>
      {onRetry && <Button className="mt-4" onClick={onRetry}><RefreshCw className="h-4 w-4" />Try again</Button>}
    </div>
  )
}

export function WithData({ children }: { children: (d: NonNullable<ReturnType<typeof useReady>>) => ReactNode }) {
  const { error, reload } = useStudent()
  const d = useReady()
  if (error && !d) return <ErrorState onRetry={reload} />
  if (!d) return <PageSkeleton />
  return <>{children(d)}</>
}
function useReady() {
  const { student, cohort, analysis, base } = useStudent()
  return student && cohort && analysis ? { student, cohort, analysis, base } : null
}

export function LevelBadge({ level }: { level: Level }) {
  return <Badge tone={levelTone(level)}>{level} risk</Badge>
}

export function RiskCard({ title, flag }: { title: string; flag: RiskFlag }) {
  const tone = levelTone(flag.level)
  const Icon = flag.level === 'Low' ? ShieldCheck : ShieldAlert
  return (
    <Card className={cn('border-l-4', tone === 'good' ? 'border-l-success' : tone === 'warn' ? 'border-l-warning' : 'border-l-danger')}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Icon className={cn('h-5 w-5', TONE[tone].text)} />{title}</CardTitle>
        <LevelBadge level={flag.level} />
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">What triggered this</p>
        <ul className="space-y-1.5 text-sm">
          {flag.reasons.map((r, i) => (
            <li key={i} className="flex gap-2"><span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE[tone].solid)} />{r}</li>
          ))}
        </ul>
        <div className="mt-3 grid gap-1.5 border-t border-border pt-3">
          {flag.indicators.map((i) => (
            <div key={i.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{i.label} <span className="opacity-80">({i.threshold})</span></span>
              <span className={cn('font-semibold tabular-nums', i.status === 'ok' ? TONE.good.text : TONE[i.status].text)}>{i.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/** Diverging horizontal bar chart: impact of each component vs cohort average (green right, red left) */

export function Gauge({ value, tone, size = 190, label, sub }: { value: number; tone: Tone; size?: number; label?: string; sub?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Score'} ${Math.round(value)} out of 100`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart data={[{ v: pct }]} innerRadius="78%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={14}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="v" cornerRadius={8} fill="var(--brand-600)" background={{ fill: 'var(--chart-grid)' }} isAnimationActive />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div><div className="text-4xl font-bold tabular-nums">{Math.round(value)}</div><div className="text-xs text-muted-foreground">{sub ?? 'out of 100'}</div></div>
      </div>
    </div>
  )
}

export const LinkButton = ({ to, children }: { to: string; children: ReactNode }) => {
  const { base } = useStudent()
  return (
    <Link to={base + to || '/'} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{children}<ArrowRight className="h-4 w-4" /></Link>
  )
}

export const tooltipStyle = { borderRadius: 8, border: '1px solid rgb(var(--border))', background: 'rgb(var(--card))' }

/** Renders the test countdown into the app top bar. Amber under 2 minutes, red under 30 seconds. */
export function TopbarTimer({ left, label = 'Time left' }: { left: number; label?: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => { setEl(document.getElementById('topbar-slot')) }, [])
  const color = left < 30 ? 'bg-danger text-white' : left < 120 ? 'bg-warning text-white' : 'bg-muted text-foreground'
  const text = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
  const node = <div role="timer" aria-label={`${label}: ${text}`} className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-sm font-bold tabular-nums', color)}><Clock className="h-4 w-4" />{text}</div>
  return el ? createPortal(node, el) : null
}
