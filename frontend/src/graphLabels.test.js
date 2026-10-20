import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { attachLabelDeclutter, clearLabelWidths } from './graphLabels'

// A stub of the part of Cytoscape the pass touches: nodes with a rendered box,
// classes, data and a font size; batch/on/off; zoom and canvas size.
function makeNode(id, { x, y, size = 10, label = id, hub = false, degree = 0, classes = [], selected = false, displayLabel = label } = {}) {
  const cls = new Set(classes)
  return {
    id: () => id,
    hasClass: (c) => cls.has(c),
    toggleClass: (c, on) => { if (on) cls.add(c); else cls.delete(c) },
    is: (sel) => sel.split(',').map((t) => t.trim()).some((t) => (t === ':selected' ? selected : cls.has(t.slice(1)))),
    data: (k) => ({ label, displayLabel, hub, degree })[k],
    renderedBoundingBox: () => ({ x1: x - size / 2, y1: y - size / 2, x2: x + size / 2, y2: y + size / 2 }),
    pstyle: () => ({ pfValue: 11 }),
  }
}

function makeCy(nodes, { w = 600, h = 400, zoom = 1 } = {}) {
  const coll = { forEach: (fn) => nodes.forEach(fn) }
  const handlers = {}
  return {
    destroyed: () => false,
    zoom: () => zoom, width: () => w, height: () => h,
    nodes: () => coll,
    batch: (fn) => fn(),
    on: (ev, sel, fn) => { (handlers[ev] ||= []).push(fn || sel) },
    off: () => {},
    emit: (ev) => (handlers[ev] || []).forEach((f) => f()),
  }
}

const run = (cy, opts) => {
  const detach = attachLabelDeclutter(cy, opts)
  vi.advanceTimersByTime(130)
  return detach
}
const hidden = (n) => n.hasClass('label-hidden')

describe('attachLabelDeclutter', () => {
  beforeEach(() => { vi.useFakeTimers(); clearLabelWidths() })
  afterEach(() => { vi.useRealTimers() })

  it('keeps a persistent label that has room and hides one that would cover a node', () => {
    const free = makeNode('free', { x: 100, y: 100 })
    const blocked = makeNode('blocked', { x: 100, y: 200 })
    const neighbour = makeNode('neighbour', { x: 125, y: 200 }) // sits where blocked's label would start
    run(makeCy([free, blocked, neighbour]))
    expect(hidden(free)).toBe(false)
    expect(hidden(blocked)).toBe(true)
  })

  it('lets a higher-priority label win a collision (best connected first)', () => {
    const a = makeNode('Alpha label', { x: 100, y: 100, degree: 5 })
    const b = makeNode('Beta label', { x: 100, y: 108, degree: 1 }) // label boxes overlap
    run(makeCy([a, b]))
    expect(hidden(a)).toBe(false)
    expect(hidden(b)).toBe(true)
  })

  it('priority: asked-for > hub > the rest', () => {
    const asked = makeNode('Asked', { x: 100, y: 100, selected: true })
    const hub = makeNode('Hub label', { x: 100, y: 110, hub: true })
    const other = makeNode('Other label', { x: 100, y: 104, degree: 9 })
    run(makeCy([asked, hub, other]))
    expect(hidden(asked)).toBe(false)
    expect(hidden(hub)).toBe(false) // a hub is never dropped for crowding...
    expect(hidden(other)).toBe(true)
    // ...it moves instead of overlapping the asked-for label
    expect(['label-l', 'label-t', 'label-b'].some((c) => hub.hasClass(c))).toBe(true)
  })

  it('hides labels that run off the canvas or belong to a node cut by its edge', () => {
    const nearRight = makeNode('A long label near the edge', { x: 560, y: 100 })
    const cut = makeNode('Cut', { x: 2, y: 200 })
    const fine = makeNode('Fine', { x: 100, y: 300 })
    run(makeCy([nearRight, cut, fine]))
    expect(hidden(nearRight)).toBe(true)
    expect(hidden(cut)).toBe(true)
    expect(hidden(fine)).toBe(false)
  })

  it('drops labels that would be smaller than ~10px on screen', () => {
    const n = makeNode('Tiny', { x: 100, y: 100 })
    run(makeCy([n], { zoom: 0.5 })) // 11 * 0.5 = 5.5px
    expect(hidden(n)).toBe(true)
  })

  it('moves a hub to the side where it touches least, and keeps it there on a tie', () => {
    const hub = makeNode('Hub label', { x: 200, y: 100, hub: true })
    let bx = 230
    const blocker = makeNode('x', { x: 0, y: 100, displayLabel: '' })
    blocker.renderedBoundingBox = () => ({ x1: bx - 5, y1: 95, x2: bx + 5, y2: 105 }) // right of the hub
    const cy = makeCy([hub, blocker])
    run(cy)
    expect(hub.hasClass('label-l')).toBe(true)
    // the blocker leaves: right and left are now equally free, the hub stays on the left
    bx = 500
    cy.emit('viewport')
    vi.advanceTimersByTime(130)
    expect(hub.hasClass('label-l')).toBe(true)
  })

  it('does not rerun on node movement while the layout is paused', () => {
    const n = makeNode('Moving', { x: 100, y: 100 })
    const cy = makeCy([n])
    let paused = true
    const spy = vi.spyOn(cy, 'zoom')
    run(cy, { paused: () => paused })
    const calls = spy.mock.calls.length
    cy.emit('position')
    vi.advanceTimersByTime(300)
    expect(spy.mock.calls.length).toBe(calls)
    paused = false
    cy.emit('position')
    vi.advanceTimersByTime(300)
    expect(spy.mock.calls.length).toBeGreaterThan(calls)
  })
})
