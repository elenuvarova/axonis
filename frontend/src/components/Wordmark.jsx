// Brand wordmark: A·X·ONIS with the X in the accent — the crossing of two edges.
// Screen readers get the plain name; the split spans are decorative.
export default function Wordmark({ className = '' }) {
  return (
    <span className={`wordmark ${className}`.trim()} aria-label="Axonis" role="img">
      <span aria-hidden="true">A</span>
      <span className="wordmark-x" aria-hidden="true">X</span>
      <span aria-hidden="true">ONIS</span>
    </span>
  )
}
