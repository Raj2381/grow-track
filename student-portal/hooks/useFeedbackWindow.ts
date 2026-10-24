import { useData } from '@/lib/data/hooks'
import { fetchFeedbackWindow, isWindowOpen } from '@/lib/data/feedback-window'
import { useStudent } from '@student/hooks/useStudent'

/** Whether the Head of Department has opened feedback for this student's department. Unknown (loading or failed) is treated as locked. */
export function useFeedbackWindow() {
  const { student } = useStudent()
  const branch = student?.branchCode
  const q = useData(branch ? ['feedback-window', branch] : null, (db) => fetchFeedbackWindow(db, branch!))
  const window = q.data ?? null
  return { loading: !student || (q.loading && q.data === undefined), error: q.error, window, open: isWindowOpen(window), retry: q.retry }
}
