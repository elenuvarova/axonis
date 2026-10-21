import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Ticker from './Ticker'
import { OppSkeleton, StateScreen } from './states'
import CellBar from './CellBar'
import { pad } from '../format'

const scoreOf = (opp) => Math.round(Math.min(1, Math.max(0, opp.score || 0)) * 100)
const detailId = (opp) => `opp-detail-${opp.id}`

function OppCard({ opp, index, expanded, onToggle, onShowOnMap }) {
  const [whyEvidence, setWhyEvidence] = useState(false)
  const score = scoreOf(opp)
  const evidence = Math.round(Math.min(1, Math.max(0, opp.evidence_strength || 0)) * 5)

  return (
    <article className={`opp-card${expanded ? ' is-open' : ''}`}>
      <div className="opp-card-top label">
        <span>Gap_{pad(index + 1)}</span>
        <span>Risk · {opp.risk_level}</span>
      </div>

      <div className="opp-score">
        <span className="opp-score-num" aria-label={`Score ${score} out of 100`}><Ticker value={score} duration={700} /></span>
        <span className="opp-score-max" aria-hidden="true">/100</span>
      </div>

      <h3 className="opp-card-title">{opp.title}</h3>

      {/* always rendered: it keeps its row, so every card's rows line up across the grid */}
      <div className="opp-cluster-meta">
        {opp.cluster_name && <>Cluster: {opp.cluster_name}</>}
        {opp.cluster_name && opp.cluster_size && <span> · {opp.cluster_size} nodes</span>}
        {opp.cluster_name && opp.generated_by_ai && <span className="opp-ai-flag"> · AI-written</span>}
      </div>

      <p className="opp-why">{opp.why_it_matters}</p>

      <div className="opp-evidence-block">
        <div className="opp-evidence">
          <button type="button" className="label opp-evidence-q" aria-expanded={whyEvidence}
            aria-controls={`ev-${opp.id}`} onClick={() => setWhyEvidence((v) => !v)}>
            Evidence <span aria-hidden="true">?</span>
          </button>
          <CellBar value={evidence / 5} cells={5} size="lg" />
          <span className="opp-evidence-n">{evidence}/5</span>
        </div>
        {whyEvidence && (
          <p className="opp-evidence-note" id={`ev-${opp.id}`}>
            How much backs this gap on the map: the cluster’s research (papers and institutions) and its size, on a 1–5 scale. It is not a market estimate.
          </p>
        )}
      </div>

      <div className="opp-footer">
        {onShowOnMap && opp.cluster_db_id && (
          <button type="button" className="btn btn-secondary" onClick={() => onShowOnMap(opp)}>Show on map</button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={expanded ? detailId(opp) : undefined}
        >
          {expanded ? 'Less' : 'Score, risks & questions'}<span aria-hidden="true">&nbsp;{expanded ? '↑' : '↓'}</span>
        </button>
      </div>
    </article>
  )
}

// The details open as a full-width strip under the card's row, not inside the card: the cards share
// their rows (subgrid), so a taller card would stretch every neighbour in its row.
function OppDetail({ opp, index }) {
  const ref = useRef(null)
  const score = scoreOf(opp)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView?.({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [])
  return (
    <section className="opp-detail" id={detailId(opp)} ref={ref} tabIndex={-1}
      aria-label={`Gap ${index + 1}: score, risks and questions`}>
      <div className="opp-detail-head label">Gap_{pad(index + 1)} · <span className="opp-detail-title">{opp.title}</span></div>
      <div className="opp-more">
        {opp.score_parts?.length > 0 && (
          <div>
            <div className="label label-plain">{`How the ${score} adds up`}</div>
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
            <div className="label label-plain">Next research questions</div>
            <ul className="opp-list">{opp.next_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </div>
        )}
      </div>
    </section>
  )
}

// how many cards sit in a row of the auto-fill grid, so the detail strip lands right after its row
function useColumnCount(ref) {
  const [cols, setCols] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setCols(Math.max(1, getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length))
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  })
  return cols
}

export default function OpportunityBoard({ opportunities = [], loading, onShowOnMap }) {
  const gridRef = useRef(null)
  const cols = useColumnCount(gridRef)
  const [openId, setOpenId] = useState(null)

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
  const openIdx = sorted.findIndex((o) => o.id === openId)

  return (
    <div className="opp-board">
      <h2 className="label label-plain opp-board-head">{`${sorted.length} opportunities · sorted by score`}</h2>
      <div className="opp-grid" ref={gridRef}>
        {sorted.flatMap((o, i) => {
          const card = (
            <OppCard key={o.id} opp={o} index={i} expanded={o.id === openId} onShowOnMap={onShowOnMap}
              onToggle={() => setOpenId((id) => (id === o.id ? null : o.id))} />
          )
          if (openIdx < 0 || i !== Math.min(sorted.length - 1, Math.floor(openIdx / cols) * cols + cols - 1)) return [card]
          return [card, <OppDetail key={`d-${openId}`} opp={sorted[openIdx]} index={openIdx} />]
        })}
      </div>
    </div>
  )
}
