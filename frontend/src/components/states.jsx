import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clock, mmss, pad } from '../format'
import Icon from './icons'

/* ── Icons ── */
export function AlertIcon() {
  return <Icon name="warning" size={24} />
}
export function GhostIcon() {
  return <Icon name="search" size={24} />
}
function CloseIcon() {
  return <Icon name="close" size={14} />
}

/* ── Centred state screen (error / empty / not-found) ── */
export function StateScreen({ variant = 'empty', icon, title, message, actions }) {
  return (
    <div className="state-screen">
      <div className={`state-icon is-${variant}`}>{icon || (variant === 'error' ? <AlertIcon /> : <GhostIcon />)}</div>
      {title && <div className="state-title">{title}</div>}
      {message && <p className="state-message">{message}</p>}
      {actions && <div className="state-actions">{actions}</div>}
    </div>
  )
}

/* ── Inline, dismissible error banner ── */
export function InlineError({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="inline-error" role="alert">
      <AlertIcon />
      <span className="inline-error-text">{message}</span>
      {onDismiss && (
        <button className="inline-error-close" onClick={onDismiss} aria-label="Dismiss">×</button>
      )}
    </div>
  )
}

/* ── Transient toast ──  [OK] / [ERR] · message · ×  */
export function Toast({ message, onClose, tone = 'error' }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onClose?.(), 4000)
    return () => clearTimeout(t)
  }, [message, onClose])
  if (!message) return null
  return (
    <div className="toast" role="status">
      <span className={`toast-tag${tone === 'ok' ? ' is-ok' : ''}`} aria-hidden="true">{tone === 'ok' ? '[OK]' : '[ERR]'}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Dismiss"><CloseIcon /></button>
    </div>
  )
}

/* ── Skeletons ── */
export function SkeletonLine({ width = '100%', height = 12 }) {
  return <div className="skeleton skeleton-line" style={{ width, height }} />
}
export function ClusterSkeleton({ rows = 5 }) {
  return (
    <div className="cluster-panel">
      <SkeletonLine width="40%" height={10} />
      <div style={{ height: 12 }} />
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
    </div>
  )
}
export function OppSkeleton({ cards = 4 }) {
  return (
    <div className="opp-board">
      <SkeletonLine width="30%" height={10} />
      <div style={{ height: 16 }} />
      <div className="opp-grid">
        {Array.from({ length: cards }).map((_, i) => <div key={i} className="skeleton skeleton-opp" />)}
      </div>
    </div>
  )
}
export function EntitySkeleton() {
  return (
    <div className="entity-card">
      <SkeletonLine width="35%" height={18} />
      <div style={{ height: 8 }} />
      <SkeletonLine width="70%" height={20} />
      <div style={{ height: 16 }} />
      <SkeletonLine width="100%" /><SkeletonLine width="92%" /><SkeletonLine width="60%" />
      <div style={{ height: 16 }} />
      <div className="entity-meta">
        <div className="skeleton" style={{ height: 52, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 52, borderRadius: 6 }} />
      </div>
    </div>
  )
}

/* ── Staged building screen ──
   The backend reports only "building", so these stages advance on a timer to
   show what the pipeline is doing during the ~30s build. They are the real
   pipeline steps, in order. The elapsed counter and the log timestamps are
   real clock time; no entity counts are shown because none are reported. */
const BUILD_STEPS = [
  { label: 'Expanding the topic into search terms', source: 'topic' },
  { label: 'Fetching concepts from Wikidata', source: 'wikidata' },
  { label: 'Querying OpenAlex for research & institutions', source: 'openalex' },
  { label: 'Resolving & de-duplicating entities', source: 'resolve' },
  { label: 'Building the graph & computing metrics', source: 'graph' },
  { label: 'Detecting knowledge clusters', source: 'cluster' },
  { label: 'Scoring product opportunities', source: 'score' },
  { label: 'Writing AI insights', source: 'insights' },
]
const STEP_MS = 3800

export function BuildingScreen({ topic }) {
  const [active, setActive] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [log, setLog] = useState(() => [{ time: clock(), source: BUILD_STEPS[0].source, message: `step 1/${BUILD_STEPS.length} · ${BUILD_STEPS[0].label}` }])

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i < BUILD_STEPS.length - 1 ? i + 1 : i))
    }, STEP_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 1000)
    return () => clearInterval(id)
  }, [])

  // Append one real-timestamped line each time the active step changes.
  useEffect(() => {
    if (active === 0) return
    const step = BUILD_STEPS[active]
    setLog((l) => [...l, { time: clock(), source: step.source, message: `step ${active + 1}/${BUILD_STEPS.length} · ${step.label}` }])
  }, [active])

  return (
    <div className="build-screen">
      <section className="build-left">
        <div className="label build-kicker">Build{topic ? ` · ${topic}` : ''}</div>
        <h1 className="build-title">Building your map</h1>
        <p className="build-subtitle">
          This usually takes about 30 seconds, sometimes longer. You can leave — the map keeps building and appears in Recent when ready.
        </p>

        {/* role="status" / aria-live="polite" announces build progress to screen readers (S-5) */}
        <ol className="build-steps" role="status" aria-live="polite" aria-atomic="false">
          {BUILD_STEPS.map((step, i) => {
            const state = i < active ? 'is-done' : i === active ? 'is-active' : ''
            const mark = i < active ? '[✓]' : i === active ? '[>]' : '[ ]'
            return (
              <li key={step.label} className={`build-step ${state}`}>
                <span className="build-step-mark" aria-hidden="true">{mark}</span>
                <span>{step.label}</span>
                {i < active && <span className="sr-only"> (done)</span>}
                {i === active && <span className="sr-only"> (in progress)</span>}
              </li>
            )
          })}
        </ol>

        <Link to="/" className="btn btn-ghost build-back">Back to home</Link>
      </section>

      <section className="build-right">
        <div className="counters">
          <div className="counter">
            <div className="label">Elapsed</div>
            <div className="counter-num">{mmss(elapsed)}</div>
          </div>
          <div className="counter">
            <div className="label">Step</div>
            <div className="counter-num">{pad(active + 1)}<span className="counter-of">/{pad(BUILD_STEPS.length)}</span></div>
          </div>
        </div>

        <div className="log-panel">
          <div className="log-head">
            <span className="label">Live log</span>
            <span className="live-tag"><span className="accent-dot" aria-hidden="true" />live</span>
          </div>
          <ul className="log-list">
            {log.map((line, i) => (
              <li key={i} className={`log-line${i === log.length - 1 ? ' is-live' : ''}`}>
                <span className="log-time">{line.time}</span>
                <span className="log-source">{line.source}</span>
                <span className="log-msg">{line.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
