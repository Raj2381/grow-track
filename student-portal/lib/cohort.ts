import type { CohortStats, SoftSkill, Student, TechSkill } from '@student/types'
import { attendanceBySubject, avg, cgpa, cohortAverageComponents } from '@student/lib/scoring'

const TECH: TechSkill[] = ['DSA', 'Web Dev', 'DBMS', 'Python', 'Java', 'C', 'SQL']
const SOFT: SoftSkill[] = ['Communication', 'Teamwork', 'Problem Solving', 'Leadership', 'Time Management']

/** Institution-wide benchmarks used for "class average" comparisons. Pure function of the student list. */
export function buildCohortStats(students: Student[]): CohortStats {
  const stats: CohortStats = {
    size: students.length,
    maxLogins: Math.max(...students.map((s) => s.lms.loginsLast30)),
    avgComponents: {},
    classAvgBySubject: {},
    avgAttendanceBySubject: {},
    avgTech: {},
    avgSoft: {} as CohortStats['avgSoft'],
    avgCgpa: 0,
  }
  const totals = new Map<string, number[]>()
  for (const s of students) for (const r of s.results) totals.set(r.code, [...(totals.get(r.code) ?? []), r.total])
  totals.forEach((rs, code) => { stats.classAvgBySubject[code] = Math.round(avg(rs)) })

  const att = new Map<string, number[]>()
  for (const s of students) for (const a of attendanceBySubject(s)) att.set(a.code, [...(att.get(a.code) ?? []), a.percent])
  att.forEach((ps, code) => { stats.avgAttendanceBySubject[code] = Math.round(avg(ps) * 10) / 10 })

  TECH.forEach((k) => {
    const v = students.map((s) => s.skills.technical[k]).filter((x): x is number => x !== undefined)
    if (v.length) stats.avgTech[k] = Math.round(avg(v))
  })
  SOFT.forEach((k) => { stats.avgSoft[k] = Math.round(avg(students.map((s) => s.skills.soft[k]))) })
  stats.avgCgpa = Math.round(avg(students.map((s) => cgpa(s))) * 100) / 100
  stats.avgComponents = cohortAverageComponents(students, stats)
  return stats
}
