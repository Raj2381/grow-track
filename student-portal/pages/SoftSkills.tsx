import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Brain, Camera, Loader2, Mic, Play, Square, Users, Video } from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Badge } from '@student/components/ui/badge'
import { Modal, Progress, useToast } from '@student/components/ui/misc'
import { ChartCard, InsightsCard, PageHeader, StatCard, StatGrid, WithData, tooltipStyle } from '@student/components/common'
import { skillLevel, softAvg } from '@student/lib/scoring'
import { SJT, SKILL_RESOURCES } from '@student/data/questions'
import { saveIntro, saveSoftSkills } from '@student/services/api'
import { scoreIntroduction } from '@student/services/ai'
import { useStudent } from '@student/hooks/useStudent'
import { useSpeech } from '@student/hooks/useSpeech'
import { useCamera } from '@student/hooks/useCamera'
import { TODAY } from '@student/data/students'
import { cn, scoreTone, TONE } from '@student/lib/utils'
import type { SoftSkill } from '@student/types'

const SOFT: SoftSkill[] = ['Communication', 'Teamwork', 'Problem Solving', 'Leadership', 'Time Management']
const levelTone = (l: string) => (l === 'Advanced' ? 'good' : l === 'Intermediate' ? 'warn' : 'bad')

/** Soft skills: scores against the cohort, a situational judgment test, suggested resources and a recorded video introduction. */
export default function SoftSkills() {
  const [sjt, setSjt] = useState(false)
  const [resFor, setResFor] = useState<SoftSkill | null>(null)
  return (
    <WithData>
      {({ student: s, cohort, base }) => {
        const rows = SOFT.map((k) => ({ k, v: s.skills.soft[k], avg: cohort.avgSoft[k] }))
        const sorted = [...rows].sort((a, b) => b.v - a.v)
        const intro = s.skills.introScore
        return (
          <>
            <PageHeader title="Soft skills" description="Communication, teamwork, problem solving, leadership and time management: your scores, how you compare with your cohort, and ways to improve."
              actions={<Link to={`${base}/skills`} className="text-sm font-semibold text-primary hover:underline">Technical skills</Link>} />
            <StatGrid>
              <StatCard label="Soft-skill average" value={Math.round(softAvg(s))} tone={scoreTone(softAvg(s))} sub={skillLevel(softAvg(s))} icon={<Users className="h-4 w-4" />} />
              <StatCard label="Strongest soft skill" value={sorted[0].k} sub={`${sorted[0].v}%`} tone="good" icon={<Brain className="h-4 w-4" />} />
              <StatCard label="Needs most practice" value={sorted[sorted.length - 1].k} sub={`${sorted[sorted.length - 1].v}%`} tone={scoreTone(sorted[sorted.length - 1].v)} icon={<Brain className="h-4 w-4" />} />
              <StatCard label="Video introduction" value={intro ? `${intro.score}/100` : 'Not taken'} sub={intro ? 'Last communication score' : 'Record one below'} tone={intro ? scoreTone(intro.score) : undefined} icon={<Video className="h-4 w-4" />} />
            </StatGrid>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <ChartCard title="Soft-skill radar" description="You compared with the cohort average" height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={rows.map((r) => ({ skill: r.k, You: r.v, Cohort: r.avg }))} outerRadius="68%">
                    <PolarGrid /><PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="You" dataKey="You" stroke="var(--chart-primary)" fill="var(--chart-primary)" fillOpacity={0.35} />
                    <Radar name="Cohort average" dataKey="Cohort" stroke="var(--chart-cohort)" fill="var(--chart-cohort)" fillOpacity={0.15} />
                    <Legend /><Tooltip contentStyle={tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="You vs cohort" description="Score per soft skill compared with the class average" height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows.map((r) => ({ skill: r.k, You: r.v, Cohort: r.avg }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="skill" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} /><Tooltip contentStyle={tooltipStyle} /><Legend />
                    <Bar dataKey="You" fill="var(--chart-primary)" radius={[4, 4, 0, 0]} /><Bar dataKey="Cohort" name="Cohort average" fill="var(--chart-cohort)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <Card className="mb-6">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div><CardTitle>Your soft skills</CardTitle><CardDescription>Situational judgment test: 10 workplace scenarios mapped to five skills.</CardDescription></div>
                <Button onClick={() => setSjt(true)}><Play className="h-4 w-4" />Take situational test</Button>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {rows.map(({ k, v }) => {
                  const lv = skillLevel(v)
                  return (
                    <div key={k} className="rounded-xl border border-border p-4">
                      <div className="text-sm font-semibold">{k}</div>
                      <div className={cn('mt-1 text-2xl font-bold', TONE[scoreTone(v)].text)}>{v}%</div>
                      <Progress value={v} tone={scoreTone(v)} className="mt-2" />
                      <div className="mt-2 flex items-center justify-between"><Badge tone={levelTone(lv)}>{lv}</Badge><button className="text-xs text-primary hover:underline" onClick={() => setResFor(k)}>Resources</button></div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <IntroCard />

            <InsightsCard items={[
              { text: <>Your strongest soft skill is <b>{sorted[0].k}</b> ({sorted[0].v}%). The one to practise most is <b>{sorted[sorted.length - 1].k}</b> ({sorted[sorted.length - 1].v}%).</>, tone: 'good' as const },
              ...rows.filter((x) => x.v < x.avg - 5).slice(0, 3).map((x) => ({ text: <><b>{x.k}</b> is {x.avg - x.v} points below the cohort average. {SKILL_RESOURCES[x.k][skillLevel(x.v).toLowerCase() as 'beginner'][0]} is a good place to start.</>, tone: 'warn' as const })),
            ]} />

            {sjt && <SJTModal current={s.skills.soft} onClose={() => setSjt(false)} />}
            <Modal open={!!resFor} onClose={() => setResFor(null)} title={`Suggested resources · ${resFor}`}>
              {resFor && (() => {
                const cur = s.skills.soft[resFor]
                const lv = skillLevel(cur)
                const list = SKILL_RESOURCES[resFor][lv.toLowerCase() as 'beginner']
                return <><p className="mb-3 text-sm text-muted-foreground">You are at <b>{lv}</b> level ({cur}%). Suggested next steps:</p><ul className="list-disc space-y-1.5 pl-5 text-sm">{list.map((x) => <li key={x}>{x}</li>)}</ul></>
              })()}
            </Modal>
          </>
        )
      }}
    </WithData>
  )
}

/* ---------------------- situational judgment test (soft) ------------------- */
function SJTModal({ current, onClose }: { current: Record<SoftSkill, number>; onClose: () => void }) {
  const { studentId } = useStudent()
  const toast = useToast()
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<(number | null)[]>(SJT.map(() => null))
  const [res, setRes] = useState<Partial<Record<SoftSkill, number>> | null>(null)

  const finish = async () => {
    const sums: Record<string, number[]> = {}
    SJT.forEach((sc, k) => { (sums[sc.skill] ??= []).push(sc.options[picked[k]!].score) })
    const scores: Partial<Record<SoftSkill, number>> = {}
    SOFT.forEach((k) => { const arr = sums[k]; if (arr) scores[k] = Math.round((current[k] + arr.reduce((a, b) => a + b, 0) / arr.length) / 2) })
    await saveSoftSkills(studentId, scores)
    toast.success('Soft-skill scores updated')
    setRes(scores)
  }
  const sc = SJT[i]
  return (
    <Modal open onClose={onClose} title="Situational judgment test" wide>
      {res ? (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">Your soft-skill scores (averaged with your previous scores):</p>
          <div className="space-y-3">{SOFT.map((k) => <div key={k}><div className="mb-1 flex justify-between text-sm"><span>{k}</span><b>{current[k]}% → {res[k]}%</b></div><Progress value={res[k] ?? 0} tone={scoreTone(res[k] ?? 0)} /></div>)}</div>
          <div className="mt-4 flex justify-end"><Button onClick={onClose}>Done</Button></div>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between text-sm"><Badge tone="primary">{sc.skill}</Badge><span>Scenario {i + 1} / {SJT.length}</span></div>
          <Progress value={((i + 1) / SJT.length) * 100} tone="primary" />
          <p className="mt-4 font-medium">{sc.scenario}</p>
          <p className="mt-1 text-xs text-muted-foreground">Choose the response that is closest to what you would really do.</p>
          <div className="mt-3 space-y-2">{sc.options.map((o, k) => (
            <button key={k} onClick={() => setPicked((a) => a.map((x, j) => (j === i ? k : x)))} className={cn('w-full rounded-xl border p-3 text-left text-sm transition', picked[i] === k ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted')}>{o.text}</button>))}</div>
          <div className="mt-5 flex justify-between">
            <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
            {i < SJT.length - 1 ? <Button disabled={picked[i] === null} onClick={() => setI(i + 1)}>Next</Button> : <Button disabled={picked.some((p) => p === null)} onClick={finish}>Submit</Button>}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* --------------------------- video introduction (beta) --------------------- */
function IntroCard() {
  const { student, studentId } = useStudent()
  const toast = useToast()
  const speech = useSpeech()
  const cam = useCamera()
  const [recording, setRecording] = useState(false)
  const [secs, setSecs] = useState(0)
  const [busy, setBusy] = useState(false)
  const startedAt = useRef(0)
  const prev = student?.skills.introScore

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => { const e = Math.round((Date.now() - startedAt.current) / 1000); setSecs(e); if (e >= 60) stop() }, 500)
    return () => clearInterval(t)
  }) // eslint-disable-line

  const begin = async () => {
    if (!cam.on) await cam.start()
    speech.reset(); speech.start(); startedAt.current = Date.now(); setSecs(0); setRecording(true)
  }
  const stop = async () => {
    if (!recording) return
    setRecording(false); speech.stop(); cam.stop(); setBusy(true)
    const text = speech.final.trim()
    const elapsed = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
    if (text.split(/\s+/).length < 8) { setBusy(false); toast.error('Not enough speech was captured. Try again in a quiet place and speak clearly.'); return }
    const r = await scoreIntroduction(text, elapsed)
    await saveIntro(studentId, { date: TODAY, score: r.score, feedback: r.feedback })
    setBusy(false); toast.success(`Communication score: ${r.score}/100`)
  }

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5" />Video Introduction <Badge tone="primary">Beta</Badge></CardTitle><CardDescription>Record a 1-minute self-introduction. Video is only previewed; the speech transcript is sent to the AI service for a communication score.</CardDescription></CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="aspect-video overflow-hidden rounded-xl bg-muted">
              {cam.on ? <video ref={cam.videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Camera className="h-8 w-8" /></div>}
            </div>
            <div className="mt-3 flex items-center gap-3">
              {!recording ? <Button onClick={begin} disabled={!speech.supported || busy}><Mic className="h-4 w-4" />Start recording</Button> : <Button variant="danger" onClick={stop}><Square className="h-4 w-4" />Stop &amp; score</Button>}
              {recording && <span className="font-mono text-sm">{String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')} / 01:00</span>}
              {busy && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Scoring…</span>}
            </div>
            {!speech.supported && <p className="mt-2 text-xs text-amber-600">Speech recognition isn't supported in this browser — try Chrome or Edge.</p>}
            {cam.error && <p className="mt-2 text-xs text-red-600">{cam.error}</p>}
          </div>
          <div className="space-y-3">
            <div className="min-h-[96px] rounded-xl bg-muted/60 p-3 text-sm"><div className="mb-1 text-xs font-medium text-muted-foreground">Live transcript</div>{speech.final || speech.interim ? <>{speech.final}<span className="italic text-muted-foreground">{speech.interim}</span></> : <span className="text-muted-foreground">Your words will appear here. Cover: who you are, what you study, a project or skill, and your goal.</span>}</div>
            {prev && <div className={cn('rounded-xl border p-3 text-sm', TONE[scoreTone(prev.score)].border, TONE[scoreTone(prev.score)].bg)}><b>Last score: {prev.score}/100</b><p className="mt-1 text-muted-foreground">{prev.feedback}</p></div>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
