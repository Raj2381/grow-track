import { ArrowRight, ListChecks, TrendingDown } from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { EmptyState } from '@student/components/common'
import { REQUIRED_PCT, consecutiveDeclines, type SubjectStat, type TrendPoint } from '@student/lib/attendance'
import { cn } from '@student/lib/utils'
import { plural, scrollToId, statusStyle } from './shared'

export function ActionPlan({ stats, weekly, onOpen }: { stats: SubjectStat[]; weekly: TrendPoint[]; onOpen: (code: string) => void }) {
  const have = stats.filter((s) => s.total > 0)
  const critical = have.filter((s) => s.status.label === 'Critical')
  const atRisk = have.filter((s) => s.status.label === 'At risk')
  const healthy = have.filter((s) => s.status.tone === 'good')

  const mostMissed = [...have].sort((a, b) => b.missed - a.missed)[0]
  const closest = [...have].filter((s) => s.status.tone !== 'bad').sort((a, b) => a.canMiss - b.canMiss || (a.percent ?? 0) - (b.percent ?? 0))[0]
  const declines = consecutiveDeclines(weekly)

  const chips: string[] = []
  if (mostMissed && mostMissed.missed > 0) chips.push(`Most missed: ${mostMissed.short} (${mostMissed.missed})`)
  if (closest) chips.push(`Closest to the limit: ${closest.short}`)
  if (declines >= 3) chips.push(`Trend: falling for ${declines} weeks`)

  const groups = [
    critical.length > 0 && { key: 'critical', title: 'Recover these first', tone: 'bad' as const, items: critical.map((s) => ({ s, text: `Attend the next ${plural(s.mustAttend, 'lecture')} in a row to reach ${REQUIRED_PCT}%.`, cta: 'View recovery plan' })) },
    atRisk.length > 0 && { key: 'risk', title: 'Avoid unnecessary absences', tone: 'warn' as const, items: atRisk.map((s) => ({ s, text: s.canMiss === 0 ? `You can't miss another lecture without dropping below ${REQUIRED_PCT}%.` : `You can miss only ${plural(s.canMiss, 'more lecture')} before falling below ${REQUIRED_PCT}%.`, cta: 'View details' })) },
    healthy.length > 0 && { key: 'ok', title: 'Keep your buffer', tone: 'good' as const, items: healthy.map((s) => ({ s, text: `You can miss up to ${plural(s.canMiss, 'more lecture')} and stay above ${REQUIRED_PCT}%.`, cta: 'View details' })) },
  ].filter(Boolean) as { key: string; title: string; tone: 'good' | 'warn' | 'bad'; items: { s: SubjectStat; text: string; cta: string }[] }[]

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-brand-600" />Your Attendance Action Plan</CardTitle><CardDescription>Generated from your attendance records, most urgent first.</CardDescription></CardHeader>
      <CardContent>
        {chips.length > 0 && <ul className="mb-4 flex flex-wrap gap-2" aria-label="Quick insights">{chips.map((c) => <li key={c} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1 text-[13px] font-medium">{c.startsWith('Trend') && <TrendingDown className="h-3.5 w-3.5 text-danger" />}{c}</li>)}</ul>}
        {groups.length === 0 ? <EmptyState icon={<ListChecks className="h-8 w-8" />} title="No attendance recorded yet" text="Your plan appears once lectures are recorded." /> : (
          <ol className="space-y-4">
            {groups.map((g, gi) => (
              <li key={g.key} className={cn('rounded-lg border p-4', g.tone === 'bad' ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' : g.tone === 'warn' ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10')}>
                <div className="mb-3 flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">{gi + 1}</span><h3 className="font-semibold">{g.title}</h3></div>
                <ul className="space-y-2">
                  {g.items.map(({ s, text, cta }) => { const Icon = statusStyle(s.status).Icon; return (
                    <li key={s.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-3 text-sm">
                      <span className="flex min-w-0 items-start gap-2"><Icon className={cn('mt-0.5 h-4 w-4 shrink-0', statusStyle(s.status).text)} aria-hidden /><span><b>{s.short}</b> ({s.percent}%, {s.status.label}) — {text}</span></span>
                      <span className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => scrollToId(`subject-${s.code}`)}>Go to card</Button><Button size="sm" variant="outline" onClick={() => onOpen(s.code)}>{cta}<ArrowRight className="h-3.5 w-3.5" /></Button></span>
                    </li>) })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
