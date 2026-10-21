import { useEffect, useRef } from 'react'
import { track } from '../analytics'
import { renderMarkdown, escapeHtml } from '../markdown'
import Icon from './icons'
import './../brief.css'

const BRIEF_TITLE_ID = 'brief-modal-title'

// Number the section labels (01, 02 …). renderMarkdown emits bare <h2> tags
// only, so this touches nothing user-controlled; the number is decoration.
export function numberSections(html) {
  let n = 0
  return html.replace(/<h2>/g, () => `<h2><span class="brief-num" aria-hidden="true">${String(++n).padStart(2, '0')}</span>`)
}

// Node count for the cover line: an explicit prop wins, else the brief's own
// "N entities" footer line, else nothing.
function nodeCountOf(brief, nodeCount) {
  if (nodeCount) return nodeCount
  const m = /(\d[\d,]*)\s+(?:entities|nodes)\b/i.exec(brief.markdown || '')
  return m ? m[1].replace(/,/g, '') : null
}

const PRINT_CSS = `
  @page{size:A4;margin:22mm 20mm 24mm}
  *{box-sizing:border-box}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Mona Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0E0E0E;background:#fff;margin:0;line-height:1.6;font-size:11pt}
  .page{max-width:68ch;margin:40px auto;padding:0 24px}
  .mono,h1,h2,th,code,.kicker,.meta,.foot{font-family:'Martian Mono',ui-monospace,Menlo,monospace}
  .cover{margin-bottom:2.2em}
  .kicker{font-size:8pt;letter-spacing:.12em;text-transform:uppercase;color:#555;margin:0 0 1.2em}
  .cover-title{font-family:'Martian Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:26pt;line-height:1.15;letter-spacing:-.02em;margin:0 0 .5em;overflow-wrap:anywhere}
  .meta{font-size:8.5pt;color:#555;margin:0 0 1.4em}
  .rule{height:3px;width:56px;background:#FF2BD6;margin:0}
  article>h1:first-child{display:none}
  h1{font-weight:500;font-size:18pt;margin:1.5em 0 .5em}
  h2{font-weight:500;font-size:8.5pt;text-transform:uppercase;letter-spacing:.1em;color:#555;border-top:1px solid #0E0E0E;padding-top:.6em;margin:2.2em 0 .8em;break-after:avoid;page-break-after:avoid}
  .brief-num{color:#C4008F;margin-right:1.2em}
  h3{font-size:12pt;font-weight:600;margin:1.5em 0 .4em;break-after:avoid;page-break-after:avoid}
  p{margin:.7em 0;orphans:3;widows:3}
  ul,ol{margin:.7em 0;padding-left:1.4em}
  li{margin:.25em 0;break-inside:avoid}
  strong{font-weight:600}
  a{color:#0E0E0E;text-decoration:underline;text-underline-offset:2px}
  code{background:#F0F0F0;padding:0 4px;font-size:.85em}
  blockquote{margin:1.2em 0;padding:.2em 0 .2em 1.2em;border-left:3px solid #FF2BD6;font-size:1.1em;break-inside:avoid}
  table{border-collapse:collapse;width:100%;margin:1.1em 0;font-size:9.5pt;break-inside:avoid;page-break-inside:avoid}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th,td{border-bottom:1px solid #CFCFCF;padding:6px 10px 6px 0;text-align:left;vertical-align:top}
  th{font-size:7.5pt;font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:#555;border-bottom:1px solid #0E0E0E}
  hr{border:0;border-top:1px solid #CFCFCF;margin:2em 0}
  .foot{margin-top:3em;padding-top:.8em;border-top:1px solid #CFCFCF;font-size:8pt;color:#555;display:flex;justify-content:space-between}
  .toolbar{margin-bottom:24px}
  .toolbar button{padding:8px 16px;cursor:pointer;font:inherit}
  @media print{.page{margin:0;padding:0;max-width:none}.toolbar{display:none}}
`

// The Print / Save as PDF page: a light, print-ready editorial document with
// the same structure as the reading view. Everything user-derived goes through
// escapeHtml / renderMarkdown.
function printDocument(brief, project, date, count) {
  const meta = [date, project.region, count ? `${count} nodes` : null].filter(Boolean).map(escapeHtml).join(' · ')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(brief.filename)}</title>
<style>${PRINT_CSS}</style></head><body><div class="page">
<div class="toolbar"><button onclick="window.print()">Print / Save PDF</button></div>
<header class="cover"><p class="kicker">Research brief</p><p class="cover-title">${escapeHtml(project.topic)}</p><p class="meta">${meta}</p><div class="rule"></div></header>
<article>${numberSections(renderMarkdown(brief.markdown))}</article>
<footer class="foot"><span>axonis.app</span><span>${escapeHtml(date)}</span></footer>
</div></body></html>`
}

// The research brief as a reading view: dialog semantics, focus trapped
// inside, Escape to close, focus back to the opener afterwards (WCAG 2.4.3,
// 2.1.2). Export as Markdown or a print/PDF page; a hairline shows how far
// you've read.
export default function BriefModal({ brief, project, onClose, returnFocusRef, onNotice, nodeCount }) {
  const count = nodeCountOf(brief, nodeCount)
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
              aria-label="Download brief as .md"
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
                win.document.write(printDocument(brief, project, briefDate, count))
                win.document.close()
              }}
            >
              Print
            </button>
            <button type="button" className="brief-close" onClick={onClose} aria-label="Close brief"><Icon name="close" size={14} /></button>
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
        >
          <header className="brief-cover">
            <p className="brief-kicker">Research brief</p>
            <p className="brief-cover-title">{project.topic}</p>
            <p className="brief-meta">
              {[briefDate, project.region, count ? `${count} nodes` : null].filter(Boolean).join(' · ')}
            </p>
            <div className="brief-rule" aria-hidden="true" />
          </header>
          <div className="brief-body" dangerouslySetInnerHTML={{ __html: numberSections(renderMarkdown(brief.markdown)) }} />
        </div>
      </div>
    </div>
  )
}
