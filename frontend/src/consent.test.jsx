import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ConsentBar from './components/ConsentBar'
import { getConsent, resetConsent } from './consent'

describe('analytics consent', () => {
  beforeEach(() => localStorage.clear())

  it('asks once and remembers a decline', () => {
    const { container } = render(<ConsentBar />)
    expect(screen.getByRole('region', { name: /analytics consent/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(getConsent()).toBe('denied')
    expect(container).toBeEmptyDOMElement()
  })

  it('remembers an accept and can be asked again', () => {
    render(<ConsentBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(getConsent()).toBe('granted')
    act(() => resetConsent())
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })
})
