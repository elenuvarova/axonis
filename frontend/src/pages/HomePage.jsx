import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProjects, createProject, buildProject, deleteProject } from '../api'
import Tour from '../components/Tour'
import { InlineError, Toast, StateScreen } from '../components/states'
import usePrefersReducedMotion from '../usePrefersReducedMotion'
import { pad, relTime } from '../format'
import Wordmark from '../components/Wordmark'
import { myProjectIds, rememberProject, forgetProject, canEdit } from '../myProjects'
import { track } from '../analytics'
import useDocumentMeta from '../useDocumentMeta'
import { resetConsent } from '../consent'
import { navigateWithTransition } from '../routeTransition'
import LetterSphere from '../components/LetterSphere'
import '../hero.css'

const TOUR_KEY = 'kge-tour-home'
const INTRO_KEY = 'axonis-hero-intro'
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#/_'
const HOME_TOUR = [
  { target: '#topic', placement: 'bottom', title: 'Start with a topic',
    body: 'Type any domain — “AI tutoring”, “CSRD reporting”, “e-waste circularity”. That’s all the tool needs to start.' },
  { target: '.form-selects', placement: 'bottom', title: 'Focus it (optional)',
    body: 'Narrow by region and pick a research goal to shape the opportunities the map surfaces.' },
  { target: '.home-body .btn-primary', placement: 'top', title: 'Build your map',
    body: 'In about 30 seconds you get an interactive knowledge graph, clusters, scored product opportunities and a research brief.' },
]

const GOALS = [
  { value: 'market', label: 'Market understanding' },
  { value: 'opportunity', label: 'Product opportunity' },
  { value: 'competitors', label: 'Competitor landscape' },
  { value: 'policy', label: 'Policy / regulation' },
  { value: 'research', label: 'Research landscape' },
]

const REGIONS = ['Global', 'EU', 'UK', 'US', 'Asia']

const EXAMPLES = ['AI tutoring', 'CSRD reporting', 'e-waste circularity']

const STATUS_GLYPH = { ready: '●', building: '◐', pending: '◐', error: '×' }

function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      <span aria-hidden="true">{STATUS_GLYPH[status] || '●'}</span> {status}
    </span>
  )
}

function ProjectsSkeleton() {
  return (
    <div className="recent-projects">
      <div className="skeleton skeleton-line" style={{ width: '30%', height: 10, marginBottom: 16 }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ height: 48 }} />
      ))}
    </div>
  )
}

// Timings live in hero.css (--hero-t-*); JS reads them so there is one timeline.
function cssMs(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

// The entrance plays once per browser session and never under reduced motion.
function introWanted(reduced) {
  if (reduced) return false
  try { return !sessionStorage.getItem(INTRO_KEY) } catch { return false }
}

// Decode effect: every letter cycles 3-5 random glyphs, then locks left to
// right. Returns [{ch, locked}]; the final text when `run` is false.
function useDecode(text, run) {
  const final = Array.from(text, (ch) => ({ ch, locked: true }))
  const [chars, setChars] = useState(final)
  useEffect(() => {
    if (!run) { setChars(final); return }
    const delay = cssMs('--hero-t-decode', 520)
    const dur = cssMs('--hero-decode-dur', 400)
    const n = text.length
    const plan = Array.from(text, (_, i) => ({
      lockAt: delay + dur * (0.35 + 0.65 * (i / Math.max(1, n - 1))),
      glyphs: Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]),
    }))
    const t0 = performance.now()
    let raf = 0, prev = ''
    const frame = (now) => {
      const t = now - t0
      const next = plan.map((p, i) => {
        if (t >= p.lockAt) return { ch: text[i], locked: true }
        const k = Math.min(p.glyphs.length - 1, Math.floor((Math.max(0, t - delay) / (p.lockAt - delay)) * p.glyphs.length))
        return { ch: p.glyphs[k], locked: false }
      })
      const key = next.map((c) => c.ch + (c.locked ? '!' : '')).join('')
      if (key !== prev) { prev = key; setChars(next) }
      if (t < delay + dur) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, run])
  return chars
}

function DecodedWord({ text, run }) {
  const chars = useDecode(text, run)
  return chars.map((c, i) => (
    <span key={i} aria-hidden="true" className={c.locked ? undefined : 'dl-scramble'}>{c.ch}</span>
  ))
}

