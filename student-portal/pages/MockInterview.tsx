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
import { aiIsLive, evaluateInterview } from '@student/services/ai'
import { saveInterviewAttempt } from '@student/services/api'
import { useSpeech } from '@student/hooks/useSpeech'
import { useCamera } from '@student/hooks/useCamera'
import { useStudent } from '@student/hooks/useStudent'
import { TODAY } from '@student/data/students'
import { cn, fmtDate, scoreTone, TONE } from '@student/lib/utils'

/* ------------------------------ question bank ------------------------------ */
interface Question { category: string; question: string; keywords: string[]; idealPoints: string[] }

const ROLES = ['Software Developer', 'Frontend Developer', 'Backend Developer', 'Data Analyst', 'Full Stack Developer', 'QA Engineer', 'General Graduate Role'] as const
type Role = (typeof ROLES)[number]

const TECH_BY_ROLE: Record<Role, Question> = {
  'Software Developer': { category: 'Technical Knowledge', question: 'Explain the difference between an array and a linked list. When would you use each?',
    keywords: ['array', 'linked list', 'memory', 'index', 'insertion', 'deletion', 'access', 'pointer'],
    idealPoints: ['Arrays use indexed, contiguous storage', 'Linked lists connect nodes using references', 'Arrays give fast indexed access (O(1))', 'Linked lists allow cheap insertion/deletion when the node is known'] },
  'Frontend Developer': { category: 'Technical Knowledge', question: 'What is the difference between state and props in React, and when would you lift state up?',
    keywords: ['state', 'props', 'component', 'parent', 'child', 'immutable', 'rerender', 'lift'],
    idealPoints: ['Props are read-only inputs from a parent', 'State is data owned and updated by a component', 'Changing state triggers a re-render', 'Lift state to the nearest common parent when siblings share data'] },
  'Backend Developer': { category: 'Technical Knowledge', question: 'Explain how REST APIs work and the difference between PUT and PATCH.',
    keywords: ['http', 'resource', 'get', 'post', 'put', 'patch', 'stateless', 'status code', 'idempotent'],
    idealPoints: ['REST models resources with URLs and HTTP verbs', 'It is stateless', 'PUT replaces a resource, PATCH updates part of it', 'PUT is idempotent; status codes communicate results'] },
  'Data Analyst': { category: 'Technical Knowledge', question: 'Explain the difference between INNER JOIN and LEFT JOIN with an example.',
    keywords: ['inner', 'left', 'join', 'table', 'match', 'null', 'rows', 'key'],
    idealPoints: ['INNER JOIN returns only matching rows', 'LEFT JOIN keeps all rows from the left table', 'Unmatched right-side columns become NULL', 'Give a concrete example such as customers and orders'] },
  'Full Stack Developer': { category: 'Technical Knowledge', question: 'Walk me through what happens from the moment a user clicks "Submit" on a form to the data being saved.',
    keywords: ['request', 'api', 'server', 'database', 'validation', 'response', 'frontend', 'http'],
    idealPoints: ['Client-side validation and the HTTP request', 'Server routing and server-side validation', 'Database write', 'Response and UI update, including error handling'] },
  'QA Engineer': { category: 'Technical Knowledge', question: 'What is the difference between unit, integration and end-to-end testing?',
    keywords: ['unit', 'integration', 'end-to-end', 'test', 'module', 'automation', 'scope', 'bug'],
    idealPoints: ['Unit tests check small isolated pieces', 'Integration tests check modules working together', 'End-to-end tests simulate real user flows', 'Cost and speed trade-offs between them'] },
  'General Graduate Role': { category: 'Technical Knowledge', question: 'Describe a tool or technology you learned recently and how you picked it up.',
    keywords: ['learn', 'tutorial', 'practice', 'project', 'documentation', 'used', 'tool', 'improve'],
    idealPoints: ['Name the tool and why you needed it', 'Explain your learning approach', 'Describe something you built or used it for', 'Reflect on what you would do next'] },
}

function questionsFor(role: Role): Question[] {
  return [
    { category: 'Introduction', question: 'Tell me about yourself, your education, and the kind of role you are looking for.',
      keywords: ['education', 'project', 'skill', 'experience', 'goal', 'role', 'learn', 'interest'],
      idealPoints: ['A clear educational background', 'Relevant skills', 'A project, achievement or experience', 'A career goal connected to the role'] },
    TECH_BY_ROLE[role],
    { category: 'Problem Solving', question: 'Describe a challenging problem you faced in a project. How did you solve it?',
      keywords: ['problem', 'challenge', 'solution', 'debug', 'analyze', 'result', 'tested', 'team'],
      idealPoints: ['A specific problem and its context', 'Steps taken to investigate', 'Reasoning behind the chosen solution', 'Outcome and lesson learned'] },
    { category: 'Communication', question: 'How would you explain a complex technical concept to a non-technical team member?',
      keywords: ['simple', 'example', 'analogy', 'understand', 'audience', 'feedback', 'explain', 'jargon'],
      idealPoints: ['Use plain language', 'Give an example or analogy', 'Avoid unnecessary jargon', 'Check understanding and invite questions'] },
    { category: 'Behavioral', question: 'Tell me about a time you worked in a team. What was your contribution, and what did you learn?',
      keywords: ['team', 'collaborate', 'responsibility', 'contribution', 'communication', 'result', 'learned', 'helped'],
      idealPoints: ['The team goal and situation', 'Your individual contribution', 'Communication and collaboration', 'Outcome and what you learned'] },
  ]
}

