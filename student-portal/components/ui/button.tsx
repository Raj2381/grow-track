import * as React from 'react'
import { cn } from '@student/lib/utils'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg' | 'icon'
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-brand-700 dark:hover:bg-brand-300',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'hover:bg-muted',
  danger: 'bg-danger text-white hover:bg-red-700',
  soft: 'bg-primary/10 text-primary hover:bg-primary/20',
}
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-6 text-sm', icon: 'h-9 w-9' }

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size = 'md', ...p }, ref) => (
  <button
    ref={ref}
    className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background', variants[variant], sizes[size], className)}
    {...p}
  />
))
Button.displayName = 'Button'
