import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ConsentBar from './components/ConsentBar'
import { getConsent, resetConsent } from './consent'

describe('analytics consent', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())
  // the bar waits a few seconds (or a scroll) before asking
  const wait = () => act(() => { vi.advanceTimersByTime(8000) })

  it('asks once and remembers a decline', () => {
    const { container } = render(<ConsentBar />)
    expect(container).toBeEmptyDOMElement()
    wait()
    expect(screen.getByRole('region', { name: /analytics consent/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(getConsent()).toBe('denied')
    expect(container).toBeEmptyDOMElement()
  })

  it('remembers an accept and can be asked again', () => {
    render(<ConsentBar />)
    wait()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(getConsent()).toBe('granted')
    act(() => resetConsent())
    wait()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })
})
