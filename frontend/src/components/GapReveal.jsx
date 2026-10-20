import { useEffect, useRef, useState } from 'react'
import { pad } from '../format'
import { track } from '../analytics'

// The first look at a map answers the product's question straight away:
// where are the gaps? For a few seconds the map dims and the top-scoring
// opportunity clusters light up, each with a plotter callout. Any touch,
// scroll or key hands the map back; it never blocks anything.
// The lit clusters step down by rank (fill, outline, callout), only the three
// best-connected nodes of each speak up in the accent, and every callout sits
// beside its cluster, not on it. On a phone only gap 01 gets a callout.
const HOLD_MS = 6500
const FIXED_UI = '.graph-legend, .graph-controls, .ask-bar, .gap-reveal-head'
const hits = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

export default function GapReveal({ cy, items, onOpen, onDone }) {
  const [boxes, setBoxes] = useState([])
  const doneRef = useRef(false)
  const placeRef = useRef(() => {})
  const ctl = useRef({ pause: () => {}, resume: () => {}, skip: () => {} })

  useEffect(() => {
    if (!cy || cy.destroyed() || !items.length) return
    doneRef.current = false // a fresh run (StrictMode mounts effects twice)
    const restore = () => {
      if (cy.destroyed()) return
      cy.batch(() => {
        cy.elements().removeClass('faded')
        cy.nodes().removeClass('highlighted gap-lit gap-top').removeData('gapRank')
        cy.edges().removeClass('highlighted')
      })
      if (cy._highlightedCluster === '__reveal__') cy._highlightedCluster = null
    }
    const finish = (how) => {
      if (doneRef.current) return
      doneRef.current = true
      track('gap_reveal_end', { how })
      restore()
      onDone()
    }

    // light the clusters
    const sets = items.map((it) => cy.nodes(`[cluster_id = "${it.clusterId}"]`))
    const all = sets.reduce((acc, s) => acc.union(s), cy.collection())
    cy.batch(() => {
      cy.elements().difference(all.union(all.edgesWith(all))).addClass('faded')
      all.addClass('highlighted gap-lit')
      all.edgesWith(all).addClass('highlighted')
      sets.forEach((s, i) => {
        s.forEach((n) => n.data('gapRank', items[i].rank))
        s.sort((a, b) => (b.data('degree') || 0) - (a.data('degree') || 0)).slice(0, 3).addClass('gap-top')
      })
    })
    cy._highlightedCluster = '__reveal__'
    track('gap_reveal', { gaps: items.length })

    // callouts follow the clusters through pan/zoom
    const phone = window.matchMedia?.('(max-width: 767px)').matches
    const W = phone ? 180 : 220, H = 72, GAP = 12, M = 16
    const place = () => {
      if (cy.destroyed()) return
      const w = cy.width(), h = cy.height()
      const c = cy.container().getBoundingClientRect()
      const wrap = cy.container().closest('.graph-canvas-wrap')
      const taken = [...(wrap?.querySelectorAll(FIXED_UI) || [])].map((el) => {
        const r = el.getBoundingClientRect()
        return { x1: r.left - c.left, y1: r.top - c.top, x2: r.right - c.left, y2: r.bottom - c.top }
      })
      const nodes = cy.nodes(':visible').map((n) => {
        const b = n.renderedBoundingBox({ includeLabels: false, includeOverlays: false })
        return { x1: b.x1 - 4, y1: b.y1 - 4, x2: b.x2 + 4, y2: b.y2 + 4 }
      })
      const out = []
      items.forEach((it, i) => {
        const s = sets[i]
        if (!s.length || (phone && i > 0)) return
        const b = s.renderedBoundingBox({ includeLabels: false, includeOverlays: false })
        // the free spot nearest the cluster: beside it first (right, left, above,
        // below), then anywhere on a coarse grid; covering a node or another
        // callout costs far more than distance, so the leader line does the reaching
        const spots = [
          [b.x2 + GAP, b.y1], [b.x2 + GAP, b.y2 - H], [b.x1 - GAP - W, b.y1], [b.x1 - GAP - W, b.y2 - H],
          [b.x2 - W, b.y1 - GAP - H], [b.x1, b.y1 - GAP - H], [b.x2 - W, b.y2 + GAP], [b.x1, b.y2 + GAP],
        ]
        // at most ~8 x 7 grid spots, however big the canvas
        const stepX = Math.max(48, (w - 2 * M - W) / 7), stepY = Math.max(40, (h - 2 * M - H) / 6)
        for (let gx = M; gx <= w - M - W; gx += stepX) for (let gy = M; gy <= h - M - H; gy += stepY) spots.push([gx, gy])
        let best = null
        for (const [sx, sy] of spots) {
          const x = clamp(sx, M, w - M - W), y = clamp(sy, M, h - M - H)
          const r = { x1: x, y1: y, x2: x + W, y2: y + H }
          const dx = Math.max(0, b.x1 - r.x2, r.x1 - b.x2), dy = Math.max(0, b.y1 - r.y2, r.y1 - b.y2)
          const cost = nodes.filter((n) => hits(r, n)).length * 10
            + taken.filter((t) => hits(r, t)).length * 200
            + out.filter((o) => hits(r, o.r)).length * 200
            + Math.hypot(dx, dy) * 0.04
            + (Math.abs(x - sx) + Math.abs(y - sy)) * 0.5 // pushed back into the canvas: a worse spot
          if (!best || cost < best.cost) best = { cost, x, y, r }
        }
        // leader: from the callout to the cluster's nearest node
        const mid = [best.x + W / 2, best.y + H / 2]
        let near = null
        s.forEach((n) => {
          const p = n.renderedPosition()
          const d = Math.hypot(p.x - mid[0], p.y - mid[1])
          if (!near || d < near.d) near = { d, x: p.x, y: p.y }
        })
        const ax = clamp(near.x, best.x, best.x + W), ay = clamp(near.y, best.y, best.y + H)
        out.push({ ...it, x: best.x, y: best.y, r: best.r, lead: { x1: ax, y1: ay, x2: near.x, y2: near.y } })
      })
      setBoxes(out)
    }
    placeRef.current = place
    place()
    // viewport events come every frame while panning or zooming: place once per frame
    let placeFrame = 0
    const placeSoon = () => { if (!placeFrame) placeFrame = requestAnimationFrame(() => { placeFrame = 0; place() }) }
    cy.on('viewport', placeSoon)

    // the timer pauses while a callout is hovered or focused (a tip that
    // disappears mid-read is worse than no tip)
    let timer = setTimeout(() => finish('timeout'), HOLD_MS)
    ctl.current = {
      pause: () => clearTimeout(timer),
      resume: () => { clearTimeout(timer); timer = setTimeout(() => finish('timeout'), 3000) },
      skip: () => finish('skip'),
    }
    const end = () => finish('interaction')
    const container = cy.container()
    container?.addEventListener('pointerdown', end, { once: true })
    container?.addEventListener('wheel', end, { once: true, passive: true })
    window.addEventListener('keydown', end, { once: true })
    return () => {
      if (!doneRef.current) { doneRef.current = true; restore() } // unmounted early (tab switch, callout)
      clearTimeout(timer)
      cy.off('viewport', placeSoon)
      cancelAnimationFrame(placeFrame)
      container?.removeEventListener('pointerdown', end)
      container?.removeEventListener('wheel', end)
      window.removeEventListener('keydown', end)
    }
  }, [cy, items]) // eslint-disable-line react-hooks/exhaustive-deps

  // the banner is not in the DOM on the first pass: place again once it is, so
  // callouts keep clear of it
  const shown = boxes.length > 0
  useEffect(() => { if (shown) placeRef.current() }, [shown])

  if (!boxes.length) return null
  return (
    <div className="gap-reveal" role="status" aria-live="polite">
      <p className="sr-only">Top gaps on this map: {items.map((b) => `${b.title}, score ${b.score}`).join('; ')}</p>
      <div className="gap-reveal-head">
        <span className="gap-reveal-k">Top gaps</span>
        <span className="gap-reveal-t">where research exists but products don’t</span>
        <button type="button" className="gap-reveal-skip" onClick={() => ctl.current.skip()}>Skip</button>
      </div>
      <svg className="gap-leaders" aria-hidden="true">
        {boxes.map((b) => <line key={b.clusterId} {...b.lead} />)}
      </svg>
      {boxes.map((b) => (
        <button
          key={b.clusterId}
          type="button"
          className={`gap-callout${b.rank === 1 ? ' is-first' : ''}`}
          style={{ transform: `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)` }}
          onClick={() => { track('gap_reveal_open', { rank: b.rank }); onOpen() }}
          onMouseEnter={() => ctl.current.pause()} onMouseLeave={() => ctl.current.resume()}
          onFocus={() => ctl.current.pause()} onBlur={() => ctl.current.resume()}
        >
          <span className="gap-callout-k">Gap {pad(b.rank)} · {b.score}{items.length > boxes.length && <span className="gap-callout-more"> · +{items.length - boxes.length}</span>}</span>
          <span className="gap-callout-t">{b.title}</span>
        </button>
      ))}
    </div>
  )
}
