import { describe, expect, it } from 'vitest'
import { rank } from './CommandPalette'

describe('palette ranking', () => {
  it('ranks exact matches by position', () => {
    expect(rank('Intelligent tutoring systems', 'intel')).toBe(3)
    expect(rank('Intelligent tutoring systems', 'tutor')).toBe(2)
    expect(rank('Intelligent tutoring systems', 'utor')).toBe(1)
  })
  it('forgives a typo or two', () => {
    expect(rank('Intelligent tutoring systems', 'tutorng')).toBe(0.5)
    expect(rank('Online machine learning', 'machne lerning')).toBe(0.5)
  })
  it('does not match unrelated words', () => {
    expect(rank('Online machine learning', 'zzqq')).toBe(-1)
    expect(rank('Online machine learning', 'cardio')).toBe(-1)
  })
})
