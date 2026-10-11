import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { TYPE_ORDER, typeGlyph, typeLabel } from '../graphTypes'
import { pad } from '../format'

// ⌘K palette: jump to any node, or run an action. A combobox (input keeps
// focus, ↑/↓ move the active option via aria-activedescendant, Enter runs it,
// Esc closes and focus returns to where it was). Type tabs narrow node results.
const MAX_NODES = 40

function rank(name, q) {
  const n = name.toLowerCase()
  const i = n.indexOf(q)
  if (i < 0) return -1
  if (i === 0) return 3
  if (/\W/.test(n[i - 1])) return 2 // starts a word
  return 1
}

function Highlight({ text, q }) {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark className="cmdk-match">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

export default function CommandPalette({ open, onClose, nodes = [], actions = [], onPickNode }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const returnFocus = useRef(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement
    setQ(''); setType('all'); setActive(0)
    requestAnimationFrame(() => inputRef.current?.focus())
    return () => { const el = returnFocus.current; if (el?.isConnected) el.focus() }
  }, [open])

  const counts = useMemo(() => {
    const c = {}
    for (const n of nodes) c[n.type] = (c[n.type] || 0) + 1
    return c
  }, [nodes])
  const types = TYPE_ORDER.filter((t) => counts[t])

  const query = q.trim().toLowerCase()
  const nodeHits = useMemo(() => {
    const pool = type === 'all' ? nodes : nodes.filter((n) => n.type === type)
    if (!query) return [...pool].sort((a, b) => (b.degree || 0) - (a.degree || 0)).slice(0, MAX_NODES)
    return pool
      .map((n) => ({ n, r: rank(n.name || '', query) }))
      .filter((x) => x.r > 0)
      .sort((a, b) => b.r - a.r || (b.n.degree || 0) - (a.n.degree || 0))
      .slice(0, MAX_NODES)
      .map((x) => x.n)
  }, [nodes, type, query])
  const actionHits = actions.filter((a) => !query || a.label.toLowerCase().includes(query))

  const items = [
    ...nodeHits.map((n) => ({ kind: 'node', key: `n-${n.id}`, node: n })),
    ...actionHits.map((a) => ({ kind: 'action', key: `a-${a.id}`, action: a })),
  ]
  const clamped = Math.min(active, Math.max(items.length - 1, 0))

  useEffect(() => { setActive(0) }, [q, type])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${clamped}"]`)?.scrollIntoView?.({ block: "nearest" })
  }, [clamped])

  if (!open) return null

  const run = (item) => {
    if (!item) return
    onClose()
    if (item.kind === 'node') onPickNode(item.node)
    else item.action.run()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); run(items[clamped]) }
    else if (e.key === 'Tab') {
      // Tab cycles the type filter instead of leaving the dialog.
      e.preventDefault()
      const all = ['all', ...types]
      const i = all.indexOf(type)
      setType(all[(i + (e.shiftKey ? all.length - 1 : 1)) % all.length])
    }
  }

  const optionId = (i) => `${listId}-opt-${i}`
  let index = -1

  return (
    <div className="cmdk-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search nodes and actions">
        <div className="cmdk-input-row">
          <span className="cmdk-prompt" aria-hidden="true">&gt;</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="search nodes or actions"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items.length ? optionId(clamped) : undefined}
            aria-autocomplete="list"
            spellCheck={false}
          />
          <kbd className="cmdk-kbd">esc</kbd>
        </div>

        <div className="cmdk-tabs" role="group" aria-label="Filter by type">
          {['all', ...types].map((t) => (
            <button
              key={t}
              type="button"
              tabIndex={-1}
              className={`cmdk-tab${type === t ? ' is-active' : ''}`}
              aria-pressed={type === t}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setType(t)}
            >
              {t === 'all' ? 'All' : typeLabel(t)} <span className="cmdk-tab-count">{pad(t === 'all' ? nodes.length : counts[t], 3)}</span>
            </button>
          ))}
        </div>

        <ul className="cmdk-list" id={listId} role="listbox" ref={listRef} aria-label="Results">
          {nodeHits.length > 0 && <li className="cmdk-group" role="presentation">Nodes</li>}
          {nodeHits.map((n) => {
            index += 1
            const i = index
            return (
              <li
                key={`n-${n.id}`}
                id={optionId(i)}
                data-index={i}
                role="option"
                aria-selected={i === clamped}
                className={`cmdk-item${i === clamped ? ' is-active' : ''}`}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(items[i])}
              >
                <span className="cmdk-glyph" aria-hidden="true">{typeGlyph(n.type)}</span>
                <span className="cmdk-name"><Highlight text={n.name} q={query} /></span>
                <span className="cmdk-meta">{typeLabel(n.type)}</span>
              </li>
            )
          })}
          {actionHits.length > 0 && <li className="cmdk-group" role="presentation">Actions</li>}
          {actionHits.map((a) => {
            index += 1
            const i = index
            return (
              <li
                key={`a-${a.id}`}
                id={optionId(i)}
                data-index={i}
                role="option"
                aria-selected={i === clamped}
                className={`cmdk-item${i === clamped ? ' is-active' : ''}`}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(items[i])}
              >
                <span className="cmdk-glyph" aria-hidden="true">→</span>
                <span className="cmdk-name"><Highlight text={a.label} q={query} /></span>
                {a.hint && <span className="cmdk-meta">{a.hint}</span>}
              </li>
            )
          })}
          {items.length === 0 && <li className="cmdk-empty" role="presentation">No node or action matches “{q}”.</li>}
        </ul>

        <div className="cmdk-foot" aria-hidden="true">
          <span><kbd className="cmdk-kbd">↑↓</kbd> move</span>
          <span><kbd className="cmdk-kbd">↵</kbd> open</span>
          <span><kbd className="cmdk-kbd">tab</kbd> type</span>
        </div>
      </div>
    </div>
  )
}
