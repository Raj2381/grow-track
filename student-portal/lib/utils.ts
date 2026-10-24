import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Level } from '@student/types'
import type { Tone } from './scoring'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', opts)

/** Status colours used everywhere: green = good, amber = warning, red = at risk. */
export const TONE = {
  good: { text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30', solid: 'bg-success', hex: 'var(--success)' },
  warn: { text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30', solid: 'bg-warning', hex: 'var(--warning)' },
  bad: { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', solid: 'bg-danger', hex: 'var(--danger)' },
} as const

export const levelTone = (l: Level): Tone => (l === 'Low' ? 'good' : l === 'Medium' ? 'warn' : 'bad')
export const scoreTone = (n: number): Tone => (n >= 75 ? 'good' : n >= 50 ? 'warn' : 'bad')
export const PRIMARY = 'var(--chart-primary)'
