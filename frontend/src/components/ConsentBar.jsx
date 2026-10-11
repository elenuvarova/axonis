import { useEffect, useState } from 'react'
import { getConsent, onConsentChange, setConsent } from '../consent'

// Asked once, at the bottom edge, without blocking the page. Declining is
// as easy as accepting (same weight, same size).
export default function ConsentBar() {
  const [choice, setChoice] = useState(getConsent)
  useEffect(() => onConsentChange(setChoice), [])
  if (choice) return null
  return (
    <section className="consent-bar" role="region" aria-label="Analytics consent">
      <p className="consent-text">
        May we record anonymised sessions with Microsoft Clarity to see where Axonis is hard to use?
        Topics you type are masked. Page counts (Umami) are cookieless and always on.
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setConsent('denied')}>Decline</button>
        <button type="button" className="btn btn-secondary" onClick={() => setConsent('granted')}>Accept</button>
      </div>
    </section>
  )
}
