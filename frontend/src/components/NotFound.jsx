import { Link } from 'react-router-dom'
import GapField from './GapField'
import usePrefersReducedMotion from '../usePrefersReducedMotion'

const DEMO_PATH = '/project/07796417-cbc2-464e-9185-8b1cf1645ee6'

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// The body of every "nothing here" screen: an unknown URL, or a map that
// doesn't exist (any more). The scene above is decoration; the heading says it.
export function NotFound({ title, message, path }) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <div className="nf">
      <div className="nf-stage">
        <GapField reducedMotion={reducedMotion} sublabel={path ? clip(path, 26) : 'Nothing here'} />
      </div>
      <div className="nf-copy">
        <p className="nf-k">404 · Gap</p>
        <h1 className="nf-title">{title}</h1>
        <p className="nf-message">{message}</p>
        <div className="state-actions">
          <Link className="btn btn-primary" to={DEMO_PATH}>Open a demo map</Link>
          <Link className="btn btn-secondary" to="/">Go home</Link>
        </div>
      </div>
    </div>
  )
}
