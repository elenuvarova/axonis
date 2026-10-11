import { useEffect, useRef, useState } from 'react'
import { pad } from '../format'
import usePrefersReducedMotion from '../usePrefersReducedMotion'

// A number that counts up once, the first time it appears with a real value
// (a map loading), then simply shows later values: numbers that move when
// nothing changed would be fake activity. Zero-padded mono digits keep the
// width fixed, so nothing around it shifts.
export default function Ticker({ value = 0, digits = 0, duration = 600 }) {
  const reduced = usePrefersReducedMotion()
  const done = useRef(false)
  const [shown, setShown] = useState(reduced ? value : 0)

  useEffect(() => {
    if (reduced || done.current || !value) { setShown(value); if (value) done.current = true; return }
    done.current = true
    const start = performance.now()
    let raf = 0
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setShown(value) }
  }, [value, reduced, duration])

  const text = digits ? pad(shown, digits) : String(shown)
  return (
    <span className="ticker">
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{value}</span>
    </span>
  )
}
