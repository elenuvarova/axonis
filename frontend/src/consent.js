// Session recordings (Microsoft Clarity) set cookies and record behaviour, so
// in the EU they need opt-in consent. Clarity loads only after "Accept";
// Umami is cookieless, self-hosted and stays on. The choice lives in this
// browser only and can be changed from the home page footer.
const KEY = 'axonis-consent'
const CLARITY_ID = 'yw1dswq8qf'
const listeners = new Set()

export function getConsent() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch { return null }
}

export function setConsent(value) {
  try { localStorage.setItem(KEY, value) } catch { /* private mode: ask again next visit */ }
  if (value === 'granted') loadClarity()
  else if (typeof window.clarity === 'function') window.clarity('consent', false)
  listeners.forEach((fn) => fn(value))
}

export function resetConsent() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  listeners.forEach((fn) => fn(null))
}

export function onConsentChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let loaded = false
export function loadClarity() {
  if (loaded || typeof window === 'undefined' || typeof document === 'undefined') return
  if (import.meta.env.MODE !== 'production') return // no recordings from dev or tests
  loaded = true
  const c = window
  c.clarity = c.clarity || function (...args) { (c.clarity.q = c.clarity.q || []).push(args) }
  const t = document.createElement('script')
  t.async = true
  t.src = `https://www.clarity.ms/tag/${CLARITY_ID}`
  document.head.appendChild(t)
  c.clarity('consent')
}

// Returning visitor who already agreed.
export function initConsent() {
  if (getConsent() === 'granted') loadClarity()
}
