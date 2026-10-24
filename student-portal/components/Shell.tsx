import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle, Award, Bell, Briefcase, CalendarCheck, ChevronRight, Code2, Database, GraduationCap, Home as HomeIcon, LogOut, Menu, MessageSquare,
  Mic, Moon, PanelLeftClose, PanelLeftOpen, PenLine, Search, Sun, Users, X, Zap,
} from 'lucide-react'
import { cn } from '@student/lib/utils'
import { StudentProvider, useStudent } from '@student/hooks/useStudent'
import { useTheme } from '@student/hooks/useTheme'
import { listStudents, resetDemoData } from '@student/services/api'
import { useFeedbackWindow } from '@student/hooks/useFeedbackWindow'
import { useLocalFeedback } from '@student/hooks/useLocalFeedback'
import { countPendingFacultyEvaluations } from '@student/services/localFeedback'
import { attendanceBySubject } from '@student/lib/scoring'
import { subjectsOfSemester } from '@student/data/catalog'
import { Skeleton } from '@student/components/ui/misc'
import { Logo } from '@student/components/Logo'
import { LogoutControl } from '@/components/logout-control'
import { StudentPicker, type Person } from '@student/components/StudentPicker'

export const DASH = '/dashboard'

interface NavItem { to: string; label: string; icon: typeof HomeIcon; end?: boolean; children?: NavItem[]; keywords?: string }
const NAV: NavItem[] = [
  { to: '', label: 'Home', icon: HomeIcon, end: true, keywords: 'overview success score risk' },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, keywords: 'lectures present absent 75' },
  { to: '/results', label: 'Results', icon: GraduationCap, keywords: 'cgpa sgpa marks backlog grades' },
  { to: '/engagement', label: 'Engagement', icon: Award, keywords: 'clubs events hackathon certification' },
  {
    to: '/placement', label: 'Placement', icon: Briefcase, keywords: 'readiness eligibility jobs',
    children: [
      { to: '/placement/aptitude', label: 'Aptitude Test', icon: PenLine, keywords: 'quant logical verbal tcs infosys' },
      { to: '/placement/interview', label: 'Mock Interview', icon: Mic, keywords: 'hr technical voice' },
      { to: '/placement/soft-skills', label: 'Soft Skills', icon: Users, keywords: 'communication teamwork leadership situational video introduction' },
    ],
  },
  { to: '/skills', label: 'Skills', icon: Zap, keywords: 'technical soft radar', children: [{ to: '/skills/coding', label: 'Coding Test', icon: Code2, keywords: 'java python c sql' }] },
  { to: '/feedback', label: 'Feedback', icon: MessageSquare, keywords: 'survey faculty evaluation remarks suggestions' },
]
const FLAT = NAV.flatMap((n) => [n, ...(n.children ?? [])])

export function Shell({ studentId, base, homeId, canSwitch }: { studentId: string; base: string; homeId: string; canSwitch: boolean }) {
  return (
    <StudentProvider studentId={studentId} base={base}>
      <Layout homeId={homeId} canSwitch={canSwitch} />
    </StudentProvider>
  )
}

