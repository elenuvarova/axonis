// A drawing layer above the Cytoscape canvas, in the B² plotter idiom:
//  - ruler ticks along the top and left edges that move with pan and zoom,
//  - registration marks (+) at the corners of the data's bounding box,
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

// Push each hull vertex away from the centroid so the outline clears the glyphs.
function inflate(poly, by) {
  const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length
  const cy = poly.reduce((s, q) => s + q[1], 0) / poly.length
  return poly.map(([x, y]) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1; return [x + (dx / d) * by, y + (dy / d) * by] })
}

export function attachOverlay(cy, canvas) {
  const ctx = canvas.getContext('2d')
  const colors = {
    line: cssVar('--line-strong', '#3A3A3A'),
    tick: cssVar('--text-3', '#555555'),
    accent: cssVar('--accent', '#FF2BD6'),
    accentSoft: 'rgba(255, 43, 214, 0.06)',
    tint: 'rgba(237, 237, 237, 0.035)',
  }
  const font = `400 ${cssVar('--fs-label', '11px')} "Martian Mono", ui-monospace, monospace`
  let frame = 0

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

  function draw() {
    frame = 0
    if (cy.destroyed()) return
    const { w, h } = size()
    ctx.clearRect(0, 0, w, h)
    const z = cy.zoom(), pan = cy.pan()

    // Ruler: a step whose on-screen spacing is ~48px; every 5th tick is long and labelled.
    const step = STEPS.find((s) => s * z >= 48) || STEPS[STEPS.length - 1]
    ctx.strokeStyle = colors.line; ctx.fillStyle = colors.tick; ctx.lineWidth = 1
    ctx.font = font; ctx.textBaseline = 'top'
    ctx.beginPath()
    for (let m = Math.floor(-pan.x / z / step) * step; m * z + pan.x < w; m += step) {
      const x = Math.round(m * z + pan.x) + 0.5
      const major = Math.round(m / step) % 5 === 0
      ctx.moveTo(x, 0); ctx.lineTo(x, major ? 8 : 4)
      if (major && x > 24) ctx.fillText(String(m), x + 3, 3)
    }
    for (let m = Math.floor(-pan.y / z / step) * step; m * z + pan.y < h; m += step) {
      const y = Math.round(m * z + pan.y) + 0.5
      const major = Math.round(m / step) % 5 === 0
      ctx.moveTo(0, y); ctx.lineTo(major ? 8 : 4, y)
    }
    ctx.stroke()

    // Cluster regions: a faint tint under each community of 3+ nodes, so the
    // map's structure reads before anything is selected (no outline: lines
    // there read as extra edges). A lit cluster gets an accent outline.
    const groups = new Map()
    cy.nodes(':visible').forEach((n) => {
      const id = n.data('cluster_id')
      if (id == null || id === '0') return
      if (!groups.has(id)) groups.set(id, { pts: [], lit: false })
      const g = groups.get(id), rp = n.renderedPosition()
      g.pts.push([rp.x, rp.y])
      if (n.hasClass('highlighted')) g.lit = true
    })
    const pad = Math.max(16, 26 * Math.min(1.4, z))
    for (const g of groups.values()) {
      if (g.pts.length < 3) continue
      const poly = inflate(hull(g.pts), pad)
      if (poly.length < 3) continue
      ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath()
      if (g.lit) {
        ctx.fillStyle = colors.accentSoft; ctx.fill()
        ctx.strokeStyle = colors.accent; ctx.lineWidth = 1; ctx.stroke()
      } else {
        ctx.fillStyle = colors.tint; ctx.fill()
      }
    }

    // Registration marks at the corners of the visible data.
    ctx.strokeStyle = colors.line; ctx.lineWidth = 1
    const vis = cy.elements(':visible')
    if (vis.length) {
      const bb = vis.renderedBoundingBox({ includeLabels: false })
      const m = 12, s = 5
      ctx.beginPath()
      for (const [x, y] of [[bb.x1 - m, bb.y1 - m], [bb.x2 + m, bb.y1 - m], [bb.x1 - m, bb.y2 + m], [bb.x2 + m, bb.y2 + m]]) {
        const X = Math.round(x) + 0.5, Y = Math.round(y) + 0.5
        ctx.moveTo(X - s, Y); ctx.lineTo(X + s, Y); ctx.moveTo(X, Y - s); ctx.lineTo(X, Y + s)
      }
      ctx.stroke()
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
  cy.on('render viewport select unselect resize position', schedule)
  schedule()
  return () => {
    cy.off('render viewport select unselect resize position', schedule)
    if (frame) cancelAnimationFrame(frame)
  }
}
