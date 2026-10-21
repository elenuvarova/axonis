import { describe, it, expect } from 'vitest'
import { renderMarkdown, escapeHtml } from './markdown'

describe('renderMarkdown', () => {
  it('renders headings, bold and paragraphs', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** text.')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<p>Some <strong>bold</strong> text.</p>')
  })

  it('renders a GFM pipe table', () => {
    const html = renderMarkdown('| Name | Type |\n|---|---|\n| AI | concept |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Name</th>')
    expect(html).toContain('<td>concept</td>')
  })

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toContain('<ul><li>a</li><li>b</li></ul>')
    expect(renderMarkdown('1. one\n2. two')).toContain('<ol><li>one</li><li>two</li></ol>')
  })

  it('escapes raw HTML so it cannot inject markup', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('drops dangerous link schemes but keeps safe ones', () => {
    const bad = renderMarkdown('[click](javascript:alert(1))')
    expect(bad).not.toContain('href')
    expect(bad).toContain('click')

    const good = renderMarkdown('[Q42](https://www.wikidata.org/wiki/Q42)')
    expect(good).toContain('href="https://www.wikidata.org/wiki/Q42"')
    expect(good).toContain('rel="noopener noreferrer"')
  })

  it('shows links to other sites as plain text', () => {
    for (const url of ['https://evil.example/login', 'https://wikidata.org.evil.example/', 'mailto:a@b.c']) {
      const html = renderMarkdown(`[Verify your account](${url})`)
      expect(html).not.toContain('href')
      expect(html).toContain('Verify your account')
    }
  })

  it('escapeHtml escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })

  it('keeps a loose ordered list (blank lines between items) as one list', () => {
    const html = renderMarkdown('1. One\n\n2. Two\n\n3. Three\n\nAfter')
    expect(html.match(/<ol>/g)).toHaveLength(1)
    expect(html.match(/<li>/g)).toHaveLength(3)
    expect(html).toContain('<p>After</p>')
  })
})

describe('headings', () => {
  it('drop a closing full stop but keep an ellipsis', async () => {
    const { renderMarkdown } = await import('./markdown')
    expect(renderMarkdown('## Summary.')).toContain('<h2>Summary</h2>')
    expect(renderMarkdown('## More...')).toContain('<h2>More...</h2>')
  })
})
