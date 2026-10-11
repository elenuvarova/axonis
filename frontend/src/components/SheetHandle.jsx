import { useRef } from 'react'

// Phone bottom sheet: three heights (fractions of the viewport). Drag the
// handle and the sheet follows the finger; on release it settles on the
// nearest height, or the next one in the direction of a quick flick. Below
// the lowest height it closes. A tap (or Enter/Space) steps through the
// heights, so nothing depends on dragging (WCAG 2.5.7).
export const SNAPS = { peek: 0.36, half: 0.6, full: 0.9 }
const ORDER = ['peek', 'half', 'full']
const FLICK = 0.5 // px per ms

export default function SheetHandle({ snap, onSnap, onClose, sheetRef }) {
  const drag = useRef(null)
  const dragged = useRef(false) // the click that follows a drag is not a tap

  const vh = () => window.innerHeight

  const onPointerDown = (e) => {
    const el = sheetRef.current
    if (!el) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { y: e.clientY, t: performance.now(), h: el.getBoundingClientRect().height, moved: false, lastY: e.clientY, lastT: performance.now() }
    el.style.transition = 'none'
  }

  const onPointerMove = (e) => {
    const d = drag.current, el = sheetRef.current
    if (!d || !el) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 4) d.moved = true
    const h = Math.min(vh() * SNAPS.full, Math.max(64, d.h - dy))
    el.style.height = `${h}px`
    d.lastY = e.clientY; d.lastT = performance.now()
  }

  const finish = (e) => {
    const d = drag.current, el = sheetRef.current
    drag.current = null
    if (!d || !el) return
    el.style.transition = ''
    if (!d.moved) { el.style.height = ''; return } // a tap: onClick handles it
    dragged.current = true
    const h = el.getBoundingClientRect().height
    el.style.height = ''
    const dt = Math.max(1, performance.now() - d.t)
    const v = (e.clientY - d.y) / dt // > 0 = downwards
    const i = ORDER.indexOf(snap)
    if (h < vh() * SNAPS.peek * 0.7 || (v > FLICK && i === 0)) { onClose(); return }
    if (v > FLICK) { onSnap(ORDER[Math.max(0, i - 1)]); return }
    if (v < -FLICK) { onSnap(ORDER[Math.min(ORDER.length - 1, i + 1)]); return }
    const nearest = ORDER.reduce((best, k) => (Math.abs(vh() * SNAPS[k] - h) < Math.abs(vh() * SNAPS[best] - h) ? k : best), 'peek')
    onSnap(nearest)
  }

  const next = ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]
  return (
    <button
      type="button"
      className="sidebar-drag-handle"
      aria-label={`Panel height: ${snap}. ${next === 'peek' ? 'Shrink' : 'Expand'} to ${next}`}
      onClick={() => { if (dragged.current) { dragged.current = false; return } onSnap(next) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  )
}
