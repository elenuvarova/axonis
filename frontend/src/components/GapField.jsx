import { useEffect, useRef } from 'react'

// The 404 scene: a giant "404" drawn as a piece of map. The two 4s are
// clusters of nodes and edges; the 0 is not drawn at all — it is a gap, an
// empty spot with a dashed accent rim that the nearest nodes reach into, as
// GapReveal lights a gap on a real map. Nodes fly in on load, shy away from
// the pointer and spring back; a click or tap sends a wave through them.
// The scene settles after the entrance and only moves when touched (WCAG
// 2.2.2); under reduced motion it is a still frame.
const STIFF = 46 // spring back to the glyph, 1/s²
const DAMP = 9 // 1/s
const INTRO_MS = 1400
const LEADS = 3 // nodes per 4 that reach into the gap

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// Deterministic, so the figure is the same on every visit.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
}

// Sample the two 4s of "404" (set in Martian Mono) on a jittered grid, and
// measure where the 0 sits.
function layout(w, h, font) {
  const fs = Math.min(w / 2.35, h * 0.92)
  const off = document.createElement('canvas')
  off.width = Math.ceil(w); off.height = Math.ceil(h)
  const g = off.getContext('2d', { willReadFrequently: true })
  g.font = `500 ${fs}px ${font}`
  g.textBaseline = 'middle'
  const adv = g.measureText('4').width
  const x0 = w / 2 - (adv * 3) / 2, cy = h / 2 + fs * 0.04
  g.fillText('4', x0, cy)
  g.fillText('4', x0 + adv * 2, cy)
  const data = g.getImageData(0, 0, off.width, off.height).data
  const step = Math.max(5, fs / 34)
  const rand = rng(11)
  const nodes = []
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      if (data[(Math.floor(y) * off.width + Math.floor(x)) * 4 + 3] < 128) continue
      const tx = x + (rand() - 0.5) * step * 0.7, ty = y + (rand() - 0.5) * step * 0.7
      nodes.push({ tx, ty, x: tx, y: ty, vx: 0, vy: 0, r: 1 + rand() * rand() * 2.4, lit: false, lag: 0, sx: 0, sy: 0 })
    }
  }
  // the 0: an ellipse in the middle cell, a little narrower than the glyph
  const gap = { x: w / 2, y: cy, rx: adv * 0.3, ry: fs * 0.33 }

  // edges: each node to its two nearest neighbours, plus a few longer ties
  const edges = new Set()
  const near = step * 1.9
  nodes.forEach((a, i) => {
    const d = []
    nodes.forEach((b, j) => {
      if (i === j) return
      const dd = Math.hypot(a.tx - b.tx, a.ty - b.ty)
      if (dd < near) d.push([dd, j])
      else if (dd < step * 4.2 && rand() < 0.012) edges.add(i < j ? `${i}-${j}` : `${j}-${i}`)
    })
    d.sort((p, q) => p[0] - q[0]).slice(0, 2).forEach(([, j]) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`))
  })

  // leads: on each side, the nodes nearest the gap that come at it from
  // different angles, so they fan in rather than leave as one bundle
  const leads = []
  for (const side of [-1, 1]) {
    const picked = []
    nodes
      .map((n, i) => [Math.hypot(n.tx - gap.x, (n.ty - gap.y) * 0.8), i])
      .filter(([, i]) => Math.sign(nodes[i].tx - gap.x) === side)
      .sort((p, q) => p[0] - q[0])
      .forEach(([, i]) => {
        if (picked.length >= LEADS) return
        const a = Math.atan2(nodes[i].ty - gap.y, Math.abs(nodes[i].tx - gap.x))
        if (picked.every((b) => Math.abs(b - a) > 0.32)) { picked.push(a); nodes[i].lit = true; nodes[i].r = 3; leads.push(i) }
      })
  }

  // entrance: from a scattered cloud, sweeping in left to right
  nodes.forEach((n) => {
    const a = rand() * Math.PI * 2, d = (0.35 + rand() * 0.5) * Math.max(w, h)
    n.sx = w / 2 + Math.cos(a) * d; n.sy = h / 2 + Math.sin(a) * d * 0.6
    n.lag = (n.tx / w) * 0.35 + rand() * 0.15
  })

  return { nodes, edges: [...edges].map((k) => k.split('-').map(Number)), leads, gap, step }
}

// the point where the ray from the gap's centre to (x, y) crosses the rim
function rim(gap, x, y, pad) {
  const a = Math.atan2((y - gap.y) / gap.ry, (x - gap.x) / gap.rx)
  return [gap.x + Math.cos(a) * (gap.rx + pad), gap.y + Math.sin(a) * (gap.ry + pad)]
}

export default function GapField({ reducedMotion = false, label = 'GAP 01', sublabel = 'Nothing here' }) {
  const canvasRef = useRef(null)
  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext?.('2d')
    if (!ctx) return // no canvas (tests, very old browsers): the page reads fine without it
    const text = cssVar('--text', '#EDEDED')
    const text2 = cssVar('--text-2', '#8A8A8A')
    const edgeCol = cssVar('--graph-edge', '#4A4A4A')
    const accent = cssVar('--accent', '#FF2BD6')
    const accentRgb = cssVar('--accent-rgb', '255 43 214')
    const font = '"Martian Mono", ui-monospace, monospace'
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, scene = null
    let introStart = null
    const pointer = { x: 0, y: 0, on: false }
    let pulse = 0 // the gap rim brightens after a wave

    const build = (keepIntro) => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width; h = rect.height
      if (!w || !h) return
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      scene = layout(w, h, font)
      if (!keepIntro) scene.nodes.forEach((n) => { n.x = n.tx; n.y = n.ty })
    }

    function draw() {
      if (!scene) return
      const { nodes, edges, leads, gap } = scene
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const p = introStart == null ? 1 : Math.min(1, (performance.now() - introStart) / INTRO_MS)
      const R = Math.max(70, scene.step * 9) // pointer reach

      // edges, lit in the accent near the pointer
      ctx.lineWidth = 1
      for (const [i, j] of edges) {
        const a = nodes[i], b = nodes[j]
        const fa = a.fade ?? 1, fb = b.fade ?? 1
        let hot = 0
        if (pointer.on) {
          const d = Math.hypot((a.x + b.x) / 2 - pointer.x, (a.y + b.y) / 2 - pointer.y)
          hot = Math.max(0, 1 - d / R)
        }
        ctx.globalAlpha = Math.min(fa, fb) * (0.9 + hot * 0.1)
        ctx.strokeStyle = hot > 0.15 ? `rgb(${accentRgb} / ${0.25 + hot * 0.6})` : edgeCol
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }

      // the gap: soft fill, dashed rim, leads reaching in
      const show = easeOutCubic(Math.max(0, (p - 0.55) / 0.45))
      ctx.globalAlpha = show
      ctx.fillStyle = `rgb(${accentRgb} / ${0.06 + pulse * 0.1})`
      ctx.beginPath(); ctx.ellipse(gap.x, gap.y, gap.rx, gap.ry, 0, 0, Math.PI * 2); ctx.fill()
      ctx.setLineDash([4, 6])
      ctx.strokeStyle = accent
      ctx.globalAlpha = show * (0.75 + pulse * 0.25)
      ctx.stroke()
      ctx.globalAlpha = show * 0.6
      for (const i of leads) {
        const n = nodes[i]
        const [x, y] = rim(gap, n.x, n.y, 6)
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(x, y); ctx.stroke()
      }
      ctx.setLineDash([])

      // the label sits in the empty middle, where a node's name would be
      ctx.globalAlpha = show
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `500 11px ${font}`
      ctx.fillStyle = accent
      ctx.fillText(label, gap.x, gap.y - 9)
      ctx.font = `400 11px ${font}`
      ctx.fillStyle = text2
      let sub = sublabel
      while (sub.length > 4 && ctx.measureText(sub).width > gap.rx * 1.7) sub = `${sub.slice(0, -2)}…`
      ctx.fillText(sub, gap.x, gap.y + 9)
      ctx.textAlign = 'start'

      // nodes
      for (const n of nodes) {
        ctx.globalAlpha = n.fade ?? 1
        ctx.fillStyle = n.lit ? accent : n.r > 3 ? text : text2
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    function tick(t) {
      const dt = Math.min(0.033, (t - (last || t)) / 1000)
      last = t
      if (!scene) { raf = 0; return }
      let energy = 0
      const now = performance.now()
      const p = introStart == null ? 1 : Math.min(1, (now - introStart) / INTRO_MS)
      const R = Math.max(70, scene.step * 9)
      for (const n of scene.nodes) {
        if (introStart != null && p < 1) {
          const e = easeOutCubic(Math.min(1, Math.max(0, (p - n.lag) / (1 - n.lag))))
          n.x = n.sx + (n.tx - n.sx) * e; n.y = n.sy + (n.ty - n.sy) * e
          n.fade = Math.min(1, e * 2.5)
          energy += 1
          continue
        }
        n.fade = 1
        let fx = (n.tx - n.x) * STIFF, fy = (n.ty - n.y) * STIFF
        if (pointer.on) {
          const dx = n.x - pointer.x, dy = n.y - pointer.y
          const d = Math.hypot(dx, dy) || 1
          if (d < R) {
            const f = (1 - d / R) ** 2 * 2600
            fx += (dx / d) * f; fy += (dy / d) * f
          }
        }
        const k = Math.exp(-DAMP * dt)
        n.vx = (n.vx + fx * dt) * k; n.vy = (n.vy + fy * dt) * k
        n.x += n.vx * dt; n.y += n.vy * dt
        energy += Math.abs(n.vx) + Math.abs(n.vy) + Math.abs(n.tx - n.x) + Math.abs(n.ty - n.y)
      }
      if (p >= 1) introStart = null
      pulse = Math.max(0, pulse - dt * 1.2)
      draw()
      // settle: no loop while nothing moves and the pointer is away
      const still = introStart == null && !pointer.on && pulse === 0 && energy < 0.5
      raf = still ? 0 : requestAnimationFrame(tick)
    }
    const start = () => { if (!raf && !reducedRef.current) { last = 0; raf = requestAnimationFrame(tick) } }

    const local = (e) => {
      const r = canvas.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    const move = (e) => {
      if (reducedRef.current) return
      ;[pointer.x, pointer.y] = local(e)
      pointer.on = true
      start()
    }
    const leave = () => { pointer.on = false; start() }
    const down = (e) => {
      if (reducedRef.current || !scene) return
      const [x, y] = local(e)
      for (const n of scene.nodes) {
        const dx = n.x - x, dy = n.y - y
        const d = Math.hypot(dx, dy) || 1
        const f = 1400 * Math.exp(-d / (scene.step * 14))
        n.vx += (dx / d) * f; n.vy += (dy / d) * f
      }
      pulse = 1
      start()
    }

    const begin = () => {
      build(!reducedRef.current)
      if (reducedRef.current) { draw(); return }
      scene?.nodes.forEach((n) => { n.x = n.sx; n.y = n.sy; n.fade = 0 })
      introStart = performance.now()
      start()
    }
    // the 4s are sampled from Martian Mono, so wait for it (but not forever)
    let alive = true
    Promise.race([
      document.fonts?.load?.(`500 64px ${font}`) ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 1200)),
    ]).then(() => alive && begin(), () => alive && begin())

    const ro = new (window.ResizeObserver || class { observe() {} disconnect() {} })(() => {
      if (!scene) return
      build(false)
      draw()
    })
    ro.observe(canvas)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('pointercancel', leave)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('pointercancel', leave)
    }
  }, [label, sublabel])

  return <canvas ref={canvasRef} className="nf-field" aria-hidden="true" />
}
