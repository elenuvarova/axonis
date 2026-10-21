import { useState, useId, useRef, useEffect } from 'react'
import { mmss, shortLabel } from '../format'
import Icon from './icons'

const SUGGESTIONS = [
  'What are the main themes here?',
  'Where are the biggest gaps?',
  'Which entities connect different areas?',
]

// Real elapsed time while a question is in flight (the model call has a 20 s
// timeout on the server, so past ~12 s say it's still working).
function PendingLine() {
  const [t0] = useState(() => Date.now())
  const [now, setNow] = useState(t0)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = (now - t0) / 1000
  return (
    <p className="ask-pending" role="status">
      <span className="spinner spinner-sm" aria-hidden="true" />
      Thinking… <span className="ask-elapsed" aria-hidden="true">{mmss(s)}</span>
      {s > 12 && <span className="ask-slow"> Still working — reading the graph and writing a cited answer.</span>}
    </p>
  )
}

// Split an answer into text and [n] citation markers.
function withCitations(text, sources, active, setActive, onPick) {
  const byN = Object.fromEntries((sources || []).map((s, i) => [s.n ?? i + 1, s]))
  return text.split(/(\[\d{1,2}\])/).map((part, i) => {
    const m = part.match(/^\[(\d{1,2})\]$/)
    const src = m && byN[Number(m[1])]
    if (!src) return part
    const n = Number(m[1])
    return (
      <button
        key={i}
        type="button"
        className={`cite${active === n ? ' is-active' : ''}`}
        onMouseEnter={() => setActive(n)}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(n)}
        onBlur={() => setActive(null)}
        onClick={() => onPick?.(src.id)}
        aria-label={`Source ${n}: ${src.name}`}
      >{n}</button>
    )
  })
}

// Right-panel mode (not a tab): ask the map, read a cited answer. Each [n]
// marker is tied to a node: hover/focus lights it on the graph, click centres
// it. `onHoverSource(id|null)` drives the graph highlight; `onClose` returns
// to the inspector.
export default function AskPanel({ onAsk, pending, result, error, onPickSource, onHoverSource, onClose, question }) {
  const [q, setQ] = useState('')
  const [activeN, setActiveN] = useState(null)
  const sourceId = (n) => result?.sources?.find((s, i) => (s.n ?? i + 1) === n)?.id ?? null
  const setActive = (n) => { setActiveN(n); onHoverSource?.(n == null ? null : sourceId(n)) }
  // The button that opened the panel unmounts with it, so move focus into the
  // panel instead of letting it fall to <body> (WCAG 2.4.3).
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const answerId = useId()

  const ask = (text) => onAsk(text)

  const submit = (e) => {
    e.preventDefault()
    const trimmed = q.trim()
    if (trimmed) { ask(trimmed); setQ('') }
  }

  const onKeyDown = (e) => {
    // Skip while an IME is composing (CJK input) — Enter there confirms the word.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  return (
    <div className="ask-panel">
      <div className="panel-head">
        <h2 className="label">Ask the map</h2>
        {onClose && (
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close ask panel"><Icon name="close" size={14} /></button>
        )}
      </div>

      <div className="ask-scroll">
        {question && (result || pending) && <p className="ask-question" data-clarity-mask="true">&gt; {question}</p>}

        {!result && !pending && (
          <>
            <p className="ask-intro">Ask a question about this domain. Answers are grounded in the graph and the nodes they use are highlighted.</p>
            <div className="ask-suggestions" aria-label="Suggested questions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="ask-chip"
                  onClick={() => { setQ(''); ask(s) }}
                >
                  <span aria-hidden="true">→ </span>{s}
                </button>
              ))}
            </div>
          </>
        )}

        {pending && <PendingLine />}

        {error && <p className="error-msg" role="alert">{error}</p>}

        {result && (
          <div className="ask-answer" id={answerId} data-clarity-mask="true">
            {/* aria-live announces the answer to screen readers when it arrives */}
            <div aria-live="polite" aria-atomic="true">
              <div className="sr-only">Answer</div>
              <p className="ask-answer-text">{withCitations(result.answer, result.sources, activeN, setActive, onPickSource)}</p>
            </div>

            {result.sources?.length > 0 && (
              <div className="ask-sources">
                <div className="label">Sources · on the map</div>
                <ol className="source-list">
                  {result.sources.map((s, i) => (
                    <li key={s.id}>
                      {/* <button> gives keyboard access + announces as interactive (C-2, WCAG 2.1.1) */}
                      <button
                        type="button"
                        className={`source-row${activeN === (s.n ?? i + 1) ? ' is-active' : ''}`}
                        onClick={() => onPickSource?.(s.id)}
                        onMouseEnter={() => setActive(s.n ?? i + 1)}
                        onMouseLeave={() => setActive(null)}
                        onFocus={() => setActive(s.n ?? i + 1)}
                        onBlur={() => setActive(null)}
                        title={`Centre on ${s.name}`}
                      >
                        <span className="source-num" aria-hidden="true">{s.n ?? i + 1}</span>
                        <span className="source-name">{shortLabel(s.name, 40)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="ask-form">
        <label htmlFor="ask-input" className="sr-only">Ask a question about this domain</label>
        <span className="ask-prompt" aria-hidden="true">&gt;</span>
        <textarea
          id="ask-input"
          ref={inputRef}
          rows={1}
          placeholder={result ? 'ask a follow-up' : 'Ask anything…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={pending}
          aria-describedby={result ? answerId : undefined}
        />
        <button
          className="btn btn-primary btn-sm"
          type="submit"
          disabled={pending || !q.trim()}
          aria-busy={pending}
        >
          Ask
        </button>
      </form>
    </div>
  )
}