/* -------------------------------- evaluation -------------------------------- */
interface AnswerResult { question: string; category: string; answer: string; score: number; feedback: string; strengths: string[]; improvements: string[]; idealPoints: string[]; comm: number; tech: number; conf: number }
const FILLERS = /\b(um+|uh+|like|basically|actually|you know|kind of|sort of)\b/gi
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/** Rule-based practice scoring: relevance (keywords), depth (length), structure, examples, filler words. */
function evaluateAnswer(q: Question, raw: string): AnswerResult {
  const answer = raw.trim()
  const lc = answer.toLowerCase()
  const words = lc.match(/\b[\w'-]+\b/g) ?? []
  const matched = q.keywords.filter((k) => lc.includes(k.toLowerCase()))
  const relevance = Math.min(matched.length / q.keywords.length * 1.6, 1)
  const hasStructure = /\b(first|second|third|finally|because|therefore|as a result|step|then|however|so that)\b/.test(lc)
  const hasExample = /\b(for example|for instance|such as|project|when i|in my|i built|i used|i led)\b/.test(lc)
  const hasResult = /\b(result|outcome|improved|reduced|increased|learned|achieved|delivered)\b/.test(lc)
  const fillers = answer.match(FILLERS)?.length ?? 0
  // depth peaks between 50 and 160 words, tapering for rambling answers
  const depth = words.length < 50 ? words.length / 50 : words.length <= 160 ? 1 : Math.max(0.7, 1 - (words.length - 160) / 400)

  let score = Math.round(10 + relevance * 40 + depth * 20 + (hasStructure ? 8 : 0) + (hasExample ? 12 : 0) + (hasResult ? 10 : 0) - Math.min(10, fillers * 2))
  if (words.length < 8) score = Math.min(score, 20)
  if (words.length >= 25 && matched.length >= 2) score = Math.max(score, 50)
  score = clamp(score)

  const strengths: string[] = [], improvements: string[] = []
  if (words.length >= 40) strengths.push('You gave a developed, reasonably detailed response.'); else improvements.push('Expand with more specifics — aim for roughly 60–120 words (4–6 sentences).')
  if (matched.length >= 3) strengths.push(`You covered key ideas: ${matched.slice(0, 4).join(', ')}.`)
  else improvements.push(`Address the core concepts directly (e.g. ${q.keywords.filter((k) => !matched.includes(k)).slice(0, 3).join(', ')}).`)
  if (hasExample) strengths.push('You grounded the answer in an example or project.'); else improvements.push('Add a real example from a project, class or experience.')
  if (hasStructure) strengths.push('Your answer was organised with clear connecting words.'); else improvements.push('Structure it: situation → action → result.')
  if (hasResult) strengths.push('You mentioned an outcome or lesson learned.')
  if (fillers > 2) improvements.push(`You used ${fillers} filler words (um, like, basically) — pause instead.`)

  const feedback = score >= 80 ? 'Strong answer. Keep backing points with specific evidence.' : score >= 60 ? 'Good start. Add precision and explain your reasoning to make it stand out.'
    : score >= 35 ? 'You addressed part of the question. Focus on the main concepts and develop your explanation.' : 'Try again with a fuller answer: explain your approach and include at least one relevant detail or example.'

  return {
    question: q.question, category: q.category, answer: answer || 'No answer submitted.', score, feedback,
    strengths: strengths.slice(0, 3), improvements: improvements.slice(0, 3), idealPoints: q.idealPoints,
    tech: clamp(Math.round(25 + relevance * 65 + (words.length >= 30 ? 8 : 0))),
    comm: clamp(Math.round(30 + depth * 30 + (hasStructure ? 15 : 0) + (hasExample ? 15 : 0) - Math.min(15, fillers * 3))),
    conf: clamp(Math.round(40 + depth * 30 + (/(not sure|i don't know|maybe i)/.test(lc) ? -15 : 10) - Math.min(15, fillers * 4) + (hasResult ? 8 : 0))),
  }
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/* ---------------------------------- page ---------------------------------- */
export default function MockInterview() {
  const { studentId, student } = useStudent()
  const toast = useToast()
  const [phase, setPhase] = useState<'setup' | 'ready' | 'interview' | 'results'>('setup')
  const [role, setRole] = useState<Role>('Software Developer')
  const [questions, setQuestions] = useState<Question[]>(() => questionsFor('Software Developer'))
  const [cur, setCur] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [results, setResults] = useState<AnswerResult[]>([])
  const [summary, setSummary] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [overall, setOverall] = useState<{ score: number; comm: number; tech: number; conf: number } | null>(null)

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
    const qs = questionsFor(role)
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
    const evaluated = questions.map((q, i) => evaluateAnswer(q, answers[i] ?? ''))
    const mean = (f: (r: AnswerResult) => number) => Math.round(evaluated.reduce((a, r) => a + f(r), 0) / evaluated.length)
    let o = { score: mean((r) => r.score), comm: mean((r) => r.comm), tech: mean((r) => r.tech), conf: mean((r) => r.conf) }
    let sum = `${role} interview: ${evaluated.filter((r) => r.answer !== 'No answer submitted.').length}/${evaluated.length} answered, average ${o.score}/100.`
    if (aiIsLive) { // live model overrides the rule-based overall scores when a key is configured
      const ev = await evaluateInterview(questions.map((q, i) => ({ question: q.question, answer: answers[i] || '(no answer)' })), 'Mixed', 'Medium')
      o = { score: ev.overall, comm: ev.communication, tech: ev.technical, conf: ev.confidence }; sum = ev.summary
    }
    await saveInterviewAttempt(studentId, { date: TODAY, type: role, difficulty: 'Standard', score: o.score, ratings: { communication: o.comm, technical: o.tech, confidence: o.conf }, feedback: sum })
    cam.stop(); setResults(evaluated); setOverall(o); setSummary(sum); setFinishing(false); setPhase('results')
    toast.success(`Interview saved — score ${o.score}/100`)
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
          {!aiIsLive && <div className="mb-4 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">Practice mode: answers are scored by built-in rules (relevance, depth, structure, examples, filler words) — not an LLM or a hiring assessment.</div>}

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
                  <Button size="lg" className="w-full" onClick={start}><Play className="h-4 w-4" />Start mock interview<ChevronRight className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>                <CardTitle>Your interview plan</CardTitle><CardDescription>Questions are revealed and read aloud one at a time · Tailored to {role}</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {questionsFor(role).map((x, i) => (
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
                    <div className="grid h-24 w-24 place-items-center rounded-full border-4" style={{ borderColor: TONE[scoreTone(overall.score)].hex }}><div className="text-center"><div className="text-3xl font-bold">{overall.score}</div><div className="text-[10px] uppercase tracking-wider text-slate-300">out of 100</div></div></div>
                    <div><div className="text-lg font-bold">{overall.score >= 80 ? 'Great practice!' : overall.score >= 60 ? 'Good progress' : overall.score >= 35 ? 'Keep improving' : 'More practice needed'}</div><div className="mt-1 text-xs text-slate-400">Time: {fmt(frozenElapsed.current)}</div></div>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-3">
                {[['Communication', overall.comm, MessageSquare], ['Technical accuracy', overall.tech, Brain], ['Confidence / clarity', overall.conf, Target]].map(([l, v, Icon]: any) => (
                  <Card key={l} className="p-5"><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{l}</div><div className={cn('text-3xl font-bold', TONE[scoreTone(v)].text)}>{v}<span className="text-base text-muted-foreground">/100</span></div><Progress value={v} tone={scoreTone(v)} className="mt-3" /></Card>
                ))}
              </div>

              <Card>
                <CardHeader><CardTitle>Question-by-question feedback</CardTitle><CardDescription>Your answer, score, strengths and what a strong answer covers</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  {results.map((r, i) => (
                    <article key={r.category} className="rounded-xl border border-border p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex flex-1 items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{i + 1}</div><div><div className="text-xs font-bold uppercase tracking-wider text-primary">{r.category}</div><h4 className="mt-1 font-semibold leading-6">{r.question}</h4></div></div>
                        <div className={cn('min-w-20 rounded-xl px-4 py-2 text-center', TONE[scoreTone(r.score)].bg)}><div className={cn('text-2xl font-bold', TONE[scoreTone(r.score)].text)}>{r.score}</div><div className="text-xs text-muted-foreground">/ 100</div></div>
                      </div>
                      <div className="mt-4 rounded-xl bg-muted/60 p-4"><div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Your answer</div><p className="whitespace-pre-wrap text-sm leading-6">{r.answer}</p></div>
                      <p className="mt-3 text-sm text-muted-foreground"><b className="text-foreground">Feedback:</b> {r.feedback}</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className={cn('rounded-xl border p-4', TONE.good.border, TONE.good.bg)}><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-green-500" />Strengths</div><ul className="list-disc space-y-1 pl-5 text-sm">{r.strengths.length ? r.strengths.map((s) => <li key={s}>{s}</li>) : <li>Keep practising — every attempt builds confidence.</li>}</ul></div>
                        <div className={cn('rounded-xl border p-4', TONE.warn.border, TONE.warn.bg)}><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-amber-500" />Improve next time</div><ul className="list-disc space-y-1 pl-5 text-sm">{r.improvements.length ? r.improvements.map((s) => <li key={s}>{s}</li>) : <li>Try the same question with a tougher follow-up.</li>}</ul></div>
                      </div>
                      <details className="mt-3 text-sm"><summary className="flex cursor-pointer items-center gap-2 font-medium text-primary"><Lightbulb className="h-4 w-4" />What a strong answer covers</summary><ul className="mt-2 list-disc space-y-1 pl-9 text-muted-foreground">{r.idealPoints.map((p) => <li key={p}>{p}</li>)}</ul></details>
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
