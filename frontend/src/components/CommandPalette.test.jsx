import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CommandPalette from './CommandPalette'

const nodes = [
  { id: 'a', name: 'natural language processing', type: 'concept', degree: 0.3 },
  { id: 'b', name: 'Language models for tutoring', type: 'paper', degree: 0.1 },
  { id: 'c', name: 'adaptive learning', type: 'concept', degree: 0.2 },
]

describe('CommandPalette', () => {
  it('filters nodes, moves with arrows and opens with Enter', () => {
    const onPick = vi.fn(); const onClose = vi.fn()
    render(<CommandPalette open nodes={nodes} actions={[]} onPickNode={onPick} onClose={onClose} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'lang' } })
    const opts = screen.getAllByRole('option')
    expect(opts).toHaveLength(2)
    // word-start match on "Language…" outranks the mid-word one
    expect(opts[0]).toHaveTextContent('Language models for tutoring')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onClose).toHaveBeenCalled()
    expect(onPick).toHaveBeenCalledWith(nodes[0])
  })

  it('Tab cycles the type filter and actions run', () => {
    const run = vi.fn()
    render(<CommandPalette open nodes={nodes} actions={[{ id: 'ask', label: 'Ask the map', run }]} onPickNode={() => {}} onClose={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(screen.getByRole('button', { name: /Concept/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(input, { target: { value: 'ask' } })
    fireEvent.click(screen.getByRole('option', { name: /Ask the map/ }))
    expect(run).toHaveBeenCalled()
  })
})
