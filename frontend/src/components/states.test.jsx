import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StateScreen, InlineError, BuildingScreen, Toast } from './states'

describe('StateScreen', () => {
  it('renders title, message and actions', () => {
    render(<StateScreen variant="error" title="Build failed" message="something broke" actions={<button>Try again</button>} />)
    expect(screen.getByText('Build failed')).toBeInTheDocument()
    expect(screen.getByText('something broke')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('InlineError', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<InlineError message="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the message and calls onDismiss', () => {
    const onDismiss = vi.fn()
    render(<InlineError message="Enter a topic" onDismiss={onDismiss} />)
    expect(screen.getByText('Enter a topic')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('Toast', () => {
  it('tags an ok outcome [OK] as a status, an error [ERR] as an alert', () => {
    const { rerender } = render(<Toast message="Added 3 entities from a.pdf." tone="ok" onClose={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('[OK]')
    rerender(<Toast message="Upload failed: File too large (max 5 MB)" onClose={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('[ERR]')
  })

  it('closes itself: ok after 4 s, errors after 9 s', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const { rerender } = render(<Toast message="done" tone="ok" onClose={onClose} />)
    vi.advanceTimersByTime(4000)
    expect(onClose).toHaveBeenCalledTimes(1)
    rerender(<Toast message="broke" onClose={onClose} />)
    vi.advanceTimersByTime(8999)
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(onClose).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

describe('BuildingScreen', () => {
  it('without progress shows the typical order, no fake completion', () => {
    render(<MemoryRouter><BuildingScreen /></MemoryRouter>)
    expect(screen.getByText('Building your map')).toBeInTheDocument()
    expect(screen.getByText('Typical order')).toBeInTheDocument()
    expect(screen.getByText('Expanding the topic into search terms')).toBeInTheDocument()
    expect(screen.queryByText('(done)')).not.toBeInTheDocument()
  })

  it('renders the real stage, counts and log from progress', () => {
    const progress = {
      stage: 'resolve', stage_index: 3, started_at: Date.now() / 1000 - 5,
      stages: [
        { key: 'expand', label: 'Expand' }, { key: 'wikidata', label: 'Wikidata' },
        { key: 'openalex', label: 'OpenAlex' }, { key: 'resolve', label: 'Resolve' },
      ],
      counts: { wikidata: 12, papers: 9 },
      log: [{ t: Date.now() / 1000, source: 'resolve', message: '83 unique entities · 68 edges' }],
    }
    render(<MemoryRouter><BuildingScreen topic="AI tutoring" progress={progress} /></MemoryRouter>)
    expect(screen.getByText('83 unique entities · 68 edges')).toBeInTheDocument()
    expect(screen.getByText('012')).toBeInTheDocument()
    expect(screen.getByText('009')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument() // institutions not reported yet
    expect(screen.getAllByText('(done)')).toHaveLength(3)
    expect(screen.getByText('(in progress)')).toBeInTheDocument()
  })
})
