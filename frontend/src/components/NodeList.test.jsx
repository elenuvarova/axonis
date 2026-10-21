import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import NodeList from './NodeList'

const nodes = [
  { id: 'a', name: 'adaptive learning', type: 'concept', degree: 0.2, bridge_score: 0.1 },
  { id: 'b', name: 'NLP', type: 'concept', degree: 0.5, bridge_score: 0.4 },
  { id: 'c', name: 'A paper', type: 'paper', degree: 0.1, bridge_score: 0 },
]
const edges = [{ id: 'e1', source: 'b', target: 'a' }, { id: 'e2', source: 'b', target: 'c' }]

describe('NodeList', () => {
  it('sorts by links by default and selects a node', () => {
    const onSelect = vi.fn()
    render(<NodeList nodes={nodes} edges={edges} onSelect={onSelect} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByRole('button')).toHaveTextContent('NLP')
    fireEvent.click(screen.getByRole('button', { name: 'Adaptive learning' }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', links: 1 }))
  })

  it('sorts by name and filters', () => {
    render(<NodeList nodes={nodes} edges={edges} onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')
    fireEvent.change(screen.getByLabelText(/List/), { target: { value: 'pap' } })
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })
})
