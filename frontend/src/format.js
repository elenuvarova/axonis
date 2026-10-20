// Small display helpers shared by pages and components.

// Zero padding is for ranks, indexes and table columns (01, GAP_01, a Links column).
// In a sentence or meta line a count is just a number: "82 nodes", not "082 nodes".
export const pad = (n, width = 2) => String(Math.max(0, Math.round(Number(n) || 0))).padStart(width, '0')

// Names as they read in lists: first letter up ("circular economy" -> "Circular
// economy"). Not text-transform: capitalize, which would turn "E-waste" into
// "E-Waste". A first word that already has a capital or a digit ("iPhone",
// "3d") is someone's spelling and stays as it is.
export function displayName(name) {
  if (typeof name !== 'string' || !name) return name
  const first = name.match(/^\S+/)?.[0]
  if (!first || !/^\p{Ll}/u.test(first) || /[\p{Lu}\d]/u.test(first)) return name
  return first[0].toLocaleUpperCase() + name.slice(1)
}

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

// Cut long names on a word boundary ("Intelligent Tutoring…", not
// "Intelligent Tutoring S…"); a single long word is cut hard. A cut never ends
// on a dangling stop-word ("Circular economy and…" becomes "Circular economy…")
// and never leaves a space before the ellipsis.
const TRAIL = /[\s,;:·–-]+$/
const STOP_WORD = /\s+(a|an|and|of|the|for|to|in|on|with|at|by|or|from|as|vs)$/i
export function shortLabel(name, max = 24) {
  if (name.length <= max) return name
  const cut = name.slice(0, max - 1)
  // a word boundary wins over a longer cut that ends mid-word ("Corporate…", not "Corporate Sustainabilit…");
  // a long hyphenated word breaks at its last hyphen; only a single unbroken word is cut hard
  const space = cut.lastIndexOf(' ')
  const hyphen = cut.lastIndexOf('-')
  const at = space >= 6 ? space : hyphen >= 8 ? hyphen : -1
  let out = (at > 0 ? cut.slice(0, at) : cut).replace(TRAIL, '')
  while (STOP_WORD.test(out)) out = out.replace(STOP_WORD, '').replace(TRAIL, '')
  return out + '…'
}
