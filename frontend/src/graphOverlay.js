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

export function attachOverlay(cy, canvas) {
  const ctx = canvas.getContext('2d')
  const colors = {
    line: cssVar('--line-strong', '#3A3A3A'),
    tick: cssVar('--text-3', '#555555'),
    accent: cssVar('--accent', '#FF2BD6'),
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

    // Registration marks at the corners of the visible data.
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
  cy.on('render viewport select unselect resize', schedule)
  schedule()
  return () => {
    cy.off('render viewport select unselect resize', schedule)
    if (frame) cancelAnimationFrame(frame)
  }
}
