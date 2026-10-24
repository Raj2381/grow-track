import { useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Clock3, EyeOff, MessageSquare, Plus, Search,
  ShieldCheck, Star, UserRound,
} from 'lucide-react'
import { Lock } from 'lucide-react'
import { useFeedbackWindow } from '@student/hooks/useFeedbackWindow'
import { Skeleton } from '@student/components/ui/misc'
import { Badge } from '@student/components/ui/badge'
import { Button } from '@student/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { PageHeader } from '@student/components/common'
import { useStudent } from '@student/hooks/useStudent'
import { useLocalFeedback } from '@student/hooks/useLocalFeedback'
import { subjectsOfSemester } from '@student/data/catalog'
import { saveLocalFeedback, type FacultyCriterion, type LocalFeedbackEntry } from '@student/services/localFeedback'
import { cn, fmtDate } from '@student/lib/utils'

type View = 'overview' | 'submit' | 'history' | 'faculty' | 'detail'
type GeneralDraft = {
  category: string
  feedbackType: string
  facultyName: string
  rating: number
  title: string
  description: string
  experienceDate: string
  isAnonymous: boolean
}

const CATEGORIES = ['Teaching', 'Course content', 'Facilities', 'Library', 'Technology', 'Student support', 'Other']
const FEEDBACK_TYPES = ['Suggestion', 'Concern', 'Appreciation', 'Question']
const CRITERIA: { key: FacultyCriterion; label: string }[] = [
  { key: 'clarity', label: 'Clarity of explanation' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'doubtSolving', label: 'Doubt solving' },
  { key: 'engagement', label: 'Class engagement' },
]
const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
const referenceCode = () => `GT-${Date.now().toString(36).toUpperCase()}`
const controlClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40'
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Feedback could not be saved. Please try again.'

