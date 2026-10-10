// Zoom / fit stack, bottom-left of the canvas.
export default function GraphControls({ cy, reducedMotion }) {
  if (!cy) return null
  const zoomBy = (factor) => {
    const next = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor))
    cy.animate({
      zoom: { level: next, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } },
      duration: reducedMotion ? 0 : 200,
    })
  }
  const fit = () => cy.animate({ fit: { padding: 48 }, duration: reducedMotion ? 0 : 300 })
  return (
    <div className="graph-controls" role="group" aria-label="Graph view controls">
      <button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button>
      <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">−</button>
      <button type="button" onClick={fit} aria-label="Fit graph to view">Fit</button>
    </div>
  )
}
