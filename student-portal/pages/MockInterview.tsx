import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle, Award, Brain, CheckCircle2, ChevronLeft, ChevronRight, Clock, Lightbulb, Mic, MessageSquare, Play, Printer,
  RotateCcw, Square, Target, TrendingUp, Video, VideoOff, Loader2, Volume2,
} from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { Badge } from '@student/components/ui/badge'
import { Label, Progress, Select, Textarea, useToast } from '@student/components/ui/misc'
import { InsightsCard, PageHeader, WithData } from '@student/components/common'
import type { EvaluationResult } from '@/evaluation/types'
import { saveInterviewAttempt } from '@student/services/api'
import { useSpeech } from '@student/hooks/useSpeech'
import { useCamera } from '@student/hooks/useCamera'
import { useStudent } from '@student/hooks/useStudent'
import { TODAY } from '@student/data/students'
import { cn, fmtDate, scoreTone, TONE } from '@student/lib/utils'

/* ------------------------------ questions & scoring ------------------------------ */
// Rubrics, ideal answers and all scoring live on the server (evaluation/, /api/mock-interview/*).
// The browser only receives the question text and the evaluation result.
interface Question { id: string; category: string; question: string; maxMarks: number }
type AnswerResult = EvaluationResult & { question: string; answer: string }

const ROLES = ['Software Developer', 'Frontend Developer', 'Backend Developer', 'Data Analyst', 'Full Stack Developer', 'QA Engineer', 'General Graduate Role'] as const
type Role = (typeof ROLES)[number]
const CATEGORIES = ['Introduction', 'Technical Knowledge', 'Problem Solving', 'Communication', 'Behavioral']

