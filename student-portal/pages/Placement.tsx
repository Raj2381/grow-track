import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, ClipboardCheck, Mic, PenLine, XCircle, Briefcase, Code2, Target, Wrench } from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Badge } from '@student/components/ui/badge'
import { ChartCard, EmptyState, Gauge, InsightsCard, PageHeader, StatCard, StatGrid, WithData, tooltipStyle } from '@student/components/common'
import { latestAptitude, PLACEMENT_WEIGHTS, type Tone } from '@student/lib/scoring'
import { cn, fmtDate, scoreTone, TONE } from '@student/lib/utils'

export default function Placement() {
  return (
    <WithData>
      {({ student: s, analysis: a, base }) => {
        const { breakdown, score } = a.readiness
        const tone = scoreTone(score)
        const latest = latestAptitude(s)
        const rows = [
          { name: 'Aptitude (latest)', value: Math.round(breakdown.aptitude), weight: PLACEMENT_WEIGHTS.aptitude },
          { name: 'Coding', value: Math.round(breakdown.coding), weight: PLACEMENT_WEIGHTS.coding },
          { name: 'Mock interview (best)', value: Math.round(breakdown.interview), weight: PLACEMENT_WEIGHTS.interview },
          { name: 'Technical skills', value: Math.round(breakdown.technical), weight: PLACEMENT_WEIGHTS.technical },
        ]
        // specific improvement suggestions
        const tips: { text: string; tone: Tone }[] = []
        if (latest) {
          const secs = Object.entries(latest.sections).map(([k, v]) => ({ k, p: Math.round((v.score / v.total) * 100) })).sort((x, y) => x.p - y.p)
          if (secs[0].p < 70) tips.push({ text: `${secs[0].k} aptitude is ${secs[0].p}% — practice 20 questions a day and revisit the explanations after each test.`, tone: secs[0].p < 50 ? 'bad' : 'warn' })
        } else tips.push({ text: 'You have not taken an aptitude test yet — start with a General Practice test.', tone: 'bad' })
        if (breakdown.coding < 70) tips.push({ text: `Coding score is ${breakdown.coding}% — solve 2 problems daily (arrays, strings, then recursion).`, tone: breakdown.coding < 50 ? 'bad' : 'warn' })
        if (!s.placement.interviews.length) tips.push({ text: 'No mock interviews yet — try one HR round this week.', tone: 'bad' })
        else if (breakdown.interview < 70) tips.push({ text: `Best mock interview is ${breakdown.interview}/100 — practise STAR-format answers and re-attempt.`, tone: 'warn' })
        const wt = Object.entries(s.skills.technical).sort((x, y) => x[1] - y[1])[0]
        if (wt[1] < 70) tips.push({ text: `${wt[0]} is your weakest technical skill (${wt[1]}%) — take the ${wt[0]} test in Skills.`, tone: 'warn' })
        a.eligibility.items.filter((i) => !i.ok).forEach((i) => tips.push({ text: `Eligibility: "${i.label}" is not met (you: ${i.actual}).`, tone: 'bad' }))

        const history = [
          ...s.placement.aptitude.map((x) => ({ id: x.id, date: x.date, kind: 'Aptitude', detail: x.pattern, score: x.totalPercent, extra: `${Object.values(x.sections).map((v) => `${v.score}/${v.total}`).join(' · ')}` })),
          ...s.placement.interviews.map((x) => ({ id: x.id, date: x.date, kind: 'Interview', detail: `${x.type} · ${x.difficulty}`, score: x.score, extra: x.feedback })),
        ].sort((x, y) => y.date.localeCompare(x.date))

        return (
          <>
            <PageHeader title="Placement" description="How ready you are for campus placements, and exactly what to work on next."
              actions={<div className="flex gap-2"><Link to={`${base}/placement/aptitude`}><Button variant="outline"><PenLine className="h-4 w-4" />Aptitude Test</Button></Link><Link to={`${base}/placement/interview`}><Button><Mic className="h-4 w-4" />Mock Interview</Button></Link></div>} />

            <StatGrid>
              <StatCard label="Readiness" value={score} tone={tone} sub={a.placementRisk.level + ' placement risk'} icon={<Briefcase className="h-4 w-4" />} />
              <StatCard label="Latest aptitude" value={latest ? `${latest.totalPercent}%` : '—'} sub={latest?.pattern ?? 'No attempts'} tone={latest ? scoreTone(latest.totalPercent) : undefined} icon={<PenLine className="h-4 w-4" />} />
              <StatCard label="Coding score" value={`${breakdown.coding}%`} tone={scoreTone(breakdown.coding)} icon={<Code2 className="h-4 w-4" />} />
              <StatCard label="Best mock interview" value={breakdown.interview ? `${breakdown.interview}/100` : '—'} tone={breakdown.interview ? scoreTone(breakdown.interview) : undefined} icon={<Mic className="h-4 w-4" />} />
            </StatGrid>

            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              <Card className="flex flex-col items-center justify-center p-6 text-center">
                <CardTitle className="mb-3">Placement readiness</CardTitle>
                <Gauge value={score} tone={tone} label="Placement readiness" />
                <Badge tone={tone} className="mt-3 px-3 py-1 text-sm">{score >= 75 ? 'Placement Ready' : score >= 50 ? 'Getting There' : 'Needs Preparation'}</Badge>
                <p className="mt-2 text-xs text-muted-foreground">35% aptitude · 30% coding · 25% mock interview · 10% technical skills</p>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" />Eligibility checklist</CardTitle><CardDescription>All three must be met to sit for company drives</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {a.eligibility.items.map((i) => (
                    <div key={i.label} className={cn('flex items-center justify-between rounded-xl border p-3', i.ok ? `${TONE.good.border} ${TONE.good.bg}` : `${TONE.bad.border} ${TONE.bad.bg}`)}>
                      <div className="flex items-center gap-2 text-sm font-medium">{i.ok ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}{i.label}</div>
                      <span className="text-sm font-semibold">{i.actual}</span>
                    </div>
                  ))}
                  <p className={cn('text-sm font-medium', a.eligibility.eligible ? TONE.good.text : TONE.bad.text)}>{a.eligibility.eligible ? 'You are eligible for placements.' : 'You are not eligible yet.'}</p>
                </CardContent>
              </Card>

              <ChartCard title="Readiness breakdown" description="Score per part (0–100)" height={250}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 22 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} label={{ value: 'Score (0–100)', position: 'insideBottom', offset: -12, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${Number(v ?? 0)}/100 (weight ${Math.round(p.payload.weight * 100)}%)`, 'Score']} />
                    <Bar dataKey="value" radius={4}>
                      {rows.map((r) => <Cell key={r.name} fill={TONE[scoreTone(r.value)].hex} />)}
                      <LabelList dataKey="value" position="right" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />What to improve</CardTitle><CardDescription>Specific suggestions based on your weakest parts</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {tips.length === 0 ? <p className="text-sm text-muted-foreground">Every part is above 70%. Try harder company-pattern tests to stay sharp.</p> : tips.map((t, i) => (
                    <div key={i} className="flex gap-3 rounded-xl bg-muted/50 p-3 text-sm"><Wrench className={cn('mt-0.5 h-4 w-4 shrink-0', TONE[t.tone].text)} />{t.text}</div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Practice now</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Link to={`${base}/placement/aptitude`} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/50"><PenLine className="h-5 w-5 text-primary" /><div><div className="text-sm font-semibold">Aptitude Test</div><div className="text-xs text-muted-foreground">TCS, Infosys, Accenture patterns</div></div></Link>
                  <Link to={`${base}/placement/interview`} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/50"><Mic className="h-5 w-5 text-primary" /><div><div className="text-sm font-semibold">Mock Interview</div><div className="text-xs text-muted-foreground">AI interviewer · voice supported</div></div></Link>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Attempt history</CardTitle><CardDescription>All aptitude tests and mock interviews</CardDescription></CardHeader>
              <CardContent className="overflow-x-auto">
                {history.length === 0 ? <EmptyState title="No attempts yet" text="Take an aptitude test or mock interview to see your history." /> : (
                  <table className="data-table w-full min-w-[560px] text-sm">
                    <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Date</th><th>Type</th><th>Details</th><th>Sections / feedback</th><th className="text-right">Score</th></tr></thead>
                    <tbody>{history.map((h) => (
                      <tr key={h.id} className="border-b border-border last:border-0">
                        <td className="py-2.5">{fmtDate(h.date)}</td><td><Badge tone={h.kind === 'Aptitude' ? 'primary' : 'neutral'}>{h.kind}</Badge></td>
                        <td>{h.detail}</td><td className="max-w-[280px] truncate text-muted-foreground" title={h.extra}>{h.extra}</td>
                        <td className={cn('text-right font-semibold', TONE[scoreTone(h.score)].text)}>{h.score}{h.kind === 'Aptitude' ? '%' : '/100'}</td>
                      </tr>))}</tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <InsightsCard items={[
              { text: <>Your readiness is <b>{score}</b>. The biggest drag is <b>{[...rows].sort((x, y) => x.value - y.value)[0].name}</b> at {[...rows].sort((x, y) => x.value - y.value)[0].value}%.</>, tone },
              ...(!a.eligibility.eligible ? [{ text: <>You are <b>not eligible</b> for drives yet — {a.eligibility.items.filter((i) => !i.ok).map((i) => i.label.toLowerCase()).join(' and ')} must be fixed first. Even great test scores won't help until then.</>, tone: 'bad' as const }] : []),
              ...tips.slice(0, 2).map((t) => ({ text: t.text, tone: t.tone })),
            ]} />
          </>
        )
      }}
    </WithData>
  )
}
