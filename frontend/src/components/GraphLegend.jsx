import { useEffect, useRef, useState } from 'react'
import { TYPE_ORDER, typeGlyph, typeGlyphOutline, typeLabel } from '../graphTypes'
import { track } from '../analytics'

// Shape key + filter for the graph. Lists only the entity types present in the
// current graph, with counts; each row is a toggle that shows/hides that type
// (aria-pressed = visible). "Isolated" hides nodes with no connections.
// The hidden set lives in the page, so the inspector's "On this map" rows
// toggle the same filter. Collapsed to a "Types" chip by default, with the list
// as an overlay under it: the map keeps its room, the key is one click away
// (the idle inspector already lists the types).
const NO_TYPES = new Set()
const NOOP = () => {}

export default function GraphLegend({ nodes = [], cy, hidden = NO_TYPES, onToggleType = NOOP }) {
  const [open, setOpen] = useState(false)
  const [hideIsolated, setHideIsolated] = useState(false)
  const rootRef = useRef(null)

  // The open list is an overlay: Escape or a tap outside closes it.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])

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
    onToggleType(t)
  }

  if (!types.length) return null

  return (
    <div ref={rootRef} className={`graph-legend${open ? ' is-open' : ''}`}>
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
                <span className="legend-glyph" aria-hidden="true">{hidden.has(t) ? typeGlyphOutline(t) : typeGlyph(t)}</span>
                <span className="legend-name">{typeLabel(t)}</span>
                <span className="legend-count">{counts[t]}</span>
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
                <span className="legend-count">{isolated}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
