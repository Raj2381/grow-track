import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Info, Layers, PieChart, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Button } from '@student/components/ui/button'
import { cn } from '@student/lib/utils'
import type { Slice } from '@student/lib/engagement'

const R = 38
const C = 2 * Math.PI * R

/** Activity distribution: clickable donut + legend on the left, insights panel on the right. */
export function DistributionCard({ slices, total, rangeLabel, onOpenCategory, onAdd }: {
  slices: Slice[]; total: number; rangeLabel: string; onOpenCategory: (c: string) => void; onAdd: () => void
}) {
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<string | null>(null)
  const top = slices[0]
  const tied = slices.filter((s) => s.count === top?.count)
  const focus = slices.find((s) => s.label === hover)

  let offset = 0
  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Engagement overview</p>
          <CardTitle>Activity distribution</CardTitle>
          <CardDescription>Where your time and participation are going · {rangeLabel}</CardDescription>
        </div>
        <span title="Counts every submitted activity (approved and pending). Rejected entries are excluded." className="text-muted-foreground">
          <Info className="h-4 w-4" aria-label="Counts approved and pending activities; rejected entries are excluded" />
        </span>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="grid items-center gap-6 sm:grid-cols-2">
            <div className="mx-auto grid h-44 w-44 place-items-center rounded-full border-[18px] border-muted">
              <div className="text-center"><div className="text-2xl font-bold">0</div><div className="text-xs text-muted-foreground">activities</div></div>
            </div>
            <div className="rounded-xl bg-muted/60 p-5">
              <div className="font-semibold">Your activity insights will appear here</div>
              <p className="mt-1 text-sm text-muted-foreground">Add an activity, or widen the date range, to see how your participation is spread across categories.</p>
              <Button size="sm" className="mt-4" onClick={onAdd}><Plus className="h-4 w-4" />Add Activity</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(240px,0.9fr)_minmax(280px,1.1fr)] lg:items-center">
            <div className="flex flex-col items-center gap-5">
              <div className="relative h-52 w-52" role="img" aria-label={`Activity distribution: ${slices.map((s) => `${s.label} ${s.count}`).join(', ')}`}>
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(var(--muted))" strokeWidth={12} />
                  {slices.map((s, i) => {
                    const len = (s.percentage / 100) * C
                    const dash = `${Math.max(0, len - (slices.length > 1 ? 0.8 : 0))} ${C}`
                    const el = (
                      <motion.circle key={s.label} cx="50" cy="50" r={R} fill="none" stroke={s.color}
                        strokeWidth={hover === s.label ? 14 : 12} strokeDasharray={dash} strokeDashoffset={-offset}
                        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: hover && hover !== s.label ? 0.35 : 1 }}
                        transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.05 }}
                        className="cursor-pointer outline-none" role="button" tabIndex={0}
                        aria-label={`${s.label}: ${s.count} activities, ${s.percentage}%. Open details`}
                        onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(s.label)} onBlur={() => setHover(null)}
                        onClick={() => onOpenCategory(s.label)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenCategory(s.label) } }} />
                    )
                    offset += len
                    return el
                  })}
                </svg>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  {focus ? (
                    <div><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{focus.label}</div><div className="text-3xl font-bold tabular-nums">{focus.count}</div><div className="text-xs text-muted-foreground">{focus.percentage}%</div></div>
                  ) : (
                    <div><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</div><div className="text-3xl font-bold tabular-nums">{total}</div><div className="text-xs text-muted-foreground">activities</div></div>
                  )}
                </div>
              </div>
              <div className="grid w-full max-w-sm grid-cols-1 gap-1.5 sm:grid-cols-2">
                {slices.map((s) => (
                  <button key={s.label} type="button" onClick={() => onOpenCategory(s.label)} onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}
                    className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted', hover === s.label && 'bg-muted')}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <b className="shrink-0 tabular-nums">{s.count} · {s.percentage}%</b>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Activity insights</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Total activities</p><p className="mt-1 text-2xl font-bold tabular-nums">{total}</p></div>
                <div>
                  <p className="text-xs text-muted-foreground">Most active</p>
                  <p className="mt-1 text-sm font-semibold">{tied.map((t) => t.label).join(' & ')}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{top.count} {top.count === 1 ? 'activity' : 'activities'} · {top.percentage}%</p>
                </div>
                <div><p className="text-xs text-muted-foreground">Category diversity</p><p className="mt-1 text-sm font-semibold">{slices.length} {slices.length === 1 ? 'category' : 'categories'}</p></div>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold"><PieChart className="h-3.5 w-3.5 text-primary" />Category breakdown</p>
                <div className="mt-3 flex flex-col gap-3">
                  {slices.map((s) => (
                    <button key={s.label} type="button" onClick={() => onOpenCategory(s.label)} className="group text-left">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground group-hover:text-foreground">{s.label}</span>
                        <b className="tabular-nums">{s.count} · {s.percentage}%</b>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div className="h-full rounded-full" style={{ background: s.color }} initial={reduce ? false : { width: 0 }} animate={{ width: `${s.percentage}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-4 text-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold"><Layers className="h-3.5 w-3.5 text-primary" />Engagement insight</p>
                <p className="mt-1 text-muted-foreground">
                  {tied.length > 1 ? `Your activities are tied across ${tied.length} categories.` : `${top.label} make up the largest share (${top.percentage}%) of your recorded activities.`}
                </p>
                <p className="mt-3 text-xs font-semibold">Helpful suggestion</p>
                <p className="mt-1 text-muted-foreground">
                  {slices.length <= 2 ? 'Your engagement is concentrated in a few areas. Trying a new category that fits your goals can round out your profile.' : 'You have a varied profile. Adding an outcome (award, certificate, role) to your entries makes them stronger.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
