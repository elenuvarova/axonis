import { useState } from 'react'
import { TYPE_ORDER, typeGlyph, typeLabel } from '../graphTypes'
import { pad } from '../format'

// Shape key for the graph. Shows only the entity types actually present in the
// current graph, with their counts, so it never lists types the user can't see.
export default function GraphLegend({ nodes = [] }) {
  // Collapsed by default on phones so it doesn't cover the graph; still there,
  // because shape is the only cue for node type.
  const [open, setOpen] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia?.('(max-width: 767px)').matches)

  const counts = {}
  for (const n of nodes) counts[n.type] = (counts[n.type] || 0) + 1
  const types = TYPE_ORDER.filter((t) => counts[t])
  for (const t of Object.keys(counts)) if (t && !TYPE_ORDER.includes(t)) types.push(t)

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
        <span className="graph-legend-title">Types</span>
        <span className="graph-legend-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul id="graph-legend-list" className="graph-legend-list">
          {types.map((t) => (
            <li key={t} className="graph-legend-item">
              <span className="legend-glyph" aria-hidden="true">{typeGlyph(t)}</span>
              <span className="legend-name">{typeLabel(t)}</span>
              <span className="legend-count">{pad(counts[t], 3)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
