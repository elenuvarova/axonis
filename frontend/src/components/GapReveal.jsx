import { useEffect, useRef, useState } from 'react'
import { pad } from '../format'
import { track } from '../analytics'

// The first look at a map answers the product's question straight away:
// where are the gaps? For a few seconds the map dims and the top-scoring
// opportunity clusters light up, each with a plotter callout. Any touch,
// scroll or key hands the map back; it never blocks anything.
const HOLD_MS = 6500

export default function GapReveal({ cy, items, onOpen, onDone }) {
  const [boxes, setBoxes] = useState([])
  const doneRef = useRef(false)

  useEffect(() => {
    if (!cy || cy.destroyed() || !items.length) return
    doneRef.current = false // a fresh run (StrictMode mounts effects twice)
    const restore = () => {
      if (cy.destroyed()) return
      cy.batch(() => {
        cy.elements().removeClass('faded')
        cy.nodes().removeClass('highlighted')
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
      all.addClass('highlighted')
      all.edgesWith(all).addClass('highlighted')
    })
    cy._highlightedCluster = '__reveal__'
    track('gap_reveal', { gaps: items.length })

    // callouts follow the clusters through pan/zoom
    const W = window.matchMedia?.('(max-width: 767px)').matches ? 180 : 220, H = 64, GAP = 8
    const place = () => {
      const w = cy.width(), h = cy.height()
      const placed = []
      const out = sets.map((s, i) => {
        if (!s.length) return null
        const b = s.renderedBoundingBox({ includeLabels: false })
        return { ...items[i], x: Math.min(Math.max(8, b.x2 + 8), w - W - 8), y: Math.min(Math.max(8, b.y1 - 8), h - H - 8) }
      }).filter(Boolean).sort((a, b) => a.y - b.y)
      // callouts never sit on each other: push a colliding one below the last
      for (const c of out) {
        for (const p of placed) {
          if (c.x < p.x + W + GAP && p.x < c.x + W + GAP && c.y < p.y + H + GAP && p.y < c.y + H + GAP) c.y = p.y + H + GAP
        }
        c.y = Math.min(c.y, h - H - 8)
        placed.push(c)
      }
      setBoxes(out)
    }
    place()
    cy.on('viewport', place)

    const timer = setTimeout(() => finish('timeout'), HOLD_MS)
    const end = () => finish('interaction')
    const container = cy.container()
    container?.addEventListener('pointerdown', end, { once: true })
    container?.addEventListener('wheel', end, { once: true, passive: true })
    window.addEventListener('keydown', end, { once: true })
    return () => {
      if (!doneRef.current) { doneRef.current = true; restore() } // unmounted early (tab switch, callout)
      clearTimeout(timer)
      cy.off('viewport', place)
      container?.removeEventListener('pointerdown', end)
      container?.removeEventListener('wheel', end)
      window.removeEventListener('keydown', end)
    }
  }, [cy, items]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!boxes.length) return null
  return (
    <div className="gap-reveal" role="status" aria-live="polite">
      <p className="sr-only">Top gaps on this map: {boxes.map((b) => `${b.title}, score ${b.score}`).join('; ')}</p>
      {boxes.map((b) => (
        <button
          key={b.clusterId}
          type="button"
          className="gap-callout"
          style={{ transform: `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)` }}
          onClick={() => { track('gap_reveal_open', { rank: b.rank }); onOpen() }}
        >
          <span className="gap-callout-k">Gap {pad(b.rank)} · {b.score}</span>
          <span className="gap-callout-t">{b.title}</span>
        </button>
      ))}
    </div>
  )
}
