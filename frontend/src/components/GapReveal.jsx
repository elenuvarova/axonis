import { useEffect, useRef, useState } from 'react'
import { pad } from '../format'
import { track } from '../analytics'
import { pickSpot } from '../gapPlacement'

// The first look at a map answers the product's question straight away:
// where are the gaps? For a few seconds the map dims and the top-scoring
// opportunity clusters light up, each with a plotter callout. Any touch,
// scroll or key hands the map back; it never blocks anything.
// The lit clusters step down by rank (fill, outline, callout), only the three
// best-connected nodes of each speak up in the accent, and every callout sits
// beside its cluster, not on it. On a phone only gap 01 gets a callout.
const HOLD_MS = 6500
const FIXED_UI = '.graph-legend, .graph-controls, .ask-bar, .gap-reveal-head'
const STAY = 8 // a callout moves only when another spot is this much cheaper (the live layout nudges nodes for a few seconds)
const SETTLE_MS = 2200 // after this the live physics has done most of its moving: a callout then stays put unless its spot turns bad
const STAY_SETTLED = 40
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

export default function GapReveal({ cy, items, onOpen, onDone }) {
  const [boxes, setBoxes] = useState([])
  const doneRef = useRef(false)
  const placeRef = useRef(() => {})
  const clearBannerRef = useRef(() => {})
  const lastSpot = useRef({}) // clusterId -> {x, y}
  const ctl = useRef({ pause: () => {}, resume: () => {}, skip: () => {} })

  useEffect(() => {
    if (!cy || cy.destroyed() || !items.length) return
    lastSpot.current = {}
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
    const t0 = performance.now()
    const place = () => {
      if (cy.destroyed()) return
      const stay = performance.now() - t0 > SETTLE_MS ? STAY_SETTLED : STAY
      const w = cy.width(), h = cy.height()
      const single = phone || h < 420 // a phone, or a landscape phone: one callout is all the canvas holds
      const c = cy.container().getBoundingClientRect()
      const wrap = cy.container().closest('.graph-canvas-wrap')
      const taken = [...(wrap?.querySelectorAll(FIXED_UI) || [])].map((el) => {
        const r = el.getBoundingClientRect()
        return { x1: r.left - c.left, y1: r.top - c.top, x2: r.right - c.left, y2: r.bottom - c.top }
      })
      const box = (b, by, cost) => ({ x1: b.x1 - by, y1: b.y1 - by, x2: b.x2 + by, y2: b.y2 + by, cost })
      // what a callout must not sit on, by how much it hurts: nodes, the best-connected
      // nodes of a lit cluster and their names, and the cluster numbers drawn by graphOverlay.js
      const nodes = cy.nodes(':visible').map((n) =>
        box(n.renderedBoundingBox({ includeLabels: false, includeOverlays: false }), 4, n.hasClass('gap-top') ? 25 : 10))
      cy.nodes('.gap-top').forEach((n) => {
        if (!n.hasClass('label-hidden')) nodes.push(box(n.renderedBoundingBox({ includeLabels: true, includeOverlays: false }), 2, 15))
      })
      for (const t of cy._tagBoxes || []) nodes.push(box(t, 3, 15))
      const out = []
      items.forEach((it, i) => {
        const s = sets[i]
        if (!s.length || (single && i > 0)) return
        const b = s.renderedBoundingBox({ includeLabels: false, includeOverlays: false })
        // the callout's spot: beside its cluster, clear of nodes, names, numbers and widgets (gapPlacement.js)
        const spot = pickSpot({
          b, w, h, W, H, GAP, M, obstacles: nodes, taken: [...taken, ...out.map((o) => o.r)],
          prev: lastSpot.current[it.clusterId], stay,
        })
        lastSpot.current[it.clusterId] = spot
        const best = { ...spot, r: { x1: spot.x, y1: spot.y, x2: spot.x + W, y2: spot.y + H } }
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
    // The banner sits on top of the canvas: if a lit cluster reaches up under it, slide the view down (never zoom) just enough.
    clearBannerRef.current = () => {
      const head = cy.container()?.closest('.graph-canvas-wrap')?.querySelector('.gap-reveal-head')
      if (!head || phone || cy.destroyed()) return
      const c = cy.container().getBoundingClientRect(), br = head.getBoundingClientRect()
      const bb = all.renderedBoundingBox({ includeLabels: false, includeOverlays: false })
      const HULL = 24 // the cluster's outline stands this far outside its nodes
      if (bb.x2 + HULL < br.left - c.left || bb.x1 - HULL > br.right - c.left) return
      const need = br.bottom - c.top + 12 - (bb.y1 - HULL)
      const dy = Math.min(need, cy.height() - 32 - (bb.y2 + HULL)) // keeps the lit clusters off the bottom edge
      if (dy < 8) return
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (reduced) cy.panBy({ x: 0, y: dy })
      else cy.animate({ panBy: { x: 0, y: dy } }, { duration: 300 })
    }
    place()
    // the live physics keeps moving the clusters for a couple of seconds: look again once it has mostly settled
    const clearTimer = setTimeout(() => clearBannerRef.current(), SETTLE_MS + 400)
    // viewport events come every frame while panning or zooming: place once per frame
    let placeFrame = 0
    const placeSoon = () => { if (!placeFrame) placeFrame = requestAnimationFrame(() => { placeFrame = 0; place() }) }
    cy.on('viewport position', placeSoon)

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
      clearTimeout(clearTimer)
      cy.off('viewport position', placeSoon)
      cancelAnimationFrame(placeFrame)
      container?.removeEventListener('pointerdown', end)
      container?.removeEventListener('wheel', end)
      window.removeEventListener('keydown', end)
    }
  }, [cy, items]) // eslint-disable-line react-hooks/exhaustive-deps

  // the banner is not in the DOM on the first pass: place again once it is, so
  // callouts keep clear of it
  const shown = boxes.length > 0
  useEffect(() => { if (shown) { clearBannerRef.current(); placeRef.current() } }, [shown])

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
