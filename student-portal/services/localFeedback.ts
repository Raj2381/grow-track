export const LOCAL_FEEDBACK_CHANGED_EVENT = 'growtrack-local-feedback-changed'

export type FeedbackStatus = 'Submitted' | 'Under Review' | 'Resolved'
export type FacultyCriterion = 'clarity' | 'punctuality' | 'doubtSolving' | 'engagement'

export interface LocalFeedbackEntry {
  id: string
  studentId: string
  referenceCode: string
  kind: 'general' | 'faculty-evaluation'
  category: string
  feedbackType: string
  title: string
  description: string
  experienceDate: string
  isAnonymous: boolean
  rating: number
  status: FeedbackStatus
  createdAt: string
  facultyName: string
  subjectCode: string
  criteria: Partial<Record<FacultyCriterion, number>>
}

const storageKey = (studentId: string) => `growtrack.feedback.v1.${studentId}`
const STORAGE_PREFIX = 'growtrack.feedback.v1.'
const STATUSES: FeedbackStatus[] = ['Submitted', 'Under Review', 'Resolved']
const CRITERIA: FacultyCriterion[] = ['clarity', 'punctuality', 'doubtSolving', 'engagement']

function isLocalFeedbackEntry(value: unknown): value is LocalFeedbackEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LocalFeedbackEntry>
  return (
    typeof item.id === 'string' &&
    typeof item.studentId === 'string' &&
    typeof item.referenceCode === 'string' &&
    (item.kind === 'general' || item.kind === 'faculty-evaluation') &&
    typeof item.category === 'string' &&
    typeof item.feedbackType === 'string' &&
    typeof item.title === 'string' &&
    typeof item.description === 'string' &&
    typeof item.experienceDate === 'string' &&
    typeof item.isAnonymous === 'boolean' &&
    typeof item.rating === 'number' &&
    item.rating >= 1 &&
    item.rating <= 5 &&
    STATUSES.includes(item.status as FeedbackStatus) &&
    typeof item.createdAt === 'string' &&
    typeof item.facultyName === 'string' &&
    typeof item.subjectCode === 'string' &&
    !!item.criteria &&
    typeof item.criteria === 'object' &&
    CRITERIA.every((key) => {
      const score = item.criteria?.[key]
      return score === undefined || (Number.isInteger(score) && score >= 1 && score <= 5)
    })
  )
}

export function readLocalFeedback(studentId: string): LocalFeedbackEntry[] {
  if (!studentId) throw new Error('A student must be selected to read feedback.')
  const stored = window.localStorage.getItem(storageKey(studentId))
  if (!stored) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    throw new Error('Saved feedback could not be read because its local data is invalid.')
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every(isLocalFeedbackEntry) ||
    parsed.some((item) => item.studentId !== studentId)
  ) {
    throw new Error('Saved feedback contains invalid data. Clear this browser’s feedback data before continuing.')
  }
  return parsed
}

export function saveLocalFeedback(entry: LocalFeedbackEntry) {
  if (!isLocalFeedbackEntry(entry)) throw new Error('Feedback details are incomplete or invalid.')
  const current = readLocalFeedback(entry.studentId)
  const next =
    entry.kind === 'faculty-evaluation'
      ? [
          entry,
          ...current.filter(
            (item) =>
              item.kind !== 'faculty-evaluation' ||
              item.subjectCode !== entry.subjectCode,
          ),
        ]
      : [entry, ...current]

  window.localStorage.setItem(storageKey(entry.studentId), JSON.stringify(next))
  window.dispatchEvent(new Event(LOCAL_FEEDBACK_CHANGED_EVENT))
}

export function clearLocalFeedbackData() {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(STORAGE_PREFIX)) window.localStorage.removeItem(key)
  }
  window.dispatchEvent(new Event(LOCAL_FEEDBACK_CHANGED_EVENT))
}

export function subscribeToLocalFeedback(onChange: () => void) {
  window.addEventListener(LOCAL_FEEDBACK_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(LOCAL_FEEDBACK_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function countPendingFacultyEvaluations(
  items: LocalFeedbackEntry[],
  subjectCodes: string[],
) {
  const evaluated = new Set(
    items
      .filter((item) => item.kind === 'faculty-evaluation')
      .map((item) => item.subjectCode),
  )
  return subjectCodes.filter((code) => !evaluated.has(code)).length
}
