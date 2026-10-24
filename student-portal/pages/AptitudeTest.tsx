import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Flag, Lightbulb, Play, XCircle } from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Badge } from '@student/components/ui/badge'
import { BottomSheet, Modal, useToast } from '@student/components/ui/misc'
import { ChartCard, InsightsCard, PageHeader, TopbarTimer, WithData, tooltipStyle } from '@student/components/common'
import { buildTest, PATTERNS, type TestPattern } from '@student/data/questions'
import { saveAptitudeAttempt } from '@student/services/api'
import { useStudent } from '@student/hooks/useStudent'
import { TODAY } from '@student/data/students'
import { cn, fmtDate, scoreTone, TONE } from '@student/lib/utils'
import type { AptitudeSection } from '@student/types'

type Q = ReturnType<typeof buildTest>[number]
interface Result { pattern: TestPattern; questions: Q[]; answers: (number | null)[]; sections: Record<AptitudeSection, { score: number; total: number }>; percent: number; secs: number }

export default function AptitudeTest() {
  const [pattern, setPattern] = useState<TestPattern | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  return (
    <WithData>
      {({ student: s }) => (
        <>
          <PageHeader title="Aptitude Test" description="Timed company-pattern practice tests: Quantitative, Logical Reasoning and Verbal." />
          {pattern ? (
            <TestRunner pattern={pattern} onDone={(r) => { setResult(r); setPattern(null) }} onExit={() => setPattern(null)} />
          ) : result ? (
            <ResultView r={result} onBack={() => setResult(null)} />
          ) : (
            <>
              <div className="mb-3 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">These are <b>original practice questions</b> written in the typical style of each company's test. They are "pattern" tests, not official company questions.</div>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {PATTERNS.map((p) => {
                  const n = Object.values(p.counts).reduce((a, b) => a + b, 0)
                  return (
                    <Card key={p.id} className="flex flex-col p-5">
                      <Badge tone="primary" className="w-fit">Pattern</Badge>
                      <div className="mt-3 text-lg font-bold">{p.name}</div>
                      <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.blurb}</p>
                      <div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span>{n} questions</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.minutes} min</span></div>
                      <Button className="mt-4" onClick={() => setPattern(p)}><Play className="h-4 w-4" />Start test</Button>
                    </Card>
                  )
                })}
              </div>
              <ScoreChart attempts={s.placement.aptitude} />
              <InsightsCard items={(() => {
                const a = [...s.placement.aptitude].sort((x, y) => x.date.localeCompare(y.date))
                if (!a.length) return [{ text: 'Take your first test to see your trend. A General Practice test is the quickest warm-up.' }]
                const last = a[a.length - 1]
                const secs = Object.entries(last.sections).map(([k, v]) => ({ k, p: Math.round((v.score / v.total) * 100) })).sort((x, y) => x.p - y.p)
                return [
                  { text: <>Your latest score is <b>{last.totalPercent}%</b> ({last.pattern}){a.length > 1 && <> — {last.totalPercent >= a[a.length - 2].totalPercent ? 'up' : 'down'} from {a[a.length - 2].totalPercent}% last time</>}. The latest attempt feeds your Placement readiness and Home score.</>, tone: scoreTone(last.totalPercent) },
                  { text: <>Weakest section: <b>{secs[0].k}</b> ({secs[0].p}%). Practise 20 questions a day and read every explanation.</>, tone: scoreTone(secs[0].p) },
                ]
              })()} />
            </>
          )}
        </>
      )}
    </WithData>
  )
}

