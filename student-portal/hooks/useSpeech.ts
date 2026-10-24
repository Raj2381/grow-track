import { useCallback, useEffect, useRef, useState } from 'react'

/** Thin wrapper around the Web Speech API (speech-to-text). Works in Chrome/Edge/Safari. */
export function useSpeech() {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const supported = Boolean(Ctor)
  const recRef = useRef<any>(null)
  const [listening, setListening] = useState(false)
  const [final, setFinal] = useState('')
  const [interim, setInterim] = useState('')
  const wantRef = useRef(false)

  const start = useCallback(() => {
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (e: any) => {
      let fin = '', inter = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) fin += t + ' '
        else inter += t
      }
      if (fin) setFinal((p) => (p + fin).replace(/\s+/g, ' '))
      setInterim(inter)
    }
    rec.onend = () => {
      // browsers stop after silence; restart while the user still wants to listen
      if (wantRef.current) { try { rec.start() } catch { /* already started */ } } else setListening(false)
    }
    rec.onerror = () => { wantRef.current = false; setListening(false) }
    recRef.current = rec
    wantRef.current = true
    try { rec.start(); setListening(true) } catch { /* noop */ }
  }, [Ctor])

  const stop = useCallback(() => {
    wantRef.current = false
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const reset = useCallback(() => { setFinal(''); setInterim('') }, [])
  useEffect(() => () => { wantRef.current = false; recRef.current?.abort?.() }, [])
  return { supported, listening, final, interim, start, stop, reset, setFinal }
}
