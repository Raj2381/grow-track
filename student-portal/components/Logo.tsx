import { cn } from '@student/lib/utils'

export function Logo({ size = 32, withWordmark = true, className, wordClassName }: { size?: number; withWordmark?: boolean; className?: string; wordClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/growthtrack-mark.svg" width={size} height={size} alt={withWordmark ? '' : 'GrowthTrack'} className="shrink-0 rounded-md object-contain" style={{ width: size, height: size }} />
      {withWordmark && <span className={cn('text-lg font-bold tracking-tight', wordClassName)}>GrowthTrack</span>}
    </span>
  )
}
