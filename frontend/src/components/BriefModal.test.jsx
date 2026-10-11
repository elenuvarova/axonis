import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BriefModal from './BriefModal'

const brief = { markdown: '# Brief\n\nSome **text**.', filename: 'brief-ai.md' }
const project = { topic: 'AI tutoring', region: 'Global', protected: true }

describe('BriefModal', () => {
  it('is an accessible dialog with the brief rendered', () => {
    render(<BriefModal brief={brief} project={project} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: /research brief · ai tutoring/i })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Brief' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download brief as markdown/i })).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<BriefModal brief={brief} project={project} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
