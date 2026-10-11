import { EntitySkeleton } from './states'
import CellBar from './CellBar'
import { typeLabel } from '../graphTypes'
import { pad } from '../format'

function Metric({ label, value, bar }) {
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      {bar != null ? <CellBar value={bar} /> : <span className="metric-spacer" />}
      <span className="metric-value">{value}</span>
    </div>
  )
}

export default function EntityCard({ entity, loading, onNeighborClick, onNeighborHover, onAsk }) {
  if (loading) return <EntitySkeleton />

  if (!entity) {
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
          <Metric label="Bridge" value={fmt(entity.bridge_score)} bar={entity.bridge_score} />
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
                    {n.name.length > 22 ? n.name.slice(0, 20) + '…' : n.name}
                  </button>
                ) : (
                  // Static label — no pointer affordance (avoids dead interactive-looking elements)
                  <span key={n.id} className="chip chip-static" title={n.name}>
                    {n.name.length > 22 ? n.name.slice(0, 20) + '…' : n.name}
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
