import * as React from 'react'
import { cn, TONE } from '@student/lib/utils'
import type { Tone } from '@student/lib/scoring'

export function Badge({ tone, className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone | 'neutral' | 'primary' }) {
  const t = tone ?? 'neutral'
  const cls =
    t === 'neutral' ? 'bg-muted text-muted-foreground border-border'
    : t === 'primary' ? 'bg-primary/10 text-primary border-primary/20'
    : `${TONE[t].bg} ${TONE[t].text} ${TONE[t].border}`
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', cls, className)} {...p} />
}
