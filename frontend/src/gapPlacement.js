// Where a gap-reveal callout goes (GapReveal.jsx). Pure geometry, in canvas pixels.
// The free spot nearest the cluster `b`: beside it first (right, left, above, below), then anywhere
// on a grid of at most ~12 x 10 spots. Covering something costs far more than distance, so the
// leader line does the reaching:
//   obstacles  { x1, y1, x2, y2, cost }  nodes, hub names, cluster numbers: cost each
//   taken      boxes of fixed widgets and callouts already placed: 200 each
//   prev       where this callout was last time: it stays unless a spot is `stay` cheaper
const hits = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

export function pickSpot({ b, w, h, W, H, GAP = 12, M = 16, obstacles, taken, prev, stay = 8 }) {
  const spots = [
    [b.x2 + GAP, b.y1], [b.x2 + GAP, b.y2 - H], [b.x1 - GAP - W, b.y1], [b.x1 - GAP - W, b.y2 - H],
    [b.x2 - W, b.y1 - GAP - H], [b.x1, b.y1 - GAP - H], [b.x2 - W, b.y2 + GAP], [b.x1, b.y2 + GAP],
  ]
  const stepX = Math.max(32, (w - 2 * M - W) / 11), stepY = Math.max(28, (h - 2 * M - H) / 9)
  for (let gx = M; gx <= w - M - W; gx += stepX) for (let gy = M; gy <= h - M - H; gy += stepY) spots.push([gx, gy])
  const costAt = (x, y, sx, sy) => {
    const r = { x1: x, y1: y, x2: x + W, y2: y + H }
    const dx = Math.max(0, b.x1 - r.x2, r.x1 - b.x2), dy = Math.max(0, b.y1 - r.y2, r.y1 - b.y2)
    return obstacles.reduce((c, o) => c + (hits(r, o) ? o.cost : 0), 0)
      + taken.filter((t) => hits(r, t)).length * 200
      + Math.hypot(dx, dy) * 0.04
      + (Math.abs(x - sx) + Math.abs(y - sy)) * 0.5 // pushed back into the canvas: a worse spot
  }
  let best = null
  for (const [sx, sy] of spots) {
    const x = clamp(sx, M, w - M - W), y = clamp(sy, M, h - M - H)
    const cost = costAt(x, y, sx, sy)
    if (!best || cost < best.cost) best = { cost, x, y }
  }
  if (prev && prev.x >= M && prev.y >= M && prev.x <= w - M - W && prev.y <= h - M - H
    && costAt(prev.x, prev.y, prev.x, prev.y) <= best.cost + stay) return { x: prev.x, y: prev.y }
  return { x: best.x, y: best.y }
}
