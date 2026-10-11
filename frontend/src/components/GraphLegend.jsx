import { useEffect, useState } from 'react'
import { TYPE_ORDER, typeGlyph, typeLabel } from '../graphTypes'
import { pad } from '../format'
import { track } from '../analytics'

// Shape key + filter for the graph. Lists only the entity types present in the
// current graph, with counts; each row is a toggle that shows/hides that type
// (aria-pressed = visible). "Isolated" hides nodes with no connections.
export default function GraphLegend({ nodes = [], cy }) {
  // Collapsed by default on phones so it doesn't cover the graph; still there,
  // because shape is the only cue for node type.
  const [open, setOpen] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia?.('(max-width: 767px)').matches)
  const [hidden, setHidden] = useState(() => new Set())
  const [hideIsolated, setHideIsolated] = useState(false)

  const counts = {}
  for (const n of nodes) counts[n.type] = (counts[n.type] || 0) + 1
  const types = TYPE_ORDER.filter((t) => counts[t])
  for (const t of Object.keys(counts)) if (t && !TYPE_ORDER.includes(t)) types.push(t)
  const isolated = nodes.filter((n) => !(n.degree > 0)).length

  // Apply the filter to the canvas. Edges of hidden nodes disappear with them.
  useEffect(() => {
    if (!cy || cy.destroyed()) return
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const off = hidden.has(n.data('type')) || (hideIsolated && n.degree(false) === 0)
        n.toggleClass('filtered', off)
      })
    })
  }, [cy, hidden, hideIsolated, nodes])

  const toggleType = (t) => {
    track('legend_filter', { type: t, visible: hidden.has(t) })
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  if (!types.length) return null

  return (
    <div className={`graph-legend${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="graph-legend-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="graph-legend-list"
        title={open ? 'Hide legend' : 'Show legend'}
      >
        <span className="graph-legend-title">Types{hidden.size || hideIsolated ? ' · filtered' : ''}</span>
        <span className="graph-legend-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul id="graph-legend-list" className="graph-legend-list" aria-label="Show or hide node types">
          {types.map((t) => (
            <li key={t}>
              <button
                type="button"
                className="graph-legend-item"
                aria-pressed={!hidden.has(t)}
                onClick={() => toggleType(t)}
                title={hidden.has(t) ? `Show ${typeLabel(t)}` : `Hide ${typeLabel(t)}`}
              >
                <span className="legend-glyph" aria-hidden="true">{typeGlyph(t)}</span>
                <span className="legend-name">{typeLabel(t)}</span>
                <span className="legend-count">{pad(counts[t], 3)}</span>
              </button>
            </li>
          ))}
          {isolated > 0 && (
            <li className="graph-legend-sep">
              <button
                type="button"
                className="graph-legend-item"
                aria-pressed={!hideIsolated}
                onClick={() => { track('legend_filter', { type: 'isolated', visible: hideIsolated }); setHideIsolated(!hideIsolated) }}
                title={hideIsolated ? 'Show isolated nodes' : 'Hide isolated nodes'}
              >
                <span className="legend-glyph" aria-hidden="true">·</span>
                <span className="legend-name">Isolated</span>
                <span className="legend-count">{pad(isolated, 3)}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
