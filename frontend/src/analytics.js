// Product events for the self-hosted Umami (stats.ontwrpn.com). A no-op when
// the script is blocked or absent (dev, tests, ad blockers). Never send what a
// visitor typed: event props are fixed labels, counts and demo topics only.
export function track(name, data) {
  try {
    if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
      window.umami.track(name, data)
    }
  } catch { /* analytics must never break the app */ }
}
