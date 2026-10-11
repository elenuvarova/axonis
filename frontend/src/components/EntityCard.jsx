import { EntitySkeleton } from './states'
import CellBar from './CellBar'
import { typeGlyph, typeLabel, TYPE_ORDER } from '../graphTypes'
import { pad, shortLabel } from '../format'

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
function Overview({ nodes = [], onPick, onHover }) {
  const hubs = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0)).slice(0, 5)
  const counts = {}
  for (const n of nodes) counts[n.type] = (counts[n.type] || 0) + 1
  const types = [...TYPE_ORDER.filter((t) => counts[t]), ...Object.keys(counts).filter((t) => !TYPE_ORDER.includes(t))]
  return (
    <div className="entity-card entity-overview">
      <div className="entity-scroll">
        <div className="label">Selection · none</div>
        <p className="entity-overview-hint">Click any node to see its details, metrics and connections, or press <kbd>⌘K</kbd> to find one.</p>
        {hubs.length > 0 && (
          <section className="entity-section">
            <h3 className="label">Best connected</h3>
            <ul className="entity-overview-hubs">
              {hubs.map((n, i) => (
                <li key={n.id}>
                  <button type="button" className="entity-overview-hub" title={n.name}
                    onClick={() => onPick?.(n.id)}
                    onMouseEnter={() => onHover?.(n.id)} onMouseLeave={() => onHover?.(null)}
                    onFocus={() => onHover?.(n.id)} onBlur={() => onHover?.(null)}>
                    <span className="entity-overview-rank" aria-hidden="true">{pad(i + 1)}</span>
                    <span className="entity-overview-glyph" aria-hidden="true">{typeGlyph(n.type)}</span>
                    <span className="entity-overview-name">{n.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {types.length > 0 && (
          <section className="entity-section">
            <h3 className="label">On this map · {nodes.length} nodes</h3>
            <dl className="entity-overview-types">
              {types.map((t) => (
                <div key={t} className="metric-row">
                  <dt className="metric-label"><span aria-hidden="true">{typeGlyph(t)} </span>{typeLabel(t)}</dt>
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

export default function EntityCard({ entity, loading, onNeighborClick, onNeighborHover, onAsk, maxBridge, nodes }) {
  if (loading) return <EntitySkeleton />

  if (!entity) {
    if (nodes?.length) return <Overview nodes={nodes} onPick={onNeighborClick} onHover={onNeighborHover} />
    return (
      <div className="entity-card-placeholder">
        <span className="placeholder-mark" aria-hidden="true">+</span>
        <p>Click any node to see its details, metrics and connections.</p>
      </div>
    )
  }

  const fmt = (n) => (n != null ? Number(n).toFixed(3) : '—')
  const clusterTag = entity.cluster_id != null ? `cluster_${pad(entity.cluster_id)}` : null

  return (
    <div className="entity-card">
      <div className="entity-scroll">
        <div className="label entity-type-tag">
          <span className="accent-dot" aria-hidden="true" />
          <span>{typeLabel(entity.type)}</span>
          {clusterTag && <span className="entity-cluster-tag">· {clusterTag}</span>}
        </div>
        <h2 className="entity-name">{entity.fullName || entity.name}</h2>

        {entity.description && <p className="entity-desc">{entity.description}</p>}

        <div className="entity-meta">
          <Metric label="Degree" value={fmt(entity.degree)} bar={entity.degree} />
          {/* bridge_score = betweenness / degree (capped at 10), not 0–1, so the bar is
              relative to the strongest bridge in this map; the number stays raw. */}
          <Metric label="Bridge" value={fmt(entity.bridge_score)} bar={maxBridge ? (entity.bridge_score || 0) / maxBridge : entity.bridge_score} />
          {entity.neighbors && <Metric label="Links" value={pad(entity.neighbors.length, 3)} />}
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
                    {shortLabel(n.name, 26)}
                  </button>
                ) : (
                  // Static label — no pointer affordance (avoids dead interactive-looking elements)
                  <span key={n.id} className="chip chip-static" title={n.name}>
                    {shortLabel(n.name, 26)}
                  </span>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {(onAsk || entity.source_url) && (
        <div className="entity-actions">
          {onAsk && <button type="button" className="btn btn-primary" onClick={onAsk}>Ask about this</button>}
          {entity.source_url && (
            <a href={entity.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Open source<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}
