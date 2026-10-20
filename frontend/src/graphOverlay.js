// A drawing layer above the Cytoscape canvas, in the B² plotter idiom:
//  - cluster regions: a faint fill, a dotted contour and the cluster's number,
//  - ruler ticks along the top and left edges that move with pan and zoom
//    (ticks only: layout coordinates measure nothing, so they carry no numbers),
//  - registration marks (+) at the corners of the data's bounding box,
//  - a crosshair with a readout, while Alt is held,
//  - bracket corners around the selected node, readable under a thumb and
//    a second cue besides the accent colour.
// Purely decorative (aria-hidden, no pointer events). Redraws at most once a frame.
function cssVar(name, fallback) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback } catch { return fallback }
}

const STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

// Convex hull (monotone chain) of screen points.
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = [], upper = []
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

// The hull grown by `r` with round corners (the hull's Minkowski sum with a disc):
// a 3-node cluster is a pebble, not a sliver, and every node keeps `r` of air
// inside the contour. Built as the hull of a 16-gon around each vertex.
function rounded(points, r) {
  const ring = []
  for (const [x, y] of points) {
    for (let k = 0; k < 16; k++) ring.push([x + Math.cos((k * Math.PI) / 8) * r, y + Math.sin((k * Math.PI) / 8) * r])
  }
  return hull(ring)
}

// Fill strength of a lit (gap-reveal) cluster by rank, so GAP 01 outweighs 03.
const RANK_FILL = { 1: 0.12, 2: 0.08, 3: 0.05 }

