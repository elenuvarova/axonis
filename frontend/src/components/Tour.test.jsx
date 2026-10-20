import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import Tour from './Tour'

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.innerHTML = '' })

describe('Tour card placement', () => {
  it('places the card by its real height, so it never overlaps the target', async () => {
    const target = document.createElement('div')
    target.id = 'tgt'
    target.getBoundingClientRect = () => ({ top: 700, left: 100, width: 300, height: 40, bottom: 740, right: 400 })
    document.body.appendChild(target)
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(260)

    render(<Tour open onClose={() => {}} steps={[{ target: '#tgt', placement: 'bottom', title: 'T', body: 'B' }]} />)
    const card = screen.getByRole('dialog')
    // no room below (740 + 14 + 260 > 892), so it sits above: top = 700 - 260 - 14
    await waitFor(() => expect(card.style.top).toBe('426px'))
  })
})
