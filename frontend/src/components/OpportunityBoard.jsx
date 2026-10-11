import { useState } from 'react'
import { OppSkeleton, StateScreen } from './states'
import CellBar from './CellBar'
import { pad } from '../format'

function OppCard({ opp, index, onShowOnMap }) {
  const [expanded, setExpanded] = useState(false)
  const score = Math.round(Math.min(1, Math.max(0, opp.score || 0)) * 100)
  const evidence = Math.round(Math.min(1, Math.max(0, opp.evidence_strength || 0)) * 5)

  return (
    <article className="opp-card">
      <div className="opp-card-top label">
        <span>Opp_{pad(index + 1)}</span>
        <span>Risk · {opp.risk_level}</span>
      </div>

      <div className="opp-score">
        <span className="opp-score-num" aria-label={`Score ${score} out of 100`}>{score}</span>
        <span className="opp-score-max" aria-hidden="true">/100</span>
      </div>

      <h3 className="opp-card-title">{opp.title}</h3>

      {opp.cluster_name && (
        <div className="opp-cluster-meta">
          Cluster: {opp.cluster_name}
          {opp.cluster_size && <span> · {opp.cluster_size} nodes</span>}
          {opp.generated_by_ai && <span className="opp-ai-flag"> · AI-written</span>}
        </div>
      )}

      <p className="opp-why">{opp.why_it_matters}</p>

      {expanded && (
        <div className="opp-more">
          {opp.score_parts?.length > 0 && (
            <div>
              <div className="label">How the {score} adds up</div>
              <ul className="opp-parts">
                {opp.score_parts.map((p) => (
                  <li key={p.key} className="opp-part">
                    <span className="opp-part-label">{p.label} <span className="opp-part-w">×{Math.round(p.weight * 100)}%</span></span>
                    <CellBar value={p.value} cells={10} />
                    <span className="opp-part-pts">+{Math.round(p.points)}</span>
                  </li>
                ))}
              </ul>
              <p className="opp-parts-note">Each signal is scaled against the strongest cluster in this map, then weighted.</p>
            </div>
          )}
          {opp.risks?.length > 0 && (
            <div>
              <div className="label">Risks</div>
              <ul className="opp-list">{opp.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          {opp.next_questions?.length > 0 && (
            <div>
              <div className="label">Next research questions</div>
              <ul className="opp-list">{opp.next_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="opp-evidence">
        <span className="label">Evidence</span>
        <CellBar value={evidence / 5} cells={5} size="lg" />
        <span className="opp-evidence-n">{evidence}/5</span>
      </div>

      <div className="opp-footer">
        {onShowOnMap && opp.cluster_db_id && (
          <button type="button" className="btn btn-secondary" onClick={() => onShowOnMap(opp)}>Show on map</button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Less' : 'Score, risks & questions'}<span aria-hidden="true">&nbsp;→</span>
        </button>
      </div>
    </article>
  )
}

export default function OpportunityBoard({ opportunities = [], loading, onShowOnMap }) {
  if (loading) return <OppSkeleton />

  if (!opportunities.length) {
    return (
      <StateScreen
        variant="empty"
        title="No opportunities yet"
        message="This graph didn't surface scored product opportunities. Try a broader or more research-active topic."
      />
    )
  }

  const sorted = [...opportunities].sort((a, b) => (b.score || 0) - (a.score || 0))

  return (
    <div className="opp-board">
      <h2 className="label opp-board-head">{pad(sorted.length)} opportunities · sorted by score</h2>
      <div className="opp-grid">
        {sorted.map((o, i) => <OppCard key={o.id} opp={o} index={i} onShowOnMap={onShowOnMap} />)}
      </div>
    </div>
  )
}
