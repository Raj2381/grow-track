import { useMemo, useState } from 'react'
import { Skeleton, Select } from '@student/components/ui/misc'
import { ErrorState, PageHeader } from '@student/components/common'
import { FadeUp } from '@student/components/motion/FadeUp'
import { HeroCard } from '@student/components/attendance/HeroCard'
import { SubjectDrawer, SubjectRiskSection } from '@student/components/attendance/SubjectCards'
import { Simulator } from '@student/components/attendance/Simulator'
import { SubjectChart } from '@student/components/attendance/SubjectChart'
import { overallPercent, subjectStats } from '@student/lib/attendance'
import { roman } from '@student/lib/scoring'
import { fmtDate } from '@student/lib/utils'
import { useStudent } from '@student/hooks/useStudent'

/** Attendance decision-support page. Every figure comes from lib/attendance.ts applied to the student's attendance records. */
export default function Attendance() {
  const { student, cohort, error, reload } = useStudent()
  const [filter, setFilter] = useState('all')
  const [drawer, setDrawer] = useState<string | null>(null)

  const stats = useMemo(() => (student ? subjectStats(student.attendance) : []), [student])

  if (error && !student) return <><PageHeader title="Attendance" description="Track attendance, spot risks, and plan your next steps." /><ErrorState onRetry={reload} /></>
  if (!student || !cohort) return <AttendanceSkeleton />

  const totals = { total: stats.reduce((a, s) => a + s.total, 0), attended: stats.reduce((a, s) => a + s.attended, 0), missed: stats.reduce((a, s) => a + s.missed, 0) }
  const overall = overallPercent(stats)
  const priority = stats.find((s) => s.status.label === 'Critical') ?? stats.find((s) => s.status.label === 'At risk') ?? null
  const lastDate = stats.flatMap((s) => s.lectures.map((l) => l.date)).sort().pop()
  const open = (code: string) => { setDrawer(code) }
  const pick = (code: string) => { setFilter(code); setDrawer(code) }
  let i = 0
  const d = () => i++ * 0.05

  return (
    <>
      <PageHeader title="Attendance" description="Track attendance, spot risks, and plan your next steps."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Semester" value={student.semester} onChange={() => undefined} className="w-36">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n} disabled={n !== student.semester}>Semester {roman(n)}{n !== student.semester ? ' (no lecture records)' : ''}</option>)}
            </Select>
            <Select aria-label="Subject filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-44">
              <option value="all">All subjects</option>
              {stats.map((s) => <option key={s.code} value={s.code}>{s.short} · {s.name}</option>)}
            </Select>
            {lastDate && <span className="text-[13px] text-muted-foreground">Last updated {fmtDate(lastDate)}</span>}
          </div>
        } />

      <div className="space-y-6">
        <FadeUp delay={d()}><HeroCard overall={overall} totals={totals} priority={priority} /></FadeUp>

        <FadeUp delay={d()}>
          <h2 className="mb-3 text-[20px] font-semibold text-[#0F172A] [.dark_&]:text-foreground">Subject risk &amp; recovery</h2>
          <SubjectRiskSection stats={stats} onOpen={open} />
        </FadeUp>

        <FadeUp delay={d()} className="grid gap-4 xl:grid-cols-[3fr_2fr]">
          <SubjectChart stats={stats} onPick={pick} filter={filter} />
          <Simulator stats={stats} />
        </FadeUp>
      </div>

      <SubjectDrawer s={stats.find((s) => s.code === drawer) ?? null} onClose={() => setDrawer(null)} />
    </>
  )
}

function AttendanceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading attendance" className="space-y-6">
      <div><Skeleton className="h-8 w-48" /><Skeleton className="mt-2 h-4 w-80" /></div>
      <Skeleton className="h-64" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-56" />)}</div>
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      <Skeleton className="h-80" /><Skeleton className="h-96" />
    </div>
  )
}
