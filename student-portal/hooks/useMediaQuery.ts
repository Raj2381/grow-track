import { useEffect, useState } from 'react'
export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q); const h = () => setM(mq.matches)
    h(); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h)
  }, [q])
  return m
}
