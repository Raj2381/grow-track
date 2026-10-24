import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarSearch, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Badge } from '@student/components/ui/badge'
import { BottomSheet, Select } from '@student/components/ui/misc'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { EmptyState } from '@student/components/common'
import { useMediaQuery } from '@student/hooks/useMediaQuery'
import type { SubjectStat } from '@student/lib/attendance'
import { TODAY } from '@student/data/students'
import { cn, fmtDate } from '@student/lib/utils'

interface Item { code: string; short: string; teacher: string; slot: string; topic: string; present: boolean; reason?: string }

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const monthLabel = (m: string) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function AttendanceCalendar({ stats, filter, missedOnly, onMissedOnly }: { stats: SubjectStat[]; filter: string; missedOnly: boolean; onMissedOnly: (v: boolean) => void }) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const byDate = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const s of stats) {
      if (filter !== 'all' && s.code !== filter) continue
      for (const l of s.lectures) m.set(l.date, [...(m.get(l.date) ?? []), { code: s.code, short: s.short, teacher: s.teacher, slot: l.slot, topic: l.topic, present: l.present, reason: l.reason }])
    }
    for (const v of m.values()) v.sort((a, b) => a.slot.localeCompare(b.slot, undefined, { numeric: true }))
    return m
  }, [stats, filter])

  const allDates = stats.flatMap((s) => s.lectures.map((l) => l.date)).sort()
  const months = useMemo(() => {
    if (!allDates.length) return []
    const out: string[] = []
    const last = (allDates[allDates.length - 1] > TODAY ? allDates[allDates.length - 1] : TODAY).slice(0, 7)
    for (let m = allDates[0].slice(0, 7); m <= last; ) { out.push(m); const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); m = iso(d).slice(0, 7) }
    return out
  }, [allDates.join(',')]) // eslint-disable-line

  const [view, setView] = useState<'month' | 'semester'>('month')
  const [month, setMonth] = useState(() => months[months.length - 1] ?? TODAY.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const wantFocus = useRef(false)

  useEffect(() => { if (wantFocus.current && focus) { refs.current.get(focus)?.focus(); wantFocus.current = false } }, [focus, month])

  const idx = months.indexOf(month)
  const select = (d: string) => { setSelected(d); setFocus(d) }
  const onKey = (e: React.KeyboardEvent, d: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    const n = addDays(d, step)
    wantFocus.current = true
    if (n.slice(0, 7) !== month) { if (!months.includes(n.slice(0, 7))) return; setMonth(n.slice(0, 7)) }
    setFocus(n)
  }

  const detail = selected ? byDate.get(selected) : undefined
  const showReason = !!detail?.some((x) => x.reason)
  const panel = selected ? (
    <div>
      <div className="mb-3 font-semibold">{fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      {!detail ? <p className="text-sm text-muted-foreground">No lectures were scheduled{filter !== 'all' ? ' for this subject' : ''}.</p> : (
        <div className="overflow-x-auto"><table className="data-table w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 pr-2">Subject</th><th className="pr-2">Time</th><th className="pr-2">Faculty</th><th className="pr-2">Topic</th><th>Status</th>{showReason && <th className="pl-2">Reason</th>}</tr></thead>
          <tbody>{detail.map((x, i) => (
            <tr key={i} className="border-b border-border last:border-0"><td className="py-2 pr-2 font-medium">{x.short}</td><td className="pr-2">{x.slot}</td><td className="pr-2">{x.teacher}</td><td className="pr-2">{x.topic}</td>
              <td><Badge tone={x.present ? 'good' : 'bad'}>{x.present ? 'Present' : 'Absent'}</Badge></td>{showReason && <td className="pl-2">{x.reason ?? '—'}</td>}</tr>))}</tbody></table></div>
      )}
    </div>
  ) : <EmptyState icon={<CalendarSearch className="h-8 w-8" />} title="Select a date to explore your attendance" text="Pick a day to see each lecture, who taught it and whether you were present." />

  return (
    <Card id="attendance-calendar" className="scroll-mt-24">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div><CardTitle>Attendance calendar</CardTitle><CardDescription>{filter === 'all' ? 'All subjects' : stats.find((s) => s.code === filter)?.name}. Use the arrow keys to move between days.</CardDescription></div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Calendar view" className="inline-flex gap-1 rounded-lg bg-muted p-1">
            {(['month', 'semester'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', view === v ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{v === 'month' ? 'Month' : 'Semester heatmap'}</button>)}
          </div>
          {missedOnly && <Button size="sm" variant="soft" onClick={() => onMissedOnly(false)}>Showing missed lectures · Clear</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]" aria-label="Legend">
          {[['bg-green-600', 'All attended'], ['bg-amber-500', 'Some missed'], ['bg-red-600', 'All missed'], ['bg-muted border border-border', 'No lectures']].map(([c, l]) => <li key={l} className="flex items-center gap-2"><span className={cn('h-3.5 w-3.5 rounded', c)} />{l}</li>)}
          <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded border-2 border-brand-600" />Selected</li>
          <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-600" />Today</li>
        </ul>
        {months.length === 0 ? <EmptyState icon={<CalendarSearch className="h-8 w-8" />} title="No lectures recorded yet" /> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              {view === 'month' ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Button variant="outline" size="icon" aria-label="Previous month" disabled={idx <= 0} onClick={() => setMonth(months[idx - 1])}><ChevronLeft className="h-4 w-4" /></Button>
                    <Select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48">{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</Select>
                    <Button variant="outline" size="icon" aria-label="Next month" disabled={idx >= months.length - 1} onClick={() => setMonth(months[idx + 1])}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                  <MonthGrid month={month} byDate={byDate} selected={selected} focus={focus ?? selected} missedOnly={missedOnly} onPick={select} onKey={onKey} refs={refs.current} />
                </>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">{months.map((m) => <div key={m}><div className="mb-1.5 text-sm font-semibold">{monthLabel(m)}</div><MonthGrid month={m} compact byDate={byDate} selected={selected} focus={focus ?? selected} missedOnly={missedOnly} onPick={select} onKey={onKey} refs={refs.current} /></div>)}</div>
              )}
            </div>
            {desktop && <div className="rounded-lg border border-border p-4" aria-live="polite">{panel}</div>}
          </div>
        )}
        {!desktop && <BottomSheet open={!!selected} onClose={() => setSelected(null)} title="Day details">{panel}</BottomSheet>}
      </CardContent>
    </Card>
  )
}

function MonthGrid({ month, byDate, selected, focus, missedOnly, onPick, onKey, refs, compact }: {
  month: string; byDate: Map<string, Item[]>; selected: string | null; focus: string | null; missedOnly: boolean; compact?: boolean
  onPick: (d: string) => void; onKey: (e: React.KeyboardEvent, d: string) => void; refs: Map<string, HTMLButtonElement>
}) {
  const [y, m] = month.split('-').map(Number)
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const tabbable = focus && focus.startsWith(month) ? focus : `${month}-01`
  return (
    <div role="grid" aria-label={monthLabel(month)}>
      <div role="row" className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} role="columnheader">{compact ? d[0] : d}</div>)}</div>
      <div role="rowgroup" className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} role="gridcell" />
          const date = `${month}-${String(d).padStart(2, '0')}`
          const ls = byDate.get(date)
          const present = ls?.filter((l) => l.present).length ?? 0
          const state = !ls ? 'none' : present === ls.length ? 'all' : present === 0 ? 'missed' : 'some'
          const dim = missedOnly && state !== 'some' && state !== 'missed'
          const bg = state === 'none' ? 'bg-muted text-muted-foreground' : state === 'all' ? 'bg-green-600 text-white' : state === 'some' ? 'bg-amber-500 text-black' : 'bg-red-600 text-white'
          const label = `${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${!ls ? 'no lectures' : `${present} of ${ls.length} lectures attended`}${date === TODAY ? ', today' : ''}`
          return (
            <div role="gridcell" key={i}>
              <button ref={(el) => { if (el) refs.set(date, el); else refs.delete(date) }} tabIndex={date === tabbable ? 0 : -1} onClick={() => onPick(date)} onKeyDown={(e) => onKey(e, date)} aria-label={label} aria-pressed={selected === date}
                className={cn('relative flex w-full flex-col items-start rounded-md p-1 text-left transition hover:scale-[1.03]', compact ? 'min-h-[36px]' : 'min-h-[44px] sm:min-h-[52px]', bg, dim && 'opacity-30', selected === date && 'ring-2 ring-brand-600 ring-offset-2 ring-offset-card')}>
                <span className="text-xs font-semibold leading-none">{d}</span>
                {ls && !compact && <span className="mt-1 flex flex-wrap gap-0.5" aria-hidden>{ls.map((x, k) => <span key={k} className={cn('h-1.5 w-1.5 rounded-full border border-white/70', x.present ? 'bg-white' : 'bg-black/60')} />)}</span>}
                {date === TODAY && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-600 ring-1 ring-white" aria-hidden />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
