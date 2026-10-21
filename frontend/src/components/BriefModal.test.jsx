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
    expect(screen.getByRole('button', { name: /download brief as \.md/i })).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<BriefModal brief={brief} project={project} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('opens with a cover block and numbered sections', () => {
    const doc = {
      markdown: '# Brief\n\n## Summary\n\nText.\n\n## Gaps\n\nMore.\n\n---\n\n42 entities across 3 clusters.',
      filename: 'brief-ai.md',
    }
    const { container } = render(<BriefModal brief={doc} project={project} onClose={() => {}} />)
    const cover = container.querySelector('.brief-cover')
    expect(cover).toHaveTextContent('Research brief')
    expect(cover.querySelector('.brief-cover-title')).toHaveTextContent('AI tutoring')
    expect(cover).toHaveTextContent(/Global/)
    expect(cover).toHaveTextContent('42 nodes')
    expect(cover.querySelector('.brief-rule')).toBeInTheDocument()
    const nums = [...container.querySelectorAll('h2 .brief-num')].map((n) => n.textContent)
    expect(nums).toEqual(['01', '02'])
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument()
  })
})
