import { Fragment } from 'react'
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
      <h2 className="label label-plain cluster-head">{`${clusters.length} clusters · ranked by opportunity`}</h2>
      <div className="cluster-list">
        {clusters.map((c, i) => {
          const score = Math.min(1, Math.max(0, c.opportunity_score || 0))
          const pts = Math.round(score * 100) // one scale everywhere: 0-100, like the opportunity cards
          // clusters with no opportunity signal go under one quiet divider
          const firstLow = pts === 0 && (i === 0 || Math.round(Math.min(1, Math.max(0, clusters[i - 1].opportunity_score || 0)) * 100) > 0)
          // a <button>: keyboard operability and role=button for free (C-2, WCAG 2.1.1)
          return (
            <Fragment key={c.id}>
            {firstLow && <div className="label cluster-low-head">Low signal · no opportunity score</div>}
            <button
              type="button"
              className={`cluster-item${activeClusterId === c.cluster_id ? ' active' : ''}${pts === 0 ? ' is-low' : ''}`}
              style={{ '--score': `${score * 100}%` }}
              onClick={() => onClusterClick(c.cluster_id)}
              aria-pressed={activeClusterId === c.cluster_id}
              aria-label={`${c.name} — ${c.size} nodes, opportunity score ${pts} of 100`}
            >
              <span className="cluster-index">{pad(i + 1)}</span>
              <span className="cluster-main">
                <span className="cluster-name" title={c.terms && c.terms !== c.name ? c.terms : undefined}>{c.name}</span>
                <span className="cluster-stats">
                  {c.size} nodes · {c.research_count} research{c.product_count > 0 ? ` · ${c.product_count} products` : ''}
                </span>
              </span>
              <span className="cluster-score">{pts}</span>
            </button>
            </Fragment>
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
