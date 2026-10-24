import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Badge } from '@student/components/ui/badge'
import { Label, Select } from '@student/components/ui/misc'
import { REQUIRED_PCT, projected, statusFor, type SubjectStat } from '@student/lib/attendance'
import { cn } from '@student/lib/utils'
import { plural, statusStyle } from './shared'

const MAX = 30

export function Simulator({ stats }: { stats: SubjectStat[] }) {
  const withData = stats.filter((s) => s.total > 0)
  const [code, setCode] = useState(withData[0]?.code ?? '')
  const [attend, setAttend] = useState(0)
  const [miss, setMiss] = useState(0)
  useEffect(() => { if (!withData.some((s) => s.code === code)) setCode(withData[0]?.code ?? '') }, [withData.length]) // eslint-disable-line
  const s = withData.find((x) => x.code === code)

  if (!s) return <Card><CardHeader><CardTitle>Plan ahead</CardTitle><CardDescription>No lectures recorded yet, so there is nothing to simulate.</CardDescription></CardHeader></Card>

  const after = projected(s.attended, s.total, attend, miss)
  const before = s.percent
  const afterStatus = statusFor(after)
  const st = statusStyle(afterStatus)
  const gap = after === null ? 0 : Math.round((REQUIRED_PCT - after) * 10) / 10
  const message = after === null ? 'No data yet.'
    : after >= REQUIRED_PCT ? (before !== null && before >= REQUIRED_PCT ? `You'll stay above ${REQUIRED_PCT}%.` : `You'll be back above ${REQUIRED_PCT}%.`)
    : `Still ${gap} points short.`

  return (
    <Card className="h-full transition duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-brand-600" />Plan ahead</CardTitle><CardDescription>See how future lectures change your attendance.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div><Label htmlFor="sim-subject">Subject</Label>
          <Select id="sim-subject" value={code} onChange={(e) => setCode(e.target.value)}>{withData.map((x) => <option key={x.code} value={x.code}>{x.short} · {x.name} ({x.percent}%)</option>)}</Select></div>
        {[
          { id: 'sim-attend', label: "Lectures I'll attend", value: attend, set: setAttend },
          { id: 'sim-miss', label: "Lectures I'll miss", value: miss, set: setMiss },
        ].map((sl) => (
          <div key={sl.id}>
            <div className="mb-1 flex items-center justify-between text-sm"><Label htmlFor={sl.id} className="mb-0 text-sm text-foreground">{sl.label}</Label><span className="font-semibold tabular-nums">{sl.value}</span></div>
            <input id={sl.id} type="range" min={0} max={MAX} value={sl.value} onChange={(e) => sl.set(Number(e.target.value))} aria-label={sl.label} aria-valuetext={plural(sl.value, 'lecture')} className="h-2 w-full cursor-pointer accent-brand-600" />
          </div>
        ))}
        <div className={cn('rounded-lg border p-4', st.border, st.bg)} aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-2xl font-bold tabular-nums"><span className="text-muted-foreground">{before}%</span> <span aria-hidden>→</span><span className="sr-only"> becomes </span> <span className={st.text}>{after}%</span></div>
            <Badge tone={afterStatus.tone === 'none' ? 'neutral' : afterStatus.tone}><st.Icon className="h-3.5 w-3.5" />{afterStatus.label}</Badge>
          </div>
          <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full transition-all duration-500', st.solid)} style={{ width: `${Math.min(100, after ?? 0)}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-foreground/70" style={{ left: `${REQUIRED_PCT}%` }} aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium">{message}</p>
        </div>
      </CardContent>
    </Card>
  )
}
