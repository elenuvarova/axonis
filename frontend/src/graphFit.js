// Fit the graph into the part of the canvas that is actually free: the
// legend, the controls and the ask bar float over it, so a plain cy.fit()
// puts nodes underneath them (and on a phone, off the visible strip).
const OVERLAYS = '.graph-legend, .graph-controls, .ask-bar'
const GAP = 16

export function freePads(cy) {
  const pads = { l: GAP, t: GAP, r: GAP, b: GAP }
  const container = cy?.container?.()
  const wrap = container?.closest('.graph-canvas-wrap')
  if (!container || !wrap) return pads
  const c = container.getBoundingClientRect()
  if (!c.width || !c.height) return pads
  for (const el of wrap.querySelectorAll(OVERLAYS)) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue
    const narrow = r.width < c.width * 0.4
    const atLeft = r.left - c.left < c.width * 0.25
    const atTop = r.top - c.top < c.height * 0.3
    if (narrow && atLeft && r.height < c.height * 0.6) {
      pads.l = Math.max(pads.l, r.right - c.left + GAP)
    } else if (atTop && r.bottom - c.top < c.height * 0.5) {
      pads.t = Math.max(pads.t, r.bottom - c.top + GAP)
    } else if (r.top - c.top > c.height * 0.5) {
      pads.b = Math.max(pads.b, c.bottom - r.top + GAP)
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
  const bb = set.boundingBox()
  const w = cy.width() - p.l - p.r, h = cy.height() - p.t - p.b
  const zoom = Math.max(cy.minZoom(), Math.min(maxZoom, w / Math.max(bb.w, 1), h / Math.max(bb.h, 1)))
  const cx = (bb.x1 + bb.x2) / 2, cyy = (bb.y1 + bb.y2) / 2
  const pan = { x: p.l + w / 2 - cx * zoom, y: p.t + h / 2 - cyy * zoom }
  if (duration) cy.animate({ zoom, pan }, { duration })
  else cy.viewport({ zoom, pan })
}

// Centre one element in the free area at a given zoom.
export function centreFree(cy, ele, zoom, { duration = 0 } = {}) {
  if (!cy || cy.destroyed() || !ele || !ele.length) return
  const p = freePads(cy)
  const w = cy.width() - p.l - p.r, h = cy.height() - p.t - p.b
  const pos = ele.position()
  const pan = { x: p.l + w / 2 - pos.x * zoom, y: p.t + h / 2 - pos.y * zoom }
  if (duration) cy.animate({ zoom, pan }, { duration })
  else cy.viewport({ zoom, pan })
}

// The first view of a map: fitted into the free area; on a phone, where a
// fitted graph is a speck with unreadable labels, zoomed to a readable level
// around the biggest hub instead.
export function initialView(cy) {
  fitFree(cy, null, { maxZoom: 1.1 })
  if (cy.width() < 600 && cy.zoom() < 0.8 && cy.nodes().length) {
    centreFree(cy, cy.nodes().max((n) => n.data('size')).ele, 0.8)
  }
}
