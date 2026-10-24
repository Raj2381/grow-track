import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Award, CalendarDays, CheckCircle2, Clock, FileBadge, Plus, RefreshCw, Search, Trophy, Users, XCircle } from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Badge } from '@student/components/ui/badge'
import { Input, Select } from '@student/components/ui/misc'
import { EmptyState, InsightsCard, PageHeader, StatCard, StatGrid, WithData } from '@student/components/common'
import { DistributionCard } from '@student/components/engagement/DistributionCard'
import { CategoryDetail } from '@student/components/engagement/CategoryDetail'
import { AddActivityForm } from '@student/components/engagement/AddActivityForm'
import { ENGAGEMENT_POINTS, WEIGHTS } from '@student/lib/scoring'
import {
  categoryOf, colorOf, distribution, filterByRange, outcomeOf, pointsOf, RANGE_LABEL, shiftDays, statusTone, type DateRange,
} from '@student/lib/engagement'
import { cn, fmtDate } from '@student/lib/utils'
import { TODAY } from '@student/data/students'
import { useStudent } from '@student/hooks/useStudent'
import type { Activity, Student, VerificationStatus } from '@student/types'
import type { Analysis } from '@student/lib/scoring'

const StatusIcon = ({ s }: { s: VerificationStatus }) => (s === 'Approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : s === 'Pending' ? <Clock className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />)

export default function Engagement() {
  return <WithData>{({ student, analysis }) => <EngagementView s={student} a={analysis} />}</WithData>
}

function EngagementView({ s, a }: { s: Student; a: Analysis }) {
  const { reload } = useStudent()
  const [params, setParams] = useSearchParams()
  const [formOpen, setFormOpen] = useState(false)
  const [range, setRange] = useState<DateRange>('all')
  const [from, setFrom] = useState(shiftDays(TODAY, -29))
  const [to, setTo] = useState(TODAY)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatus>('all')
  const [refreshing, setRefreshing] = useState(false)
  const listRef = useRef<HTMLElement>(null)

  useEffect(() => { setRefreshing(false) }, [s])

  const acts = useMemo(() => filterByRange(s.activities, range, { today: TODAY, semester: s.semester, from, to }), [s.activities, range, s.semester, from, to])
  const slices = useMemo(() => distribution(acts), [acts])
  const submitted = acts.filter((x) => x.status !== 'Rejected')
  const approved = acts.filter((x) => x.status === 'Approved')
  const pendingAll = s.activities.filter((x) => x.status === 'Pending')
  const rejectedAll = s.activities.filter((x) => x.status === 'Rejected')
  const categories = useMemo(() => [...new Set(acts.map(categoryOf))].sort(), [acts])

  const countCat = (list: Activity[], cats: string[]) => list.filter((x) => cats.includes(categoryOf(x))).length
  const pendingIn = (cats: string[]) => countCat(acts.filter((x) => x.status === 'Pending'), cats)
  const clubs = new Set(approved.filter((x) => x.type === 'club').map((x) => (x.organizer || x.title).trim().toLowerCase())).size

  const rows = useMemo(() => acts
    .filter((x) => catFilter === 'all' || categoryOf(x) === catFilter)
    .filter((x) => statusFilter === 'all' || x.status === statusFilter)
    .filter((x) => `${x.title} ${categoryOf(x)} ${x.organizer} ${x.role}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((x, y) => y.date.localeCompare(x.date)), [acts, catFilter, statusFilter, search])

  const selected = params.get('category')
  const openCategory = (c: string) => setParams((p) => { p.set('category', c); return p })
  const closeCategory = () => setParams((p) => { p.delete('category'); return p })

  const capped = Math.min(100, a.points)
  const scoreShare = Math.round(capped * WEIGHTS.engagement * 10) / 10
  const rangeLabel = range === 'custom' ? `${fmtDate(from)} – ${fmtDate(to)}` : RANGE_LABEL[range]

  return (
    <>
      <PageHeader
        title="Engagement"
        description="Your events, clubs, hackathons and certifications. You add them; a faculty coordinator verifies them."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View my activities<ArrowUpRight className="h-4 w-4" /></Button>
            <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Add Activity</Button>
          </div>
        }
      />

      {/* Score banner: how engagement feeds the Success Score */}
      <Card className="relative mb-6 overflow-hidden border-0 bg-gradient-to-br from-brand-950 to-brand-800 text-white">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-64 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
        <div className="relative grid gap-5 p-6 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/10"><Award className="h-7 w-7 text-brand-300" /></div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-brand-300">Engagement points</div>
              <div className="text-4xl font-extrabold tabular-nums">{capped}<span className="text-lg font-semibold text-white/60"> / 100</span></div>
            </div>
          </div>
          <div className="md:border-l md:border-white/15 md:pl-6">
            <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent transition-all" style={{ width: `${capped}%` }} /></div>
            <p className="mt-3 text-sm text-white/85">
              Adds <b className="text-white">{scoreShare} of {WEIGHTS.engagement * 100}</b> possible points to your Success Score. <b className="text-white">Only approved activities count.</b> Hackathon or competition +{ENGAGEMENT_POINTS.hackathon} · certification +{ENGAGEMENT_POINTS.certification} · club or leadership role +{ENGAGEMENT_POINTS.club} · event, workshop or volunteering +{ENGAGEMENT_POINTS.event}.
            </p>
            {pendingAll.length > 0 && <p className="mt-1 text-xs text-white/70">{pendingAll.length} pending {pendingAll.length === 1 ? 'entry is' : 'entries are'} worth up to +{pendingAll.reduce((p, x) => p + pointsOf(x), 0)} more once approved.</p>}
          </div>
        </div>
      </Card>

      {/* Date range toolbar */}
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Showing <b className="text-foreground">{rangeLabel}</b> · {acts.length} {acts.length === 1 ? 'entry' : 'entries'}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-4 w-4" />Date range
            <Select value={range} onChange={(e) => setRange(e.target.value as DateRange)} className="h-9 w-auto text-foreground">
              {(Object.keys(RANGE_LABEL) as DateRange[]).map((k) => <option key={k} value={k}>{RANGE_LABEL[k]}</option>)}
            </Select>
          </label>
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="rng-from">Start date</label>
              <Input id="rng-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto" />
              <span className="text-xs text-muted-foreground">to</span>
              <label className="sr-only" htmlFor="rng-to">End date</label>
              <Input id="rng-to" type="date" value={to} min={from} max={TODAY} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto" />
            </div>
          )}
          <Button variant="outline" size="sm" className="h-9" disabled={refreshing} onClick={() => { setRefreshing(true); reload() }} aria-label="Refresh engagement data">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />Refresh
          </Button>
        </div>
      </div>

      <StatGrid>
        <StatCard label="Events attended" value={countCat(approved, ['Events', 'Workshops', 'Seminars', 'Volunteering'])} sub={`approved · ${pendingIn(['Events', 'Workshops', 'Seminars', 'Volunteering'])} pending`} icon={<CalendarDays />} />
        <StatCard label="Club participation" value={clubs} sub="distinct clubs & roles, approved" icon={<Users />} />
        <StatCard label="Hackathons & competitions" value={countCat(approved, ['Hackathons', 'Competitions'])} sub={`approved · ${pendingIn(['Hackathons', 'Competitions'])} pending`} icon={<Trophy />} />
        <StatCard label="Certifications" value={countCat(approved, ['Certifications'])} sub={`approved · ${pendingIn(['Certifications'])} pending`} icon={<FileBadge />} />
      </StatGrid>

      <DistributionCard slices={slices} total={submitted.length} rangeLabel={rangeLabel} onOpenCategory={openCategory} onAdd={() => setFormOpen(true)} />

      <Card>
        <section ref={listRef} aria-labelledby="my-acts" className="scroll-mt-24">
          <CardHeader className="flex-col gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
            <div><CardTitle id="my-acts">My activities</CardTitle><CardDescription>Everything you have recorded, with its verification status and points.</CardDescription></div>
            {acts.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative">
                  <span className="sr-only">Search activities</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities" className="pl-9 sm:w-48" />
                </label>
                <label><span className="sr-only">Filter by category</span>
                  <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="sm:w-44"><option value="all">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select>
                </label>
                <label><span className="sr-only">Filter by status</span>
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="sm:w-36">
                    <option value="all">All statuses</option><option>Approved</option><option>Pending</option><option>Rejected</option>
                  </Select>
                </label>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {acts.length === 0 ? (
              <EmptyState icon={<Users className="h-8 w-8" />} title={s.activities.length ? 'No activities in this date range' : 'No activities recorded yet'}
                text={s.activities.length ? 'Choose a wider date range to see more.' : 'Add your first activity to start building your engagement record.'}
                action={s.activities.length ? <Button size="sm" variant="outline" onClick={() => setRange('all')}>Show all time</Button> : <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Add Activity</Button>} />
            ) : rows.length === 0 ? (
              <EmptyState title="No activities match your filters" action={<Button size="sm" variant="outline" onClick={() => { setSearch(''); setCatFilter('all'); setStatusFilter('all') }}>Clear filters</Button>} />
            ) : (
              <>
                {/* desktop table */}
                <div className="hidden max-h-[560px] overflow-auto rounded-lg border border-border md:block">
                  <table className="data-table w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>{['Activity', 'Category', 'Organization', 'Date', 'Participation', 'Status', 'Points'].map((h) => <th key={h} className={cn('px-4 py-3 font-medium', h === 'Points' && 'text-right')}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map((x) => (
                        <tr key={x.id} className="border-t border-border">
                          <td className="px-4 py-2"><div className="font-semibold">{x.title}</div>{outcomeOf(x) && x.role !== outcomeOf(x) && <div className="text-xs text-muted-foreground">{outcomeOf(x)}</div>}</td>
                          <td className="px-4 py-2"><button type="button" onClick={() => openCategory(categoryOf(x))} className="inline-flex items-center gap-1.5 hover:text-primary"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(categoryOf(x)) }} />{categoryOf(x)}</button></td>
                          <td className="px-4 py-2 text-muted-foreground">{x.organizer || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-2 tabular-nums">{fmtDate(x.date)}</td>
                          <td className="px-4 py-2">{x.role}</td>
                          <td className="px-4 py-2"><Badge tone={statusTone(x.status)}><StatusIcon s={x.status} />{x.status}</Badge></td>
                          <td className={cn('px-4 py-2 text-right font-semibold tabular-nums', x.status !== 'Approved' && 'font-normal text-muted-foreground')}>{x.status === 'Approved' ? `+${pointsOf(x)}` : x.status === 'Pending' ? `(+${pointsOf(x)})` : '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* mobile cards */}
                <ul className="space-y-3 md:hidden">
                  {rows.map((x) => (
                    <li key={x.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><div className="font-semibold">{x.title}</div><div className="text-xs text-muted-foreground">{x.organizer || '—'} · {fmtDate(x.date)}</div></div>
                        <Badge tone={statusTone(x.status)}><StatusIcon s={x.status} />{x.status}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(categoryOf(x)) }} />{categoryOf(x)}</span>
                        <span className="text-muted-foreground">{x.role}</span>
                        <span className="ml-auto font-semibold tabular-nums">{x.status === 'Approved' ? `+${pointsOf(x)} pts` : x.status === 'Pending' ? `+${pointsOf(x)} if approved` : '0 pts'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">Points in brackets are pending and will count once approved.</p>
              </>
            )}
          </CardContent>
        </section>
      </Card>

      <InsightsCard items={[
        { text: <>You have <b>{capped}</b> approved engagement points. {a.points >= 100 ? 'You have reached the 100-point cap.' : a.points <= 85 ? <>An approved hackathon or competition (+{ENGAGEMENT_POINTS.hackathon}) moves your score the most.</> : 'Any approved activity will take you to the cap.'}</>, tone: capped >= 60 ? 'good' : 'warn' },
        ...pendingAll.map((x) => ({ tone: 'warn' as const, text: <><b>{x.title}</b> is awaiting verification. It adds {pointsOf(x)} points once approved.</> })),
        ...rejectedAll.map((x) => ({ tone: 'bad' as const, text: <><b>{x.title}</b> was rejected. Re-submit it with a clearer certificate or link to claim {pointsOf(x)} points.</> })),
      ]} />

      {selected && (
        <CategoryDetail
          category={selected}
          color={colorOf(selected)}
          activities={acts.filter((x) => categoryOf(x) === selected)}
          allCount={submitted.length}
          categories={categories}
          onClose={closeCategory}
          onSelect={openCategory}
          onAdd={() => { closeCategory(); setFormOpen(true) }}
        />
      )}
      <AddActivityForm open={formOpen} onClose={() => setFormOpen(false)} semester={s.semester} />
    </>
  )
}
