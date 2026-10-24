import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { CohortStats, Student } from '@student/types'
import { analyze, type Analysis } from '@student/lib/scoring'
import { getCohort, getStudent, subscribe } from '@student/services/api'

interface Ctx { error: boolean; reload: () => void; studentId: string; student: Student | null; cohort: CohortStats | null; analysis: Analysis | null; loading: boolean; base: string }
const StudentCtx = createContext<Ctx | null>(null)

/**
 * Loads one student + cohort through the service layer and computes the analysis once.
 * Pass any studentId (faculty/admin views reuse every page this way).
 */
export function StudentProvider({ studentId, base, children }: { studentId: string; base: string; children: React.ReactNode }) {
  const [student, setStudent] = useState<Student | null>(null)
  const [cohort, setCohort] = useState<CohortStats | null>(null)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), [])
  useEffect(() => { setStudent((s) => (s && s.id === studentId ? s : null)) }, [studentId])
  useEffect(() => {
    let alive = true
    setError(false)
    Promise.all([getStudent(studentId), getCohort()]).then(([s, c]) => { if (alive) { setStudent(s); setCohort(c) } }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [studentId, version])

  const analysis = useMemo(() => (student && cohort ? analyze(student, cohort) : null), [student, cohort])
  return <StudentCtx.Provider value={{ error, reload: () => setVersion((v) => v + 1), studentId, student, cohort, analysis, loading: !student || !cohort, base }}>{children}</StudentCtx.Provider>
}

export function useStudent(studentIdOverride?: string) {
  const c = useContext(StudentCtx)
  if (!c) throw new Error('useStudent must be used inside StudentProvider')
  void studentIdOverride // pages accept a studentId prop for reuse; the provider above already scopes the data
  return c
}