function Rating({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (rating: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          onClick={() => onChange(rating)}
          className="rounded p-1 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Star className={cn('h-6 w-6', rating <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
        </button>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: LocalFeedbackEntry['status'] }) {
  const tone = status === 'Resolved' ? 'good' : status === 'Under Review' ? 'warn' : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}

function feedbackEntry(
  studentId: string,
  values: Pick<LocalFeedbackEntry, 'kind' | 'category' | 'feedbackType' | 'title' | 'description' | 'experienceDate' | 'isAnonymous' | 'rating' | 'facultyName' | 'subjectCode' | 'criteria'>,
): LocalFeedbackEntry {
  const code = referenceCode()
  return {
    ...values,
    id: `${code}-${Math.random().toString(36).slice(2, 8)}`,
    studentId,
    referenceCode: code,
    status: 'Submitted',
    createdAt: new Date().toISOString(),
  }
}

function FeedbackContent({ banner }: { banner?: string }) {
  const { student, studentId } = useStudent()
  const { items, error, loading, refresh } = useLocalFeedback(studentId)
  const [view, setView] = useState<View>('overview')
  const [selected, setSelected] = useState<LocalFeedbackEntry | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')

  const generalItems = useMemo(() => items.filter((item) => item.kind === 'general'), [items])
  const facultyItems = useMemo(() => items.filter((item) => item.kind === 'faculty-evaluation'), [items])
  const categories = useMemo(() => [...new Set(generalItems.map((item) => item.category))].sort(), [generalItems])
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return generalItems.filter((item) => {
      const matchesQuery = !query || `${item.title} ${item.description} ${item.referenceCode}`.toLowerCase().includes(query)
      return matchesQuery && (!categoryFilter || item.category === categoryFilter) && (!statusFilter || item.status === statusFilter)
    })
  }, [categoryFilter, generalItems, search, statusFilter])
  const average = items.length ? items.reduce((sum, item) => sum + item.rating, 0) / items.length : null
  const subjects = student ? subjectsOfSemester(student.semester, student.branchCode) : []

  const save = (entry: LocalFeedbackEntry) => {
    try {
      saveLocalFeedback(entry)
      setNotice(`Saved in this browser. Reference: ${entry.referenceCode}`)
      setSaveError('')
      setView('overview')
    } catch (cause) {
      setSaveError(errorMessage(cause))
    }
  }

  const openDetail = (entry: LocalFeedbackEntry) => {
    setSelected(entry)
    setView('detail')
  }

  const pageTitle =
    view === 'submit' ? 'Submit feedback' :
      view === 'history' ? 'My feedback history' :
        view === 'faculty' ? 'Faculty evaluation' :
          view === 'detail' ? 'Feedback details' : 'Student feedback'

  return (
    <div className="space-y-6">
      {banner && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[15px] font-medium text-green-900">{banner}</div>}
      <PageHeader
        title={pageTitle}
        description="Share your experience, rate your courses and teachers, and keep track of your submissions."
        actions={
          <div className="flex flex-wrap gap-2">
            {view !== 'overview' && (
              <Button variant="outline" onClick={() => { setView('overview'); setNotice(''); setSaveError('') }}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Overview
              </Button>
            )}
            {(view === 'overview' || view === 'history') && (
              <Button onClick={() => { setView('submit'); setNotice(''); setSaveError('') }}>
                <Plus className="mr-2 h-4 w-4" /> Submit feedback
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-3" role="tablist" aria-label="Feedback sections">
        {([
          ['overview', 'Overview'],
          ['history', 'My feedback'],
          ['faculty', 'Faculty evaluation'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab || (view === 'detail' && tab === 'history')}
            onClick={() => { setView(tab); setNotice(''); setSaveError('') }}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              view === tab || (view === 'detail' && tab === 'history')
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" onClick={refresh}>Try again</Button>
        </div>
      )}
      {saveError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{saveError}</p>}
      {notice && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{notice}</p>}

      {view === 'overview' && (
        <Overview
          items={items}
          generalItems={generalItems}
          facultyItems={facultyItems}
          average={average}
          loading={loading}
          onSubmit={() => { setView('submit'); setNotice(''); setSaveError('') }}
          onFaculty={() => { setView('faculty'); setNotice(''); setSaveError('') }}
          onHistory={() => setView('history')}
          onDetail={openDetail}
        />
      )}
      {view === 'submit' && <GeneralFeedbackForm studentId={studentId} onCancel={() => setView('overview')} onSave={save} />}
      {view === 'history' && (
        <History
          items={filteredItems}
          categories={categories}
          search={search}
          category={categoryFilter}
          status={statusFilter}
          loading={loading}
          onSearch={setSearch}
          onCategory={setCategoryFilter}
          onStatus={setStatusFilter}
          onDetail={openDetail}
        />
      )}
      {view === 'faculty' && (
        <FacultyEvaluation
          studentId={studentId}
          subjects={subjects}
          evaluations={facultyItems}
          loading={loading}
          onSave={save}
          onDetail={openDetail}
        />
      )}
      {view === 'detail' && selected && <Details item={selected} onBack={() => setView(selected.kind === 'general' ? 'history' : 'faculty')} />}
    </div>
  )
}

function Overview({
  items, generalItems, facultyItems, average, loading, onSubmit, onFaculty, onHistory, onDetail,
}: {
  items: LocalFeedbackEntry[]
  generalItems: LocalFeedbackEntry[]
  facultyItems: LocalFeedbackEntry[]
  average: number | null
  loading: boolean
  onSubmit: () => void
  onFaculty: () => void
  onHistory: () => void
  onDetail: (item: LocalFeedbackEntry) => void
}) {
  const ratings = items.filter((item) => item.rating > 0)
  const resolved = items.filter((item) => item.status === 'Resolved').length
  const underReview = items.filter((item) => item.status === 'Under Review').length
  const categoryCounts = generalItems.reduce<Record<string, number>>((counts, item) => {
    counts[item.category] = (counts[item.category] ?? 0) + 1
    return counts
  }, {})

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Feedback submitted" value={loading ? '…' : String(items.length)} icon={<ClipboardList className="h-5 w-5" />} />
        <Stat label="Resolved" value={loading ? '…' : String(resolved)} icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat label="Under review" value={loading ? '…' : String(underReview)} icon={<Clock3 className="h-5 w-5" />} />
        <Stat label="Average rating" value={loading ? '…' : average === null ? '—' : `${average.toFixed(1)}/5`} icon={<Star className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Share your voice</CardTitle>
            <CardDescription>Help improve your student experience or share constructive feedback about your courses.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={onSubmit}><MessageSquare className="mr-2 h-4 w-4" /> Submit general feedback</Button>
            <Button variant="outline" onClick={onFaculty}><UserRound className="mr-2 h-4 w-4" /> Evaluate a faculty member</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Feedback by category</CardTitle>
            <CardDescription>{generalItems.length ? 'Your general feedback submissions' : 'Your category summary will appear here.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(categoryCounts).length ? Object.entries(categoryCounts).map(([category, count]) => (
              <div key={category}>
                <div className="mb-1 flex justify-between text-sm"><span>{category}</span><span className="text-muted-foreground">{count}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(count / generalItems.length) * 100}%` }} /></div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No general feedback submitted yet.</p>}
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">{facultyItems.length} faculty evaluation{facultyItems.length === 1 ? '' : 's'} submitted</p>
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Recent submissions</h2><p className="text-sm text-muted-foreground">A quick look at your latest feedback.</p></div>
          <button type="button" onClick={onHistory} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all <ArrowRight className="h-4 w-4" /></button>
        </div>
        {items.length ? (
          <div className="space-y-3">
            {items.slice(0, 4).map((item) => <FeedbackRow key={item.id} item={item} onClick={() => onDetail(item)} />)}
          </div>
        ) : (
          <Card><CardContent className="flex flex-col items-center py-10 text-center">
            <MessageSquare className="mb-3 h-9 w-9 text-muted-foreground/50" />
            <p className="font-medium">No feedback yet</p><p className="mt-1 text-sm text-muted-foreground">Your submissions will be saved in this browser.</p>
            <Button className="mt-4" onClick={onSubmit}><Plus className="mr-2 h-4 w-4" /> Submit feedback</Button>
          </CardContent></Card>
        )}
        {!ratings.length && !!items.length && <p className="mt-3 text-xs text-muted-foreground">Submit a rating to see your average satisfaction score.</p>}
      </section>
    </>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>
        <span className="rounded-lg bg-primary/10 p-3 text-primary">{icon}</span>
      </CardContent>
    </Card>
  )
}

function FeedbackRow({ item, onClick }: { item: LocalFeedbackEntry; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.title}</span><StatusBadge status={item.status} /></span>
        <span className="mt-1 block text-sm text-muted-foreground">{item.kind === 'faculty-evaluation' ? `${item.subjectCode} · ${item.facultyName}` : `${item.category} · ${item.feedbackType}`} · {fmtDate(item.createdAt)}</span>
      </span>
      <span className="flex items-center gap-2 text-sm font-medium text-primary">{item.referenceCode}<ArrowRight className="h-4 w-4" /></span>
    </button>
  )
}

function GeneralFeedbackForm({
  studentId, onCancel, onSave,
}: {
  studentId: string
  onCancel: () => void
  onSave: (entry: LocalFeedbackEntry) => void
}) {
  const [values, setValues] = useState<GeneralDraft>({
    category: '',
    feedbackType: '',
    facultyName: '',
    rating: 0,
    title: '',
    description: '',
    experienceDate: today(),
    isAnonymous: false,
  })
  const [validationError, setValidationError] = useState('')
  const update = <K extends keyof GeneralDraft>(key: K, value: GeneralDraft[K]) =>
    setValues((current) => ({ ...current, [key]: value }))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!values.category || !values.feedbackType || !values.rating || !values.title.trim() || !values.description.trim() || !values.experienceDate || values.experienceDate > today()) {
      setValidationError('Complete all required fields and choose a rating before submitting.')
      return
    }
    if (values.title.trim().length > 100 || values.description.trim().length > 1000) {
      setValidationError('Keep the title to 100 characters and the description to 1,000 characters.')
      return
    }
    setValidationError('')
    onSave(feedbackEntry(studentId, {
      kind: 'general',
      category: values.category,
      feedbackType: values.feedbackType,
      facultyName: values.facultyName,
      rating: values.rating,
      title: values.title.trim(),
      description: values.description.trim(),
      experienceDate: values.experienceDate,
      isAnonymous: values.isAnonymous,
      subjectCode: '',
      criteria: {},
    }))
  }

  return (
    <Card>
      <CardHeader><CardTitle>Tell us about your experience</CardTitle><CardDescription>Required fields are marked with an asterisk.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <Field label="Category *">
            <select required value={values.category} onChange={(event) => update('category', event.target.value)} className={controlClass}>
              <option value="">Choose a category</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </Field>
          <Field label="Feedback type *">
            <select required value={values.feedbackType} onChange={(event) => update('feedbackType', event.target.value)} className={controlClass}>
              <option value="">Choose a type</option>{FEEDBACK_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Faculty member (optional)">
            <input value={values.facultyName} onChange={(event) => update('facultyName', event.target.value)} maxLength={100} placeholder="Enter a faculty name" className={controlClass} />
          </Field>
          <Field label="Date of experience *">
            <input type="date" max={today()} required value={values.experienceDate} onChange={(event) => update('experienceDate', event.target.value)} className={controlClass} />
          </Field>
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium">Your rating *</p>
            <Rating value={values.rating} onChange={(rating) => update('rating', rating)} label="Overall feedback rating" />
          </div>
          <Field label="Title *" className="md:col-span-2">
            <input required value={values.title} onChange={(event) => update('title', event.target.value)} maxLength={100} placeholder="A short summary of your feedback" className={controlClass} />
            <span className="text-right text-xs text-muted-foreground">{values.title.length}/100</span>
          </Field>
          <Field label="Description *" className="md:col-span-2">
            <textarea required rows={5} value={values.description} onChange={(event) => update('description', event.target.value)} maxLength={1000} placeholder="Describe your experience, concern, or suggestion…" className={`${controlClass} resize-y`} />
            <span className="text-right text-xs text-muted-foreground">{values.description.length}/1000</span>
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 md:col-span-2">
            <input type="checkbox" checked={values.isAnonymous} onChange={(event) => update('isAnonymous', event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
            <span><span className="flex items-center gap-2 text-sm font-medium"><EyeOff className="h-4 w-4" /> Submit anonymously</span><span className="mt-1 block text-xs text-muted-foreground">Your name is hidden in the saved feedback view. This response remains on this browser only.</span></span>
          </label>
          {validationError && <p role="alert" className="text-sm text-destructive md:col-span-2">{validationError}</p>}
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit"><MessageSquare className="mr-2 h-4 w-4" /> Submit feedback</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cn('grid content-start gap-2 text-sm font-medium', className)}>{label}{children}</label>
}

function FacultyEvaluation({
  studentId, subjects, evaluations, loading, onSave, onDetail,
}: {
  studentId: string
  subjects: ReturnType<typeof subjectsOfSemester>
  evaluations: LocalFeedbackEntry[]
  loading: boolean
  onSave: (entry: LocalFeedbackEntry) => void
  onDetail: (entry: LocalFeedbackEntry) => void
}) {
  const [subjectCode, setSubjectCode] = useState(subjects[0]?.code ?? '')
  const [ratings, setRatings] = useState<Partial<Record<FacultyCriterion, number>>>({})
  const [comment, setComment] = useState('')
  const [validationError, setValidationError] = useState('')
  const subject = subjects.find((item) => item.code === subjectCode)
  const previous = evaluations.find((item) => item.subjectCode === subjectCode)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subject || CRITERIA.some(({ key }) => !ratings[key])) {
      setValidationError('Choose a course and rate every criterion from 1 to 5.')
      return
    }
    const fullRatings = Object.fromEntries(CRITERIA.map(({ key }) => [key, ratings[key]!])) as Record<FacultyCriterion, number>
    const overall = Object.values(fullRatings).reduce((sum, rating) => sum + rating, 0) / CRITERIA.length
    setValidationError('')
    onSave(feedbackEntry(studentId, {
      kind: 'faculty-evaluation',
      category: 'Faculty evaluation',
      feedbackType: 'Faculty evaluation',
      facultyName: subject.teacher,
      rating: Math.round(overall * 10) / 10,
      title: `${subject.short} faculty evaluation`,
      description: comment.trim(),
      experienceDate: today(),
      isAnonymous: true,
      subjectCode: subject.code,
      criteria: fullRatings,
    }))
    setRatings({})
    setComment('')
  }

  if (!subjects.length) return <EmptyPanel title="No courses found" description="There are no courses available for the current semester." />

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Rate a faculty member</CardTitle>
          <CardDescription>Share constructive, course-specific feedback. Evaluations are saved locally in this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <Field label="Subject / faculty member">
              <select value={subjectCode} onChange={(event) => { setSubjectCode(event.target.value); setRatings({}); setValidationError('') }} className={controlClass}>
                {subjects.map((item) => <option key={item.code} value={item.code}>{item.name} — {item.teacher}</option>)}
              </select>
            </Field>
            {previous && <p className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">You submitted an evaluation for this course on {fmtDate(previous.createdAt)}. Submitting again replaces that evaluation.</p>}
            <div className="space-y-4">
              {CRITERIA.map(({ key, label }) => (
                <div key={key} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0">
                  <span className="text-sm font-medium">{label}</span>
                  <Rating value={ratings[key] ?? 0} onChange={(rating) => setRatings((current) => ({ ...current, [key]: rating }))} label={label} />
                </div>
              ))}
            </div>
            <Field label="Comment (optional)">
              <textarea rows={3} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What went well? What could improve?" className={`${controlClass} resize-y`} />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Saved only in this browser</span>
              <Button type="submit" disabled={loading}><CheckCircle2 className="mr-2 h-4 w-4" /> Submit evaluation</Button>
            </div>
            {validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>My evaluations</CardTitle><CardDescription>Evaluation progress for current-semester courses.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {subjects.map((item) => {
            const evaluation = evaluations.find((entry) => entry.subjectCode === item.code)
            return (
              <button key={item.code} type="button" onClick={() => setSubjectCode(item.code)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition hover:bg-muted/50">
                <span><span className="block text-sm font-medium">{item.short}</span><span className="block text-xs text-muted-foreground">{item.teacher}</span></span>
                {evaluation ? <Badge tone="good">Submitted</Badge> : <Badge tone="warn">Pending</Badge>}
              </button>
            )
          })}
          {evaluations.map((evaluation) => (
            <button key={evaluation.id} type="button" onClick={() => onDetail(evaluation)} className="w-full text-left text-xs font-medium text-primary hover:underline">
              View {evaluation.subjectCode} evaluation
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function History({
  items, categories, search, category, status, loading, onSearch, onCategory, onStatus, onDetail,
}: {
  items: LocalFeedbackEntry[]
  categories: string[]
  search: string
  category: string
  status: string
  loading: boolean
  onSearch: (value: string) => void
  onCategory: (value: string) => void
  onStatus: (value: string) => void
  onDetail: (item: LocalFeedbackEntry) => void
}) {
  return (
    <section>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_190px_170px]">
        <label className="relative"><span className="sr-only">Search feedback</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search feedback…" className={`${controlClass} pl-9`} /></label>
        <label><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => onCategory(event.target.value)} className={controlClass}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => onStatus(event.target.value)} className={controlClass}><option value="">All statuses</option><option>Submitted</option><option>Under Review</option><option>Resolved</option></select></label>
      </div>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading locally saved feedback…</p> : items.length ? (
        <div className="space-y-3">{items.map((item) => <FeedbackRow key={item.id} item={item} onClick={() => onDetail(item)} />)}</div>
      ) : <EmptyPanel title="No feedback matches" description="Try a different search or submit new feedback." />}
    </section>
  )
}

function Details({ item, onBack }: { item: LocalFeedbackEntry; onBack: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_0.7fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><CardTitle>{item.title}</CardTitle><CardDescription>{item.category} · {fmtDate(item.createdAt)}</CardDescription></div>
            <StatusBadge status={item.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 border-b border-border pb-4 sm:grid-cols-2">
            <DetailValue label="Reference code" value={item.referenceCode} />
            <DetailValue label="Faculty member" value={item.facultyName || 'Not specified'} />
            <DetailValue label="Rating" value={`${item.rating}/5`} />
            <DetailValue label="Submitted as" value={item.isAnonymous ? 'Anonymous' : 'Student'} />
          </div>
          {item.kind === 'faculty-evaluation' && (
            <div className="space-y-2">
              <h2 className="font-semibold">Evaluation criteria</h2>
              {CRITERIA.map(({ key, label }) => item.criteria[key] ? <div key={key} className="flex items-center justify-between text-sm"><span>{label}</span><span className="font-medium">{item.criteria[key]}/5</span></div> : null)}
            </div>
          )}
          <div><h2 className="mb-2 font-semibold">{item.kind === 'faculty-evaluation' ? 'Comment' : 'Your feedback'}</h2><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description || 'No additional comment.'}</p></div>
          <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>Submission status</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="text-sm font-medium">{item.status}</p><p className="text-xs text-muted-foreground">{fmtDate(item.createdAt)}</p></div></div>
          <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">This is a local-only submission. Its status will not change unless it is updated in this browser.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return <Card><CardContent className="flex flex-col items-center py-12 text-center"><MessageSquare className="mb-3 h-9 w-9 text-muted-foreground/50" /><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></CardContent></Card>
}

/**
 * Feedback is locked until the Head of Department opens it for this student's department. While locked nothing can be filled in;
 * once opened, the page works as before and shows the HOD's message and closing date.
 */
export default function Feedback() {
  const gate = useFeedbackWindow()
  if (gate.loading) return <div aria-busy="true" aria-label="Checking whether feedback is open"><Skeleton className="mb-4 h-10 w-64" /><Skeleton className="h-64 w-full" /></div>
  if (gate.error && !gate.window) {
    return (
      <>
        <PageHeader title="Student feedback" description="Share your experience, rate your courses and teachers, and keep track of your submissions." />
        <Card><CardContent className="p-8 text-center">
          <p className="text-[16px] font-medium">{gate.error}</p>
          <Button className="mt-4" variant="outline" onClick={() => gate.retry()}>Try again</Button>
        </CardContent></Card>
      </>
    )
  }
  if (!gate.open) {
    const closed = gate.window?.isOpen && gate.window.closesAt
    return (
      <>
        <PageHeader title="Student feedback" description="Share your experience, rate your courses and teachers, and keep track of your submissions." />
        <Card role="status" className="mx-auto max-w-2xl">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-muted text-foreground"><Lock className="h-8 w-8" aria-hidden="true" /></span>
            <h2 className="mt-5 text-[22px] font-semibold">Feedback is locked right now</h2>
            <p className="mt-2 max-w-md text-[16px] leading-7 text-muted-foreground">
              {closed ? 'The feedback period for your department has ended.' : 'Your Head of Department opens feedback for each feedback period.'}{' '}
              You will get a notification here as soon as it opens, and then the feedback form will be available.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }
  const w = gate.window!
  const until = w.closesAt ? `Open until ${fmtDate(w.closesAt)}. ` : ''
  return <FeedbackContent banner={`${until}${w.message}`.trim() || undefined} />
}
