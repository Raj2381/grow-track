import { useEffect, useRef } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, CalendarCheck, CheckCircle2, XCircle } from 'lucide-react'
import { REQUIRED_PCT, bufferPoints, percent, type SubjectStat } from '@student/lib/attendance'
import { plural, scrollToId } from './shared'

const SIZE = 180, STROKE = 12, R = SIZE / 2 - STROKE, C = 2 * Math.PI * R

function Ring({ value }: { value: number | null }) {
  const reduce = useReducedMotion()
  const num = useRef<HTMLSpanElement>(null)
  const v = value ?? 0
  useEffect(() => {
    if (value === null) return
    if (reduce) { if (num.current) num.current.textContent = value.toFixed(1); return }
    const ctl = animate(0, value, { duration: 1, ease: 'easeOut', onUpdate: (x) => { if (num.current) num.current.textContent = x.toFixed(1) } })
    return () => ctl.stop()
  }, [value, reduce])
  // tick marking the requirement: angle measured clockwise from the top
  const a = (REQUIRED_PCT / 100) * 2 * Math.PI
  const tick = (r: number) => `${SIZE / 2 + r * Math.sin(a)},${SIZE / 2 - r * Math.cos(a)}`
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} role="img" aria-label={value === null ? 'Overall attendance: no data yet' : `Overall attendance ${value} percent. Requirement ${REQUIRED_PCT} percent.`}>
      <svg width={SIZE} height={SIZE}>
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={STROKE} />
          {value !== null && (
            <motion.circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={value >= REQUIRED_PCT ? 'var(--brand-400)' : 'var(--danger)'} strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={C} initial={{ strokeDashoffset: reduce ? C * (1 - v / 100) : C }} animate={{ strokeDashoffset: C * (1 - v / 100) }} transition={{ duration: reduce ? 0 : 1, ease: 'easeOut' }} />
          )}
        </g>
        <polyline points={`${tick(R - STROKE / 2 - 1)} ${tick(R + STROKE / 2 + 4)}`} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-4xl font-bold tabular-nums">{value === null ? '—' : <><span ref={num}>{value.toFixed(1)}</span>%</>}</div>
          <div className="mt-0.5 text-xs text-white/80">{value === null ? 'No data yet' : `${REQUIRED_PCT}% required`}</div>
        </div>
      </div>
    </div>
  )
}

export function HeroCard({ overall, totals, priority }: {
  overall: number | null
  totals: { total: number; attended: number; missed: number }
  priority: SubjectStat | null
}) {
  const buffer = bufferPoints(overall)
  const above = overall !== null && overall >= REQUIRED_PCT
  const pctOf = (n: number) => percent(n, totals.total)
  const tiles = [
    { label: 'Total lectures', value: totals.total, sub: 'this semester so far' },
    { label: 'Attended', value: totals.attended, sub: pctOf(totals.attended) === null ? '' : `${pctOf(totals.attended)}% of total` },
    { label: 'Missed', value: totals.missed, sub: pctOf(totals.missed) === null ? '' : `${pctOf(totals.missed)}% of total` },
  ]
  return (
    <section aria-label="Overall attendance" className="relative overflow-hidden rounded-xl border border-brand-800 text-white shadow-soft transition duration-150 hover:-translate-y-0.5 hover:shadow-md" style={{ background: 'linear-gradient(135deg, var(--brand-950), var(--brand-800))' }}>
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-64 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#fff 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }} aria-hidden />
      <div className="relative flex flex-col items-center gap-8 p-6 md:p-8 lg:flex-row lg:items-center">
        <Ring value={overall} />
        <div className="flex-1 text-center lg:text-left">
          <div className="text-[13px] font-medium uppercase tracking-wide text-white/80">Overall attendance</div>
          <div className="mt-1 text-5xl font-extrabold tabular-nums">{overall === null ? 'No data yet' : `${overall}%`}</div>
          {overall !== null && (
            <>
              <span className={`mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold tracking-wide ${above ? 'border-green-400/40 bg-green-500/20 text-green-200' : 'border-red-400/40 bg-red-500/25 text-red-100'}`}>
                {above ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{above ? 'ABOVE REQUIREMENT' : 'BELOW REQUIREMENT'}
              </span>
              <p className="mt-2 text-sm text-white/85">{buffer! >= 0 ? `${buffer} points above` : `${Math.abs(buffer!)} points below`} the {REQUIRED_PCT}% minimum</p>
            </>
          )}
        </div>
        <div className="grid w-full grid-cols-3 gap-3 lg:w-auto lg:min-w-[400px]">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-white/15 bg-white/[0.08] p-3 backdrop-blur-sm sm:p-4">
              <div className="text-xs text-white/80 sm:text-[13px]">{t.label}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums sm:text-[28px]">{t.value}</div>
              <div className="text-xs text-white/80">{t.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative flex items-center justify-between gap-4 border-t border-white/10 bg-black/15 px-6 py-3.5 md:px-8">
        <p className="flex items-start gap-2 text-sm"><CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
          {priority === null
            ? (overall === null ? 'No attendance has been recorded yet.' : `All subjects are at or above ${REQUIRED_PCT}%. Keep it up.`)
            : priority.status.label === 'Critical'
              ? <span><b>{priority.name}</b> needs attention — attend the next {plural(priority.mustAttend, 'lecture')} to reach {REQUIRED_PCT}%.</span>
              : <span><b>{priority.name}</b> is closest to the limit — you can miss only {plural(priority.canMiss, 'more lecture')}.</span>}
        </p>
        {priority && <button onClick={() => scrollToId(`subject-${priority.code}`)} aria-label={`Go to ${priority.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 hover:bg-white/25"><ArrowRight className="h-4 w-4" /></button>}
      </div>
    </section>
  )
}
