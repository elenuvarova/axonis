import { useEffect, useRef } from 'react'

// Interactive letter sphere for the home hero: glyphs on a Fibonacci sphere,
// drawn on a 2D canvas with perspective and depth fade, plus a ring of the
// four entity words orbiting the equator. Drag to spin (inertia), otherwise it
// turns slowly on its own. `paused` stops the auto-spin (WCAG 2.2.2); under
// reduced motion there is no auto-spin and no inertia, but dragging still works.
const LETTERS = 'CONCEPTSRESEARCHPAPERSORGANISATIONSPRODUCTSOPPORTUNITIESGAPS'
const RING = ' CONCEPTS · RESEARCH · ORGANISATIONS · PRODUCTS · OPPORTUNITIES ·'
const COUNT = 320
const AUTO_SPIN = 0.16 // rad/s — one turn in ~40 s
const FRICTION = 2.2 // 1/s, drag inertia decay

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function buildPoints() {
  const pts = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  // Deterministic pseudo-random so the sphere looks the same on every visit.
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const t = golden * i
    pts.push({
      x: Math.cos(t) * r, y, z: Math.sin(t) * r,
      ch: LETTERS[Math.floor(rand() * LETTERS.length)],
      accent: rand() < 0.06,
    })
  }
  return pts
}

export default function LetterSphere({ paused = false, reducedMotion = false }) {
  const canvasRef = useRef(null)
  const state = useRef({ yaw: 0.6, pitch: -0.25, vYaw: 0, vPitch: 0, dragging: false, ring: 0 })
  const startRef = useRef(() => {})
  const pausedRef = useRef(paused)
  const reducedRef = useRef(reducedMotion)
  pausedRef.current = paused
  reducedRef.current = reducedMotion

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pts = buildPoints()
    const text = cssVar('--text', '#EDEDED')
    const text2 = cssVar('--text-2', '#8A8A8A')
    const accent = cssVar('--accent', '#FF2BD6')
    const font = '"Martian Mono", ui-monospace, monospace'
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, visible = true

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width; h = rect.height
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      draw()
    }

    function draw() {
      if (!w) return
      const s = state.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const R = Math.min(w, h) * 0.31
      const cx = w / 2, cy = h / 2, cam = 3.2
      // glyph size follows the sphere so a phone-sized sphere isn't a solid blob
      const glyphPx = Math.max(8, Math.min(15, R / 11)), ringPx = Math.max(6, Math.min(9, R / 18))
      const cyw = Math.cos(s.yaw), syw = Math.sin(s.yaw)
      const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

      const items = []
      for (const p of pts) {
        // yaw around Y, then pitch around X
        const x1 = p.x * cyw + p.z * syw
        const z1 = -p.x * syw + p.z * cyw
        const y2 = p.y * cp - z1 * sp
        const z2 = p.y * sp + z1 * cp
        items.push({ x: x1, y: y2, z: z2, ch: p.ch, accent: p.accent, ring: false })
      }
      // Equator ring, tilted with the sphere's pitch, counter-rotating slowly.
      const n = RING.length
      for (let i = 0; i < n; i++) {
        const a = s.ring + (i / n) * Math.PI * 2
        const x = Math.cos(a) * 1.38, z0 = Math.sin(a) * 1.38
        // ring tilt is clamped so a hard drag never swings it out of the frame
        const tilt = Math.max(-0.55, Math.min(0.55, s.pitch + 0.35))
        const y = -z0 * Math.sin(tilt), z = z0 * Math.cos(tilt)
        items.push({ x, y, z, ch: RING[i], accent: false, ring: true })
      }
      items.sort((a, b) => a.z - b.z)

      for (const it of items) {
        if (it.ch === ' ') continue
        const k = cam / (cam - it.z) // perspective
        const depth = (it.z + 1.42) / 2.84 // 0 back … 1 front
        const size = (it.ring ? ringPx : glyphPx) * k
        ctx.font = `${it.ring ? 400 : 500} ${size.toFixed(1)}px ${font}`
        ctx.globalAlpha = it.ring ? 0.25 + depth * 0.6 : 0.12 + depth * 0.88
        ctx.fillStyle = it.accent ? accent : it.ring ? text2 : text
        ctx.fillText(it.ch, cx + it.x * R * k, cy + it.y * R * k)
      }
      ctx.globalAlpha = 1
    }

    function tick(t) {
      const dt = Math.min(0.05, (t - (last || t)) / 1000)
      last = t
      const s = state.current
      if (!s.dragging) {
        if (reducedRef.current) { s.vYaw = 0; s.vPitch = 0 }
        const decay = Math.exp(-FRICTION * dt)
        s.vYaw *= decay; s.vPitch *= decay
        const auto = pausedRef.current || reducedRef.current ? 0 : AUTO_SPIN
        s.yaw += (auto + s.vYaw) * dt
        s.pitch += s.vPitch * dt
        // ease the tilt back towards a gentle default
        s.pitch += (-0.25 - s.pitch) * Math.min(1, dt * 0.6)
        if (!pausedRef.current && !reducedRef.current) s.ring -= AUTO_SPIN * 0.6 * dt
      }
      draw()
      // Nothing moving (paused / reduced motion, no drag inertia left): stop
      // the loop until the next drag or un-pause instead of redrawing a still.
      const idle = (pausedRef.current || reducedRef.current) && !s.dragging &&
        Math.abs(s.vYaw) + Math.abs(s.vPitch) < 1e-3 && Math.abs(s.pitch + 0.25) < 1e-3
      raf = visible && !idle ? requestAnimationFrame(tick) : 0
    }
    const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    startRef.current = start

    // Drag to spin.
    let px = 0, py = 0, pt = 0
    const down = (e) => {
      state.current.dragging = true
      px = e.clientX; py = e.clientY; pt = performance.now()
      canvas.setPointerCapture(e.pointerId)
      start()
    }
    const move = (e) => {
      const s = state.current
      if (!s.dragging) return
      const now = performance.now(), dt = Math.max(1, now - pt) / 1000
      const dx = (e.clientX - px) / (w * 0.5), dy = (e.clientY - py) / (h * 0.5)
      s.yaw += dx * 1.6; s.pitch = Math.max(-1.2, Math.min(1.2, s.pitch + dy * 1.6))
      s.vYaw = (dx * 1.6) / dt; s.vPitch = (dy * 1.6) / dt
      px = e.clientX; py = e.clientY; pt = now
      draw()
    }
    const up = () => { state.current.dragging = false }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)

    // Only animate while on screen and the tab is visible.
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
    io.observe(canvas)
    const onVis = () => { visible = !document.hidden; visible ? start() : stop() }
    document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    // Redraw once the self-hosted mono font is in, so glyphs aren't fallback.
    document.fonts?.ready.then(draw)
    start()

    return () => {
      stop(); io.disconnect(); ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
  }, [])

  // Un-pausing (or leaving reduced motion) restarts an idle loop.
  useEffect(() => { startRef.current() }, [paused, reducedMotion])

  return <canvas ref={canvasRef} className="letter-sphere" aria-hidden="true" />
}