/** 0 red, 1–4 orange, 5–7 yellow, 8–10 green (marks out of 10). */
function markStyle(marks: number, max: number) {
  const m = (marks / max) * 10
  if (m <= 0) return { badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300', bar: '#dc2626' }
  if (m < 5) return { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300', bar: '#ea580c' }
  if (m < 8) return { badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300', bar: '#ca8a04' }
  return { badge: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300', bar: '#16a34a' }
}
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/* ---------------------------------- page ---------------------------------- */
export default function MockInterview() {
  const { studentId, student } = useStudent()
  const toast = useToast()
  const [phase, setPhase] = useState<'setup' | 'ready' | 'interview' | 'results'>('setup')
  const [role, setRole] = useState<Role>('Software Developer')
  const [questions, setQuestions] = useState<Question[]>([])
  const [cur, setCur] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [results, setResults] = useState<AnswerResult[]>([])
  const [summary, setSummary] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [overall, setOverall] = useState<{ score: number; total: number; max: number; comm: number; tech: number; conf: number } | null>(null)

  const speech = useSpeech()
  const cam = useCamera()
  const prefix = useRef('')
  const startedAt = useRef(0)
  const frozenElapsed = useRef(0)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const interviewQuestionsRef = useRef<Question[]>([])
  const beginInterviewRef = useRef<() => void>(() => {})
  const [speakingQuestion, setSpeakingQuestion] = useState(false)
  const [speakingWelcome, setSpeakingWelcome] = useState(false)
  const [welcomeFinished, setWelcomeFinished] = useState(false)
  const [showQuestionText, setShowQuestionText] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const canReadAloud = typeof window !== 'undefined' && 'speechSynthesis' in window

  const readQuestionAloud = (question: Question, index: number) => {
    if (!canReadAloud) {
      setSpeechError('Question read-aloud is not supported in this browser. Use “Show question text” to read the question.')
      return
    }
    utteranceRef.current = null
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`Question ${index + 1}. ${question.category}. ${question.question}`)
    utterance.lang = 'en-IN'
    utterance.rate = 0.92
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === 'en-in') ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ?? null
    utterance.onstart = () => {
      if (utteranceRef.current === utterance) setSpeakingQuestion(true)
    }
    utterance.onend = () => {
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null
        setSpeakingQuestion(false)
      }
    }
    utterance.onerror = () => {
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null
        setSpeakingQuestion(false)
        setSpeechError('The question could not be read aloud. Use the replay button or “Show question text”.')
      }
    }
    utteranceRef.current = utterance
    setSpeechError('')
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
  }, [])

  useEffect(() => {
    if (phase !== 'interview') return
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 500)
    return () => clearInterval(t)
  }, [phase])

  const beginInterview = () => {
    const qs = interviewQuestionsRef.current
    if (!qs.length) return
    speech.stop()
    speech.reset()
    setQuestions(qs)
    setAnswers(qs.map(() => ''))
    setResults([])
    setOverall(null)
    setCur(0)
    startedAt.current = Date.now()
    setElapsed(0)
    setWelcomeFinished(false)
    setSpeakingWelcome(false)
    setPhase('interview')
    setShowQuestionText(false)
    readQuestionAloud(qs[0], 0)
    if (!cam.on) cam.start()
  }
  useEffect(() => {
    beginInterviewRef.current = beginInterview
  })

  // Use the spoken confirmation to start. Otherwise append recognised words to the current answer.
  useEffect(() => {
    if (!speech.listening) return
    if (phase === 'ready') {
      if (/\b(yes|yeah|yep|ready)\b/i.test(speech.final)) beginInterviewRef.current()
      return
    }
    if (phase !== 'interview') return
    setAnswers((a) => a.map((x, i) => (i === cur ? (prefix.current + ' ' + speech.final).trim() : x)))
  }, [speech.final, speech.listening, phase, cur])

  const start = async () => {
    let qs: Question[]
    setStarting(true)
    try {
      const res = await fetch(`/api/mock-interview/questions?role=${encodeURIComponent(role)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      qs = ((await res.json()) as { questions: Question[] }).questions
    } catch {
      setStarting(false)
      toast.error('Could not load the interview questions. Please try again.')
      return
    }
    setStarting(false)
    interviewQuestionsRef.current = qs
    speech.stop()
    speech.reset()
    window.speechSynthesis?.cancel()
    setSpeechError('')
    setWelcomeFinished(false)
    setSpeakingWelcome(false)
    setPhase('ready')
    if (!canReadAloud) {
      setWelcomeFinished(true)
      setSpeechError('Welcome read-aloud is not supported in this browser. You can still confirm you are ready below.')
      return
    }
    const welcome = new SpeechSynthesisUtterance(
      'Hello, I am your virtual machine AI interviewer. I am here to conduct your interview. Are you ready for the interview? Please say yes.',
    )
    welcome.lang = 'en-IN'
    welcome.rate = 0.92
    utteranceRef.current = welcome
    welcome.onstart = () => {
      if (utteranceRef.current === welcome) setSpeakingWelcome(true)
    }
    welcome.onend = () => {
      if (utteranceRef.current === welcome) {
        utteranceRef.current = null
        setSpeakingWelcome(false)
        setWelcomeFinished(true)
        if (speech.supported) {
          speech.reset()
          speech.start()
        }
      }
    }
    welcome.onerror = () => {
      if (utteranceRef.current === welcome) {
        utteranceRef.current = null
        setSpeakingWelcome(false)
        setWelcomeFinished(true)
        setSpeechError('The welcome could not be read aloud. Please confirm when you are ready using the button below.')
      }
    }
    window.speechSynthesis.speak(welcome)
  }

  const setAnswer = (v: string) => setAnswers((a) => a.map((x, i) => (i === cur ? v : x)))
  const goto = (i: number) => {
    speech.stop(); speech.reset()
    setCur(i)
    setShowQuestionText(false)
    const nextQuestion = questions[i]
    if (nextQuestion) readQuestionAloud(nextQuestion, i)
  }
  const toggleVoice = () => {
    if (speech.listening) { speech.stop(); return }
    prefix.current = answers[cur]; speech.reset(); speech.start()
  }

  const finish = async () => {
    speech.stop()
    utteranceRef.current = null
    window.speechSynthesis?.cancel()
    setSpeakingQuestion(false)
    setFinishing(true)
    frozenElapsed.current = Math.round((Date.now() - startedAt.current) / 1000)
    let evaluated: AnswerResult[]
    let total = 0, max = 0
    try {
      const res = await fetch('/api/mock-interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: questions.map((q, i) => ({ questionId: q.id, answer: answers[i] ?? '' })) }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { results: EvaluationResult[]; total: number; max: number }
      evaluated = data.results.map((r, i) => ({ ...r, question: questions[i].question, answer: answers[i]?.trim() || 'No answer submitted.' }))
      total = data.total; max = data.max
    } catch {
      setFinishing(false)
      toast.error('Could not evaluate your answers. Check your connection and press Finish again.')
      return
    }
    const byCat = (cats: string[]) => evaluated.filter((r) => cats.includes(r.category)).map((r) => pct(r.score, r.maxMarks))
    const clarity = evaluated.map((r) => pct(r.breakdown.clarity, r.maxMarks * 0.15))
    const o = { score: pct(total, max), total, max, tech: avg(byCat(['Technical Knowledge', 'Problem Solving'])), comm: avg(byCat(['Introduction', 'Communication'])), conf: avg(clarity) }
    const answeredCount = evaluated.filter((r) => r.answer !== 'No answer submitted.').length
    const relevantCount = evaluated.filter((r) => r.relevant).length
    const sum = `${role} interview: ${answeredCount}/${evaluated.length} answered, ${relevantCount} relevant. Score ${total}/${max} (${o.score}%).`
    await saveInterviewAttempt(studentId, { date: TODAY, type: role, difficulty: 'Standard', score: o.score, ratings: { communication: o.comm, technical: o.tech, confidence: o.conf }, feedback: sum })
    cam.stop(); setResults(evaluated); setOverall(o); setSummary(sum); setFinishing(false); setPhase('results')
    toast.success(`Interview saved — ${total}/${max}`)
  }

  const reset = () => {
    speech.stop(); speech.reset(); utteranceRef.current = null; window.speechSynthesis?.cancel()
    setSpeakingQuestion(false); setSpeakingWelcome(false); setWelcomeFinished(false); setSpeechError(''); cam.stop(); setPhase('setup')
  }
  const answered = answers.filter((a) => a.trim()).length
  const q = questions[cur]
  const hist = student ? [...student.placement.interviews].sort((a, b) => b.date.localeCompare(a.date)) : []

  return (
    <WithData>
      {() => (
        <>
          <PageHeader title="Mock Interview" description="Practise real interview questions by typing or speaking, then get a detailed report. Your best score feeds Placement readiness." />
          <div className="mb-4 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">Strict scoring: each answer is checked on the server for relevance first (off-topic, copied, gibberish or \"I don't know\" answers score 0), then marked against a rubric of required keywords and concepts. Practice only — not a hiring assessment.</div>

          {phase === 'setup' && (
            <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Set up your interview</CardTitle><CardDescription>5 questions · about 10 minutes · interviewing as {student?.name}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div><Label htmlFor="role">Target job role</Label><Select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</Select></div>
                  <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><Video className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>Interview questions are read aloud one at a time. Answer each with your voice or by typing. Your browser may ask for camera access when you start (optional, preview only — nothing is recorded).</p></div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={canReadAloud ? 'good' : 'warn'}>{canReadAloud ? 'Question read-aloud available' : 'Question read-aloud unsupported'}</Badge>
                    <Badge tone={speech.supported ? 'good' : 'warn'}>{speech.supported ? 'Voice input available' : 'Voice input unsupported here — use typing'}</Badge>
                  </div>
                  <Button size="lg" className="w-full" onClick={start} disabled={starting}>{starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Start mock interview<ChevronRight className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>                <CardTitle>Your interview plan</CardTitle><CardDescription>Questions are revealed and read aloud one at a time · Tailored to {role}</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {CATEGORIES.map((c, i) => ({ category: c })).map((x, i) => (
                    <div key={x.category} className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-sm font-semibold">{i + 1}</div><div><div className="text-sm font-semibold">{x.category}</div><div className="text-xs text-muted-foreground">One question · individual feedback</div></div></div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {phase === 'ready' && (
            <div className="mx-auto max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Your interviewer is ready</CardTitle>
                  <CardDescription>The interview will begin after you confirm you are ready.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-xl bg-muted/60 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Virtual machine AI interviewer</p>
                    <p className="mt-2 text-lg font-semibold leading-8">“Hello, I am your virtual machine AI interviewer. I am here to conduct your interview. Are you ready for the interview?”</p>
                  </div>
                  {speakingWelcome && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Volume2 className="h-4 w-4 animate-pulse text-primary" />The interviewer is speaking. Listen, then say “yes”.</p>}
                  {welcomeFinished && speech.listening && <p role="status" className="flex items-center gap-2 text-sm text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Listening for your confirmation… {speech.interim && <span className="italic text-muted-foreground">{speech.interim}</span>}</p>}
                  {welcomeFinished && speech.final && !/\b(yes|yeah|yep|ready)\b/i.test(speech.final) && <p className="text-sm text-muted-foreground">I heard “{speech.final.trim()}”. Please say “yes” when you are ready, or use the button below.</p>}
                  {speechError && <p role="status" className="flex items-start gap-2 text-sm text-amber-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{speechError}</p>}
                  <div className="flex flex-wrap gap-3">
                    {welcomeFinished && speech.supported && (
                      <Button variant={speech.listening ? 'outline' : 'primary'} onClick={() => {
                        if (speech.listening) {
                          speech.stop()
                        } else {
                          speech.reset()
                          speech.start()
                        }
                      }}>
                        <Mic className="h-4 w-4" />{speech.listening ? 'Stop listening' : 'Say yes to begin'}
                      </Button>
                    )}
                    <Button onClick={beginInterview} disabled={!welcomeFinished}>
                      <CheckCircle2 className="h-4 w-4" />I’m ready — start interview
                    </Button>
                    <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4" />Cancel</Button>
                  </div>
                  {!speech.supported && welcomeFinished && <p className="text-xs text-muted-foreground">Voice recognition is unavailable in this browser. Use the confirmation button to continue.</p>}
                </CardContent>
              </Card>
            </div>
          )}

          {phase === 'interview' && q && (
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <div><div className="text-sm font-bold">Interview in progress</div><div className="text-xs text-muted-foreground">{student?.name} · {role}</div></div>
                  <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold tabular-nums"><Clock className="h-4 w-4" />{fmt(elapsed)}</div>
                </div>
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-3 flex items-center justify-between"><Badge tone="primary">Question {cur + 1} of {questions.length}</Badge><span className="text-xs text-muted-foreground">{answered} answered</span></div>
                  <Progress value={((cur + 1) / questions.length) * 100} tone="primary" className="mb-5" />
                  <div className="mb-5 rounded-xl bg-muted/60 p-5">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">{q.category}</div>
                    <h2 className="text-xl font-bold leading-8">{showQuestionText ? q.question : 'Listen to your interviewer'}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => readQuestionAloud(q, cur)} disabled={!canReadAloud || speakingQuestion}>
                        <Volume2 className="h-4 w-4" />{speakingQuestion ? 'Reading question…' : 'Read question aloud'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowQuestionText((visible) => !visible)}>
                        {showQuestionText ? 'Hide question text' : 'Show question text'}
                      </Button>
                      {speakingQuestion && <span className="text-xs text-muted-foreground" role="status">Listen to the question, then record or type your answer.</span>}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Take a moment to think. Explain your reasoning and use an example where it helps.</p>
                  </div>
                  {speechError && <p role="status" className="mb-4 flex items-start gap-2 text-sm text-amber-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{speechError}</p>}
                  <div className="mb-2 flex items-center justify-between"><Label htmlFor="answer" className="mb-0 text-sm text-foreground">Your answer</Label><span className="text-xs text-muted-foreground">{(answers[cur] ?? '').trim().split(/\s+/).filter(Boolean).length} words · aim for 60–120</span></div>
                  <Textarea id="answer" rows={7} value={answers[cur] ?? ''} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer, or press “Answer by voice”…" className="leading-7" />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant={speech.listening ? 'danger' : 'primary'} onClick={toggleVoice} disabled={!speech.supported || speakingQuestion} title={!speech.supported ? 'Speech recognition is not supported in this browser' : speakingQuestion ? 'Wait until the question has finished' : ''}>
                      {speech.listening ? <><Square className="h-4 w-4" />Stop voice input</> : <><Mic className="h-4 w-4" />Answer by voice</>}
                    </Button>
                    <Button variant="outline" onClick={() => { speech.stop(); speech.reset(); setAnswer('') }}><RotateCcw className="h-4 w-4" />Clear</Button>
                  </div>
                  {speech.listening && <p className="mt-3 flex items-center gap-2 text-sm text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Listening… <span className="italic text-muted-foreground">{speech.interim}</span></p>}
                  {!speech.supported && <p className="mt-3 flex items-start gap-2 text-sm text-amber-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Speech-to-text isn't supported in this browser (try Chrome or Edge). You can type your answers.</p>}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                    <Button variant="outline" disabled={cur === 0} onClick={() => goto(cur - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button>
                    {cur < questions.length - 1 ? <Button onClick={() => goto(cur + 1)}>Next question<ChevronRight className="h-4 w-4" /></Button>
                      : <Button className="bg-green-600 hover:bg-green-700" onClick={finish} disabled={finishing}>{finishing ? <><Loader2 className="h-4 w-4 animate-spin" />Evaluating…</> : <><CheckCircle2 className="h-4 w-4" />Finish and view report</>}</Button>}
                  </div>
                  {answered < questions.length && cur === questions.length - 1 && <p className="mt-2 text-right text-xs text-amber-600">{questions.length - answered} question(s) are still unanswered and will score 0.</p>}
                </CardContent>
              </Card>

              <aside className="space-y-5">
                <div className="overflow-hidden rounded-xl bg-brand-950 p-4 text-white shadow-soft">
                  <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">Camera preview</span><span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', cam.on ? 'bg-green-400/15 text-green-300' : 'bg-white/10 text-slate-300')}>{cam.on ? 'Live' : 'Off'}</span></div>
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-800">
                    {cam.on ? <video ref={cam.videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <div className="grid h-full place-items-center text-slate-400"><div className="flex flex-col items-center gap-2"><VideoOff className="h-8 w-8" /><span className="text-sm">Camera is off</span></div></div>}
                  </div>
                  {cam.error && <p className="mt-2 text-xs text-amber-300">{cam.error}</p>}
                  <button onClick={cam.on ? cam.stop : cam.start} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15">{cam.on ? <><VideoOff className="h-4 w-4" />Turn camera off</> : <><Video className="h-4 w-4" />Turn camera on</>}</button>
                </div>
                <Card>
                  <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {questions.map((x, i) => {
                      const done = Boolean(answers[i]?.trim())
                      return (
                        <button key={x.category} onClick={() => goto(i)} className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition', i === cur ? 'border-primary/40 bg-primary/10' : 'border-transparent bg-muted/50 hover:border-border')}>
                          <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold', done ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : i === cur ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}>{done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}</div>
                          <div className="min-w-0"><div className="text-sm font-semibold">{x.category}</div><div className="text-xs text-muted-foreground">{done ? 'Answer added' : 'Not answered yet'}</div></div>
                        </button>
                      )
                    })}
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}

          {phase === 'results' && overall && (
            <div className="space-y-6">
              <section className="rounded-xl bg-brand-950 p-6 text-white sm:p-8">
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-300"><CheckCircle2 className="h-4 w-4" />INTERVIEW COMPLETED</div>
                    <h2 className="text-3xl font-bold">Your practice report</h2>
                    <p className="mt-2 max-w-xl text-sm text-slate-300">{summary} This attempt is saved to your history and counts toward Placement readiness.</p>
                  </div>
                  <div className="flex items-center gap-5 rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="grid h-24 w-24 place-items-center rounded-full border-4" style={{ borderColor: markStyle(overall.total, overall.max).bar }}><div className="text-center"><div className="text-2xl font-bold">{overall.total}/{overall.max}</div><div className="text-[10px] uppercase tracking-wider text-slate-300">{overall.score}%</div></div></div>
                    <div><div className="text-lg font-bold">{overall.score >= 80 ? 'Great practice!' : overall.score >= 60 ? 'Good progress' : overall.score >= 35 ? 'Keep improving' : 'More practice needed'}</div><div className="mt-1 text-xs text-slate-400">Time: {fmt(frozenElapsed.current)}</div></div>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-3">
                {[['Communication', overall.comm, MessageSquare], ['Technical accuracy', overall.tech, Brain], ['Confidence / clarity', overall.conf, Target]].map(([l, v, Icon]: any) => (
                  <Card key={l} className="p-5"><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{l}</div><div className={cn('text-3xl font-bold', TONE[scoreTone(v)].text)}>{v}<span className="text-base text-muted-foreground">/100</span></div><Progress value={v} tone={scoreTone(v)} className="mt-3" /></Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <CardHeader><CardTitle>Score by category</CardTitle><CardDescription>Marks earned out of marks available</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {results.map((r) => (
                      <div key={r.questionId}>
                        <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{r.category}</span><span className="tabular-nums text-muted-foreground">{r.score}/{r.maxMarks}</span></div>
                        <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct(r.score, r.maxMarks)}%`, background: markStyle(r.score, r.maxMarks).bar }} /></div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Strengths and areas to improve</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div><div className="mb-1 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-green-500" />Strengths</div>
                      <ul className="list-disc space-y-1 pl-5">{results.filter((r) => pct(r.score, r.maxMarks) >= 70).map((r) => <li key={r.questionId}>{r.category}: {r.score}/{r.maxMarks}</li>)}{!results.some((r) => pct(r.score, r.maxMarks) >= 70) && <li>No category reached 70% yet — focus on answering the question directly.</li>}</ul></div>
                    <div><div className="mb-1 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-amber-500" />Areas to improve</div>
                      <ul className="list-disc space-y-1 pl-5">{results.filter((r) => pct(r.score, r.maxMarks) < 70).map((r) => <li key={r.questionId}>{r.category}: {r.relevant ? r.improvedAnswerHint : r.reason}</li>)}{!results.some((r) => pct(r.score, r.maxMarks) < 70) && <li>Try a harder role next time.</li>}</ul></div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Question-by-question feedback</CardTitle><CardDescription>Your answer, marks, matched and missing keywords, and what a strong answer covers</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  {results.map((r, i) => (
                    <article key={r.questionId} className="rounded-xl border border-border p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex flex-1 items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{i + 1}</div><div><div className="text-xs font-bold uppercase tracking-wider text-primary">{r.category}</div><h4 className="mt-1 font-semibold leading-6">{r.question}</h4></div></div>
                        <div className={cn('min-w-20 rounded-xl px-4 py-2 text-center', markStyle(r.score, r.maxMarks).badge)}><div className="text-2xl font-bold">{r.score}</div><div className="text-xs opacity-80">/ {r.maxMarks}</div></div>
                      </div>
                      <div className="mt-4 rounded-xl bg-muted/60 p-4"><div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Your answer</div><p className="whitespace-pre-wrap text-sm leading-6">{r.answer}</p></div>
                      {!r.relevant ? (
                        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">Irrelevant answer: 0 marks. {r.reason.replace(/^Irrelevant answer:\s*/, '')}</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                          {([['Required keywords', r.breakdown.mustHave, 0.4], ['Good-to-have', r.breakdown.goodToHave, 0.15], ['Concept coverage', r.breakdown.concepts, 0.3], ['Clarity', r.breakdown.clarity, 0.15]] as const).map(([l, v, w]) => (
                            <div key={l} className="rounded-lg bg-muted/60 p-2"><div className="font-semibold tabular-nums">{v.toFixed(1)} / {(r.maxMarks * w).toFixed(1)}</div><div className="text-muted-foreground">{l}</div></div>
                          ))}
                        </div>
                      )}
                      {r.relevant && r.status === 'identity-only' && <p className="mt-2 text-sm text-amber-700">{r.reason}</p>}
                      {(r.matchedKeywords.length > 0 || r.missingKeywords.length > 0) && r.relevant && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {r.matchedKeywords.map((k) => <span key={'m' + k} className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/20 dark:text-green-300">✓ {k}</span>)}
                          {r.missingKeywords.map((k) => <span key={'x' + k} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">{k}</span>)}
                        </div>
                      )}
                      {r.incorrectClaims.length > 0 && <p className="mt-3 flex items-start gap-2 text-sm text-red-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{r.incorrectClaims.join(' ')}</p>}
                      <p className="mt-3 text-sm text-muted-foreground"><b className="text-foreground">Feedback:</b> {r.feedback}</p>
                      {r.improvedAnswerHint && <p className="mt-1 text-sm text-muted-foreground"><b className="text-foreground">Hint:</b> {r.improvedAnswerHint}</p>}
                      <details className="mt-3 text-sm"><summary className="flex cursor-pointer items-center gap-2 font-medium text-primary"><Lightbulb className="h-4 w-4" />Sample strong answer</summary><p className="mt-2 pl-6 text-muted-foreground">{r.sampleIdealAnswer}</p></details>
                    </article>
                  ))}
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-3 print:hidden">
                <Button onClick={reset}><RotateCcw className="h-4 w-4" />Try another interview</Button>
                <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / save report</Button>
              </div>
            </div>
          )}

          <Card className="mt-6">
            <CardHeader><CardTitle>Interview history</CardTitle><CardDescription>Best score: {hist.length ? Math.max(...hist.map((h) => h.score)) : '—'}</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              {hist.length === 0 ? <p className="text-sm text-muted-foreground">No interviews yet.</p> : (
                <table className="data-table w-full min-w-[520px] text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Date</th><th>Type</th><th>Comm.</th><th>Technical</th><th>Confidence</th><th className="text-right">Score</th></tr></thead>
                  <tbody>{hist.map((h) => (<tr key={h.id} className="border-b border-border last:border-0"><td className="py-2.5">{fmtDate(h.date)}</td><td>{h.type} · {h.difficulty}</td><td>{h.ratings.communication}</td><td>{h.ratings.technical}</td><td>{h.ratings.confidence}</td><td className={cn('text-right font-semibold', TONE[scoreTone(h.score)].text)}>{h.score}</td></tr>))}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <InsightsCard items={hist.length ? [
            { text: <>Your best mock interview score is <b>{Math.max(...hist.map((h) => h.score))}</b>/100 — it counts for 25% of Placement readiness.</>, tone: scoreTone(Math.max(...hist.map((h) => h.score))) },
            { text: hist[0].feedback },
            { text: 'Re-attempt weekly. Structure answers as situation → action → result, and add one concrete example to each.' },
          ] : [{ text: 'Take your first mock interview — even a rough attempt gives you a baseline score.' }]} />
        </>
      )}
    </WithData>
  )
}
