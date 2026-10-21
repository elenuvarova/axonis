import { render, screen, fireEvent } from '@testing-library/react'
import OpportunityBoard from './OpportunityBoard'

const opps = [
  { id: 'a', title: 'Alpha platform', score: 0.9, risk_level: 'low', risks: ['Slow adoption'], next_questions: [] },
  { id: 'b', title: 'Beta service', score: 0.5, risk_level: 'low', risks: ['Thin data'], next_questions: [] },
]

describe('OpportunityBoard', () => {
  it('opens one card’s details as a strip outside the cards and closes it again', () => {
    const { container } = render(<OpportunityBoard opportunities={opps} />)
    const toggles = screen.getAllByRole('button', { name: /score, risks & questions/i })
    fireEvent.click(toggles[0])

    const strip = screen.getByRole('region', { name: /gap 1: score, risks and questions/i })
    expect(strip).toHaveTextContent('Slow adoption')
    expect(strip.closest('.opp-card')).toBeNull()
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true')
    expect(toggles[0]).toHaveAttribute('aria-controls', strip.id)

    fireEvent.click(screen.getAllByRole('button', { name: /score, risks & questions/i })[0])
    expect(screen.getByRole('region', { name: /gap 2/i })).toHaveTextContent('Thin data')
    expect(container.querySelectorAll('.opp-detail')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /less/i }))
    expect(container.querySelector('.opp-detail')).toBeNull()
  })
})
