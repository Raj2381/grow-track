import * as React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, TONE } from '@student/lib/utils'
import type { Tone } from '@student/lib/scoring'

/* ------------------------------- Skeleton --------------------------------- */
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-xl bg-muted', className)} />

/* ------------------------------- Progress --------------------------------- */
export function Progress({ value, tone = 'good', className, marker }: { value: number; tone?: Tone | 'primary'; className?: string; marker?: number }) {
  const color = tone === 'primary' ? 'bg-primary' : TONE[tone].solid
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      {marker !== undefined && <div className="absolute top-0 h-full w-0.5 bg-foreground/60" style={{ left: `${marker}%` }} />}
    </div>
  )
}

/* --------------------------------- Inputs --------------------------------- */
const field = 'w-full rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-subtle focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50'
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, 'h-10', className)} {...p} />
))
Input.displayName = 'Input'
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, 'min-h-[80px] py-2', className)} {...p} />
))
Textarea.displayName = 'Textarea'
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className={cn(field, 'h-10', className)} {...p} />
export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label className={cn('mb-1 block text-xs font-medium text-muted-foreground', className)} {...p} />

/* ---------------------------------- Tabs ---------------------------------- */
const TabsCtx = createContext<{ value: string; set: (v: string) => void }>({ value: '', set: () => {} })
export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: React.ReactNode; className?: string }) {
  const [value, set] = useState(defaultValue)
  return <TabsCtx.Provider value={{ value, set }}><div className={className}>{children}</div></TabsCtx.Provider>
}
export const TabsList = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="tablist" className={cn('mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1', className)} {...p} />
)
export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const c = useContext(TabsCtx)
  const active = c.value === value
  return (
    <button role="tab" aria-selected={active} onClick={() => c.set(value)}
      className={cn('whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition', active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
      {children}
    </button>
  )
}
export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  return useContext(TabsCtx).value === value ? <div>{children}</div> : null
}

/* --------------------------------- Modal ---------------------------------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={cn('max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* --------------------------------- Toasts (sonner) --------------------------------- */
export const useToast = () => ({
  success: (t: string) => { toast.success(t) },
  error: (t: string) => { toast.error(t) },
  info: (t: string) => { toast(t) },
})
export { Toaster } from 'sonner'

/* ------------------------------- Bottom sheet ------------------------------- */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[75vh] w-full overflow-y-auto rounded-t-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  )
}

/* ---------------------------- Side drawer (Sheet) ---------------------------- */
export function Sheet({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[520px] flex-col border-l border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  )
}
