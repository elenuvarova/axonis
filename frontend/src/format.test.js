import { describe, it, expect } from 'vitest'
import { displayName, shortLabel } from './format'

describe('shortLabel', () => {
  it('keeps short names whole', () => {
    expect(shortLabel('circular economy')).toBe('circular economy')
  })

  it('cuts on a word boundary and drops dangling stop-words', () => {
    expect(shortLabel('Circular economy and the recycling of e-waste')).toBe('Circular economy…')
    expect(shortLabel('A global review of consumer behavior')).toBe('A global review…')
  })

  it('never leaves a space or punctuation before the ellipsis', () => {
    for (const name of ['Risk assessment for sustainability in e-waste', 'Managing end-of-life solar photovoltaic e-waste']) {
      expect(shortLabel(name)).toMatch(/[^\s,;:·–-]…$/)
    }
  })
})

// displayName: first letter up, nothing else changed;
// mixed-case and digit-led names are left to their authors.
describe('displayName', () => {
  it('capitalizes a lowercase first letter', () => {
    expect(displayName('circular economy')).toBe('Circular economy')
  })

  it('raises only the first letter, never title-cases', () => {
    expect(displayName('e-waste recycling')).toBe('E-waste recycling')
    expect(displayName('end-of-life electronics')).toBe('End-of-life electronics')
  })

  it('keeps already-capitalised names, even mixed case', () => {
    expect(displayName('Circular Economy')).toBe('Circular Economy')
  })

  it('leaves names that already start with a capital or a digit alone', () => {
    expect(displayName('E-waste')).toBe('E-waste')
    expect(displayName('iPhone recycling')).toBe('iPhone recycling')
    expect(displayName('3d printing')).toBe('3d printing')
  })

  it('passes empty and non-string values through', () => {
    expect(displayName('')).toBe('')
    expect(displayName(null)).toBe(null)
    expect(displayName(undefined)).toBe(undefined)
  })
})
