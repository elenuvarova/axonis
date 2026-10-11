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

export function rememberProject(id) {
  save([id, ...myProjectIds().filter((x) => x !== id)])
}

export function forgetProject(id) {
  save(myProjectIds().filter((x) => x !== id))
}