function Layout({ homeId, canSwitch }: { homeId: string; canSwitch: boolean }) {
  const loc = useLocation()
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === loc.pathname
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('gt.sidebar') === 'collapsed')
  const reduce = useReducedMotion()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => { localStorage.setItem('gt.sidebar', collapsed ? 'collapsed' : 'open') }, [collapsed])

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpenAt(null)} />}
      <Sidebar open={open} collapsed={collapsed} onClose={() => setOpenAt(null)} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setOpenAt(loc.pathname)} homeId={homeId} canSwitch={canSwitch} />
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={loc.pathname} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function Sidebar({ open, collapsed, onClose, onToggle }: { open: boolean; collapsed: boolean; onClose: () => void; onToggle: () => void }) {
  const { base } = useStudent()
  const link = (n: NavItem, child = false) => (
    <NavLink key={n.to} to={base + n.to} end={!!n.end || !!n.children || child} title={collapsed ? n.label : undefined}
      className={({ isActive }) => cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        collapsed && 'lg:justify-center lg:px-0', child && !collapsed && 'ml-5 h-9 text-[13px]',
        isActive ? 'bg-brand-600 text-white' : 'text-brand-100 hover:bg-white/[0.06] hover:text-white')}>
      <n.icon className="h-[18px] w-[18px] shrink-0" />
      <span className={cn(collapsed && 'lg:hidden')}>{n.label}</span>
    </NavLink>
  )
  return (
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-brand-950 text-white transition-all duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full', collapsed && 'lg:w-[72px]')}>
      <div className={cn('flex h-16 items-center justify-between px-4', collapsed && 'lg:justify-center lg:px-0')}>
        <Link to={DASH} aria-label="GrowthTrack home"><Logo size={32} withWordmark={!collapsed} wordClassName="text-white" className={cn(collapsed && 'lg:gap-0')} /></Link>
        <button className="rounded-lg p-1 text-brand-100 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV.map((n) => (
          <div key={n.label} className="space-y-1">
            {link(n)}
            {n.children?.map((c) => link(c, true))}
          </div>
        ))}
      </nav>
      <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
        <LogoutControl className={cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-brand-100 hover:bg-white/[0.06]', collapsed && 'lg:justify-center lg:px-0')} title={collapsed ? 'Logout' : undefined}>
          <LogOut className="h-[18px] w-[18px] shrink-0" /><span className={cn(collapsed && 'lg:hidden')}>Logout</span>
        </LogoutControl>
        <button onClick={onToggle} className="hidden h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-brand-100 hover:bg-white/[0.06] lg:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : undefined}>
          {collapsed ? <PanelLeftOpen className="mx-auto h-[18px] w-[18px]" /> : <><PanelLeftClose className="h-[18px] w-[18px]" />Collapse</>}
        </button>
        <button className={cn('flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-brand-100 hover:bg-white/[0.06]', collapsed && 'lg:justify-center lg:px-0')} onClick={() => resetDemoData()} title="Reset data">
          <Database className="h-[18px] w-[18px] shrink-0" /><span className={cn(collapsed && 'lg:hidden')}>Reset data</span>
        </button>
      </div>
    </aside>
  )
}

