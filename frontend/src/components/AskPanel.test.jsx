import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AskPanel from './AskPanel'

describe('AskPanel', () => {
  it('submits the typed question', () => {
    const onAsk = vi.fn()
    render(<AskPanel onAsk={onAsk} pending={false} result={null} />)
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/i), { target: { value: 'what is x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(onAsk).toHaveBeenCalledWith('what is x')
  })

  it('asks a suggestion when clicked', () => {
    const onAsk = vi.fn()
    render(<AskPanel onAsk={onAsk} pending={false} result={null} />)
    fireEvent.click(screen.getByText('Where are the biggest gaps?'))
    expect(onAsk).toHaveBeenCalledWith('Where are the biggest gaps?')
  })

  it('renders the answer and source chips', () => {
    render(
      <AskPanel
        onAsk={() => {}}
        pending={false}
        result={{ answer: 'A grounded reply', sources: [{ id: '1', name: 'Adaptive learning' }] }}
        onPickSource={() => {}}
      />,
    )
    expect(screen.getByText('A grounded reply')).toBeInTheDocument()
    expect(screen.getByText('Adaptive learning')).toBeInTheDocument()
  })
})

const result = {
  answer: 'Tutoring tools cluster around NLP [1] and adaptive learning [2].',
  sources: [
    { n: 1, id: 'a', name: 'natural language processing', type: 'concept' },
    { n: 2, id: 'b', name: 'adaptive learning', type: 'concept' },
  ],
}

describe('AskPanel citations', () => {
  it('turns [n] markers into buttons tied to nodes', () => {
    const onHover = vi.fn()
    const onPick = vi.fn()
    render(<AskPanel onAsk={() => {}} result={result} question="q" onHoverSource={onHover} onPickSource={onPick} />)
    const cite = screen.getByRole('button', { name: 'Source 2: adaptive learning' })
    fireEvent.mouseEnter(cite)
    expect(onHover).toHaveBeenLastCalledWith('b')
    fireEvent.mouseLeave(cite)
    expect(onHover).toHaveBeenLastCalledWith(null)
    fireEvent.click(cite)
    expect(onPick).toHaveBeenCalledWith('b')
  })

  it('leaves markers without a matching source as plain text', () => {
    render(<AskPanel onAsk={() => {}} result={{ ...result, answer: 'Claim [9].' }} question="q" />)
    expect(screen.queryByRole('button', { name: /Source 9/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Claim \[9\]/)).toBeInTheDocument()
  })
})