function ScoreChart({ attempts }: { attempts: { id: string; date: string; totalPercent: number; pattern: string }[] }) {
  const data = [...attempts].sort((a, b) => a.date.localeCompare(b.date)).map((a, i) => ({ n: `#${i + 1}`, Score: a.totalPercent, pattern: a.pattern, date: fmtDate(a.date) }))
  if (!data.length) return null
  return (
    <ChartCard title="Score over attempts" description="Your total aptitude score for every attempt" height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 16, top: 10, bottom: 18 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="n" label={{ value: 'Attempt', position: 'insideBottom', offset: -12, fontSize: 11 }} />
          <YAxis domain={[0, 100]} label={{ value: 'Score %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v ?? 0)}%`, 'Score']} labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.pattern} · ${p[0].payload.date}` : '')} />
          <Line dataKey="Score" stroke="var(--chart-primary)" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function TestRunner({ pattern, onDone, onExit }: { pattern: TestPattern; onDone: (r: Result) => void; onExit: () => void }) {
  const { studentId } = useStudent()
  const toast = useToast()
  const questions = useMemo(() => buildTest(pattern), [pattern])
  const total = pattern.minutes * 60
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null))
  const [marked, setMarked] = useState<boolean[]>(() => questions.map(() => false))
  const [visited, setVisited] = useState<boolean[]>(() => questions.map((_, i) => i === 0))
  const [left, setLeft] = useState(total)
  const [confirm, setConfirm] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [exit, setExit] = useState(false)
  const startRef = useRef(Date.now())
  const doneRef = useRef(false)

  const submit = useCallback(async () => {
    if (doneRef.current) return
    doneRef.current = true
    const sections = {} as Result['sections']
    questions.forEach((q, i) => {
      sections[q.section] ??= { score: 0, total: 0 }
      sections[q.section].total++
      if (answers[i] === q.answer) sections[q.section].score++
    })
    const sc = Object.values(sections).reduce((a, v) => a + v.score, 0)
    const percent = Math.round((sc / questions.length) * 100)
    const secs = Math.min(total, Math.round((Date.now() - startRef.current) / 1000))
    await saveAptitudeAttempt(studentId, { pattern: pattern.name, date: TODAY, sections, totalPercent: percent, timeTakenSec: secs })
    toast.success(`Test submitted — you scored ${percent}%`)
    onDone({ pattern, questions, answers, sections, percent, secs })
  }, [answers, questions, pattern, studentId, toast, total, onDone])

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, total - Math.round((Date.now() - startRef.current) / 1000))), 500)
    return () => clearInterval(t)
  }, [total])
  useEffect(() => { if (left === 0) submit() }, [left, submit])

  const go = (i: number) => { setIdx(i); setVisited((v) => v.map((x, k) => (k === i ? true : x))) }
  const q = questions[idx]
  const answered = answers.filter((a) => a !== null).length
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0')

  const palette = (
      <Card className="h-fit shadow-none lg:shadow-soft">
        <CardHeader><CardTitle>Question palette</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-2">
            {questions.map((_, i) => {
              const st = marked[i] ? 'bg-brand-500 text-white' : answers[i] !== null ? 'bg-green-500 text-white' : visited[i] ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-muted text-muted-foreground'
              return <button key={i} onClick={() => go(i)} aria-label={`Question ${i + 1}`} className={cn('aspect-square rounded-lg text-xs font-semibold transition', st, i === idx && 'ring-2 ring-primary ring-offset-2 ring-offset-card')}>{i + 1}</button>
            })}
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            {[['bg-green-500', 'Answered'], ['bg-red-200', 'Not answered'], ['bg-brand-500', 'Marked for review'], ['bg-muted', 'Not visited']].map(([c, l]) => <div key={l} className="flex items-center gap-2"><span className={cn('h-3 w-3 rounded', c)} />{l}</div>)}
          </div>
          <div className="mt-4 text-sm"><b>{answered}</b> of {questions.length} answered</div>
          <Button className="mt-3 w-full" onClick={() => setConfirm(true)}>Submit test</Button>
          <Button className="mt-2 w-full" variant="ghost" onClick={() => setExit(true)}>Exit without saving</Button>
        </CardContent>
      </Card>
  )
  return (
    <div className="grid gap-4 pb-16 lg:pb-0 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>{pattern.name}</CardTitle><CardDescription>Question {idx + 1} of {questions.length} · <Badge tone="primary">{q.section}</Badge></CardDescription></div>
          <TopbarTimer left={left} />
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-base font-medium">{q.q}</p>
          <div className="space-y-2" role="radiogroup" aria-label="Options">
            {q.options.map((o, i) => (
              <button key={i} role="radio" aria-checked={answers[idx] === i} onClick={() => setAnswers((a) => a.map((x, k) => (k === idx ? i : x)))}
                className={cn('flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition', answers[idx] === i ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted')}>
                <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold', answers[idx] === i ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{String.fromCharCode(65 + i)}</span>{o}
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" disabled={idx === 0} onClick={() => go(idx - 1)}><ArrowLeft className="h-4 w-4" />Previous</Button>
              <Button variant="outline" disabled={idx === questions.length - 1} onClick={() => go(idx + 1)}>Next<ArrowRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-2">
              <Button variant={marked[idx] ? 'soft' : 'ghost'} onClick={() => setMarked((m) => m.map((x, k) => (k === idx ? !x : x)))}><Flag className="h-4 w-4" />{marked[idx] ? 'Marked' : 'Mark for review'}</Button>
              <Button variant="ghost" onClick={() => setAnswers((a) => a.map((x, k) => (k === idx ? null : x)))}>Clear</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="hidden lg:block">{palette}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 lg:hidden">
        <span className="text-sm"><b>{answered}</b> answered</span>
        <Button variant="outline" size="sm" onClick={() => setSheet(true)}>Questions</Button>
        <Button size="sm" onClick={() => setConfirm(true)}>Submit</Button>
      </div>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Question palette">{palette}</BottomSheet>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Submit test?">
        <p className="text-sm text-muted-foreground">You have answered <b>{answered}</b> of {questions.length} questions{marked.some(Boolean) && <> and <b>{marked.filter(Boolean).length}</b> are marked for review</>}. You can't change answers after submitting.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirm(false)}>Keep working</Button><Button onClick={submit}>Yes, submit</Button></div>
      </Modal>
      <Modal open={exit} onClose={() => setExit(false)} title="Exit the test?">
        <p className="text-sm text-muted-foreground">Your answers will be discarded and no attempt will be saved.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setExit(false)}>Continue test</Button><Button variant="danger" onClick={onExit}>Exit</Button></div>
      </Modal>
    </div>
  )
}

function ResultView({ r, onBack }: { r: Result; onBack: () => void }) {
  const tone = scoreTone(r.percent)
  const correct = r.questions.filter((q, i) => r.answers[i] === q.answer).length
  return (
    <>
      <Button variant="outline" className="mb-4" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back to tests</Button>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card className="p-5"><div className="text-xs text-muted-foreground">Total score</div><div className={cn('text-4xl font-bold', TONE[tone].text)}>{r.percent}%</div><div className="text-xs text-muted-foreground">{correct}/{r.questions.length} correct · {r.pattern.name}</div></Card>
        {Object.entries(r.sections).map(([k, v]) => {
          const p = Math.round((v.score / v.total) * 100)
          return <Card key={k} className="p-5"><div className="text-xs text-muted-foreground">{k}</div><div className={cn('text-2xl font-bold', TONE[scoreTone(p)].text)}>{v.score}/{v.total}</div><div className="text-xs text-muted-foreground">{p}%</div></Card>
        })}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Time taken: <b>{Math.floor(r.secs / 60)}m {r.secs % 60}s</b> of {r.pattern.minutes}m. This attempt has been saved and now counts toward your Placement readiness.</p>
      <Card>
        <CardHeader><CardTitle>Answer review</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {r.questions.map((q, i) => {
            const ok = r.answers[i] === q.answer
            const skipped = r.answers[i] === null
            return (
              <div key={i} className={cn('rounded-xl border p-4 text-sm', ok ? `${TONE.good.border} ${TONE.good.bg}` : `${TONE.bad.border} ${TONE.bad.bg}`)}>
                <div className="flex items-start gap-2">{ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}<div><span className="mr-2 text-xs text-muted-foreground">Q{i + 1} · {q.section}</span><b>{q.q}</b></div></div>
                <div className="mt-2 grid gap-1 pl-6 text-xs sm:grid-cols-2">
                  <div>Your answer: <b>{skipped ? 'Not answered' : q.options[r.answers[i]!]}</b></div>
                  <div>Correct answer: <b>{q.options[q.answer]}</b></div>
                </div>
                <p className="mt-2 pl-6 text-xs text-muted-foreground"><Lightbulb className="mr-1 inline h-3.5 w-3.5" />{q.explanation}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </>
  )
}