function Topbar({ onMenu, homeId, canSwitch }: { onMenu: () => void; homeId: string; canSwitch: boolean }) {
  const { student, base, studentId } = useStudent()
  const feedback = useLocalFeedback(studentId)
  const feedbackWindow = useFeedbackWindow()
  const { dark, toggle } = useTheme()
  const nav = useNavigate()
  const loc = useLocation()
  const [people, setPeople] = useState<Person[]>([])
  const [bell, setBell] = useState(false)
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => { if (canSwitch) listStudents().then(setPeople) }, [canSwitch])

  const notes = useMemo(() => {
    if (!student) return []
    const out: { text: string; href: string; tone: 'warn' | 'bad' | 'info' }[] = []
    if (feedbackWindow.open) out.push({ text: feedbackWindow.window?.message ? `Feedback is open: ${feedbackWindow.window.message}` : 'Feedback is now open. Share your feedback.', href: '/feedback', tone: 'info' })
    attendanceBySubject(student).filter((a) => a.percent < 75).forEach((a) => out.push({ text: `${a.name} attendance is ${a.percent}%, below 75%`, href: '/attendance', tone: 'bad' }))
    const pendingFacultyEvaluations = countPendingFacultyEvaluations(
      feedback.items,
      subjectsOfSemester(student.semester, student.branchCode).map((subject) => subject.code),
    )
    if (!feedback.loading && !feedback.error && pendingFacultyEvaluations) {
      out.push({ text: `${pendingFacultyEvaluations} faculty evaluation${pendingFacultyEvaluations > 1 ? 's' : ''} pending`, href: '/feedback', tone: 'warn' })
    }
    if (student.lms.assignments.pending) out.push({ text: `${student.lms.assignments.pending} assignments pending on LMS`, href: '', tone: 'warn' })
    student.activities.filter((a) => a.status === 'Rejected').forEach((a) => out.push({ text: `"${a.title}" was rejected. Re-submit proof.`, href: '/engagement', tone: 'info' }))
    return out
  }, [feedback.error, feedback.items, feedback.loading, feedbackWindow.open, feedbackWindow.window, student])

  const results = q.trim() ? FLAT.filter((n) => (n.label + ' ' + (n.keywords ?? '')).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : []
  const go = (n: { to: string }) => { setQ(''); setSearchOpen(false); nav(base + n.to) }

  const sub = loc.pathname.replace(base, '') || ''
  const crumbs = FLAT.filter((n) => n.to === sub || (n.to !== '' && sub.startsWith(n.to + '/')))
  const parent = NAV.find((n) => n.children?.some((c) => c.to === sub))
  const trail = [parent, FLAT.find((n) => n.to === sub)].filter(Boolean) as NavItem[]
  void crumbs

  const initials = student?.name.split(' ').map((p) => p[0]).join('') ?? ''
  const switchTo = (id: string) => nav(`${id === homeId ? DASH : `${DASH}/student/${id}`}${sub}`)

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
        <Link to={base || DASH} className="text-muted-foreground hover:text-foreground">Dashboard</Link>
        {trail.map((t, i) => (
          <span key={t.to} className="flex items-center gap-1.5"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /><span className={cn('truncate', i === trail.length - 1 ? 'font-semibold' : 'text-muted-foreground')}>{t.label}</span></span>
        ))}
      </nav>
      <div id="topbar-slot" className="ml-1" />
      <div className="flex-1" />

      <div className="relative hidden md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0]) }} placeholder="Search pages…" aria-label="Search pages"
          className="h-9 w-52 rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-subtle focus:ring-2 focus:ring-brand-400" />
        {searchOpen && q.trim() && (
          <div className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-border bg-card p-1 shadow-lg">
            {results.length === 0 ? <div className="px-3 py-2 text-sm text-muted-foreground">No pages match</div> : results.map((r) => (
              <button key={r.to} onMouseDown={() => go(r)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"><r.icon className="h-4 w-4 text-muted-foreground" />{r.label}</button>
            ))}
          </div>
        )}
      </div>

      {canSwitch && <StudentPicker people={people} studentId={studentId} defaultId={homeId} onPick={switchTo} />}
      <button onClick={toggle} className="rounded-lg p-2 hover:bg-muted" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
      <div className="relative">
        <button className="relative rounded-lg p-2 hover:bg-muted" onClick={() => setBell((b) => !b)} aria-label={`Notifications (${notes.length})`} aria-expanded={bell}>
          <Bell className="h-5 w-5" />
          {notes.length > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{notes.length}</span>}
        </button>
        {bell && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setBell(false)} />
            <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-card p-2 shadow-lg">
              <div className="px-3 py-2 text-sm font-semibold">Notifications</div>
              {notes.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>}
              {notes.map((n, i) => (
                <button key={i} onClick={() => { setBell(false); nav(base + n.href) }} className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
                  <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', n.tone === 'bad' ? 'text-danger' : n.tone === 'warn' ? 'text-warning' : 'text-brand-600')} />{n.text}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2.5 border-l border-border pl-3">
        {student ? (
          <>
            <div className="hidden text-right leading-tight lg:block"><div className="text-sm font-semibold">{student.name}</div><div className="text-xs text-muted-foreground">{student.rollNo} · {student.branch}</div></div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800" title={student.name}>{initials}</div>
          </>
        ) : <Skeleton className="h-9 w-24" />}
      </div>
    </header>
  )
}
