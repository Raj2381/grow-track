import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertOctagon, BookOpenCheck, GraduationCap, Layers, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Badge } from '@student/components/ui/badge'
import { ChartCard, EmptyState, InsightsCard, PageHeader, StatCard, StatGrid, WithData, tooltipStyle } from '@student/components/common'
import { activeBacklogs, cgpa, creditTotals, roman, sgpa } from '@student/lib/scoring'
import { cn, fmtDate, TONE } from '@student/lib/utils'
import { subjectByCode } from '@student/data/catalog'

export default function Results() {
  const [sem, setSem] = useState(5)
  return (
    <WithData>
      {({ student: s, cohort }) => {
        const rows = s.results.filter((r) => r.semester === sem)
        const cr = creditTotals(s)
        const active = activeBacklogs(s)
        const sems = [1, 2, 3, 4, 5]
        const trend = sems.map((k) => ({ sem: `Sem ${roman(k)}`, SGPA: sgpa(s, k), CGPA: cgpa(s, k) }))
        const compare = rows.map((r) => ({ name: subjectByCode(r.code).short, You: r.total, 'Class average': cohort.classAvgBySubject[r.code] }))
        const diffs = rows.map((r) => ({ r, diff: r.total - cohort.classAvgBySubject[r.code] })).sort((a, b) => b.diff - a.diff)
        const strong = diffs.slice(0, 2)
        const weak = [...diffs].reverse().slice(0, 2)
        const cur = sgpa(s, s.semester)
        const prev = sgpa(s, s.semester - 1)
        const c5 = cgpa(s)
        return (
          <>
            <PageHeader title="Results" description="Semester-wise marks, grades and backlogs. Data is entered by the examination office (read-only)." />
            <StatGrid>
              <StatCard label="CGPA" value={c5.toFixed(2)} sub="across all semesters" tone={c5 >= 7.5 ? 'good' : c5 >= 6.5 ? 'warn' : 'bad'} icon={<GraduationCap className="h-4 w-4" />} />
              <StatCard label={`SGPA · Sem ${roman(s.semester)}`} value={cur.toFixed(2)} sub={`${cur >= prev ? 'Up' : 'Down'} ${Math.abs(cur - prev).toFixed(2)} vs previous (provisional)`} tone={cur >= 7.5 ? 'good' : cur >= 6.5 ? 'warn' : 'bad'} icon={<TrendingUp className="h-4 w-4" />} />
              <StatCard label="Credits earned" value={`${cr.earned} / ${cr.total}`} sub={`${cr.total - cr.earned} credits pending`} tone={cr.earned === cr.total ? 'good' : 'warn'} icon={<Layers className="h-4 w-4" />} />
              <StatCard label="Active backlogs" value={active.length} sub={active.length ? 'Needs clearing' : 'None'} tone={active.length ? 'bad' : 'good'} icon={<AlertOctagon className="h-4 w-4" />} />
            </StatGrid>

            <Card className="mb-6">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div><CardTitle>Semester marks</CardTitle><CardDescription>SGPA this semester: <b>{sgpa(s, sem).toFixed(2)}</b>{sem === s.semester && ' (provisional)'}</CardDescription></div>
                <div role="tablist" aria-label="Select semester" className="inline-flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
                  {sems.map((k) => (
                    <button key={k} role="tab" aria-selected={sem === k} onClick={() => setSem(k)}
                      className={cn('whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition', sem === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>Sem {roman(k)}</button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="data-table w-full min-w-[640px] text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Subject</th><th className="px-2 text-right">Credits</th><th className="px-2 text-right">Internal /40</th><th className="px-2 text-right">External /60</th><th className="px-2 text-right">Total /100</th><th className="px-2 text-center">Grade</th><th className="px-2 text-right">Credits obtained</th><th className="pl-2">Status</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const sub = subjectByCode(r.code)
                      return (
                        <tr key={r.code} className={cn('border-b border-border last:border-0', !r.passed && `${TONE.bad.bg}`)}>
                          <td className="py-2.5 pr-3"><div className="font-medium">{sub.name}</div><div className="text-xs text-muted-foreground">{r.code}</div></td>
                          <td className="px-2 text-right">{sub.credits}</td><td className="px-2 text-right">{r.internal}</td><td className="px-2 text-right">{r.external}</td>
                          <td className="px-2 text-right font-semibold">{r.total}</td>
                          <td className="px-2 text-center"><Badge tone={!r.passed ? 'bad' : r.gradePoint >= 8 ? 'good' : 'warn'}>{r.grade}</Badge></td>
                          <td className="px-2 text-right">{r.creditsObtained}</td>
                          <td className="pl-2">{r.passed ? <Badge tone="good">Pass</Badge> : <Badge tone="bad">Backlog</Badge>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <ChartCard title="SGPA &amp; CGPA trend" description="Semester GPA and cumulative GPA across semesters">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ left: 0, right: 16, top: 12, bottom: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sem" label={{ value: 'Semester', position: 'insideBottom', offset: -12, fontSize: 11 }} />
                    <YAxis domain={[4, 10]} label={{ value: 'GPA (out of 10)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="top" height={28} />
                    <Line dataKey="SGPA" stroke="var(--chart-primary)" strokeWidth={3} dot={{ r: 4 }} />
                    <Line dataKey="CGPA" stroke="var(--success)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title={`Subject performance vs class · Sem ${roman(sem)}`} description="Your total marks compared with the class average">
                <ResponsiveContainer width="100%" height="100%">
                  {rows.length >= 3 && sem === s.semester ? (
                    <RadarChart data={compare} outerRadius="72%">
                      <PolarGrid /><PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="You" dataKey="You" stroke="var(--chart-primary)" fill="var(--chart-primary)" fillOpacity={0.35} />
                      <Radar name="Class average" dataKey="Class average" stroke="var(--chart-cohort)" fill="var(--chart-cohort)" fillOpacity={0.2} />
                      <Legend /><Tooltip contentStyle={tooltipStyle} />
                    </RadarChart>
                  ) : (
                    <BarChart data={compare} margin={{ left: 0, right: 12, top: 12, bottom: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" label={{ value: 'Subject', position: 'insideBottom', offset: -12, fontSize: 11 }} />
                      <YAxis domain={[0, 100]} label={{ value: 'Marks /100', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} /><Legend verticalAlign="top" height={28} />
                      <Bar dataKey="You" fill="var(--chart-primary)" radius={[6, 6, 0, 0]} /><Bar dataKey="Class average" fill="var(--chart-cohort)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-500" />Strongest subjects · Sem {roman(sem)}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {strong.map(({ r, diff }) => (
                    <div key={r.code} className="flex items-center justify-between rounded-xl bg-green-50 p-3 text-sm dark:bg-green-500/10"><span className="font-medium">{subjectByCode(r.code).name}</span><span className="text-green-600 dark:text-green-400">{r.total} ({diff >= 0 ? '+' : ''}{Math.round(diff)} vs class)</span></div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-red-500" />Needs improvement · Sem {roman(sem)}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {weak.map(({ r, diff }) => (
                    <div key={r.code} className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm dark:bg-red-500/10"><span className="font-medium">{subjectByCode(r.code).name}</span><span className="text-red-600 dark:text-red-400">{r.total} ({diff >= 0 ? '+' : ''}{Math.round(diff)} vs class)</span></div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5" />Backlogs</CardTitle><CardDescription>Active and cleared backlogs with attempt history</CardDescription></CardHeader>
              <CardContent>
                {s.backlogs.length === 0 ? <EmptyState title="No backlogs" text="You have never failed a subject. Keep it up!" /> : (
                  <div className="space-y-3">
                    {s.backlogs.map((b) => (
                      <div key={b.code} className={cn('rounded-xl border p-4', b.status === 'active' ? `${TONE.bad.border} ${TONE.bad.bg}` : 'border-border')}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div><div className="font-semibold">{subjectByCode(b.code).name}</div><div className="text-xs text-muted-foreground">{b.code} · Semester {roman(b.semester)}</div></div>
                          <Badge tone={b.status === 'active' ? 'bad' : 'good'}>{b.status === 'active' ? 'Active' : 'Cleared'}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {b.attempts.map((t) => (
                            <div key={t.attempt} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
                              <b>Attempt {t.attempt}</b> · {fmtDate(t.date)} · {t.marks}/100 · <span className={t.result === 'Pass' ? TONE.good.text : TONE.bad.text}>{t.result}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <InsightsCard items={[
              ...active.map((b) => ({ tone: 'bad' as const, text: <>You have an active backlog in <b>{subjectByCode(b.code).name}</b> after {b.attempts.length} attempt{b.attempts.length > 1 ? 's' : ''} (last score {b.attempts[b.attempts.length - 1].marks}/100 — you need 40 with 24 in the external). Clearing it removes a {10}-point academic penalty and unlocks placement eligibility.</> })),
              { text: <>Your CGPA is <b>{c5.toFixed(2)}</b>. {c5 >= 7 ? 'You meet the 7.0 placement cut-off for CGPA.' : `You need ${(7 - c5).toFixed(2)} more to reach the 7.0 placement cut-off.`}</>, tone: c5 >= 7 ? 'good' : 'warn' },
              ...(weak[0] ? [{ text: <>In Sem {roman(sem)}, <b>{subjectByCode(weak[0].r.code).name}</b> is {Math.abs(Math.round(weak[0].diff))} marks {weak[0].diff < 0 ? 'below' : 'above'} the class average — a focused revision plan there lifts your SGPA the most.</>, tone: (weak[0].diff < 0 ? 'warn' : 'good') as 'warn' | 'good' }] : []),
            ]} />
          </>
        )
      }}
    </WithData>
  )
}
