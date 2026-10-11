import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SheetHandle from './SheetHandle'

describe('SheetHandle', () => {
  it('steps through the heights on tap', () => {
    const onSnap = vi.fn()
    render(<SheetHandle snap="peek" onSnap={onSnap} onClose={() => {}} sheetRef={{ current: null }} />)
    fireEvent.click(screen.getByRole('button', { name: /expand to half/i }))
    expect(onSnap).toHaveBeenCalledWith('half')
  })

  it('wraps from full back to peek', () => {
    const onSnap = vi.fn()
    render(<SheetHandle snap="full" onSnap={onSnap} onClose={() => {}} sheetRef={{ current: null }} />)
    fireEvent.click(screen.getByRole('button', { name: /shrink to peek/i }))
    expect(onSnap).toHaveBeenCalledWith('peek')
  })
})