// Interactive letter sphere (drag to spin). The auto-spin can be paused;
// under reduced motion it starts still and only moves when dragged.
function Hero({ intro }) {
  const reduced = usePrefersReducedMotion()
  const [playing, setPlaying] = useState(true)
  return (
    <div className="home-hero-media">
      <LetterSphere paused={!playing} reducedMotion={reduced} assemble={intro} />
      {!reduced && (
        <button type="button" className="btn btn-ghost hero-toggle" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause background animation' : 'Play background animation'}>
          {playing ? 'Pause' : 'Play'}
        </button>
      )}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [topic, setTopic] = useState('')
  const [region, setRegion] = useState('Global')
  const [goal, setGoal] = useState('opportunity')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')
  const [tourOpen, setTourOpen] = useState(false)
  const tryRef = useRef(null)
  const reducedMotion = usePrefersReducedMotion()
  // Decided once on first render; the flag is written after mount so a
  // StrictMode double render still plays the entrance.
  const [intro] = useState(() => introWanted(reducedMotion))
  useEffect(() => {
    try { sessionStorage.setItem(INTRO_KEY, '1') } catch { /* ignore */ }
  }, [])

  // The tour no longer opens by itself: the home is one field and a button,
  // and an overlay in the first seconds hid exactly that. HOW IT WORKS opens it.

  const closeTour = () => {
    setTourOpen(false)
    try { localStorage.setItem(TOUR_KEY, '1') } catch { /* ignore */ }
  }

  useDocumentMeta({
    title: 'Axonis — map any domain: concepts, research and product gaps',
    description: "Type any domain and get an interactive knowledge graph of its concepts, research and organisations, with scored product opportunities where research exists but products don't. Built from Wikidata and OpenAlex in under a minute.",
    path: '/',
  })
  const [mine, setMine] = useState(myProjectIds)
  const { data: projectsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects', mine],
    queryFn: () => getProjects(mine),
  })

  const startMutation = useMutation({
    mutationFn: async () => {
      const project = await createProject({ topic: topic.trim(), region, goal })
      rememberProject(project.id, project.owner_token)
      track('build_start', { region, goal })
      setMine(myProjectIds())
      await buildProject(project.id)
      return project
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      navigateWithTransition(navigate, `/project/${project.id}`, { topicEl: document.querySelector('.query-line') })
    },
    onError: (e) => setErr(e.message || 'Could not start the build. Please try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteProject(id),
    onSuccess: (_, id) => { track('map_delete'); forgetProject(id); setMine(myProjectIds()); qc.invalidateQueries({ queryKey: ['projects'] }) },
    onError: (e) => setToast(e?.status === 403 || e?.status === 429 ? e.message : 'Could not delete the project. Please try again.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')
    if (!topic.trim()) { setErr('Enter a topic to explore first.'); return }
    startMutation.mutate()
  }

  const projects = projectsData || []
  const busy = startMutation.isPending

  return (
    <div className="home">
      <header className="topbar">
        <Link to="/" className="crumb-brand"><Wordmark /></Link>
        <span className="crumb-sep" aria-hidden="true">/</span>
        <span className="crumb-name">axonis.app</span>
        <nav className="topbar-right" aria-label="Page help">
          <button type="button" className="btn btn-ghost" onClick={() => setTourOpen(true)}>How it works</button>
          <button type="button" className="btn btn-ghost" onClick={() => tryRef.current?.querySelector('button')?.focus()}>Examples</button>
        </nav>
      </header>

      <main id="main" className={`home-body${intro ? ' hero-intro' : ''}`} tabIndex={-1}>
        <div className="home-left">
          <div className="label home-kicker">Knowledge Graph Explorer · open data <span className="hero-arrow" aria-hidden="true">→</span> graph <span className="hero-arrow" aria-hidden="true">→</span> gaps</div>
          <h1 className="display home-title" aria-label="Map any domain: concepts, research, opportunities">
            <span className="hero-line">Map any domain</span>
            <span className="hero-line"><span className="hero-arrow" aria-hidden="true">→ </span>Concepts</span>
            <span className="hero-line"><span className="hero-arrow" aria-hidden="true">→ </span>Research</span>
            <span className="hero-line accent"><span className="hero-arrow" aria-hidden="true">→ </span><DecodedWord text="Opportunities" run={intro} /></span>
          </h1>
          <p className="body home-lede">
            Type a topic. We read Wikidata and OpenAlex, build the graph, and mark where research exists but products don’t.
          </p>

          <form className="query-block" onSubmit={handleSubmit}>
            <div className="query-line">
              <span className="query-prompt" aria-hidden="true">&gt;</span>
              <span className="query-caret" aria-hidden="true" />
              <label htmlFor="topic" className="sr-only">Topic</label>
              <input
                id="topic"
                type="text"
                autoComplete="off"
                placeholder="e-waste circularity"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="query-controls">
              <div className="form-selects">
                <label className="pill" htmlFor="region">
                  <span className="pill-key">Region:</span>
                  <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} disabled={busy}>
                    {REGIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
                <label className="pill" htmlFor="goal">
                  <span className="pill-key">Goal:</span>
                  <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} disabled={busy}>
                    {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy} data-umami-event="build-map">
                {busy ? <><span className="spinner spinner-sm" aria-hidden="true" />Building…</> : <>Build<span aria-hidden="true">&nbsp;↵</span></>}
              </button>
            </div>
            <InlineError message={err} onDismiss={() => setErr('')} />
            <span className="qb-edge qb-top" aria-hidden="true" />
            <span className="qb-edge qb-right" aria-hidden="true" />
            <span className="qb-edge qb-bottom" aria-hidden="true" />
            <span className="qb-edge qb-left" aria-hidden="true" />
          </form>

          <div className="try-row" ref={tryRef}>
            <span className="label">Try</span>
            {EXAMPLES.map((ex) => {
              // A ready demo for this topic opens instantly instead of a new build.
              const demo = projects.find((p) => p.protected && p.status === 'ready' && p.topic.toLowerCase() === ex.toLowerCase())
              return (
                <button
                  key={ex}
                  type="button"
                  className="chip"
                  disabled={busy}
                  title={demo ? 'Open the demo map' : 'Use this topic'}
                  onClick={(e) => {
                    if (demo) { track('demo_open', { topic: demo.topic, via: 'try' }); navigateWithTransition(navigate, `/project/${demo.id}`, { topicEl: e.currentTarget }); return }
                    setTopic(ex); document.getElementById('topic')?.focus()
                  }}
                >
                  {ex}{demo && <span aria-hidden="true">&nbsp;→</span>}
                  {demo && <span className="sr-only"> (open demo)</span>}
                </button>
              )
            })}
          </div>
        </div>

        <Hero intro={intro} />

        <section className="home-recent" aria-label="Recent projects">
          {isLoading && <ProjectsSkeleton />}

          {isError && (
            <div className="recent-projects">
              <StateScreen
                variant="error"
                title="Couldn't load your projects"
                message="The server didn't respond. Check your connection and try again."
                actions={<button className="btn btn-secondary" onClick={() => refetch()}>Retry</button>}
              />
            </div>
          )}

          {!isLoading && !isError && projects.length > 0 && (
            <div className="recent-projects">
              <div className="project-head label" aria-hidden="true">
                <div className="project-cols">
                  <span>ID</span><span>Topic</span><span>Region</span><span>Status</span><span>Created</span>
                </div>
                <span className="project-del-spacer" />
              </div>
              <h2 className="sr-only">Recent projects</h2>
              {projects.map((p, i) => (
                // Row is an inert container; the main area is a keyboard-operable button
                // and the delete is a sibling button — avoids button-in-interactive-div (C-2).
                <div key={p.id} className="project-row">
                  <button
                    type="button"
                    className="project-row-main project-cols"
                    onClick={(e) => { track(p.protected ? 'demo_open' : 'map_open', p.protected ? { topic: p.topic, via: 'list' } : undefined); navigateWithTransition(navigate, `/project/${p.id}`, { topicEl: e.currentTarget.querySelector('.project-row-name') }) }}
                    aria-label={`Open project: ${p.topic}`}
                  >
                    <span className="project-row-id">{pad(i + 1)}</span>
                    <span className="project-row-name" data-clarity-mask={p.protected ? undefined : 'true'}>{p.topic}</span>
                    <span className="project-row-meta">{p.region}</span>
                    <span><StatusBadge status={p.status} /></span>
                    <span className="project-row-meta">{relTime(p.created_at)}</span>
                  </button>
                  {/* Fixed-width end cell on every row, so the columns line up with the header */}
                  <span className="project-row-end">
                    {p.protected ? (
                      // portfolio demo: read-only on the server, so no delete affordance
                      <span className="project-demo-tag" title="Demo map: read and ask only">Demo</span>
                    ) : canEdit(p) ? (
                      <button
                        type="button"
                        className="btn btn-ghost project-del"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(p.id)}
                        aria-label={`Delete ${p.topic}`}
                      >Delete</button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="home-footer">
          <span>Data: <a href="https://www.wikidata.org" target="_blank" rel="noreferrer">Wikidata</a> and <a href="https://openalex.org" target="_blank" rel="noreferrer">OpenAlex</a> (CC0)</span>
          <span><a href="https://github.com/elenuvarova/axonis" target="_blank" rel="noreferrer">Source</a></span>
          <button type="button" className="home-footer-link" onClick={resetConsent}>Analytics settings</button>
        </footer>
      </main>

      <Toast message={toast} onClose={() => setToast('')} />
      <Tour steps={HOME_TOUR} open={tourOpen} onClose={closeTour} />
    </div>
  )
}
