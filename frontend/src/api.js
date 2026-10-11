const BASE = '/api'

// Errors carry the server's `detail` when there is one (rate limit, demo
// protection), so the UI can show a real reason instead of "429".
async function fail(r) {
  let detail = ''
  try { detail = (await r.json()).detail || '' } catch { /* not JSON */ }
  const err = new Error(typeof detail === 'string' && detail ? detail : `${r.status} ${r.statusText}`)
  err.status = r.status
  throw err
}

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, opts)
  if (!r.ok) await fail(r)
  return r.json()
}

export const getProjects = (mine = []) =>
  req(mine.length ? `/projects?mine=${encodeURIComponent(mine.join(','))}` : '/projects')
export const getProject = (id) => req(`/projects/${id}`)
export const getGraph = (id) => req(`/projects/${id}/graph`)
export const getClusters = (id) => req(`/projects/${id}/clusters`)
export const getOpportunities = (id) => req(`/projects/${id}/opportunities`)
export const getEntity = (projectId, entityId) =>
  req(`/projects/${projectId}/entities/${entityId}`)

export const createProject = (body) =>
  req('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const buildProject = (id) =>
  req(`/projects/${id}/build`, { method: 'POST' })

export const deleteProject = async (id) => {
  const r = await fetch(`${BASE}/projects/${id}`, { method: 'DELETE' })
  if (!r.ok) await fail(r)
}

export const getBrief = (id) => req(`/projects/${id}/brief`)

export const uploadDocument = (projectId, file) => {
  const form = new FormData()
  form.append('file', file)
  // No explicit Content-Type — the browser sets the multipart boundary.
  return req(`/projects/${projectId}/upload`, { method: 'POST', body: form })
}

export const askQuestion = (projectId, question) =>
  req(`/projects/${projectId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
