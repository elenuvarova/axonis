import { ClusterSkeleton } from './states'
import { pad } from '../format'

export default function ClusterPanel({
  clusters = [], activeClusterId, onClusterClick, loading,
  oppCountFor, onSeeOpportunities,
}) {
  if (loading) return <ClusterSkeleton />

  if (!clusters.length) {
    return (
      <div className="cluster-panel">
        <p className="cluster-hint">No clusters were detected for this graph.</p>
      </div>
    )
  }

  const active = clusters.find((c) => c.cluster_id === activeClusterId)
  const activeIndex = active ? clusters.indexOf(active) : -1
  const activeOpps = active && oppCountFor ? oppCountFor(active) : 0

  return (
    <div className="cluster-panel">
      <h2 className="label cluster-head">{pad(clusters.length)} clusters · ranked by opportunity</h2>
      <div className="cluster-list">
        {clusters.map((c, i) => {
          const score = Math.min(1, Math.max(0, c.opportunity_score || 0))
          return (
            // <button> gives keyboard operability and role=button for free (C-2, WCAG 2.1.1)
            <button
              key={c.id}
              type="button"
              className={`cluster-item${activeClusterId === c.cluster_id ? ' active' : ''}`}
              style={{ '--score': `${score * 100}%` }}
              onClick={() => onClusterClick(c.cluster_id)}
              aria-pressed={activeClusterId === c.cluster_id}
              aria-label={`${c.name} — ${c.size} nodes, opportunity score ${score.toFixed(2)}`}
            >
              <span className="cluster-index">{pad(i + 1)}</span>
              <span className="cluster-main">
                <span className="cluster-name">{c.name}</span>
                <span className="cluster-stats">
                  {c.size} nodes · {c.research_count} research{c.product_count > 0 ? ` · ${c.product_count} products` : ''}
                </span>
              </span>
              <span className="cluster-score">{score.toFixed(2)}</span>
            </button>
          )
        })}
      </div>

      {active ? (
        <div className="cluster-selected">
          <div className="label accent">Selected · cluster {pad(activeIndex + 1)}</div>
          <p className="cluster-selected-text">
            {active.name} groups {active.size} nodes with {active.research_count} research
            items and {active.product_count} products.
          </p>
          <div className="cluster-selected-actions">
            {activeOpps > 0 && onSeeOpportunities && (
              <button type="button" className="btn btn-secondary" onClick={onSeeOpportunities}>
                See {activeOpps} {activeOpps === 1 ? 'opportunity' : 'opportunities'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="cluster-hint">Select a cluster to highlight it on the map.</p>
      )}
    </div>
  )
}
