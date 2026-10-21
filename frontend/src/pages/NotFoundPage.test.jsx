import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFoundPage from './NotFoundPage'

describe('NotFoundPage', () => {
  it('names the problem in a heading and offers a way on', () => {
    render(<MemoryRouter initialEntries={['/no/such/page']}><NotFoundPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Nothing is mapped here' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open a demo map' })).toHaveAttribute('href', expect.stringMatching(/^\/project\//))
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })
})
