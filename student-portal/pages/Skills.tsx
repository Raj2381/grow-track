import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookOpen, Brain, Clock, Code2, Play, Users } from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Badge } from '@student/components/ui/badge'
import { Modal, Progress, useToast } from '@student/components/ui/misc'
import { ChartCard, InsightsCard, PageHeader, StatCard, StatGrid, WithData, tooltipStyle } from '@student/components/common'
import { skillLevel, softAvg, techAvg } from '@student/lib/scoring'
import { SKILL_RESOURCES, TECH_TESTS, type CoreTech } from '@student/data/questions'
import { saveSkillTest } from '@student/services/api'
import { useStudent } from '@student/hooks/useStudent'
import { TODAY } from '@student/data/students'
import { cn, scoreTone, TONE } from '@student/lib/utils'
import type { SoftSkill, TechSkill } from '@student/types'
import { Link } from 'react-router-dom'
import { bestByLanguage } from '@student/lib/coding'

const TECH: CoreTech[] = ['DSA', 'Web Dev', 'DBMS', 'Python']
const CODING = ['Java', 'Python', 'C', 'SQL'] as const
const SOFT: SoftSkill[] = ['Communication', 'Teamwork', 'Problem Solving', 'Leadership', 'Time Management']
const levelTone = (l: string) => (l === 'Advanced' ? 'good' : l === 'Intermediate' ? 'warn' : 'bad')

