import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'

export interface Person { id: string; name: string; rollNo: string; branch?: string }

/** Searchable picker for the faculty/admin "view as student" switch. Scales to the whole student directory. */
export function StudentPicker({ people, studentId, defaultId, onPick }: {
  people: Person[]
  studentId: string
  defaultId: string
  onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const current = people.find((p) => p.id === studentId)
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = term ? people.filter((p) => `${p.name} ${p.rollNo} ${p.id}`.toLowerCase().includes(term)) : people
    return list.slice(0, 8)
  }, [people, q])
  const choose = (id: string) => { setQ(''); setOpen(false); onPick(id) }
  const label = (p: Person) => (p.id === defaultId ? `${p.name} (me)` : p.name)

  return (
    <div className="relative hidden xl:block">
      <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        value={open ? q : current ? label(current) : ''}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => { setQ(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) choose(matches[0].id); if (e.key === 'Escape') setOpen(false) }}
        placeholder="Search students…"
        aria-label="View as student"
        title="Faculty/admin view: open any student's dashboard"
        className="h-9 w-44 rounded-lg border border-border bg-card pl-2 pr-7 text-xs outline-none focus:ring-2 focus:ring-brand-400"
      />
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-72 rounded-lg border border-border bg-card p-1 shadow-lg" role="listbox">
          {matches.length === 0 ? <div className="px-3 py-2 text-sm text-muted-foreground">No student matches</div> : matches.map((p) => (
            <button key={p.id} role="option" aria-selected={p.id === studentId} onMouseDown={() => choose(p.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted">
              <span className="truncate">{label(p)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{p.rollNo}</span>
            </button>
          ))}
          <div className="px-3 py-1 text-[11px] text-muted-foreground">{people.length} students · type to search</div>
        </div>
      )}
    </div>
  )
}
