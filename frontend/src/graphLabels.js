// Label decluttering for the graph canvas. Cytoscape draws every label that has
// text, so on a dense map names run over neighbouring nodes and each other.
// This pass decides which labels stay: a label is dropped (class `label-hidden`)
// when its box would cover another node, overlap a label that matters more, or
// run off the edge of the canvas. Labels the user asked for (hover, selection,
// a cited node, a gap) are never dropped; they win every collision.
// Priority, high to low: asked-for > the three hubs > lit by a cluster > persistent (best connected first).
// A hub is never dropped for crowding: it moves to whichever side of its node (right, left, above,
// below) touches the fewest nodes and labels. Labels under ~10px on screen are dropped (Cytoscape's
// own min-zoomed-font-size does not hide them).
const FORCED = '.show-label, .focus-label, .cite-focus, :selected'
const MIN_PX = 9.5   // below this Cytoscape does not draw the label (min-zoomed-font-size)
const EDGE = 6       // keep a label this far from the canvas edge
const PAD = 2
const SLACK = 4     // a hidden label comes back only when it clears by this much more (no flicker at the edge of a collision)
// Label offsets from the node, in model px. The stylesheet (GraphCanvas.jsx) uses the same
// numbers; they are constants here so a hub's moved label is not measured from its moved offset.
export const LABEL_MARGIN = 7
export const TOP_GAP = 5

let measureCtx = null
const widths = new Map()
function textWidth(text, px) {
  const key = `${px.toFixed(1)}|${text}`
  const hit = widths.get(key)
  if (hit != null) return hit
  if (measureCtx === null) {
    try { measureCtx = document.createElement('canvas').getContext('2d') || false } catch { measureCtx = false }
  }
  let w
  if (measureCtx) {
    measureCtx.font = `500 ${px}px "Mona Sans", system-ui, sans-serif`
    w = measureCtx.measureText(text).width
  } else {
    w = text.length * px * 0.55 // no canvas (tests): a sans face runs ~0.55em per character
  }
  if (widths.size > 600) widths.clear()
  widths.set(key, w)
  return w
}
export function clearLabelWidths() { widths.clear() } // Mona Sans arriving changes every width

const inflate = (r, by) => ({ x1: r.x1 - by, y1: r.y1 - by, x2: r.x2 + by, y2: r.y2 + by })

const hits = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2

