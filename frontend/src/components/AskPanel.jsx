import { useState, useId } from 'react'

const SUGGESTIONS = [
  'What are the main themes here?',
  'Where are the biggest gaps?',
  'Which entities connect different areas?',
]

// Right-panel mode (not a tab): ask the map, read a cited answer, click a
// numbered source to centre it on the graph. `onClose` returns to the inspector.
export default function AskPanel({ onAsk, pending, result, error, onPickSource, onClose, question }) {
  const [q, setQ] = useState('')
  const answerId = useId()

  const ask = (text) => onAsk(text)

  const submit = (e) => {
    e.preventDefault()
    const trimmed = q.trim()
    if (trimmed) { ask(trimmed); setQ('') }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) submit(e)
  }

  return (
    <div className="ask-panel">
      <div className="panel-head">
        <h2 className="label">Ask the map</h2>
        {onClose && (
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close ask panel">×</button>
        )}
      </div>

      <div className="ask-scroll">
        {question && (result || pending) && <p className="ask-question">&gt; {question}</p>}

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

        {pending && <p className="ask-pending" role="status"><span className="spinner spinner-sm" aria-hidden="true" />Thinking…</p>}

        {error && <p className="error-msg" role="alert">{error}</p>}

        {result && (
          <div className="ask-answer" id={answerId}>
            {/* aria-live announces the answer to screen readers when it arrives */}
            <div aria-live="polite" aria-atomic="true">
              <div className="sr-only">Answer</div>
              <p className="ask-answer-text">{result.answer}</p>
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
                        className="source-row"
                        onClick={() => onPickSource?.(s.id)}
                        title={`Centre on ${s.name}`}
                      >
                        <span className="source-num" aria-hidden="true">{i + 1}</span>
                        <span className="source-name">{s.name.length > 32 ? s.name.slice(0, 30) + '…' : s.name}</span>
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
          rows={1}
          placeholder={result ? 'ask a follow-up' : 'Ask anything…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={pending}
          aria-describedby={result ? answerId : undefined}
        />
        <button
          className="btn btn-primary"
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
