import { useCurrentUser } from '@/lib/data/hooks'
import type { AppRole } from '@/lib/data/current-user'
import { DEFAULT_STUDENT_ID } from '@student/data/students'

export type HomeStudent = {
  /** false while the signed-in person is still being identified */
  ready: boolean
  /** the student whose dashboard "/dashboard" shows */
  id: string
  /** a student sees only themselves; staff may switch to any student */
  canSwitch: boolean
  role: AppRole | null
}

/**
 * Who "/dashboard" belongs to. A signed-in student sees their own record (never STU-0001 by default); staff keep the demo
 * student and the picker. With login switched off (local demo) it behaves as before.
 */
export function useHomeStudent(): HomeStudent {
  const me = useCurrentUser()
  if (me.loading && !me.data) return { ready: false, id: DEFAULT_STUDENT_ID, canSwitch: false, role: null }
  const user = me.data
  if (user?.role === 'student' && user.studentId) return { ready: true, id: user.studentId, canSwitch: false, role: 'student' }
  return { ready: true, id: DEFAULT_STUDENT_ID, canSwitch: Boolean(user), role: user?.role ?? null }
}
