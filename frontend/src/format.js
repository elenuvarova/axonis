// Small display helpers shared by pages and components.

export const pad = (n, width = 2) => String(Math.max(0, Math.round(Number(n) || 0))).padStart(width, '0')

// "2d ago" style label. The API sends naive UTC timestamps, so force UTC.
export function relTime(iso) {
  if (!iso) return '—'
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d ago`
  if (s < 86400 * 60) return `${Math.floor(s / 604800)}w ago`
  return `${Math.floor(s / 2592000)}mo ago`
}

export function clock(date = new Date()) {
  return date.toTimeString().slice(0, 8)
}

export function mmss(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}
