import { describe, expect, it } from 'vitest'
import { bind, tieAcross } from './typography'

const N = ' '

describe('bind', () => {
  it('ties short words to the next word', () => {
    expect(bind('Type a topic and get a map of the domain')).toBe(`Type a${N}topic and${N}get a${N}map of${N}the${N}domain`)
  })
  it('keeps a dash off the start of a line', () => {
    expect(bind('open data — graph – gaps')).toBe(`open data${N}— graph${N}– gaps`)
  })
  it('keeps a middle dot off the start of a line', () => {
    expect(bind('Circular e-waste · 8 nodes')).toBe(`Circular e-waste${N}· 8${N}nodes`)
  })
  it('ties numbers to their word', () => {
    expect(bind('58 nodes in 10 clusters')).toBe(`58${N}nodes in${N}10${N}clusters`)
  })
  it('leaves long words and single tokens alone', () => {
    expect(bind('Opportunities')).toBe('Opportunities')
    expect(bind('research exists')).toBe('research exists')
  })
  it('is idempotent', () => {
    const once = bind('a map of the domain')
    expect(bind(once)).toBe(once)
  })
})

describe('tieAcross', () => {
  it('ties a unit to a number held in the previous text node', () => {
    expect(tieAcross(' nodes · ', '8', null)).toBe(`${N}nodes · `)
  })
  it('ties a number to a word held in the next text node', () => {
    expect(tieAcross('of 8 ', null, 'nodes')).toBe(`of 8${N}`)
  })
  it('leaves ordinary seams alone', () => {
    expect(tieAcross(' and more', 'papers', null)).toBe(' and more')
    expect(tieAcross('see ', null, 'nodes')).toBe('see ')
    expect(tieAcross(' — 8', '3', null)).toBe(' — 8')
  })
  it('is idempotent', () => {
    const once = tieAcross(' nodes', '8', null)
    expect(tieAcross(once, '8', null)).toBe(once)
  })
})
