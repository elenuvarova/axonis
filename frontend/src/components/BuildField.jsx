import { useEffect, useRef } from 'react'
import usePrefersReducedMotion from '../usePrefersReducedMotion'

// The build, drawn as it happens. Every concept, paper and institution the
// server has reported so far flies out of the core to its place — glyph by
// type (● concept, ◆ paper, ■ institution), grouped into sectors by source.
// The counts are the real ones from the progress stream; from the resolving
// stage on, neighbours are linked with faint lines while the server merges
// duplicates. It gives way to the saved graph once that exists.
const TYPES = [
  { key: 'wikidata', shape: 'circle', angle: -Math.PI / 2 },
  { key: 'papers', shape: 'diamond', angle: Math.PI / 6 },
  { key: 'institutions', shape: 'square', angle: (5 * Math.PI) / 6 },
]
const CAP = 70 // per type, so a huge build stays light
const FLY_MS = 900
const ease = (t) => 1 - Math.pow(1 - t, 3)

function cssVar(name, fallback) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback } catch { return fallback }
}

export default function BuildField({ counts = {}, stageIndex = -1, log = [] }) {
  const canvasRef = useRef(null)
  const reduced = usePrefersReducedMotion()
  const state = useRef({ parts: [], stage: -1, reduced: false, terms: [] })
  state.current.stage = stageIndex
  state.current.reduced = reduced
  // the search terms the topic was expanded into, straight from the log
  const termLine = log.find((l) => /search terms:/i.test(l.message || ''))
  state.current.terms = termLine ? termLine.message.split(':').slice(1).join(':').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8) : []

  // spawn particles up to the reported counts
  useEffect(() => {
    const s = state.current
    const now = performance.now()
    TYPES.forEach((t, ti) => {
      const want = Math.min(CAP, counts?.[t.key] || 0)
      const have = s.parts.filter((p) => p.type === ti).length
      const step = Math.min(35, 600 / Math.max(1, want - have)) // a whole batch lands within ~0.6 s
      for (let i = have; i < want; i++) {
        // golden-angle placement inside the type's 120° sector
        const spread = (i * 2.399963) % (Math.PI * 0.62) - Math.PI * 0.31
        const r = 0.22 + 0.7 * Math.sqrt((i + 1) / CAP)
        s.parts.push({ type: ti, a: t.angle + spread, r, born: now + (i - have) * step })
      }
    })
  }, [counts?.wikidata, counts?.papers, counts?.institutions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d')
    if (!ctx) return // no canvas (tests, very old browsers): the counters still tell the story
    const text = cssVar('--text', '#EDEDED'), text2 = cssVar('--text-2', '#8A8A8A')
    const line = cssVar('--line', '#2A2A2A'), accent = cssVar('--accent', '#FF2BD6')
    let raf = 0, w = 0, h = 0, t0 = performance.now()

    const resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1)
      w = r.width; h = r.height
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const glyph = (shape, x, y, size) => {
      ctx.beginPath()
      if (shape === 'circle') ctx.arc(x, y, size / 2, 0, Math.PI * 2)
      else if (shape === 'square') ctx.rect(x - size / 2, y - size / 2, size, size)
      else { ctx.moveTo(x, y - size / 1.6); ctx.lineTo(x + size / 1.6, y); ctx.lineTo(x, y + size / 1.6); ctx.lineTo(x - size / 1.6, y); ctx.closePath() }
      ctx.fill()
    }

    const frame = (now) => {
      const s = state.current
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46
      const RX = Math.max(R, w * 0.44), RY = R // the field fills a wide box, not just its centre
      const spin = s.reduced ? 0 : (now - t0) / 60000 // a slow drift, one turn a minute

      // positions
      const pts = s.parts.map((p) => {
        const age = now - p.born
        const k = s.reduced ? 1 : age <= 0 ? 0 : ease(Math.min(1, age / FLY_MS))
        const a = p.a + spin
        return { x: cx + Math.cos(a) * p.r * RX * k, y: cy + Math.sin(a) * p.r * RY * k, k, age, type: p.type }
      })

      // links once the server is resolving and saving (stage ≥ 3)
      if (s.stage >= 3 && pts.length > 1) {
        ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath()
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i]; if (p.k < 1) continue
          let best = -1, bd = Infinity
          for (let j = 0; j < pts.length; j++) {
            if (j === i || pts[j].k < 1) continue
            const d = (pts[j].x - p.x) ** 2 + (pts[j].y - p.y) ** 2
            if (d < bd) { bd = d; best = j }
          }
          if (best >= 0) { ctx.moveTo(p.x, p.y); ctx.lineTo(pts[best].x, pts[best].y) }
        }
        ctx.stroke()
      }

      // while a source is being queried: a beam sweeps its sector
      // (concepts during Wikidata, papers and institutions during OpenAlex)
      const sweeping = s.stage === 1 ? [0] : s.stage === 2 ? [1, 2] : []
      if (sweeping.length) {
        const ph = s.reduced ? 0 : Math.sin((now - t0) / 700)
        ctx.strokeStyle = accent; ctx.lineWidth = 1
        for (const ti of sweeping) {
          const a = TYPES[ti].angle + ph * Math.PI * 0.3
          ctx.globalAlpha = 0.12
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.95, a - 0.12, a + 0.12); ctx.closePath()
          ctx.fillStyle = accent; ctx.fill()
          ctx.globalAlpha = 0.9
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // search terms on an orbit around the core, while the sources are queried
      if (s.terms.length && s.stage <= 2) {
        ctx.font = `400 ${cssVar('--fs-label', '11px')} "Martian Mono", ui-monospace, monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const rx = Math.min(w * 0.4, R * 1.05), ry = R * 0.42
        ctx.setLineDash([2, 4]); ctx.strokeStyle = line
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
        s.terms.forEach((term, i) => {
          const a = spin * 4 + (i / s.terms.length) * Math.PI * 2 - Math.PI / 2
          const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry
          ctx.fillStyle = cssVar('--panel', '#171717')
          const tw = ctx.measureText(term.toUpperCase()).width
          ctx.fillRect(x - tw / 2 - 4, y - 8, tw + 8, 16) // a plate so lines never cross the letters
          ctx.fillStyle = text2
          ctx.fillText(term.toUpperCase(), x, y)
        })
      }

      // the core: the topic the build started from
      ctx.strokeStyle = accent; ctx.lineWidth = 1
      ctx.strokeRect(cx - 7.5, cy - 7.5, 15, 15)
      ctx.fillStyle = accent; ctx.fillRect(cx - 2, cy - 2, 4, 4)

      // glyphs; the newest flash in the accent
      for (const p of pts) {
        if (p.age < 0) continue
        ctx.globalAlpha = Math.min(1, 0.25 + p.k)
        ctx.fillStyle = p.age < FLY_MS + 500 && !s.reduced ? accent : p.type === 0 ? text : text2
        glyph(TYPES[p.type].shape, p.x, p.y, 6)
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }

    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="build-field" aria-hidden="true" />
}
