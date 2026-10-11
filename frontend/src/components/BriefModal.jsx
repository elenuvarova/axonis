import { useEffect, useRef } from 'react'
import { track } from '../analytics'
import { renderMarkdown, escapeHtml } from '../markdown'

const BRIEF_TITLE_ID = 'brief-modal-title'

// The research brief as a reading view: dialog semantics, focus trapped
// inside, Escape to close, focus back to the opener afterwards (WCAG 2.4.3,
// 2.1.2). Export as Markdown or a print/PDF page; a hairline shows how far
// you've read.
export default function BriefModal({ brief, project, onClose, returnFocusRef, onNotice }) {
  const modalRef = useRef(null)
  const progressRef = useRef(null)
  const briefDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  useEffect(() => {
    modalRef.current?.querySelector('button:not([disabled]), [href], input:not([disabled])')?.focus()
    const opener = returnFocusRef?.current
    return () => { if (opener?.isConnected) opener.focus() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key !== 'Tab') return
    const modal = modalRef.current
    if (!modal) return
    const focusable = [...modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )]
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    // No aria-hidden here: it would hide the dialog inside it from screen readers.
    <div className="brief-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={BRIEF_TITLE_ID}
        className="brief-modal"
        data-clarity-mask={project.protected ? undefined : 'true'}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="brief-modal-header">
          <span id={BRIEF_TITLE_ID} className="label brief-modal-title">
            Research brief · {project.topic} · {project.region} · {briefDate}
          </span>
          <div className="brief-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="Download brief as Markdown"
              onClick={() => {
                track('brief_download', { format: 'md' })
                const blob = new Blob([brief.markdown], { type: 'text/markdown' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = brief.filename
                a.click()
                URL.revokeObjectURL(a.href)
              }}
            >
              .md
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="Print brief"
              onClick={() => {
                track('brief_download', { format: 'print' })
                const win = window.open('', '_blank')
                if (!win) { onNotice?.('Allow pop-ups to print the brief.'); return }
                win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(brief.filename)}</title>
<style>
  body{font-family:'Mona Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#0E0E0E;line-height:1.6}
  h1{font-family:'Martian Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:1.75em;border-bottom:2px solid #0E0E0E;padding-bottom:.3em;margin-bottom:.5em;letter-spacing:-.02em}
  h2{font-family:'Martian Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:.75em;text-transform:uppercase;letter-spacing:.08em;color:#555;border-bottom:1px solid #2A2A2A;padding-bottom:.2em;margin:2em 0 .6em}
  h3{font-size:1.1em;margin:1.5em 0 .4em}
  p{margin:.7em 0}
  ul,ol{margin:.7em 0;padding-left:1.4em}
  li{margin:.25em 0}
  strong{font-weight:600}
  a{color:#0E0E0E;text-decoration:underline}
  code{font-family:'Martian Mono',ui-monospace,Menlo,monospace;background:#EDEDED;padding:0 4px;font-size:.85em}
  table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.95em}
  th,td{border:1px solid #2A2A2A;padding:7px 12px;text-align:left}
  th{background:#EDEDED;font-weight:600}
  hr{border:none;border-top:1px solid #2A2A2A;margin:2em 0}
  @media print{body{margin:20px}button{display:none}}
</style></head><body>
<button onclick="window.print()" style="margin-bottom:24px;padding:8px 16px;cursor:pointer">Print / Save PDF</button>
<article>${renderMarkdown(brief.markdown)}</article>
</body></html>`)
                win.document.close()
              }}
            >
              Print
            </button>
            <button type="button" className="btn btn-ghost brief-close" onClick={onClose} aria-label="Close brief">×</button>
          </div>
        </div>
        {/* Reading progress: a hairline under the header that fills as you scroll */}
        <div className="brief-progress" aria-hidden="true"><span ref={progressRef} /></div>
        <div
          className="brief-content brief-rendered"
          onScroll={(e) => {
            const el = e.currentTarget, bar = progressRef.current
            if (bar) bar.style.transform = `scaleX(${el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)})`
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(brief.markdown) }}
        />
      </div>
    </div>
  )
}
