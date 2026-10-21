import { useEffect, useRef } from 'react'
import { EntitySkeleton } from './states'
import CellBar from './CellBar'
import { typeGlyph, typeGlyphOutline, typeLabel, TYPE_ORDER } from '../graphTypes'
import { pad, shortLabel, displayName } from '../format'

function Metric({ label, value, bar }) {
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      {bar != null ? <CellBar value={bar} /> : <span className="metric-spacer" />}
      <span className="metric-value">{value}</span>
    </div>
  )
}

// Nothing selected: instead of an empty panel, a way in. The best-connected
// nodes are one click away, and the type mix says what the map is made of.
function Overview({ nodes = [], onPick, onHover, gapCount = 0, onShowGaps, gapsPending, hiddenTypes, onToggleType }) {
  const hubs = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0)).slice(0, 5)
  const counts = {}
  for (const n of nodes) counts[n.type] = (counts[n.type] || 0) + 1
  const types = [...TYPE_ORDER.filter((t) => counts[t]), ...Object.keys(counts).filter((t) => !TYPE_ORDER.includes(t))]
  return (
    <div className="entity-card entity-overview">
      <div className="entity-scroll">
        <div className="label">Selection · none</div>
        <p className="entity-overview-hint">Click any node to see its details, metrics and connections, or press <kbd>⌘K</kbd> to find one.</p>
        {onShowGaps && gapCount > 0 && (
          <button type="button" className="btn btn-ghost entity-overview-gaps" onClick={onShowGaps}>Show the {gapCount} top gaps <span aria-hidden="true">→</span></button>
        )}
        {/* the gaps button's room is kept while the opportunities load: the lists below do not jump */}
        {gapsPending && !onShowGaps && <span className="btn btn-ghost entity-overview-gaps is-pending" aria-hidden="true">Show the 3 top gaps →</span>}
        {hubs.length > 0 && (
          <section className="entity-section">
            <h2 className="label">Best connected</h2>
            <ul className="entity-overview-hubs">
              {hubs.map((n, i) => (
                <li key={n.id}>
                  <button type="button" className="entity-overview-hub" title={n.name}
                    onClick={() => onPick?.(n.id)}
                    onMouseEnter={() => onHover?.(n.id)} onMouseLeave={() => onHover?.(null)}
                    onFocus={() => onHover?.(n.id)} onBlur={() => onHover?.(null)}>
                    <span className="entity-overview-rank" aria-hidden="true">{pad(i + 1)}</span>
                    <span className="entity-overview-glyph" aria-hidden="true">{typeGlyph(n.type)}</span>
                    <span className="entity-overview-name">{displayName(n.name)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {types.length > 0 && (
          <section className="entity-section">
            <h2 className="label">{`On this map · ${nodes.length} nodes`}</h2>
            <dl className="entity-overview-types">
              {types.map((t) => (
                <div key={t} className="metric-row">
                  <dt className="metric-label">
                    {onToggleType ? (
                      // the same filter as the map legend: a hidden type is struck through and its glyph hollow
                      <button type="button" className="type-toggle" aria-pressed={!hiddenTypes?.has(t)} onClick={() => onToggleType(t)}
                        title={hiddenTypes?.has(t) ? `Show ${typeLabel(t)} on the map` : `Hide ${typeLabel(t)} from the map`}>
                        <span aria-hidden="true">{hiddenTypes?.has(t) ? typeGlyphOutline(t) : typeGlyph(t)} </span>{typeLabel(t)}
                      </button>
                    ) : (<><span aria-hidden="true">{typeGlyph(t)} </span>{typeLabel(t)}</>)}
                  </dt>
                  <dd className="metric-value">{counts[t]}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  )
}

export default function EntityCard({ entity, loading, onNeighborClick, onNeighborHover, onAsk, maxBridge, nodes, gapCount, onShowGaps, gapsPending, hiddenTypes, onToggleType }) {
  // The hub or chip that was pressed unmounts with the old card, dropping focus to <body>:
  // hand it to the new card's name so keyboard people keep their place (WCAG 2.4.3).
  // Focus elsewhere (the canvas, the Ask field) is left alone.
  const nameRef = useRef(null)
  useEffect(() => {
    const a = document.activeElement
    if (!a || a === document.body || a.closest?.('.graph-sidebar')) nameRef.current?.focus({ preventScroll: true })
  }, [entity?.id])

  if (loading) return <EntitySkeleton />

  if (!entity) {
    if (nodes?.length) return <Overview nodes={nodes} onPick={onNeighborClick} onHover={onNeighborHover} gapCount={gapCount} onShowGaps={onShowGaps} gapsPending={gapsPending} hiddenTypes={hiddenTypes} onToggleType={onToggleType} />
    return (
      <div className="entity-card-placeholder">
        <span className="placeholder-mark" aria-hidden="true">+</span>
        <p>Click any node to see its details, metrics and connections.</p>
      </div>
    )
  }

  const fmt = (n) => (n != null ? Number(n).toFixed(3) : '—')
  const clusterTag = entity.cluster_id != null ? `cluster_${pad(entity.cluster_id)}` : null
  // third-party data (OpenAlex homepages): React renders javascript: hrefs as-is
  const safeSource = /^https?:\/\//i.test(entity.source_url || '') ? entity.source_url : null

  return (
    <div className="entity-card">
      <div className="entity-scroll">
        <div className="label entity-type-tag">
          <span className="entity-type-glyph" aria-hidden="true">{typeGlyph(entity.type)}</span>
          <span>{typeLabel(entity.type)}</span>
          {clusterTag && <span className="entity-cluster-tag">· {clusterTag}</span>}
        </div>
        <h2 className="entity-name" ref={nameRef} tabIndex={-1} title={entity.fullName || entity.name}>{displayName(entity.fullName || entity.name)}</h2>

        {entity.description && <p className="entity-desc">{entity.description}</p>}

        <div className="entity-meta">
          <Metric label="Degree" value={fmt(entity.degree)} bar={entity.degree} />
          {/* bridge_score = betweenness / degree (capped at 10), not 0–1, so the bar is
              relative to the strongest bridge in this map; the number stays raw. */}
          <Metric label="Bridge" value={fmt(entity.bridge_score)} bar={maxBridge ? (entity.bridge_score || 0) / maxBridge : entity.bridge_score} />
          {entity.neighbors && <Metric label="Links" value={entity.neighbors.length} />}
        </div>

        <div className="entity-source">
          <span className="label">Source</span>
          <span className="entity-source-name">{entity.source ?? '—'}</span>
        </div>

        {entity.neighbors && entity.neighbors.length > 0 && (
          <div className="entity-neighbors">
            <h3 className="label">Connected · {entity.neighbors.length}</h3>
            <div className="chip-row">
              {entity.neighbors.map((n) =>
                onNeighborClick ? (
                  // Interactive: keyboard operable, announces as button (WCAG 2.1.1, 4.1.2)
                  <button
                    key={n.id}
                    type="button"
                    className="chip"
                    title={n.name}
                    onClick={() => onNeighborClick(n.id)}
                    onMouseEnter={() => onNeighborHover?.(n.id)}
                    onMouseLeave={() => onNeighborHover?.(null)}
                    onFocus={() => onNeighborHover?.(n.id)}
                    onBlur={() => onNeighborHover?.(null)}
                  >
                    {shortLabel(displayName(n.name), 32)}
                  </button>
                ) : (
                  // Static label — no pointer affordance (avoids dead interactive-looking elements)
                  <span key={n.id} className="chip chip-static" title={n.name}>
                    {shortLabel(displayName(n.name), 32)}
                  </span>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {(onAsk || safeSource) && (
        <div className="entity-actions">
          {onAsk && <button type="button" className="btn btn-primary" onClick={onAsk}>Ask about this</button>}
          {safeSource && (
            <a href={safeSource} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Open source<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}
