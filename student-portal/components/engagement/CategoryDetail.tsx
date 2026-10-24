import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpDown, BarChart3, ChevronDown, ExternalLink, FileText, Plus, Search, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@student/components/ui/badge'
import { Button } from '@student/components/ui/button'
import { Input, Select } from '@student/components/ui/misc'
import { tooltipStyle } from '@student/components/common'
import { cn, fmtDate } from '@student/lib/utils'
import { describeCategory, earnedPoints, outcomeOf, pointsOf, statusTone } from '@student/lib/engagement'
import type { Activity } from '@student/types'

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** Full-screen detail view for one category (opened from the chart, legend or URL ?category=). */
export function CategoryDetail({ category, color, activities, allCount, categories, onClose, onSelect, onAdd }: {
  category: string; color: string; activities: Activity[]; allCount: number; categories: string[]
  onClose: () => void; onSelect: (c: string) => void; onAdd: () => void
}) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [newest, setNewest] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [visible, setVisible] = useState(8)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  useEffect(() => { setQuery(''); setRole('all'); setVisible(8); setOpen(null); panel.current?.scrollTo({ top: 0 }) }, [category])

  const counted = activities.filter((a) => a.status !== 'Rejected')
  const roles = useMemo(() => [...new Set(activities.map((a) => a.role))].sort(), [activities])
  const list = useMemo(() => activities
    .filter((a) => role === 'all' || a.role === role)
    .filter((a) => `${a.title} ${a.organizer} ${outcomeOf(a)}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (newest ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))), [activities, role, query, newest])

  const share = allCount ? Math.round((counted.length / allCount) * 1000) / 10 : 0
  const outcomes = counted.filter((a) => outcomeOf(a)).length
  const points = activities.reduce((p, a) => p + earnedPoints(a), 0)
  const latest = [...counted].sort((a, b) => b.date.localeCompare(a.date))[0]
  const monthly = useMemo(() => {
    const m = new Map<string, number>()
    counted.forEach((a) => m.set(a.date.slice(0, 7), (m.get(a.date.slice(0, 7)) ?? 0) + 1))
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8)
      .map(([k, count]) => ({ month: new Date(k + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), count }))
  }, [counted])

  const insights = counted.length
    ? [
      `${category} make up ${share}% of your recorded activities.`,
      outcomes ? `${outcomes} ${outcomes === 1 ? 'entry records' : 'entries record'} an outcome such as an award, role or certificate.` : 'None of these entries records an outcome yet. Adding one makes your profile stronger.',
      latest ? `Your most recent ${category.toLowerCase()} entry was on ${fmtDate(latest.date)}.` : '',
    ].filter(Boolean)
    : [`No ${category.toLowerCase()} activities in this date range.`]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cat-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-background shadow-xl outline-none">
        <div className="relative overflow-hidden border-b border-border bg-card p-5 sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
          <div className="flex items-start justify-between gap-3">
            <button type="button" onClick={onClose} className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />Back to Engagement
            </button>
            <button type="button" onClick={onClose} aria-label="Close category details" className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Engagement › Activities › {category}</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}><BarChart3 className="h-5 w-5" /></span>
            <div>
              <h2 id="cat-title" className="text-2xl font-bold tracking-tight">{category}</h2>
              <p className="text-sm text-muted-foreground">{describeCategory(category)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Activities" value={counted.length} sub={activities.length > counted.length ? `+${activities.length - counted.length} rejected` : undefined} />
            <Stat label="Share of total" value={`${share}%`} sub="of submitted activities" />
            <Stat label="With an outcome" value={outcomes} />
            <Stat label="Points earned" value={points} sub="approved entries only" />
          </div>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4" style={{ color }} />Insights</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {insights.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />{t}</li>)}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">Activity trend</h3>
            <p className="text-xs text-muted-foreground">Activities per month (approved and pending)</p>
            {monthly.length < 2 ? (
              <p className="mt-4 rounded-lg bg-muted/60 px-3 py-6 text-center text-sm text-muted-foreground">Not enough data for a trend yet. Activities in at least two different months are needed.</p>
            ) : (
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgb(var(--muted))' }} contentStyle={tooltipStyle} formatter={(v) => [Number(v ?? 0), 'Activities']} />
                    <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h3 className="font-semibold">Activity timeline</h3><p className="text-xs text-muted-foreground">{list.length} matching {list.length === 1 ? 'activity' : 'activities'}</p></div>
              <div className="flex flex-wrap gap-2">
                <label className="relative">
                  <span className="sr-only">Search {category}</span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-9 w-40 pl-8" />
                </label>
                <label><span className="sr-only">Filter by role</span>
                  <Select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-auto"><option value="all">All roles</option>{roles.map((r) => <option key={r}>{r}</option>)}</Select>
                </label>
                <Button variant="outline" size="sm" className="h-9" onClick={() => setNewest((v) => !v)}><ArrowUpDown className="h-3.5 w-3.5" />{newest ? 'Newest' : 'Oldest'}</Button>
              </div>
            </div>
            {list.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No {category.toLowerCase()} activities match.
                <button type="button" onClick={onAdd} className="ml-1 font-semibold text-primary hover:underline">Add activity</button>
              </div>
            ) : (
              <ol className="relative mt-5 space-y-3 border-l-2 border-border pl-5">
                {list.slice(0, visible).map((a) => {
                  const expanded = open === a.id
                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-background" style={{ background: color }} />
                      <article className="rounded-xl border border-border bg-background">
                        <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : a.id)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
                          <div className="min-w-0">
                            <h4 className="font-semibold">{a.title}</h4>
                            <p className="mt-0.5 text-xs text-muted-foreground">{a.organizer || 'Organizer not provided'} · {fmtDate(a.date)} · {a.role}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                          </div>
                        </button>
                        {expanded && (
                          <dl className="grid gap-x-6 gap-y-2 border-t border-border px-4 py-3 text-sm sm:grid-cols-2">
                            <div><dt className="text-xs text-muted-foreground">Participation</dt><dd className="font-medium">{a.role}</dd></div>
                            <div><dt className="text-xs text-muted-foreground">Outcome</dt><dd className="font-medium">{outcomeOf(a) || 'None recorded'}</dd></div>
                            <div><dt className="text-xs text-muted-foreground">Points</dt><dd className="font-medium">{a.status === 'Approved' ? `+${pointsOf(a)}` : a.status === 'Pending' ? `+${pointsOf(a)} once approved` : '0 (rejected)'}</dd></div>
                            <div><dt className="text-xs text-muted-foreground">Proof</dt><dd className="flex items-center gap-1 truncate font-medium">{a.proof ? <><FileText className="h-3.5 w-3.5 shrink-0" />{a.proof}</> : '—'}</dd></div>
                            {a.description && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Description</dt><dd>{a.description}</dd></div>}
                            {a.link && <div className="sm:col-span-2"><a href={a.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Open reference link<ExternalLink className="h-3.5 w-3.5" /></a></div>}
                          </dl>
                        )}
                      </article>
                    </li>
                  )
                })}
              </ol>
            )}
            {visible < list.length && <Button variant="ghost" size="sm" className="mt-3" onClick={() => setVisible((v) => v + 8)}>Load more</Button>}
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Explore other categories</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.filter((c) => c !== category).map((c) => (
                  <button key={c} type="button" onClick={() => onSelect(c)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-brand-400 hover:text-primary">{c}</button>
                ))}
              </div>
            </div>
            <Button onClick={onAdd}><Plus className="h-4 w-4" />Add activity</Button>
          </section>
        </div>
      </div>
    </div>
  )
}
