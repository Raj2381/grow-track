import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { sql as sqlLanguage } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronLeft, Clock,
  Code2, Coffee, Database, FileCode2, Play, RotateCcw,
  RefreshCw, Send, Terminal, XCircle,
} from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { InsightsCard, PageHeader, WithData } from '@student/components/common'
import { LANGUAGE_META, CODING_QUESTIONS, type Difficulty } from '@student/data/codingQuestions'
import { bestByLanguage, CODING_LANGUAGES } from '@student/lib/coding'
import { codingChallenges, findCodingChallenge, type CodingLanguage as ExecutableLanguage } from '@/lib/coding-challenges'
import { gradeSql } from '@student/services/sql'
import { saveCodingAttempt } from '@student/services/api'
import { useStudent } from '@student/hooks/useStudent'
import { TODAY } from '@student/data/students'
import { cn, fmtDate, scoreTone, TONE } from '@student/lib/utils'
import type { CodingAttempt, CodingLanguage } from '@student/types'

type Filter = 'All' | Difficulty
type SupportedLanguage = CodingLanguage
type TestCaseResult = { passed: boolean; actual: string; expected: string }
type RunResult = {
  results: TestCaseResult[]
  compileOutput: string
  runtimeOutput: string
  errorLine?: number
}
type SqlChallenge = {
  id: string
  title: string
  difficulty: Difficulty
  topic: string
  question: string
  expectedQuery: string
  explanation: string
  examples: { input: string; output: string; explanation: string }[]
  testCount: number
}

const TIME_LIMIT = 900
const LANG_ICON = { Java: Coffee, Python: FileCode2, C: Code2, SQL: Database } as const
const EDITOR_LANGUAGE: Record<SupportedLanguage, ExecutableLanguage | 'sql'> = {
  Java: 'java', Python: 'python', C: 'c', SQL: 'sql',
}
const templates: Record<SupportedLanguage, string> = {
  Java: `import java.util.*;\n\nclass Solution {\n    public int[] pairSumIndices(int[] values, int target) {\n        // Return the two indices whose values add up to target.\n        return new int[] {-1, -1};\n    }\n}`,
  Python: `def pair_sum_indices(values, target):\n    # Return the two indices whose values add up to target.\n    return [-1, -1]`,
  C: `#include <stddef.h>\n\nvoid pairSumIndices(const int values[], int length, int target, int answer[2]) {\n    // Store the two matching indices in answer[0] and answer[1].\n    answer[0] = -1;\n    answer[1] = -1;\n}`,
  SQL: `-- Return the names of CSE students with CGPA above 8,\n-- ordered from highest CGPA to lowest.\nSELECT name\nFROM students\nWHERE dept = 'CSE' AND cgpa > 8\nORDER BY cgpa DESC;`,
}

const executableLanguage = (language: SupportedLanguage): ExecutableLanguage => EDITOR_LANGUAGE[language] as ExecutableLanguage
const sqlChallenges: SqlChallenge[] = CODING_QUESTIONS
  .filter((q) => q.language === 'SQL' && q.type === 'sql_query' && q.expectedQuery)
  .map((q) => ({
    id: q.id, title: q.topic, difficulty: q.difficulty, topic: q.topic, question: q.question,
    expectedQuery: q.expectedQuery!, explanation: q.explanation,
    examples: [{ input: 'students table', output: q.expectedQuery!, explanation: q.explanation }],
    testCount: 1,
  }))

const codeChallenges = codingChallenges
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

function lineFromError(output: string) {
  const match = output.match(/(?:line\s+|:)(\d+)(?::\d+)?/i)
  return match ? Number(match[1]) : undefined
}

