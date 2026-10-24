export type TechSkill = 'DSA' | 'Web Dev' | 'DBMS' | 'Python' | 'Java' | 'C' | 'SQL'
export type CodingLanguage = 'Java' | 'Python' | 'C' | 'SQL'
export type SoftSkill = 'Communication' | 'Teamwork' | 'Problem Solving' | 'Leadership' | 'Time Management'
export type ActivityType = 'event' | 'club' | 'hackathon' | 'certification'
export type VerificationStatus = 'Pending' | 'Approved' | 'Rejected'
export type Level = 'Low' | 'Medium' | 'High'

export interface CatalogSubject {
  code: string
  name: string
  short: string
  credits: number
  semester: number
  teacher: string
}

export interface SubjectResult {
  code: string
  semester: number
  internal: number // out of 40
  external: number // out of 60
  total: number // out of 100
  grade: string
  gradePoint: number
  passed: boolean
  creditsObtained: number
}

export interface BacklogAttempt {
  attempt: number
  date: string
  marks: number
  result: 'Fail' | 'Pass'
}

export interface Backlog {
  code: string
  semester: number
  status: 'active' | 'cleared'
  attempts: BacklogAttempt[]
}

export interface Lecture {
  date: string // ISO yyyy-mm-dd
  slot: string
  topic: string
  present: boolean
  /** optional absence reason, shown only when recorded */
  reason?: string
}

export interface AttendanceRecord {
  code: string
  lectures: Lecture[]
}

export interface LMSData {
  loginsLast30: number
  lastLogin: string
  assignments: { assigned: number; submitted: number; late: number; pending: number }
  avgQuiz: number
}

export interface Activity {
  id: string
  type: ActivityType
  title: string
  organizer: string
  date: string
  category: string
  role: string
  proof: string
  status: VerificationStatus
  semester: number
  /** Display category chosen by the student (Workshop, Competition, Volunteering…). Falls back to the scoring type. */
  kind?: string
  /** Outcome, e.g. "Finalist placement" */
  achievement?: string
  description?: string
  /** Optional http(s) link to a certificate, project or event page */
  link?: string
}

export type AptitudeSection = 'Quantitative' | 'Logical Reasoning' | 'Verbal'

export interface AptitudeAttempt {
  id: string
  pattern: string
  date: string
  sections: Record<AptitudeSection, { score: number; total: number }>
  totalPercent: number
  timeTakenSec: number
}

export interface InterviewAttempt {
  id: string
  date: string
  type: string
  difficulty: string
  score: number
  ratings: { communication: number; technical: number; confidence: number }
  feedback: string
}

export interface SkillTestAttempt {
  id: string
  skill: TechSkill
  date: string
  score: number
}

export interface CodingAttempt {
  id: string
  language: CodingLanguage
  date: string
  difficulty: string
  score: number // percent
  questionCount: number
  correct: number
  wrong: number
  skipped: number
  timeTakenSec: number
  topicScores: Record<string, { correct: number; total: number }>
}

export interface SurveyResponse {
  date: string
  ratings: Record<string, number>
  comments: Record<string, string>
}

export interface TeacherFeedback {
  code: string
  date: string
  clarity: number
  punctuality: number
  doubtSolving: number
  engagement: number
  comment: string
}

export interface FacultyRemark {
  code: string
  teacher: string
  date: string
  participation: number
  discipline: number
  attitude: number
  comment: string
}

export type Gender = 'Female' | 'Male' | 'Other'
export type Residence = 'Hostel' | 'Day scholar'
export type EntryBand = 'Top 10%' | 'Top 25%' | 'Top 50%' | 'Bottom 50%'
export type IncomeBand = 'Low' | 'Lower-middle' | 'Middle' | 'High'

/** Static background attributes of a student (known from admission, not behavioural data). */
export interface StudentProfile {
  department: string
  section: string
  mentorId: string
  mentorName: string
  gender: Gender
  residence: Residence
  scholarship: boolean
  entryBand: EntryBand
  incomeBand: IncomeBand
  /** Year of admission (all generated students belong to the same batch). */
  batch: number
}

export interface Student {
  id: string
  name: string
  rollNo: string
  branch: string
  /** Short branch code that selects the subject catalog (CSE, IT, ECE, MECH, CIVIL). */
  branchCode: 'CSE' | 'IT' | 'ECE' | 'MECH' | 'CIVIL'
  /** Latest completed semester (the dataset holds semesters 1..semester). */
  semester: number
  email: string
  profile: StudentProfile
  results: SubjectResult[]
  backlogs: Backlog[]
  attendance: AttendanceRecord[]
  semesterAttendance: Record<number, number>
  lms: LMSData
  activities: Activity[]
  placement: { aptitude: AptitudeAttempt[]; codingScore: number; interviews: InterviewAttempt[] }
  skills: {
    /** Core skills always present; Java / C / SQL appear after the first coding test (Python is overridden by its best coding score). */
    technical: Partial<Record<TechSkill, number>>
    codingAttempts: CodingAttempt[]
    soft: Record<SoftSkill, number>
    technicalTests: SkillTestAttempt[]
    introScore?: { date: string; score: number; feedback: string }
  }
  feedback: {
    survey: SurveyResponse | null
    teacherFeedback: TeacherFeedback[]
    remarks: FacultyRemark[]
  }
}

export interface CohortStats {
  size: number
  maxLogins: number
  avgComponents: Record<string, number>
  classAvgBySubject: Record<string, number>
  avgAttendanceBySubject: Record<string, number>
  avgTech: Partial<Record<TechSkill, number>>
  avgSoft: Record<SoftSkill, number>
  avgCgpa: number
}