export function attachOverlay(cy, canvas) {
  const ctx = canvas.getContext('2d')
  const accentRgb = cssVar('--accent-rgb', '255 43 214')
  const colors = {
    line: cssVar('--line-strong', '#3A3A3A'),
    label: cssVar('--text-2', '#8A8A8A'),
    bg: cssVar('--bg', '#0E0E0E'),
    accent: cssVar('--accent', '#FF2BD6'),
    hull: cssVar('--hull-fill', 'rgba(237, 237, 237, 0.06)'),
    hullLine: cssVar('--hull-line', 'rgba(237, 237, 237, 0.16)'),
  }
  const accentAlpha = (a) => `rgb(${accentRgb} / ${a})`
  const font = `400 ${cssVar('--fs-label', '11px')} "Martian Mono", ui-monospace, monospace`
  let frame = 0
  let pointer = null // rendered position of a fine pointer over the canvas
  let altDown = false // the crosshair shows only while Alt is held
  const finePointer = (() => { try { return window.matchMedia('(pointer: fine)').matches } catch { return false } })()

  function size() {
    const dpr = window.devicePixelRatio || 1
    const w = cy.width(), h = cy.height()
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px'
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { w, h }
  }

  // Boxes of the floating widgets, in canvas coordinates. Measured once, not per frame:
  // they only move when the canvas resizes or a widget is added or removed.
  let rects = null
  function widgetRects() {
    if (rects) return rects
    const container = cy.container()
    const wrap = container?.closest('.graph-canvas-wrap')
    if (!container || !wrap) return []
    const c = container.getBoundingClientRect()
    rects = [...wrap.querySelectorAll('.graph-legend, .graph-controls, .ask-bar, .gap-chip')].map((el) => {
      const r = el.getBoundingClientRect()
      return { x1: r.left - c.left, y1: r.top - c.top, x2: r.right - c.left, y2: r.bottom - c.top }
    })
    return rects
  }
  const forgetRects = () => { rects = null; schedule() }
  const wrapEl = cy.container()?.closest('.graph-canvas-wrap')
  const widgetWatch = wrapEl && typeof MutationObserver !== 'undefined' ? new MutationObserver(forgetRects) : null
  widgetWatch?.observe(wrapEl, { childList: true })
  window.addEventListener('resize', forgetRects)

  function draw() {
    frame = 0
    if (cy.destroyed()) return
    const { w, h } = size()
    ctx.clearRect(0, 0, w, h)
    const z = cy.zoom(), pan = cy.pan()

    // Ruler: a step whose on-screen spacing is ~48px; every 5th tick is long.
    const step = STEPS.find((s) => s * z >= 48) || STEPS[STEPS.length - 1]
    ctx.strokeStyle = colors.line; ctx.lineWidth = 1
    ctx.beginPath()
    for (let m = Math.floor(-pan.x / z / step) * step; m * z + pan.x < w; m += step) {
      const x = Math.round(m * z + pan.x) + 0.5
      const major = Math.round(m / step) % 5 === 0
      ctx.moveTo(x, 0); ctx.lineTo(x, major ? 8 : 4)
    }
    for (let m = Math.floor(-pan.y / z / step) * step; m * z + pan.y < h; m += step) {
      const y = Math.round(m * z + pan.y) + 0.5
      const major = Math.round(m / step) % 5 === 0
      ctx.moveTo(0, y); ctx.lineTo(major ? 8 : 4, y)
    }
    ctx.stroke()

    // Cluster regions: a faint fill and a dotted contour under each community
    // of 3+ nodes, so the map's structure reads before anything is selected.
    // The dots keep the contour from reading as one more edge; each region
    // carries its number from the Clusters list, so it has an identity without a colour.
    const groups = new Map()
    cy.nodes(':visible').forEach((n) => {
      const id = n.data('cluster_id')
      if (id == null || id === '0') return
      if (!groups.has(id)) groups.set(id, { id, pts: [], lit: false, rank: 0 })
      const g = groups.get(id), rp = n.renderedPosition()
      g.pts.push([rp.x, rp.y])
      if (n.hasClass('highlighted')) g.lit = true
      const r = n.data('gapRank')
      if (r && (!g.rank || r < g.rank)) g.rank = r
    })
    const pad = Math.max(14, 22 * Math.min(1.4, z))
    const regions = []
    for (const g of groups.values()) {
      if (g.pts.length < 3) continue
      const base = hull(g.pts)
      if (base.length < 3) continue
      regions.push({ g, poly: rounded(base, pad) })
    }
    regions.sort((a, b) => a.g.lit - b.g.lit) // lit regions on top
    const ranks = cy._clusterRanks
    const tagBoxes = [] // where the cluster numbers sit: the label pass (graphLabels.js) keeps names off them
    ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'
    for (const { g, poly } of regions) {
      ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath()
      if (g.lit) {
        ctx.fillStyle = accentAlpha(RANK_FILL[g.rank] || 0.1); ctx.fill()
        ctx.strokeStyle = colors.accent
        // only the first gap gets a solid outline; the others step back to dashes
        ctx.setLineDash(!g.rank || g.rank === 1 ? [] : [4, 3])
      } else {
        ctx.fillStyle = colors.hull; ctx.fill()
        ctx.strokeStyle = colors.hullLine; ctx.setLineDash([1, 3])
      }
      ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([])
      const num = ranks && ranks[g.id]
      if (num) {
        // the tag sits on the contour's highest point, clear of the nodes inside
        const top = poly.reduce((best, q) => (q[1] < best[1] ? q : best), poly[0])
        if (top[1] > 16) {
          // a halo in the canvas colour keeps the number legible where it lands on a neighbouring (or overlapping) region
          const tag = String(num).padStart(2, '0')
          ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = colors.bg
          ctx.strokeText(tag, top[0], top[1] - 5)
          ctx.fillStyle = g.lit ? colors.accent : colors.label
          ctx.fillText(tag, top[0], top[1] - 5)
          const tw = ctx.measureText(tag).width / 2
          tagBoxes.push({ x1: top[0] - tw, x2: top[0] + tw, y1: top[1] - 17, y2: top[1] - 3 })
        }
      }
    }
    cy._tagBoxes = tagBoxes
    ctx.textAlign = 'start'

    // Registration marks at the corners of the visible data. They sit clear of
    // the floating widgets and the canvas edge, or they are left out.
    ctx.strokeStyle = colors.line; ctx.lineWidth = 1
    const vis = cy.elements(':visible')
    if (vis.length) {
      const bb = vis.renderedBoundingBox({ includeLabels: false })
      const m = 16, s = 5
      const blocked = widgetRects()
      ctx.beginPath()
      for (const [x, y] of [[bb.x1 - m, bb.y1 - m], [bb.x2 + m, bb.y1 - m], [bb.x1 - m, bb.y2 + m], [bb.x2 + m, bb.y2 + m]]) {
        if (x < s + 4 || y < s + 4 || x > w - s - 4 || y > h - s - 4) continue
        if (blocked.some((r) => x + s > r.x1 && x - s < r.x2 && y + s > r.y1 && y - s < r.y2)) continue
        const X = Math.round(x) + 0.5, Y = Math.round(y) + 0.5
        ctx.moveTo(X - s, Y); ctx.lineTo(X + s, Y); ctx.moveTo(X, Y - s); ctx.lineTo(X, Y + s)
      }
      ctx.stroke()
    }

    // Plotter crosshair: hairlines through a mouse pointer, with its model
    // coordinates read off on the rulers. Only while Alt is held, fine pointers only.
    if (pointer && altDown) {
      const { x, y } = pointer
      ctx.strokeStyle = colors.hullLine; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h)
      ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5)
      ctx.stroke(); ctx.setLineDash([])
      const mx = Math.round((x - pan.x) / z), my = Math.round((y - pan.y) / z)
      ctx.fillStyle = colors.label; ctx.font = font; ctx.textBaseline = 'top'
      ctx.fillText(`x ${mx}`, Math.min(w - 64, x + 6), 14)
      ctx.save(); ctx.translate(14, Math.max(64, y - 6)); ctx.rotate(-Math.PI / 2); ctx.fillText(`y ${my}`, 0, 0); ctx.restore()
    }

    // Brackets around the selection.
    ctx.strokeStyle = colors.accent; ctx.lineWidth = 1.5
    cy.nodes(':selected').forEach((n) => {
      const b = n.renderedBoundingBox({ includeLabels: false })
      const pad = 6, arm = Math.max(5, Math.min(10, (b.w + pad * 2) / 3))
      const x1 = b.x1 - pad, y1 = b.y1 - pad, x2 = b.x2 + pad, y2 = b.y2 + pad
      ctx.beginPath()
      ctx.moveTo(x1, y1 + arm); ctx.lineTo(x1, y1); ctx.lineTo(x1 + arm, y1)
      ctx.moveTo(x2 - arm, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + arm)
      ctx.moveTo(x1, y2 - arm); ctx.lineTo(x1, y2); ctx.lineTo(x1 + arm, y2)
      ctx.moveTo(x2 - arm, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - arm)
      ctx.stroke()
    })
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw) }
  cy.on('resize', forgetRects)
  cy.on('render viewport select unselect resize position', schedule)
  const onMove = (e) => {
    pointer = e.renderedPosition ? { ...e.renderedPosition } : null
    altDown = !!e.originalEvent?.altKey
    if (altDown) schedule()
  }
  const container = cy.container()
  const onLeave = () => { pointer = null; schedule() }
  const onKeyUp = (e) => { if (e.key === 'Alt') { altDown = false; schedule() } }
  if (finePointer) {
    cy.on('mousemove', onMove)
    container?.addEventListener('mouseleave', onLeave)
    window.addEventListener('keyup', onKeyUp)
  }
  schedule()
  return () => {
    cy.off('mousemove', onMove)
    container?.removeEventListener('mouseleave', onLeave)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('resize', forgetRects)
    cy.off('resize', forgetRects)
    widgetWatch?.disconnect()
    cy.off('render viewport select unselect resize position', schedule)
    if (frame) cancelAnimationFrame(frame)
  }
}