function starterCode(language: SupportedLanguage, challengeId: string) {
  const challenge = codeChallenges.find((item) => item.id === challengeId)
  if (language === 'SQL') {
    const sqlChallenge = sqlChallenges.find((item) => item.id === challengeId)
    return sqlChallenge?.expectedQuery ?? templates.SQL
  }
  if (!challenge) return templates[language]
  const name = challenge.functionNames[language === 'Python' ? 'python' : language === 'Java' ? 'java' : 'c']
  if (challenge.kind === 'two-sum') return templates[language]
  if (['sum-array', 'max-element'].includes(challenge.kind)) {
    return language === 'Python'
      ? `def ${name}(values):\n    # Return the requested value from the array.\n    return 0`
      : language === 'Java'
        ? `class Solution {\n    public int ${name}(int[] values) {\n        // Return the requested value from the array.\n        return 0;\n    }\n}`
        : `int ${name}(const int values[], int length) {\n    // Return the requested value from the array.\n    return 0;\n}`
  }
  if (challenge.kind === 'reverse-string') {
    return language === 'Python'
      ? `def ${name}(text):\n    # Return the requested text transformation.\n    return text`
      : language === 'Java'
        ? `class Solution {\n    public String ${name}(String text) {\n        // Return the requested text transformation.\n        return text;\n    }\n}`
        : `#include <string.h>\n\nvoid ${name}(const char *text, char *answer, int capacity) {\n    // Return the requested text transformation in answer.\n    strncpy(answer, text, capacity - 1);\n    answer[capacity - 1] = '\\0';\n}`
  }
  return language === 'Python'
    ? `def ${name}(text):\n    # Return the requested boolean or count.\n    return False`
    : language === 'Java'
      ? `class Solution {\n    public ${challenge.kind === 'count-vowels' ? 'int' : 'boolean'} ${name}(String text) {\n        // Return the requested boolean or count.\n        return ${challenge.kind === 'count-vowels' ? '0' : 'false'};\n    }\n}`
      : `#include <stdbool.h>\n\n${challenge.kind === 'count-vowels' ? 'int' : 'bool'} ${name}(const char *text) {\n    // Return the requested boolean or count.\n    return ${challenge.kind === 'count-vowels' ? '0' : 'false'};\n}`
}

function pickChallenges(language: SupportedLanguage, filter: Filter) {
  const pool = language === 'SQL'
    ? sqlChallenges.filter((challenge) => filter === 'All' || challenge.difficulty === filter)
    : codeChallenges.filter((challenge) => filter === 'All' || challenge.difficulty === filter)
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 2)
}

function refreshChallenges(
  language: SupportedLanguage,
  filter: Filter,
  current: { id: string }[],
) {
  const next = pickChallenges(language, filter)
  if (next.length <= 1 || current.length === 0) return next
  const currentIds = new Set(current.map((challenge) => challenge.id))
  if (next.some((challenge) => !currentIds.has(challenge.id))) return next

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rerolled = pickChallenges(language, filter)
    if (rerolled.some((challenge) => !currentIds.has(challenge.id))) return rerolled
  }
  return next
}

export default function CodingTest() {
  const [selection, setSelection] = useState<{ language: SupportedLanguage; challengeId: string; id: number } | null>(null)
  const [summary, setSummary] = useState<AttemptSummary | null>(null)
  return (
    <WithData>
      {({ student, base }) => (
        <>
          <PageHeader title="Coding Test" description="Solve real coding problems in a language-aware editor, run test cases, and review every result."
            actions={<Link to={`${base}/skills`}><Button variant="outline"><ArrowLeft className="h-4 w-4" />Back to Skills</Button></Link>} />
          {selection
            ? <Runner key={selection.id} language={selection.language} challengeId={selection.challengeId} onDone={(result) => { setSummary(result); setSelection(null) }} onExit={() => setSelection(null)} />
            : summary
              ? <ResultView summary={summary} onBack={() => setSummary(null)} onRetake={() => { setSelection({ ...summary.selection, id: Date.now() }); setSummary(null) }} />
              : <Select attempts={student.skills.codingAttempts} onStart={(language, challengeId) => setSelection({ language, challengeId, id: Date.now() })} />}
        </>
      )}
    </WithData>
  )
}

