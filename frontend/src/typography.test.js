import { describe, expect, it } from 'vitest'
import { bind } from './typography'

const N = ' '

describe('bind', () => {
  it('ties short words to the next word', () => {
    expect(bind('Type a topic and get a map of the domain')).toBe(`Type a${N}topic and${N}get a${N}map of${N}the${N}domain`)
  })
  it('keeps a dash off the start of a line', () => {
    expect(bind('open data — graph – gaps')).toBe(`open data${N}— graph${N}– gaps`)
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
