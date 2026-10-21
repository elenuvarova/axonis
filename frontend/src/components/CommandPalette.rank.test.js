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
  it('needs short words to match as a prefix', () => {
    expect(rank('Data science', 'date')).toBe(-1)
    expect(rank('Card games', 'care')).toBe(-1)
    expect(rank('Lean startup methods', 'lean st')).toBe(3)
    expect(rank('Machine learning in data science', 'data machine')).toBe(0.5)
  })
  it('treats hyphens like spaces', () => {
    expect(rank('Self regulated learning', 'self-regulated')).toBe(0.5)
  })
  it('matches non-Latin names', () => {
    expect(rank('Обучение с подкреплением', 'подкрепление')).toBe(2)
    expect(rank('Обучение с подкреплением', 'подкрепленем')).toBe(0.5)
    expect(rank('人工知能', '人工')).toBe(3)
  })
  it('needs every word of a multi-word query', () => {
    expect(rank('Online machine learning', 'machine cardiology')).toBe(-1)
  })
})
