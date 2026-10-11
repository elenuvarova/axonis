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

/* ── Building screen ──
   Driven by the real pipeline: the project poll carries `progress` (current
   stage, real counts, timestamped log lines from the backend). Nothing here
   advances on a timer. If no progress is reported (an older server, or a
   document upload), the steps are shown as the typical order without marks. */
const FALLBACK_STEPS = [
  { key: 'expand', label: 'Expanding the topic into search terms' },
  { key: 'wikidata', label: 'Fetching concepts from Wikidata' },
  { key: 'openalex', label: 'Querying OpenAlex for research & institutions' },
  { key: 'resolve', label: 'Resolving & de-duplicating entities' },
  { key: 'persist', label: 'Saving entities & relationships' },
  { key: 'metrics', label: 'Computing graph metrics & clusters' },
  { key: 'insights', label: 'Scoring opportunities & writing AI insights' },
]
const USUAL_SECONDS = 60


export function BuildingScreen({ topic, progress, preview }) {
  const [mountedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const steps = progress?.stages || FALLBACK_STEPS
  const active = progress ? progress.stage_index : -1
  // Server start time when we have it (survives a reload); never negative
  // even if the two clocks disagree a little.
  const startMs = progress?.started_at ? Math.min(progress.started_at * 1000, mountedAt) : mountedAt
  const elapsed = (now - startMs) / 1000
  const overrun = elapsed > USUAL_SECONDS
  const log = (progress?.log || []).slice(-8)

  return (
    <div className="build-screen">
      <section className="build-left">
        <div className="label build-kicker" data-clarity-mask="true">Build{topic ? ` · ${topic}` : ''}</div>
        <h1 className="build-title">Building your map</h1>
        <p className="build-subtitle">
          {overrun
            ? <>Taking longer than usual · {mmss(elapsed)}. Wikidata and OpenAlex can be slow; the build is still running.</>
            : 'This usually takes under a minute. You can leave — the map keeps building and appears in Recent when ready.'}
        </p>

        {!progress && <div className="label build-order-label">Typical order</div>}
        {/* role="status" / aria-live="polite" announces stage changes to screen readers */}
        <ol className="build-steps" role="status" aria-live="polite" aria-atomic="false">
          {steps.map((step, i) => {
            const state = !progress ? 'is-typical' : i < active ? 'is-done' : i === active ? 'is-active' : ''
            const mark = !progress ? `${pad(i + 1)} ` : i < active ? '[✓]' : i === active ? '[>]' : '[ ]'
            return (
              <li key={step.key} className={`build-step ${state}`}>
                <span className="build-step-mark" aria-hidden="true">{mark}</span>
                <span>{step.label}</span>
                {progress && i < active && <span className="sr-only"> (done)</span>}
                {progress && i === active && <span className="sr-only"> (in progress)</span>}
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
          {progress ? (
            [['Concepts', 'wikidata'], ['Papers', 'papers'], ['Institutions', 'institutions']].map(([label, key]) => (
              <div className="counter" key={key}>
                <div className="label">{label}</div>
                {/* a dash until the server has reported this source */}
                <div className="counter-num">{progress.counts?.[key] != null ? pad(progress.counts[key], 3) : <span className="counter-pending">—</span>}</div>
              </div>
            ))
          ) : null}
        </div>

        <div className="log-panel">
          <div className="log-head">
            <span className="label">{progress ? 'Build log' : 'Waiting for the server'}</span>
            {/* key = last line count, so the dot re-flashes on every real event */}
            <span className="live-tag" key={progress?.log?.length || 0}><span className="accent-dot live-pulse" aria-hidden="true" />live</span>
          </div>
          {log.length > 0 ? (
            <ul className="log-list">
              {log.map((line, i) => (
                <li key={`${line.t}-${i}`} className={`log-line${i === log.length - 1 ? ' is-live' : ''}`}>
                  <span className="log-time">{clock(new Date(line.t * 1000))}</span>
                  <span className="log-source">{line.source}</span>
                  <span className="log-msg">{line.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="log-empty">No events reported yet. Steps appear here as the server completes them.</p>
          )}
        </div>
        <div className="build-preview">
          <div className="log-head">
            <span className="label">Preview · the saved graph</span>
          </div>
          {preview || (
            <p className="log-empty">The map appears here once entities are saved — after resolving, before metrics and AI insights.</p>
          )}
        </div>
      </section>
    </div>
  )
}
