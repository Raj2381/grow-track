import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LineChart as LineIcon, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { EmptyState, tooltipStyle } from '@student/components/common'
import { REQUIRED_PCT, cumulativeTrend, hasTrend, monthlyTrend, trendDelta, weeklyTrend } from '@student/lib/attendance'
import { cn } from '@student/lib/utils'

type Mode = 'Weekly' | 'Monthly' | 'Semester'

export function TrendCard({ lectures, scope }: { lectures: { date: string; present: boolean }[]; scope: string }) {
  const [mode, setMode] = useState<Mode>('Weekly')
  const weekly = weeklyTrend(lectures)
  const pts = mode === 'Weekly' ? weekly : mode === 'Monthly' ? monthlyTrend(lectures) : cumulativeTrend(lectures)
  const delta = trendDelta(weekly, 4)
  const ok = hasTrend(pts)
  return (
    <Card className="transition duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Attendance trend</CardTitle>
          <CardDescription>{scope} · {mode === 'Weekly' ? "each week's attendance" : mode === 'Monthly' ? "each month's attendance" : 'running attendance across the semester'}</CardDescription>
          {delta !== null && (
            <span className={cn('mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold', delta < 0 ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' : delta > 0 ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-muted text-muted-foreground')}>
              {delta < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {delta === 0 ? 'No change' : `${Math.abs(delta)} pts ${delta < 0 ? 'lower' : 'higher'}`} in the last 4 weeks
            </span>
          )}
        </div>
        <div role="tablist" aria-label="Trend period" className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {(['Weekly', 'Monthly', 'Semester'] as Mode[]).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition', mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{m}</button>)}
        </div>
      </CardHeader>
      <CardContent>
        {!ok ? <EmptyState icon={<LineIcon className="h-8 w-8" />} title="Not enough data for a trend yet" text="A trend needs lectures in at least two different weeks (or months)." /> : (
          <div className="h-72" role="img" aria-label={`${mode} attendance trend from ${pts[0].percent} to ${pts[pts.length - 1].percent} percent`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pts} margin={{ left: 0, right: 16, top: 12, bottom: 22 }}>
                <defs><linearGradient id="attTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand-500)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--brand-100)" stopOpacity={0.05} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" label={{ value: mode === 'Monthly' ? 'Month' : 'Week starting', position: 'insideBottom', offset: -12, fontSize: 12 }} />
                <YAxis domain={[0, 100]} label={{ value: 'Attendance %', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${Number(v ?? 0)}% (${p.payload.attended}/${p.payload.total} lectures)`, 'Attendance']} />
                <ReferenceLine y={REQUIRED_PCT} stroke="var(--danger)" strokeDasharray="6 4" label={{ value: `${REQUIRED_PCT}% minimum`, position: 'insideBottomRight', fill: 'var(--danger)', fontSize: 12 }} />
                <Area type="monotone" dataKey="percent" stroke="var(--brand-500)" strokeWidth={3} fill="url(#attTrend)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
