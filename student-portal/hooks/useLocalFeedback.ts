import { useCallback, useSyncExternalStore } from 'react'
import {
  LOCAL_FEEDBACK_CHANGED_EVENT, readLocalFeedback, subscribeToLocalFeedback,
  type LocalFeedbackEntry,
} from '@student/services/localFeedback'

interface FeedbackSnapshot {
  items: LocalFeedbackEntry[]
  error: string
  loading: boolean
}

const snapshots = new Map<string, FeedbackSnapshot>()
const emptySnapshot: FeedbackSnapshot = { items: [], error: '', loading: true }

function getSnapshot(studentId: string): FeedbackSnapshot {
  const cached = snapshots.get(studentId)
  if (cached) return cached

  let next: FeedbackSnapshot
  try {
    next = { items: readLocalFeedback(studentId), error: '', loading: false }
  } catch (cause) {
    next = {
      items: [],
      error: cause instanceof Error ? cause.message : 'Saved feedback could not be read.',
      loading: false,
    }
  }
  snapshots.set(studentId, next)
  return next
}

export function useLocalFeedback(studentId: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const handleChange = () => {
      snapshots.delete(studentId)
      onChange()
    }
    return subscribeToLocalFeedback(handleChange)
  }, [studentId])
  const getCurrentSnapshot = useCallback(() => getSnapshot(studentId), [studentId])
  const state = useSyncExternalStore(subscribe, getCurrentSnapshot, () => emptySnapshot)
  const refresh = useCallback(() => {
    snapshots.delete(studentId)
    window.dispatchEvent(new Event(LOCAL_FEEDBACK_CHANGED_EVENT))
  }, [studentId])

  return { ...state, refresh }
}
