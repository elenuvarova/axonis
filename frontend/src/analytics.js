// Product events for the self-hosted Umami (stats.ontwrpn.com), mirrored to
// Microsoft Clarity as custom events so recordings can be filtered by them.
// A no-op when a script is blocked or absent (dev, tests, ad blockers). Never send what a
// visitor typed: event props are fixed labels, counts and demo topics only.
export function track(name, data) {
  try {
    if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
      window.umami.track(name, data)
    }
    if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
      window.clarity('event', name)
    }
  } catch { /* analytics must never break the app */ }
}
