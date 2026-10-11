import { useEffect, useState } from 'react'
import { getConsent, onConsentChange, setConsent } from '../consent'

// Asked once, as a one-line strip on the bottom edge. The page reserves room
// for it (body.has-consent), so it never covers the form or the map
// controls. Declining is as easy as accepting (same weight, same size).
export default function ConsentBar() {
  const [choice, setChoice] = useState(getConsent)
  // Not in the first seconds of a visit: the question waits until the visitor
  // scrolls or has spent a few seconds here (Clarity stays off until then anyway).
  const [ready, setReady] = useState(false)
  useEffect(() => onConsentChange(setChoice), [])
  useEffect(() => {
    if (choice) return
    const show = () => setReady(true)
    const t = setTimeout(show, 8000)
    const onScroll = () => { if (window.scrollY > 200) show() }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll) }
  }, [choice])
  const visible = !choice && ready
  useEffect(() => {
    document.body.classList.toggle('has-consent', visible)
    return () => document.body.classList.remove('has-consent')
  }, [visible])
  if (!visible) return null
  return (
    <section className="consent-bar" role="region" aria-label="Analytics consent">
      <p className="consent-text">
        Record anonymised sessions (Microsoft Clarity)?<span className="consent-more"> It helps improve Axonis; typed topics are masked.</span>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setConsent('denied')}>Decline</button>
        <button type="button" className="btn btn-secondary" onClick={() => setConsent('granted')}>Accept</button>
      </div>
    </section>
  )
}
