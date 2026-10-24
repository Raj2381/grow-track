import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { DASH, Shell } from '@student/components/Shell'
import { DEFAULT_STUDENT_ID } from '@student/data/students'
import { listStudents } from '@student/services/api'
import NotFound from '@student/pages/NotFound'
import { PageSkeleton } from '@student/components/common'
import { useHomeStudent } from '@student/hooks/useHomeStudent'
const Home = lazy(() => import('@student/pages/Home'))
const Attendance = lazy(() => import('@student/pages/Attendance'))
const Results = lazy(() => import('@student/pages/Results'))
const Engagement = lazy(() => import('@student/pages/Engagement'))
const Placement = lazy(() => import('@student/pages/Placement'))
const AptitudeTest = lazy(() => import('@student/pages/AptitudeTest'))
const MockInterview = lazy(() => import('@student/pages/MockInterview'))
const SoftSkills = lazy(() => import('@student/pages/SoftSkills'))
const Skills = lazy(() => import('@student/pages/Skills'))
const CodingTest = lazy(() => import('@student/pages/CodingTest'))
const Feedback = lazy(() => import('@student/pages/Feedback'))

/** Same page tree is mounted twice: "/dashboard" (logged-in student) and "/dashboard/student/:studentId" (faculty/admin view). */
const pages = (
  <>
    <Route index element={<Home />} />
    <Route path="attendance" element={<Attendance />} />
    <Route path="results" element={<Results />} />
    <Route path="engagement" element={<Engagement />} />
    <Route path="placement" element={<Placement />} />
    <Route path="placement/aptitude" element={<AptitudeTest />} />
    <Route path="placement/interview" element={<MockInterview />} />
    <Route path="placement/soft-skills" element={<SoftSkills />} />
    <Route path="skills" element={<Skills />} />
    <Route path="skills/coding" element={<CodingTest />} />
    <Route path="feedback" element={<Feedback />} />
    <Route path="*" element={<NotFound />} />
  </>
)

/** "/dashboard": the signed-in student's own record (staff see the demo student and can switch). */
function HomeShell() {
  const home = useHomeStudent()
  if (!home.ready) return <div className="p-8"><PageSkeleton /></div>
  return <Shell studentId={home.id} base={DASH} homeId={home.id} canSwitch={home.canSwitch} />
}

function StudentShell() {
  const { studentId } = useParams()
  const home = useHomeStudent()
  const [known, setKnown] = useState<{ id?: string; ok: boolean } | null>(null)
  useEffect(() => {
    let alive = true
    listStudents().then((list) => { if (alive) setKnown({ id: studentId, ok: list.some((s) => s.id === studentId) }) }).catch(() => { if (alive) setKnown({ id: studentId, ok: false }) })
    return () => { alive = false }
  }, [studentId])
  if (!home.ready || !known || known.id !== studentId) return <div className="p-8"><PageSkeleton /></div>
  if (!home.canSwitch && studentId !== home.id) return <Navigate to={DASH} replace />   // a student may only open their own pages
  if (!known.ok) return <NotFound message="That student does not exist." />
  return <Shell studentId={studentId ?? DEFAULT_STUDENT_ID} base={`${DASH}/student/${studentId}`} homeId={home.id} canSwitch={home.canSwitch} />
}

/** Old (pre-redesign) URLs such as /attendance or /student/s007/results keep working. */
const LEGACY = ['attendance', 'results', 'engagement', 'placement', 'skills', 'feedback', 'student']
function Legacy() {
  const { pathname, search } = useLocation()
  return LEGACY.includes(pathname.split('/')[1]) ? <Navigate to={`${DASH}${pathname}${search}`} replace /> : <NotFound />
}

export default function App() {
  return (
    <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
    <Routes>
      <Route path="/" element={<Navigate to={DASH} replace />} />
      <Route path={DASH} element={<HomeShell />}>{pages}</Route>
      <Route path={`${DASH}/student/:studentId`} element={<StudentShell />}>{pages}</Route>
      <Route path="*" element={<Legacy />} />
    </Routes>
    </Suspense>
  )
}
