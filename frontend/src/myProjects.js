// Projects this browser created. The public list is demos + these, so a
// visitor sees their own maps without seeing everyone else's (no accounts).
// Storage can be unavailable (private mode, blocked site data): fail quietly.
const KEY = 'axonis-my-projects'

export function myProjectIds() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 100) : []
  } catch { return [] }
}

function save(ids) {
  try { localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 100))) } catch { /* ignore */ }
}

// Owner tokens: create returns one per map; rebuild, upload and delete send
// it back. Only this browser has it, so a shared link can't wipe the map.
const TOKENS = 'axonis-owner-tokens'

function tokens() {
  try {
    const v = JSON.parse(localStorage.getItem(TOKENS) || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

function saveTokens(map) {
  try { localStorage.setItem(TOKENS, JSON.stringify(map)) } catch { /* ignore */ }
}

export function ownerToken(id) {
  const t = tokens()[id]
  return typeof t === 'string' ? t : null
}

// Maps made before owner tokens (locked: false) stay editable by anyone.
export function canEdit(project) {
  return !!project && !project.protected && (!project.locked || !!ownerToken(project.id))
}

export function rememberProject(id, token) {
  save([id, ...myProjectIds().filter((x) => x !== id)])
  if (token) {
    const ids = new Set(myProjectIds())
    const kept = Object.fromEntries(Object.entries(tokens()).filter(([k]) => ids.has(k)))
    saveTokens({ ...kept, [id]: token })
  }
}

export function forgetProject(id) {
  save(myProjectIds().filter((x) => x !== id))
  const t = tokens()
  delete t[id]
  saveTokens(t)
}
