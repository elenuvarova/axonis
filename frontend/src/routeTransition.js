import { flushSync } from 'react-dom'

// Home → map as one scene: the picked topic flies into the breadcrumb and
// the hero's stage grows into the map's canvas (View Transitions API).
// Falls back to a plain navigation where unsupported or under reduced motion.
export function navigateWithTransition(navigate, to, { topicEl } = {}) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced || typeof document === 'undefined' || !document.startViewTransition) { navigate(to); return }
  const root = document.documentElement
  if (topicEl) topicEl.style.viewTransitionName = 'topic'
  root.classList.add('vt-route')
  const vt = document.startViewTransition(() => {
    if (topicEl) topicEl.style.viewTransitionName = ''
    flushSync(() => navigate(to))
  })
  vt.finished.finally(() => root.classList.remove('vt-route'))
}
