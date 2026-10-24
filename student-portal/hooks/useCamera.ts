import { useCallback, useEffect, useRef, useState } from 'react'

/** Webcam preview only — nothing is recorded or uploaded. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [on, setOn] = useState(false)
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setOn(false)
  }, [])
  const start = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = s
      setOn(true)
      setError('')
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = s })
    } catch {
      setError('Camera unavailable or permission denied.')
    }
  }, [])
  useEffect(() => () => stop(), [stop])
  return { videoRef, on, error, start, stop }
}
