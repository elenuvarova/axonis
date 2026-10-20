import { describe, expect, it } from 'vitest'
import { freePads } from './graphFit'

const rect = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t })

// a canvas wrap + a sidebar inside one .graph-view, with stubbed geometry
function setup({ vw, sidebar }) {
  document.body.innerHTML = `<div class="graph-view"><div class="graph-canvas-wrap"><div id="c"></div></div><aside class="graph-sidebar"></aside></div>`
  const c = document.getElementById('c')
  c.getBoundingClientRect = () => rect(0, 124, 390, 844)
  const aside = document.querySelector('.graph-sidebar')
  aside.getBoundingClientRect = () => sidebar
  window.innerWidth = vw
  const cy = { container: () => c, elements: () => ({ length: 0 }) }
  return { cy, aside }
}

describe('freePads', () => {
  it('keeps the graph clear of the bottom sheet on a phone', () => {
    const { cy } = setup({ vw: 390, sidebar: rect(0, 496, 390, 800) })
    const p = freePads(cy)
    expect(p.b).toBeGreaterThanOrEqual(844 - 496) // everything under the sheet's top edge is covered
  })

  it('ignores a hidden sheet', () => {
    const { cy, aside } = setup({ vw: 390, sidebar: rect(0, 496, 390, 800) })
    aside.style.visibility = 'hidden'
    expect(freePads(cy).b).toBeLessThan(100)
  })

  it('does not treat the desktop side panel as a bottom sheet', () => {
    const { cy } = setup({ vw: 1440, sidebar: rect(1080, 104, 1440, 900) })
    expect(freePads(cy).b).toBeLessThan(100)
  })
})
