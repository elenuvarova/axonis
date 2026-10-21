import { describe, expect, it } from 'vitest'
import { pickSpot } from './gapPlacement'

const base = { w: 1000, h: 600, W: 220, H: 72, taken: [] }
// the cluster's own nodes fill its box, so a callout on top of it always costs something
const filled = (b) => ({ ...b, cost: 10 })
const hit = (r, o) => r.x < o.x2 && o.x1 < r.x + 220 && r.y < o.y2 && o.y1 < r.y + 72

describe('pickSpot', () => {
  it('sits next to its cluster, not on it, when there is room', () => {
    const b = { x1: 300, y1: 250, x2: 500, y2: 400 }
    const spot = pickSpot({ ...base, b, obstacles: [filled(b)] })
    expect(hit(spot, b)).toBe(false)
    const gap = Math.max(b.x1 - (spot.x + 220), spot.x - b.x2, b.y1 - (spot.y + 72), spot.y - b.y2)
    expect(gap).toBeLessThanOrEqual(12)
  })

  it('keeps off a cluster number sitting where the callout would land', () => {
    const b = { x1: 300, y1: 250, x2: 500, y2: 400 }
    const tag = { x1: 520, y1: 255, x2: 545, y2: 270, cost: 15 }
    const spot = pickSpot({ ...base, b, obstacles: [filled(b), tag] })
    expect(hit(spot, tag)).toBe(false)
  })

  it('never lands on a fixed widget or a callout already placed', () => {
    const b = { x1: 300, y1: 250, x2: 500, y2: 400 }
    const widget = { x1: 500, y1: 200, x2: 800, y2: 450 }
    const spot = pickSpot({ ...base, b, obstacles: [filled(b)], taken: [widget] })
    expect(hit(spot, widget)).toBe(false)
  })

  it('stays put while nodes drift a little, and moves once its spot is badly covered', () => {
    const b = { x1: 300, y1: 250, x2: 500, y2: 400 }
    const prev = { x: 512, y: 250 }
    const nudge = { x1: 600, y1: 260, x2: 604, y2: 264, cost: 5 } // one node drifted under it
    expect(pickSpot({ ...base, b, obstacles: [filled(b), nudge], prev })).toEqual(prev)
    const wall = Array.from({ length: 6 }, (_, i) => ({ x1: 520 + i * 30, y1: 250, x2: 540 + i * 30, y2: 320, cost: 25 }))
    expect(pickSpot({ ...base, b, obstacles: [filled(b), ...wall], prev })).not.toEqual(prev)
  })

  it('stays inside the canvas on a small one', () => {
    const b = { x1: 0, y1: 0, x2: 320, y2: 400 }
    const spot = pickSpot({ w: 320, h: 444, W: 180, H: 72, b, obstacles: [filled(b)], taken: [] })
    expect(spot.x).toBeGreaterThanOrEqual(16)
    expect(spot.x + 180).toBeLessThanOrEqual(304)
    expect(spot.y + 72).toBeLessThanOrEqual(428)
  })
})