function Select({ attempts, onStart }: { attempts: CodingAttempt[]; onStart: (language: SupportedLanguage, challengeId: string) => void }) {
  const [language, setLanguage] = useState<SupportedLanguage>('Python')
  const [filter, setFilter] = useState<Filter>('All')
  const best = bestByLanguage(attempts, true)
  const [challenges, setChallenges] = useState(() => pickChallenges(language, filter))
  const changeLanguage = (next: SupportedLanguage) => {
    setLanguage(next)
    setChallenges(pickChallenges(next, filter))
  }
  const changeFilter = (next: Filter) => {
    setFilter(next)
    setChallenges(pickChallenges(language, next))
  }
  const refresh = () => setChallenges((current) => refreshChallenges(language, filter, current))
  const sorted = [...attempts].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Difficulty:</span>
        <div className="inline-flex gap-1 rounded-xl bg-muted p-1">
          {(['All', 'Easy', 'Medium', 'Hard'] as Filter[]).map((item) => (
            <button key={item} onClick={() => changeFilter(item)} className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium transition', filter === item ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{item}</button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Write, run, and submit complete solutions. Every test case is evaluated.</span>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CODING_LANGUAGES.map((item) => {
          const Icon = LANG_ICON[item]
          const active = item === language
          return (
            <button key={item} onClick={() => changeLanguage(item)} className="text-left">
              <Card className={cn('h-full overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-400', active && 'border-brand-500 ring-2 ring-brand-100')}>
                <div className="flex items-center gap-3 border-b border-border p-5">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-800 dark:text-brand-100"><Icon className="h-6 w-6" /></div>
                  <div><div className="text-lg font-semibold">{LANGUAGE_META[item].label}</div><div className="text-xs text-muted-foreground">{LANGUAGE_META[item].blurb}</div></div>
                </div>
                <CardContent className="grid grid-cols-2 gap-2 p-5 text-center text-sm">
                  <div><div className="text-lg font-bold">{item === 'SQL' ? sqlChallenges.length : codeChallenges.length}</div><div className="text-xs text-muted-foreground">problems</div></div>
                  <div><div className={cn('text-lg font-bold', best[item] !== undefined && TONE[scoreTone(best[item]!)].text)}>{best[item] !== undefined ? `${best[item]}%` : '—'}</div><div className="text-xs text-muted-foreground">best score</div></div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{LANGUAGE_META[language].label} problems</CardTitle>
              <CardDescription>Select a problem to open the full coding workspace.</CardDescription>
            </div>
            <Button variant="outline" onClick={refresh} aria-label="Refresh coding questions">
              <RefreshCw className="h-4 w-4" />Refresh questions
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {challenges.map((challenge) => (
            <div key={challenge.id} className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{challenge.title}</p><p className="mt-1 text-xs text-muted-foreground">{challenge.difficulty} · {'testCount' in challenge ? challenge.testCount : challenge.tests.length} hidden test cases</p></div><span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">{challenge.topic}</span></div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{'question' in challenge ? challenge.question : challenge.description}</p>
              <Button className="mt-4 w-full" onClick={() => onStart(language, challenge.id)}><Code2 className="h-4 w-4" />Open coding workspace</Button>
            </div>
          ))}
        </CardContent>
      </Card>
      {sorted.length > 0 && <Card className="mb-6"><CardHeader><CardTitle>Recent attempts</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="data-table w-full min-w-[540px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Date</th><th>Language</th><th>Difficulty</th><th>Tests</th><th className="text-right">Score</th></tr></thead><tbody>{sorted.slice(0, 8).map((attempt) => <tr key={attempt.id} className="border-b border-border last:border-0"><td className="py-2.5">{fmtDate(attempt.date)}</td><td>{attempt.language}</td><td>{attempt.difficulty}</td><td>{attempt.correct}/{attempt.questionCount}</td><td className={cn('text-right font-semibold', TONE[scoreTone(attempt.score)].text)}>{attempt.score}%</td></tr>)}</tbody></table></CardContent></Card>}
      <InsightsCard items={[{ text: 'Your best score in each language updates the Technical Skills profile and placement readiness.' }, { text: 'Run your solution before submitting to catch compile errors and failing test cases early.' }]} />
    </>
  )
}

type AttemptSummary = {
  selection: { language: SupportedLanguage; challengeId: string }
  score: number
  passed: number
  total: number
  results: TestCaseResult[]
  duration: number
  compileOutput: string
  runtimeOutput: string
  errorLine?: number
}

function Runner({ language, challengeId, onDone, onExit }: { language: SupportedLanguage; challengeId: string; onDone: (summary: AttemptSummary) => void; onExit: () => void }) {
  const { studentId } = useStudent()
  const sqlChallenge = language === 'SQL' ? sqlChallenges.find((item) => item.id === challengeId)! : null
  const codeChallenge = language === 'SQL' ? null : findCodingChallenge(challengeId)!
  const challenge = (sqlChallenge ?? codeChallenge)!
  const [source, setSource] = useState(() => starterCode(language, challengeId))
  const [left, setLeft] = useState(TIME_LIMIT)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const sourceLines = source.split('\n')

  const execute = useCallback(async (): Promise<RunResult> => {
    setBusy(true); setRunResult(null)
    try {
      if (language === 'SQL') {
        const result = await gradeSql(source, sqlChallenge!.expectedQuery)
        const runResult = { results: [{ passed: result.correct, actual: result.message, expected: 'Expected result set' }], compileOutput: '', runtimeOutput: result.message }
        setRunResult(runResult)
        return runResult
      } else {
        const response = await fetch('/api/code-execution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: executableLanguage(language), challengeId, source }) })
        const payload = await response.json() as { error?: string; stdout?: string; stderr?: string; compileOutput?: string; results?: TestCaseResult[] }
        if (!response.ok) throw new Error(payload.error ?? 'The code runner could not be reached.')
        const results = payload.results ?? []
        if (!results.length) {
          throw new Error(payload.compileOutput || payload.stderr || 'The runner did not return test results. Check the function name and signature.')
        }
        const compileOutput = payload.compileOutput ?? ''
        const runtimeOutput = payload.stderr?.includes('__CAMPUSIQ_CASE__:') ? '' : payload.stderr ?? ''
        const runResult = { results, compileOutput, runtimeOutput, errorLine: lineFromError(compileOutput || runtimeOutput) }
        setRunResult(runResult)
        return runResult
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The solution could not be executed.'
      const reportedLine = lineFromError(message)
      const runResult = { results: [], compileOutput: message, runtimeOutput: '', errorLine: reportedLine && reportedLine <= source.split('\n').length ? reportedLine : undefined }
      setRunResult(runResult)
      return runResult
    } finally { setBusy(false) }
  }, [challengeId, language, source, sqlChallenge])

  const submit = async () => {
    if (busy || submitted) return
    const result = await execute()
    const results = result?.results ?? []
    if (!results.length) return
    const passed = results.filter((item) => item.passed).length
    const total = results.length
    const score = Math.round((passed / total) * 100)
    const topics = { [sqlChallenge?.topic ?? codeChallenge!.title]: { correct: passed, total } }
    await saveCodingAttempt(studentId, { language, date: TODAY, difficulty: challenge.difficulty, score, questionCount: total, correct: passed, wrong: total - passed, skipped: 0, timeTakenSec: Math.min(TIME_LIMIT, Math.round((Date.now() - startedAt) / 1000)), topicScores: topics })
    setSubmitted(true)
    onDone({ selection: { language, challengeId }, score, passed, total, results, duration: Math.round((Date.now() - startedAt) / 1000), compileOutput: result.compileOutput, runtimeOutput: result.runtimeOutput, errorLine: result.errorLine })
  }

  useEffect(() => { const timer = window.setInterval(() => setLeft(Math.max(0, TIME_LIMIT - Math.round((Date.now() - startedAt) / 1000))), 500); return () => window.clearInterval(timer) }, [startedAt])
  // The timeout is an external clock event; submitting at zero is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (left === 0 && !submitted) void submit() }, [left, submitted]) // eslint-disable-line react-hooks/exhaustive-deps

  const extensions = language === 'Java' ? [java()] : language === 'Python' ? [python()] : language === 'C' ? [cpp()] : [sqlLanguage()]
  const isCompileError = Boolean(runResult?.compileOutput && !runResult.results.length)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onExit}><ChevronLeft className="h-4 w-4" />Problems</Button>
        <div className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold', left < 60 ? 'border-red-200 bg-red-50 text-red-700' : 'border-border bg-card')}><Clock className="h-4 w-4" />{formatTime(left)}</div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)]">
        <Card className="min-w-0"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>{challenge.title}</CardTitle><CardDescription>{challenge.difficulty} · {language === 'SQL' ? sqlChallenge!.topic : codeChallenge!.title}</CardDescription></div><span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{LANGUAGE_META[language].label}</span></div></CardHeader><CardContent className="space-y-5">
          <div className="prose prose-sm max-w-none text-foreground"><p>{language === 'SQL' ? sqlChallenge!.question : codeChallenge!.description}</p></div>
          <div><h3 className="mb-2 text-sm font-semibold">Examples</h3><div className="space-y-2">{challenge.examples.map((example) => <div key={example.input} className="rounded-lg bg-muted/50 p-3 text-xs"><div><b>Input:</b> {example.input}</div><div className="mt-1"><b>Expected:</b> {example.output}</div><div className="mt-1 text-muted-foreground">{example.explanation}</div></div>)}</div></div>
          <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 text-xs text-brand-900"><b>How it works:</b> Your code is compiled and run against hidden tests. Fix compile/runtime errors before submitting; the editor reports the relevant line when the runner provides one.</div>
        </CardContent></Card>
        <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b border-border bg-[#182b3b] text-white"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2 text-white"><Terminal className="h-4 w-4" />{LANGUAGE_META[language].label} editor</CardTitle><span className="text-xs text-white/70">{sourceLines.length} lines</span></div></CardHeader><CardContent className="bg-[#0f1b25] p-0">
          <CodeMirror value={source} onChange={setSource} extensions={extensions} theme={oneDark} minHeight="430px" basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true, highlightActiveLine: true }} />
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#182b3b] p-3"><Button onClick={() => void execute()} disabled={busy || submitted}><Play className="h-4 w-4" />{busy ? 'Running…' : 'Run tests'}</Button><Button variant="soft" onClick={() => { setSource(starterCode(language, challengeId)); setRunResult(null) }} disabled={busy || submitted}><RotateCcw className="h-4 w-4" />Reset code</Button><Button className="ml-auto" onClick={() => void submit()} disabled={busy || submitted}><Send className="h-4 w-4" />Submit solution</Button></div>
        </CardContent></Card>
      </div>
      {runResult && <RunFeedback result={runResult} isCompileError={isCompileError} sourceLines={sourceLines} />}
    </div>
  )
}

function RunFeedback({ result, isCompileError, sourceLines }: { result: RunResult; isCompileError: boolean; sourceLines: string[] }) {
  return <Card className="border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2">{isCompileError ? <XCircle className="h-5 w-5 text-red-600" /> : result.results.every((item) => item.passed) ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}{isCompileError ? 'Code error' : `${result.results.filter((item) => item.passed).length}/${result.results.length} test cases passed`}</CardTitle><CardDescription>{result.errorLine ? `The runner reported a problem near line ${result.errorLine}.` : 'Review the output below and update your solution.'}</CardDescription></CardHeader><CardContent className="space-y-3">
    {result.errorLine && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><b>Line {result.errorLine}:</b> {sourceLines[result.errorLine - 1] ?? 'The reported line is outside the editor.'}</div>}
    {isCompileError && result.compileOutput && <pre className="overflow-x-auto rounded-lg bg-red-950 p-3 text-xs text-red-100">{result.compileOutput}</pre>}
    {result.runtimeOutput && <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{result.runtimeOutput}</pre>}
    {!isCompileError && <div className="grid gap-2 sm:grid-cols-2">{result.results.map((item, index) => <div key={index} className={cn('rounded-lg border p-3 text-sm', item.passed ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-900')}><div className="flex items-center gap-2 font-semibold">{item.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}Test case {index + 1}</div><div className="mt-1 text-xs">Expected: {item.expected}</div><div className="mt-1 text-xs">Actual: {item.actual}</div></div>)}</div>}
  </CardContent></Card>
}

function ResultView({ summary, onBack, onRetake }: { summary: AttemptSummary; onBack: () => void; onRetake: () => void }) {
  return <div className="space-y-5"><Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6"><div><p className="text-sm text-muted-foreground">{LANGUAGE_META[summary.selection.language].label} · {summary.selection.challengeId}</p><h2 className="mt-1 text-3xl font-bold">{summary.score}%</h2><p className="mt-1 text-sm text-muted-foreground">{summary.passed} of {summary.total} test cases passed in {formatTime(summary.duration)}.</p></div><div className="flex gap-2"><Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4" />All problems</Button><Button onClick={onRetake}><RotateCcw className="h-4 w-4" />Try again</Button></div></CardContent></Card><RunFeedback result={{ results: summary.results, compileOutput: summary.compileOutput, runtimeOutput: summary.runtimeOutput, errorLine: summary.errorLine }} isCompileError={Boolean(summary.compileOutput && !summary.results.length)} sourceLines={[]} /></div>
}
