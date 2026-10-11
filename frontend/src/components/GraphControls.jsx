import { useEffect, useState } from 'react'
import { track } from '../analytics'

// Zoom / fit / focus-depth stack, bottom-left of the canvas.
// Depth cycles All → 1 → 2: with a node selected, everything further than that
// many hops from it is hidden, so a hub's neighbourhood can be read on its own.
const DEPTHS = [0, 1, 2]

export default function GraphControls({ cy, reducedMotion, selectedId, listView = false, onToggleList }) {
  const [depth, setDepth] = useState(0)

  useEffect(() => {
    if (!cy || cy.destroyed()) return
    const node = selectedId ? cy.getElementById(selectedId) : null
    cy.batch(() => {
      cy.elements().removeClass('out-of-focus')
      cy.nodes().removeClass('focus-label')
      if (!depth || !node || !node.length) return
      let keep = node
      for (let i = 0; i < depth; i++) keep = keep.closedNeighborhood()
      cy.elements().difference(keep).addClass('out-of-focus')
      // a small focused set can afford a label on every node
      if (keep.nodes().length <= 25) keep.nodes().addClass('focus-label')
    })
    if (depth && node && node.length) {
      // fit the focused neighbourhood, but never past 1.2× (labels stay readable)
      const eles = cy.elements(':visible'), bb = eles.boundingBox(), pad = 72
      const zoom = Math.min(1.2, (cy.width() - pad * 2) / Math.max(bb.w, 1), (cy.height() - pad * 2) / Math.max(bb.h, 1))
      cy.animate({ zoom: Math.max(zoom, cy.minZoom()), center: { eles }, duration: reducedMotion ? 0 : 300 })
    }
  }, [cy, depth, selectedId, reducedMotion])

  if (!cy) return null
  const zoomBy = (factor) => {
    const next = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor))
    cy.animate({
      zoom: { level: next, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } },
      duration: reducedMotion ? 0 : 200,
    })
  }
  const fit = () => cy.animate({ fit: { eles: cy.elements(':visible'), padding: 48 }, duration: reducedMotion ? 0 : 300 })
  const nextDepth = DEPTHS[(DEPTHS.indexOf(depth) + 1) % DEPTHS.length]
  const depthLabel = depth ? `Depth ${depth}` : 'Depth ∞'

  const listBtn = onToggleList && (
    <button type="button" className={listView ? 'is-on' : ''} onClick={onToggleList} aria-pressed={listView}
      aria-label="List view: the graph's nodes as a sortable table" title="Show the nodes as a list">
      List
    </button>
  )
  if (listView) {
    return <div className="graph-controls" role="group" aria-label="Graph view controls">{listBtn}</div>
  }
  return (
    <div className="graph-controls" role="group" aria-label="Graph view controls">
      <button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button>
      <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">−</button>
      <button type="button" onClick={fit} aria-label="Fit graph to view">Fit</button>
      <button
        type="button"
        className={depth ? 'is-on' : ''}
        onClick={() => { if (selectedId) { track('depth', { level: nextDepth }); setDepth(nextDepth) } }}
        aria-disabled={!selectedId}
        aria-label={selectedId
          ? `Focus depth: ${depth ? `${depth} hop${depth > 1 ? 's' : ''} around the selected node` : 'whole graph'}. Switch to ${nextDepth ? nextDepth : 'whole graph'}.`
          : 'Focus depth: select a node first'}
        title={selectedId ? 'Show only nodes within N hops of the selection' : 'Select a node to focus on its neighbourhood'}
      >
        {depthLabel}
      </button>
      {listBtn}
    </div>
  )
}
