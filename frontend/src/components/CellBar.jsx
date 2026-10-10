// Segmented bar used by metric rows (20 cells) and opportunity evidence (5 cells).
// Purely visual: the numeric value is always rendered next to it as text.
export default function CellBar({ value = 0, cells = 20, size = 'sm' }) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * cells)
  return (
    <span className={`cellbar cellbar-${size}`} aria-hidden="true">
      {Array.from({ length: cells }).map((_, i) => (
        <i key={i} className={i < filled ? 'on' : ''} />
      ))}
    </span>
  )
}
