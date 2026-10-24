import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties, ElementType, ReactNode } from 'react'

type FadeUpProps = {
  children: ReactNode
  delay?: number
  duration?: number
  y?: number
  className?: string
  style?: CSSProperties
  as?: 'div' | 'section' | 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'nav'
  once?: boolean
}

/** Fade + rise on scroll into view. Renders a plain element when the user prefers reduced motion. */
export function FadeUp({ children, delay = 0, duration = 0.7, y = 24, className, style, as = 'div', once = true }: FadeUpProps) {
  const reduce = useReducedMotion()
  if (reduce) {
    const Plain = as as ElementType
    return <Plain className={className} style={style}>{children}</Plain>
  }
  const Tag = motion[as] as ElementType
  return (
    <Tag
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  )
}
