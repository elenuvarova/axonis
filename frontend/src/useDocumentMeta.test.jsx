import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import useDocumentMeta from './useDocumentMeta'

const robots = () => document.head.querySelector('meta[name="robots"]')

describe('useDocumentMeta', () => {
  it('adds noindex for private pages and removes it on public ones', () => {
    const { rerender } = renderHook((p) => useDocumentMeta(p), {
      initialProps: { title: 'Your map · Axonis', path: '/project/x', noindex: true },
    })
    expect(robots()?.getAttribute('content')).toBe('noindex')
    rerender({ title: 'AI tutoring — knowledge map · Axonis', path: '/project/y', noindex: false })
    expect(robots()).toBeNull()
  })
})