export default function Skills() {
  const [tech, setTech] = useState<CoreTech | null>(null)
  const [resFor, setResFor] = useState<string | null>(null)
  return (
    <WithData>
      {({ student: s, cohort, base }) => {
        const techKeys = (Object.keys(s.skills.technical) as TechSkill[]).filter((k) => s.skills.technical[k] !== undefined)
        const all = [...techKeys.map((k) => ({ k: k as string, v: s.skills.technical[k]!, avg: cohort.avgTech[k] ?? s.skills.technical[k]!, kind: 'Technical' })), ...SOFT.map((k) => ({ k: k as string, v: s.skills.soft[k], avg: cohort.avgSoft[k], kind: 'Soft' }))]
        const sorted = [...all].sort((a, b) => b.v - a.v)
        const radar = all.map((x) => ({ skill: x.k, You: x.v, Cohort: x.avg }))
        return (
          <>
            <PageHeader title="Skills" description="Technical and soft-skill scores, how you compare with your cohort, and ways to improve." />
            <StatGrid>
              <StatCard label="Technical average" value={Math.round(techAvg(s))} tone={scoreTone(techAvg(s))} sub={skillLevel(techAvg(s))} icon={<Code2 className="h-4 w-4" />} />
              <StatCard label="Soft-skill average" value={Math.round(softAvg(s))} tone={scoreTone(softAvg(s))} sub={skillLevel(softAvg(s))} icon={<Users className="h-4 w-4" />} />
              <StatCard label="Strongest skill" value={sorted[0].k} sub={`${sorted[0].v}%`} tone="good" icon={<Brain className="h-4 w-4" />} />
              <StatCard label="Weakest skill" value={sorted[sorted.length - 1].k} sub={`${sorted[sorted.length - 1].v}%`} tone={scoreTone(sorted[sorted.length - 1].v)} icon={<Brain className="h-4 w-4" />} />
            </StatGrid>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <ChartCard title="Skill radar" description="Every skill — you vs cohort average" height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar} outerRadius="68%">
                    <PolarGrid /><PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="You" dataKey="You" stroke="var(--chart-primary)" fill="var(--chart-primary)" fillOpacity={0.35} />
                    <Radar name="Cohort average" dataKey="Cohort" stroke="var(--chart-cohort)" fill="var(--chart-cohort)" fillOpacity={0.15} />
                    <Legend /><Tooltip contentStyle={tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="You vs cohort" description="Score per skill compared with the class average" height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={all.map((x) => ({ name: x.k, You: x.v, 'Cohort average': x.avg }))} margin={{ left: 0, right: 12, top: 12, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={60} tick={{ fontSize: 11 }} label={{ value: 'Skill', position: 'insideBottom', offset: -34, fontSize: 11 }} />
                    <YAxis domain={[0, 100]} label={{ value: 'Score %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} /><Legend verticalAlign="top" height={28} />
                    <Bar dataKey="You" fill="var(--chart-primary)" radius={[5, 5, 0, 0]} /><Bar dataKey="Cohort average" fill="var(--chart-cohort)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <Card className="mb-6">
              <CardHeader><CardTitle>Technical skills</CardTitle><CardDescription>Take a short timed MCQ test (6 questions, 3 minutes). Your new score is averaged with your previous one.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {TECH.map((k) => {
                  const v = s.skills.technical[k] ?? 0; const lv = skillLevel(v)
                  return (
                    <div key={k} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between"><b>{k}</b><Badge tone={levelTone(lv)}>{lv}</Badge></div>
                      <div className={cn('mt-2 text-3xl font-bold', TONE[scoreTone(v)].text)}>{v}%</div>
                      <Progress value={v} tone={scoreTone(v)} className="mt-2" />
                      <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setTech(k)}><Play className="h-3.5 w-3.5" />Take test</Button><Button size="sm" variant="outline" onClick={() => setResFor(k)}><BookOpen className="h-3.5 w-3.5" />Resources</Button></div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div><CardTitle>Coding languages</CardTitle><CardDescription>Java, Python, C and SQL tests. Your best score per language feeds the radar and your Success Score.</CardDescription></div>
                <Link to={`${base}/skills/coding`}><Button><Code2 className="h-4 w-4" />Take coding test</Button></Link>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {CODING.map((l) => {
                  const b = bestByLanguage(s.skills.codingAttempts)[l]
                  return (
                    <div key={l} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between"><b>{l}</b>{b !== undefined && <Badge tone={levelTone(skillLevel(b))}>{skillLevel(b)}</Badge>}</div>
                      <div className={cn('mt-2 text-2xl font-bold', b !== undefined && TONE[scoreTone(b)].text)}>{b !== undefined ? `${b}%` : 'Not attempted'}</div>
                      {b !== undefined && <Progress value={b} tone={scoreTone(b)} className="mt-2" />}</div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div><p className="font-semibold">Soft skills have their own page</p><p className="text-sm text-muted-foreground">Communication, teamwork, leadership, the situational test and the video introduction.</p></div>
                <Link to={`${base}/placement/soft-skills`} className="text-sm font-semibold text-primary hover:underline">Open soft skills</Link>
              </CardContent>
            </Card>

            <InsightsCard items={[
              { text: <>Your strongest skill is <b>{sorted[0].k}</b> ({sorted[0].v}%). Your weakest is <b>{sorted[sorted.length - 1].k}</b> ({sorted[sorted.length - 1].v}%) — {sorted[sorted.length - 1].v < sorted[sorted.length - 1].avg ? `${sorted[sorted.length - 1].avg - sorted[sorted.length - 1].v} points below the cohort average` : 'still above the cohort average'}.</>, tone: scoreTone(sorted[sorted.length - 1].v) },
              ...all.filter((x) => x.v < x.avg - 5).slice(0, 3).map((x) => ({ text: <><b>{x.k}</b> is {x.avg - x.v} points below the cohort average. {SKILL_RESOURCES[x.k][skillLevel(x.v).toLowerCase() as 'beginner'][0]} is a good place to start.</>, tone: 'warn' as const })),
            ]} />

            {tech && <TechTestModal skill={tech} current={s.skills.technical[tech] ?? 0} onClose={() => setTech(null)} />}
            <Modal open={!!resFor} onClose={() => setResFor(null)} title={`Suggested resources · ${resFor}`}>
              {resFor && (() => {
                const cur = resFor in s.skills.soft ? s.skills.soft[resFor as SoftSkill] : s.skills.technical[resFor as TechSkill] ?? 0
                const lv = skillLevel(cur); const r = SKILL_RESOURCES[resFor]
                const list = r[lv.toLowerCase() as 'beginner']
                return <><p className="mb-3 text-sm text-muted-foreground">You are at <b>{lv}</b> level ({cur}%). Suggested next steps:</p><ul className="list-disc space-y-1.5 pl-5 text-sm">{list.map((x) => <li key={x}>{x}</li>)}</ul></>
              })()}
            </Modal>
          </>
        )
      }}
    </WithData>
  )
}

/* ---------------------------- technical MCQ test --------------------------- */
function TechTestModal({ skill, current, onClose }: { skill: CoreTech; current: number; onClose: () => void }) {
  const { studentId } = useStudent()
  const toast = useToast()
  const qs = TECH_TESTS[skill]
  const [i, setI] = useState(0)
  const [ans, setAns] = useState<(number | null)[]>(qs.map(() => null))
  const [left, setLeft] = useState(180)
  const [res, setRes] = useState<{ raw: number; blended: number } | null>(null)
  const start = useRef(Date.now())

  const finish = async () => {
    if (res) return
    const correct = qs.filter((q, k) => ans[k] === q.answer).length
    const raw = Math.round((correct / qs.length) * 100)
    const blended = Math.round((current + raw) / 2)
    await saveSkillTest(studentId, skill, blended, TODAY)
    toast.success(`${skill} test saved — ${correct}/${qs.length} correct`)
    setRes({ raw, blended })
  }
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, 180 - Math.round((Date.now() - start.current) / 1000))), 500)
    return () => clearInterval(t)
  })
  useEffect(() => { if (left === 0 && !res) finish() }) // eslint-disable-line

  return (
    <Modal open onClose={onClose} title={`${skill} test`} wide>
      {res ? (
        <div>
          <div className="text-center"><div className={cn('text-5xl font-bold', TONE[scoreTone(res.raw)].text)}>{res.raw}%</div><p className="mt-1 text-sm text-muted-foreground">Test score. Your {skill} skill is now <b>{res.blended}%</b> (average of previous {current}% and this test).</p></div>
          <div className="mt-4 space-y-2">{qs.map((q, k) => (
            <div key={k} className={cn('rounded-xl border p-3 text-sm', ans[k] === q.answer ? `${TONE.good.border} ${TONE.good.bg}` : `${TONE.bad.border} ${TONE.bad.bg}`)}>
              <b>{q.q}</b><div className="mt-1 text-xs">Correct: <b>{q.options[q.answer]}</b>{ans[k] !== q.answer && <> · You: {ans[k] === null ? 'skipped' : q.options[ans[k]!]}</>}</div><div className="text-xs text-muted-foreground">{q.explanation}</div>
            </div>))}</div>
          <div className="mt-4 flex justify-end"><Button onClick={onClose}>Done</Button></div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between text-sm"><span>Question {i + 1} / {qs.length}</span><span className={cn('flex items-center gap-1 font-mono font-bold', left < 30 && TONE.bad.text)}><Clock className="h-4 w-4" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span></div>
          <Progress value={((i + 1) / qs.length) * 100} tone="primary" />
          <p className="mt-4 font-medium">{qs[i].q}</p>
          <div className="mt-3 space-y-2">{qs[i].options.map((o, k) => (
            <button key={k} onClick={() => setAns((a) => a.map((x, j) => (j === i ? k : x)))} className={cn('w-full rounded-xl border p-3 text-left text-sm transition', ans[i] === k ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted')}>{o}</button>))}</div>
          <div className="mt-5 flex justify-between">
            <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
            {i < qs.length - 1 ? <Button onClick={() => setI(i + 1)}>Next</Button> : <Button onClick={finish}>Submit</Button>}
          </div>
        </div>
      )}
    </Modal>
  )
}