// `paused()` says the layout is moving nodes about (boot or live physics): label passes
// wait for it to stop instead of running eight times a second on a moving target.
export function attachLabelDeclutter(cy, { paused = () => false } = {}) {
  let timer = 0
  let busy = false
  const sides = new Map() // hub id -> last side ('r' | 'l' | 't' | 'b'), so ties keep it

  function run() {
    timer = 0
    if (cy.destroyed()) return
    busy = true
    const z = cy.zoom(), w = cy.width(), h = cy.height()
    const bodies = []
    const cands = []
    // the cluster numbers drawn by graphOverlay.js are obstacles too
    for (const t of cy._tagBoxes || []) bodies.push({ n: null, r: { x1: t.x1 - PAD, y1: t.y1 - PAD, x2: t.x2 + PAD, y2: t.y2 + PAD } })
    cy.nodes(':visible').forEach((n) => {
      if (n.hasClass('faded')) return
      const b = n.renderedBoundingBox({ includeLabels: false, includeOverlays: false })
      bodies.push({ n, r: { x1: b.x1 - PAD, y1: b.y1 - PAD, x2: b.x2 + PAD, y2: b.y2 + PAD } })
      const asked = n.is(FORCED)
      const hub = !asked && n.data('hub')
      const lit = (n.hasClass('highlighted') && !n.hasClass('gap-lit')) || n.hasClass('gap-top')
      const text = asked || hub || lit ? n.data('label') : n.data('displayLabel')
      if (!text) return
      const px = n.pstyle('font-size').pfValue * z
      cands.push({ n, b, text, px, tier: asked ? 0 : hub ? 1 : lit ? 2 : 3, degree: n.data('degree') || 0 })
    })
    cands.sort((a, b) => a.tier - b.tier || b.degree - a.degree)

    const placed = []
    const hide = new Set()
    const side = new Map() // hub id -> 'l' | 't' | 'b' (default: right of the node)
    for (const c of cands) {
      const tw = textWidth(c.text, c.px) + PAD * 2
      const midY = (c.b.y1 + c.b.y2) / 2, midX = (c.b.x1 + c.b.x2) / 2
      const mx = LABEL_MARGIN * z, my = TOP_GAP * z
      const spots = {
        r: { x1: c.b.x2 + mx, x2: c.b.x2 + mx + tw, y1: midY - c.px * 0.8, y2: midY + c.px * 0.8 },
        l: { x1: c.b.x1 - mx - tw, x2: c.b.x1 - mx, y1: midY - c.px * 0.8, y2: midY + c.px * 0.8 },
        t: { x1: midX - tw / 2, x2: midX + tw / 2, y1: c.b.y1 - my - c.px * 1.6, y2: c.b.y1 - my },
        b: { x1: midX - tw / 2, x2: midX + tw / 2, y1: c.b.y2 + my, y2: c.b.y2 + my + c.px * 1.6 },
      }
      const off = (r) => r.x1 < EDGE || r.x2 > w - EDGE || r.y1 < EDGE || r.y2 > h - EDGE
      const crowd = (r, slack = 0) => {
        const q = slack ? inflate(r, slack) : r
        return placed.filter((p) => hits(q, p)).length + bodies.filter((o) => o.n !== c.n && hits(q, o.r)).length
      }
      // a node cut by the canvas edge has no business keeping a label
      const nodeOut = midX < EDGE || midX > w - EDGE || midY < EDGE || midY > h - EDGE
      if (c.tier === 0) { placed.push(spots.r); continue }          // asked for: always shown, to the right
      if (c.px < MIN_PX || nodeOut) { hide.add(c.n.id()); continue } // too small to read at this zoom / off the canvas
      if (c.tier === 1) {
        // a hub takes the side (right, left, above, below) where its label touches the least
        // the side it has now is tried first and only a strictly better one replaces it
        const id = c.n.id(), now = sides.get(id) || 'r'
        let best = null
        for (const k of [now, 'r', 'l', 't', 'b']) {
          if (off(spots[k])) continue
          const n = crowd(spots[k])
          if (!best || n < best.n) best = { k, n }
        }
        if (!best) { hide.add(id); continue }
        placed.push(spots[best.k])
        sides.set(id, best.k)
        if (best.k !== 'r') side.set(id, best.k)
        continue
      }
      if (off(spots.r) || crowd(spots.r, c.n.hasClass('label-hidden') ? SLACK : 0)) hide.add(c.n.id())
      else placed.push(spots.r)
    }

    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const id = n.id(), off = hide.has(id)
        if (n.hasClass('label-hidden') !== off) n.toggleClass('label-hidden', off)
        for (const k of ['l', 't', 'b']) {
          const on = side.get(id) === k
          if (n.hasClass('label-' + k) !== on) n.toggleClass('label-' + k, on)
        }
      })
    })
    busy = false
  }

  // Throttled. A pan or zoom fires `viewport`; physics fires `position` every frame, so
  // that one is ignored while the layout runs and the pass waits for `layoutstop`.
  const schedule = () => { if (!timer && !busy) timer = setTimeout(run, 120) }
  const onPosition = () => { if (!paused()) schedule() }
  const events = 'viewport layoutstop resize'
  cy.on(events, schedule)
  cy.on('position', onPosition)
  cy.on('class', 'node', schedule)
  schedule()
  // Mona Sans is lazy: measure again once it has loaded
  try { document.fonts?.ready.then(() => { clearLabelWidths(); schedule() }) } catch { /* no font API */ }
  return () => {
    cy.off(events, schedule)
    cy.off('position', onPosition)
    cy.off('class', 'node', schedule)
    clearTimeout(timer)
  }
}
