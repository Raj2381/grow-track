import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@student/components/ui/card'
import { REQUIRED_PCT, type SubjectStat } from '@student/lib/attendance'

/** Marker colours by attendance category (status is also written in the tooltip and the text summary, never colour alone). */
const CATEGORY = {
  bad: { hex: '#DC2626', name: 'Critical' },
  warn: { hex: '#D97706', name: 'At risk' },
  good: { hex: '#16A34A', name: 'Good' },
} as const
const LINE = '#2563EB'
const LEGEND = { bad: 'Critical attendance', warn: 'Attendance at risk', good: 'Good attendance' } as const

interface Row { code: string; name: string; short: string; attendance: number; attended: number; total: number; tone: keyof typeof CATEGORY; label: string }

type DotProps = { cx?: number; cy?: number; payload?: Row }

/** A circular marker coloured by category, with a white ring so it stands out on the line. */
function Marker({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return <g />
  return <circle cx={cx} cy={cy} r={7} fill={CATEGORY[payload.tone].hex} stroke="#FFFFFF" strokeWidth={2.5} />
}

/**
 * The exact percentage next to each marker, with a white halo so it stays readable over gridlines and the line. Subjects below the
 * minimum are labelled underneath their marker and the rest above, which keeps every label clear of the reference line's own label.
 */
function PercentLabel({ x, y, value }: { x?: number; y?: number; value?: number | string }) {
  if (x === undefined || y === undefined || value === undefined) return null
  return (
    <text x={x} y={Number(value) < REQUIRED_PCT ? y + 26 : y - 14} textAnchor="middle" fontSize={14} fontWeight={700} fill="#0F172A" stroke="#FFFFFF" strokeWidth={4} paintOrder="stroke">
      {value}%
    </text>
  )
}

export function SubjectChart({ stats, onPick, filter = 'all' }: { stats: SubjectStat[]; onPick: (code: string) => void; filter?: string }) {
  const data: Row[] = stats
    .filter((s) => s.percent !== null && (filter === 'all' || s.code === filter))
    .sort((a, b) => a.percent! - b.percent!)
    .map((s) => ({
      code: s.code, name: s.name, short: s.short, attendance: s.percent!, attended: s.attended, total: s.total,
      tone: (s.status.tone === 'none' ? 'warn' : s.status.tone) as keyof typeof CATEGORY, label: s.status.label,
    }))
  const summary = `Line chart of attendance by subject, lowest first. ${data.map((d) => `${d.short} ${d.attendance} percent, ${CATEGORY[d.tone].name}`).join('; ')}. Minimum required attendance ${REQUIRED_PCT} percent.`

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-[18px] text-[#0F172A] [.dark_&]:text-foreground">Subject-wise Attendance</CardTitle>
        <CardDescription className="text-[14px] text-[#475569] [.dark_&]:text-muted-foreground">Compare attendance percentages across subjects. Lower percentages indicate higher risk.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] font-medium text-[#334155] [.dark_&]:text-foreground" aria-label="Legend">
          {(Object.keys(CATEGORY) as (keyof typeof CATEGORY)[]).map((k) => (
            <li key={k} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: CATEGORY[k].hex }} aria-hidden />{LEGEND[k]}</li>
          ))}
          <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed" style={{ borderColor: '#475569' }} aria-hidden />Minimum required attendance</li>
        </ul>
        {data.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-[#475569]">No lectures recorded for this selection yet.</p>
        ) : (
          <div className="h-[340px] rounded-lg bg-white p-2 sm:h-[380px] [.dark_&]:bg-transparent" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 36, right: 24, left: 4, bottom: 8 }} accessibilityLayer>
                <CartesianGrid stroke="#E2E8F0" strokeWidth={1} vertical={false} />
                <XAxis dataKey="short" type="category" interval={0} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} tick={{ fontSize: 13, fontWeight: 600, fill: '#334155' }} padding={{ left: 28, right: 28 }} />
                <YAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={48} tick={{ fontSize: 13, fill: '#334155' }} />
                <Tooltip cursor={{ stroke: '#94A3B8', strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  const r = active && (payload?.[0]?.payload as Row | undefined)
                  if (!r) return null
                  return (
                    <div className="rounded-lg border border-[#CBD5E1] bg-white p-3 text-[13px] text-[#334155] shadow-lg">
                      <div className="mb-1 text-[14px] font-semibold text-[#0F172A]">{r.short} · {r.name}</div>
                      <div>Attendance: <b className="text-[#0F172A]">{r.attendance}%</b></div>
                      <div>Lectures: <b className="text-[#0F172A]">{r.attended}</b> attended of <b className="text-[#0F172A]">{r.total}</b></div>
                      <div className="mt-1 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY[r.tone].hex }} aria-hidden />{CATEGORY[r.tone].name}{r.label !== CATEGORY[r.tone].name ? ` (${r.label})` : ''}</div>
                    </div>
                  )
                }} />
                <ReferenceLine y={REQUIRED_PCT} stroke="#475569" strokeDasharray="6 5" strokeWidth={1.5}
                  label={({ viewBox }: { viewBox?: { x: number; y: number; width: number } }) => viewBox ? (
                    <text x={viewBox.x + viewBox.width - 8} y={viewBox.y + 22} textAnchor="end" fontSize={13} fontWeight={600} fill="#334155" stroke="#FFFFFF" strokeWidth={4} paintOrder="stroke">
                      Minimum Required Attendance — {REQUIRED_PCT}%
                    </text>
                  ) : <g />} />
                <Line type="linear" dataKey="attendance" stroke={LINE} strokeWidth={2.5} isAnimationActive={false}
                  dot={<Marker />} activeDot={(p: DotProps) => <Marker {...p} />} label={<PercentLabel />}
                  onClick={(e) => { const row = (e as unknown as { payload?: Row }).payload; if (row) onPick(row.code) }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[13px] text-[#475569] [.dark_&]:text-muted-foreground">The blue line joins the subjects from lowest to highest attendance; it is a comparison, not a trend over time.</p>
      </CardContent>
    </Card>
  )
}
