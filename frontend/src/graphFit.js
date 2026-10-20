// Fit the graph into the part of the canvas that is actually free: the
// legend, the controls and the ask bar float over it, so a plain cy.fit()
// puts nodes underneath them (and on a phone, off the visible strip).
const OVERLAYS = '.graph-legend, .graph-controls, .ask-bar, .gap-chip'
const GAP = 24 // clear air between the graph (and its cluster outlines) and a widget
// Room the graph keeps from the canvas edge: the ruler and the registration
// marks live there, and labels run to the right of their nodes.
const EDGE = { l: 32, t: 32, r: 40, b: 32 }

// A widget in a corner can be cleared by padding either axis; take the one that
// leaves the graph the larger zoom (a tall column of controls costs width on a
// wide canvas, but on a tall narrow one the free height is where to give).
export function freePads(cy) {
  const pads = { ...EDGE }
  const container = cy?.container?.()
  const wrap = container?.closest('.graph-canvas-wrap')
  if (!container || !wrap) return pads
  const c = container.getBoundingClientRect()
  if (!c.width || !c.height) return pads
  const vis = cy.elements(':visible')
  const bb = vis.length ? vis.boundingBox({ includeLabels: false, includeOverlays: false }) : null
  const zoomFor = (p) => (bb
    ? Math.min((c.width - p.l - p.r) / Math.max(bb.w, 1), (c.height - p.t - p.b) / Math.max(bb.h, 1))
    : 0)
  for (const el of wrap.querySelectorAll(OVERLAYS)) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue
    const narrow = r.width < c.width * 0.4
    const atLeft = r.left - c.left < c.width * 0.25
    const atTop = r.top - c.top < c.height * 0.3
    const inTopHalf = r.bottom - c.top < c.height * 0.5
    const needL = r.right - c.left + GAP, needT = r.bottom - c.top + GAP, needB = c.bottom - r.top + GAP
    if (narrow && atLeft && r.height < c.height * 0.6) {
      const side = { ...pads, l: Math.max(pads.l, needL) }
      const vert = inTopHalf ? { ...pads, t: Math.max(pads.t, needT) } : { ...pads, b: Math.max(pads.b, needB) }
      Object.assign(pads, zoomFor(side) >= zoomFor(vert) ? side : vert)
    } else if (atTop && inTopHalf) {
      pads.t = Math.max(pads.t, needT)
    } else if (r.top - c.top > c.height * 0.5) {
      pads.b = Math.max(pads.b, needB)
    }
  }
  // Never squeeze the graph into less than half the canvas.
  if (pads.l + pads.r > c.width / 2) pads.l = Math.max(GAP, c.width / 2 - pads.r)
  if (pads.t + pads.b > c.height / 2) pads.t = Math.max(GAP, c.height / 2 - pads.b)
  return pads
}

// Zoom and pan so `eles` sit centred in the free area, capped at maxZoom so
// a small graph isn't blown up past a readable label size.
export function fitFree(cy, eles, { maxZoom = 1.1, duration = 0 } = {}) {
  if (!cy || cy.destroyed()) return
  const set = eles && eles.length ? eles : cy.elements(':visible')
  if (!set.length) return
  const p = freePads(cy)
  // labels are left out: they are re-laid at the new zoom, and the ones that
  // would run off the canvas drop out (graphLabels.js)
  const bb = set.boundingBox({ includeLabels: false, includeOverlays: false })
  const w = cy.width() - p.l - p.r, h = cy.height() - p.t - p.b
  const zoom = Math.max(cy.minZoom(), Math.min(maxZoom, w / Math.max(bb.w, 1), h / Math.max(bb.h, 1)))
  const cx = (bb.x1 + bb.x2) / 2, cyy = (bb.y1 + bb.y2) / 2
  const pan = { x: p.l + w / 2 - cx * zoom, y: p.t + h / 2 - cyy * zoom }
  if (duration) cy.animate({ zoom, pan }, { duration })
  else cy.viewport({ zoom, pan })
}

// Centre one element in the free area at a given zoom.
export function centreFree(cy, ele, zoom, { duration = 0, shiftX = 0 } = {}) {
  if (!cy || cy.destroyed() || !ele || !ele.length) return
  const p = freePads(cy)
  const w = cy.width() - p.l - p.r, h = cy.height() - p.t - p.b
  const pos = ele.position()
  const pan = { x: p.l + w / 2 + shiftX - pos.x * zoom, y: p.t + h / 2 - pos.y * zoom }
  if (duration) cy.animate({ zoom, pan }, { duration })
  else cy.viewport({ zoom, pan })
}

// The first view of a map: fitted into the free area; on a phone, where a
// fitted graph is a speck with unreadable labels, zoomed to a readable level
// around the best-connected node instead, set left of centre because its label runs to the right.
export function initialView(cy) {
  fitFree(cy, null, { maxZoom: 1.1 })
  // phone only: a narrow canvas on a tablet (the Clusters tab) shows the whole graph, not a crop
  const phone = typeof window !== 'undefined' && window.innerWidth < 768
  if (phone && cy.width() < 600 && cy.zoom() < 0.8 && cy.nodes().length) {
    centreFree(cy, cy.nodes().max((n) => n.data('degree') || 0).ele, 0.8, { shiftX: -Math.min(64, cy.width() * 0.16) })
  }
}
