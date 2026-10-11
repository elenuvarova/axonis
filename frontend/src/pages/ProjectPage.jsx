import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { flushSync } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { canEdit } from '../myProjects'
import Ticker from '../components/Ticker'
import SheetHandle, { SNAPS } from '../components/SheetHandle'
import BriefModal from '../components/BriefModal'
import GapReveal from '../components/GapReveal'
import { fitFree } from '../graphFit'
import { getProject, getGraph, getClusters, getOpportunities, getEntity, getBrief, buildProject, uploadDocument, askQuestion } from '../api'

// Cytoscape + cola are heavy; load them only when a graph actually renders.
const GraphCanvas = lazy(() => import('../components/GraphCanvas'))

import EntityCard from '../components/EntityCard'
import GraphLegend from '../components/GraphLegend'
import CommandPalette from '../components/CommandPalette'
import NodeList from '../components/NodeList'
import { track } from '../analytics'
import useDocumentMeta from '../useDocumentMeta'
import GraphControls from '../components/GraphControls'
import ClusterPanel from '../components/ClusterPanel'
import OpportunityBoard from '../components/OpportunityBoard'
import AskPanel from '../components/AskPanel'
import { BuildingScreen, StateScreen, Toast } from '../components/states'
import HelpButton from '../components/HelpButton'
import Tour from '../components/Tour'
import usePrefersReducedMotion from '../usePrefersReducedMotion'
import { pad } from '../format'
import Wordmark from '../components/Wordmark'
import Icon from '../components/icons'

const PANEL_ID   = 'project-sidebar-panel'
const TAB_ID     = (id) => `tab-${id}`

const STATUS_GLYPH = { ready: '●', building: '◐', pending: '◐', error: '×' }

function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      <span aria-hidden="true">{STATUS_GLYPH[status] || '●'}</span> {status}
    </span>
  )
}



// Fit the view to a set of nodes but never zoom past 1.2×: fitting two or three
// nodes otherwise jumps to max zoom and the labels turn into billboards.
// Fit a subset (a cluster, an answer's nodes) into the free canvas area, never past 1.2×.
function fitCapped(cy, eles, _padding, reduced) {
  fitFree(cy, eles, { maxZoom: 1.2, duration: reduced ? 0 : 400 })
}

// The last progress snapshot, completed: every stage done and the counts
// taken from the finished graph (the server stops reporting at "ready").
function finalProgress(last, graph) {
  if (!last) return null
  const nodes = graph?.nodes || []
  const by = (t) => nodes.filter((n) => n.type === t).length
  const counts = graph ? { ...last.counts, wikidata: by('concept'), papers: by('paper'), institutions: by('institution') } : last.counts
  return { ...last, stage_index: (last.stages || []).length, counts, log: [...(last.log || []), { t: Date.now() / 1000, source: 'ready', message: 'map ready' }] }
}

export default function ProjectPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const reducedMotion = usePrefersReducedMotion()
  const fileInputRef = useRef(null)
  const briefBtnRef  = useRef(null)
  const [tab, setTab] = useState('graph')
  const [askOpen, setAskOpen] = useState(false)
  const [askedText, setAskedText] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteOpenRef = useRef(false)
  paletteOpenRef.current = paletteOpen
  const [listView, setListView] = useState(false)
  const pendingCentre = useRef(null)
  const [highlightClusterId, setHighlightClusterId] = useState(null)
  const [cy, setCy] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  // Phone sheet: opens at peek height so the map stays visible; expands on demand.
  const [sheetSnap, setSheetSnap] = useState('peek')
  const sheetRef = useRef(null)
  const [brief, setBrief] = useState(null)
  const [askResult, setAskResult] = useState(null)
  const [toast, setToast] = useState('')
  const [tourOpen, setTourOpen] = useState(false)
  const pendingCluster = useRef(null)

  const projectTour = [
    { target: '.graph-canvas-wrap', placement: 'center', before: () => setTab('graph'),
      title: 'Your knowledge map',
      body: 'Each node is an entity, sized by how central it is, and its shape tells you the type. Drag nodes, scroll to zoom, double-click to refit — and hover any node to reveal its label and connections.' },
    { target: '.graph-legend', placement: 'bottom', before: () => setTab('graph'),
      title: 'Shape = type',
      body: 'The legend maps each shape to an entity type — concepts, research papers, organisations and products.' },
    { target: '.project-tab-bar', placement: 'bottom',
      title: 'Three ways to read it',
      body: 'Clusters groups related concepts and Opportunities surfaces scored product openings. Use “ask the map” on the canvas to question the domain in plain English.' },
    { target: '.header-actions', placement: 'bottom',
      title: 'Enrich & export',
      body: 'Upload a PDF or CSV to fold new entities into the map, or generate a one-click research Brief you can download or print.' },
  ]

  const closeTour = () => {
    setTourOpen(false)
    try { localStorage.setItem('kge-tour-project', '1') } catch { /* ignore */ }
  }

  // ── Panel Escape to close (mobile sheet / ask mode) (C-3) ────────────────
  useEffect(() => {
    if (!panelOpen && !askOpen) return
    const handler = (e) => { if (e.key === 'Escape' && !brief && !tourOpen && !paletteOpen) closePanel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [panelOpen, askOpen, brief, tourOpen, paletteOpen]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Mutations ─────────────────────────────────────────────────────────────
  const briefMutation = useMutation({
    mutationFn: () => { track('brief_open'); return getBrief(id) },
    onSuccess: (data) => setBrief(data),
    onError: (e) => setToast(e.message || 'Could not generate brief. Please try again.'),
  })

  const rebuildMutation = useMutation({
    mutationFn: () => { track('rebuild'); return buildProject(id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => { track('upload'); return uploadDocument(id, file) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['graph', id] })
      qc.invalidateQueries({ queryKey: ['clusters', id] })
      qc.invalidateQueries({ queryKey: ['opportunities', id] })
    },
    onError: (e) => setToast(`Upload failed: ${e.message}`),
  })

  const onPickFile = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    e.target.value = ''
  }

  const askMutation = useMutation({
    mutationFn: (question) => { track('ask', { demo: !!project?.protected }); return askQuestion(id, question) },
    onSuccess: (data) => {
      track('ask_answer', { citations: (data.answer.match(/\[\d{1,2}\]/g) || []).length })
      setAskResult(data); highlightNodes(data.highlighted_nodes)
    },
    onError: () => setAskResult(null),
  })

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: project, error: projErr, refetch: refetchProject } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id),
    refetchInterval: (q) => (q.state.data?.status === 'building' ? 2500 : false),
  })

  const isReady = project?.status === 'ready'

  const { data: graphData } = useQuery({
    queryKey: ['graph', id], queryFn: () => getGraph(id), enabled: isReady,
  })
  // Build preview: only once the server is past saving (stage ≥ metrics) —
  // before that a rebuild still has the previous graph in the database.
  const previewReady = project?.status === 'building' && (project?.progress?.stage_index ?? -1) >= 5
  const { data: previewGraph } = useQuery({
    queryKey: ['graph-preview', id], queryFn: () => getGraph(id), enabled: previewReady,
    refetchInterval: previewReady ? 4000 : false,
  })
  const { data: clustersData } = useQuery({
    queryKey: ['clusters', id], queryFn: () => getClusters(id), enabled: isReady,
  })
  const { data: oppsData } = useQuery({
    queryKey: ['opportunities', id], queryFn: () => getOpportunities(id), enabled: isReady,
  })
  const { data: entityData } = useQuery({
    queryKey: ['entity', id, selectedId], queryFn: () => getEntity(id, selectedId), enabled: !!selectedId,
  })

  // The tour no longer opens by itself (it covered the map on first sight);
  // the gap reveal below is the first-run moment. "?" and ⌘K replay the tour.

  // Gap reveal: once per map per session, after the first layout settles,
  // light the top opportunity clusters with callouts (GapReveal).
  const [reveal, setReveal] = useState(null)
  useEffect(() => {
    if (!cy || !oppsData || !clustersData || project?.status !== 'ready') return
    const key = `axonis-reveal-${id}`
    try { if (sessionStorage.getItem(key)) return } catch { return }
    const byId = new Map((clustersData.clusters || []).map((c) => [c.id, c]))
    const seen = new Set()
    const items = [...(oppsData.opportunities || [])]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((o) => ({ o, c: byId.get(o.cluster_db_id) }))
      .filter(({ c }) => c && !seen.has(c.cluster_id) && seen.add(c.cluster_id))
      .slice(0, window.matchMedia?.('(max-width: 767px)').matches ? 2 : 3)
      .map(({ o, c }, i) => ({ rank: i + 1, clusterId: c.cluster_id, score: Math.round(Math.min(1, Math.max(0, o.score || 0)) * 100), title: o.title }))
    if (!items.length) return
    // marked as seen only when it actually shows, so an effect that is set
    // up and torn down early (StrictMode, a quick tab switch) can't eat it
    const show = () => {
      if (cy.destroyed()) return
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1') } catch { return }
      setReveal(items)
    }
    cy.one('layoutstop', show)
    const t = setTimeout(show, reducedMotion ? 300 : 1800)
    return () => { clearTimeout(t); cy.off('layoutstop', show) }
  }, [cy, oppsData, clustersData, project?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only demo maps put their topic in the title and description. Umami and
  // Clarity both send document.title with every event, so a visitor's own
  // topic in the title would leak what they typed into analytics. Demo topics
  // are public and are the pages worth indexing.
  const publicTopic = project?.protected ? project.topic : null
  useDocumentMeta({
    title: project ? (publicTopic ? `${publicTopic} — knowledge map · Axonis` : 'Your map · Axonis') : null,
    description: publicTopic
      ? `An interactive knowledge graph of ${publicTopic}: concepts, research and organisations from Wikidata and OpenAlex, clustered and scored for product opportunities.`
      : null,
    path: `/project/${id}`,
  })

  // Build outcome for analytics: seen building, then ready or error.
  const buildSeen = useRef(null)
  // Finale: a build watched to the end holds the assembly field for a beat
  // with the final counts, then the field becomes the map (view transition).
  const lastProgress = useRef(null)
  if (project?.progress) lastProgress.current = project.progress
  const [finishing, setFinishing] = useState(false)
  useEffect(() => {
    const st = project?.status
    if (st === 'building' && !buildSeen.current) buildSeen.current = Date.now()
    if ((st === 'ready' || st === 'error') && buildSeen.current) {
      track(st === 'ready' ? 'build_done' : 'build_error', { seconds: Math.round((Date.now() - buildSeen.current) / 1000) })
      buildSeen.current = null
      if (st === 'ready' && lastProgress.current && !reducedMotion) setFinishing(true)
    }
  }, [project?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!finishing || !graphData) return
    const t = setTimeout(() => {
      const end = () => setFinishing(false)
      if (document.startViewTransition) {
        document.documentElement.classList.add('vt-route')
        document.startViewTransition(() => flushSync(end)).finished.finally(() => document.documentElement.classList.remove('vt-route'))
      } else end()
    }, 1600)
    return () => clearTimeout(t)
  }, [finishing, graphData])

  // ⌘K / Ctrl+K opens the node & action palette (map must be ready).
  useEffect(() => {
    if (project?.status !== 'ready') return
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !brief && !tourOpen) {
        e.preventDefault()
        if (!paletteOpenRef.current) track('cmdk_open', { via: 'shortcut' })
        setPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [project?.status, brief, tourOpen])

  // A node picked from the palette while the map was unmounted (Opportunities
  // tab) is centred once the new canvas has finished its first layout (same
  // pattern as the pending cluster below).
  useEffect(() => {
    if (!cy || !pendingCentre.current) return
    const apply = () => {
      if (cy.destroyed() || !pendingCentre.current) return
      const nid = pendingCentre.current
      pendingCentre.current = null
      centreNode(nid)
    }
    cy.one('layoutstop', apply)
    const t = setTimeout(apply, reducedMotion ? 300 : 1600)
    return () => { clearTimeout(t); cy.off('layoutstop', apply) }
  }, [cy]) // eslint-disable-line react-hooks/exhaustive-deps

  // On a phone the inspector sheet covers the lower part of the canvas, so
  // move the picked node into the strip that stays visible above it.
  useEffect(() => {
    if (!cy || !selectedId || cy.destroyed()) return
    if (!window.matchMedia?.('(max-width: 767px)').matches) return
    const node = cy.getElementById(selectedId)
    if (!node.length) return
    const sheet = window.innerHeight * SNAPS.peek
    const box = cy.container().getBoundingClientRect()
    const visible = Math.max(80, window.innerHeight - sheet - box.top)
    const p = node.position(), z = cy.zoom()
    cy.animate({ pan: { x: cy.width() / 2 - p.x * z, y: visible / 2 - p.y * z } }, { duration: reducedMotion ? 0 : 300 })
    setSheetSnap('peek')
  }, [selectedId, cy]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Graph interaction ─────────────────────────────────────────────────────
  const handleNodeClick = (nodeData) => {
    if (nodeData) {
      setSelectedId(nodeData.id)
      setTab('graph')
      setAskOpen(false)
      setPanelOpen(true)
    } else {
      setSelectedId(null)
      if (!askOpen) setPanelOpen(false)
    }
  }

  const clearHighlights = (c) => {
    c.batch(() => {
      c.elements().removeClass('faded')
      c.nodes().removeClass('highlighted')
      c.edges().removeClass('highlighted')
    })
    c._highlightedCluster = null
  }

  const highlightCluster = (c, clusterId, { fit = true } = {}) => {
    clearHighlights(c)
    const inCluster = c.nodes(`[cluster_id = "${clusterId}"]`)
    c.batch(() => {
      inCluster.addClass('highlighted')
      inCluster.connectedEdges().addClass('highlighted')
    })
    c._highlightedCluster = clusterId
    if (fit && inCluster.length) fitCapped(c, inCluster, 60, reducedMotion)
  }

  const handleClusterClick = (clusterId) => {
    const isDeselect = highlightClusterId === clusterId
    setHighlightClusterId(isDeselect ? null : clusterId)
    setPanelOpen(!isDeselect)
    if (!cy) return
    if (isDeselect) clearHighlights(cy)
    else highlightCluster(cy, clusterId)
  }

  // Opportunities → map: switch to the map and highlight that opportunity's cluster.
  const showOppOnMap = (opp) => {
    const cluster = (clustersData?.clusters ?? []).find((c) => c.id === opp.cluster_db_id)
    if (!cluster) return
    pendingCluster.current = cluster.cluster_id
    setTab('graph')
    setAskOpen(false)
    setSelectedId(null)
    setHighlightClusterId(cluster.cluster_id)
    setPanelOpen(false)
  }

  // The canvas remounts when returning from Opportunities. Apply the pending
  // highlight to the live instance once its first layout has settled; the
  // request stays pending until then, so an instance that is torn down
  // early (StrictMode, a quick tab switch) can't swallow it.
  useEffect(() => {
    if (!cy || !pendingCluster.current) return
    const apply = () => {
      if (cy.destroyed() || !pendingCluster.current) return
      const clusterId = pendingCluster.current
      pendingCluster.current = null
      highlightCluster(cy, clusterId)
    }
    cy.one('layoutstop', apply)
    const t = setTimeout(apply, reducedMotion ? 300 : 1600) // in case the layout already stopped
    return () => { clearTimeout(t); cy.off('layoutstop', apply) }
  }, [cy]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearAskHighlight = () => {
    if (cy) cy.nodes('.cite-focus').removeClass('cite-focus')
    if (cy && cy._highlightedCluster === '__ask__') clearHighlights(cy)
  }

  // Tab switches run as a view transition where supported: the underline
  // slides to the new tab and the content cross-fades in a few steps.
  const handleTabClick = (tabId) => {
    const go = () => switchTab(tabId)
    if (tabId === tab) { go(); return }
    if (!reducedMotion && typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(() => flushSync(go))
    } else go()
  }

  const switchTab = (tabId) => {
    track('tab', { tab: tabId })
    setTab(tabId)
    // The list mirrors the map; it shouldn't follow the user into Clusters.
    if (tabId !== 'graph') setListView(false)
    if (askOpen) { setAskOpen(false); clearAskHighlight() }
    if (tabId === 'clusters') setPanelOpen(true)
    else if (tabId === 'graph') setPanelOpen(!!selectedId)
    else setPanelOpen(false)
  }

  // Where focus goes back to when Ask closes (the opener may have unmounted;
  // fall back to the canvas "ask the map" bar).
  const askReturnFocus = useRef(null)
  const openAsk = () => {
    track('ask_open')
    askReturnFocus.current = document.activeElement
    setTab('graph')
    setAskOpen(true)
    setPanelOpen(true)
  }

  const closeAsk = () => {
    setAskOpen(false)
    clearAskHighlight()
    setPanelOpen(!!selectedId)
    requestAnimationFrame(() => {
      const prev = askReturnFocus.current
      const target = prev && prev.isConnected ? prev : document.querySelector('.ask-bar')
      target?.focus()
    })
  }

  const closePanel = useCallback(() => {
    setSheetSnap('peek')
    if (askOpen) { closeAsk(); return }
    setPanelOpen(false)
    if (tab === 'clusters') {
      setHighlightClusterId(null)
      if (cy) clearHighlights(cy)
    }
  }, [tab, cy, askOpen, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ask citation / inspector chip hover or focus: light one node on the graph.
  const hoverSource = (nid) => {
    if (!cy) return
    cy.batch(() => {
      cy.nodes('.cite-focus').removeClass('cite-focus')
      if (nid) cy.getElementById(nid).addClass('cite-focus')
    })
  }

  const highlightNodes = (ids) => {
    if (!cy) return
    let coll = cy.collection()
    ;(ids || []).forEach((nid) => { coll = coll.union(cy.getElementById(nid)) })
    cy.batch(() => {
      cy.nodes().removeClass('highlighted')
      cy.edges().removeClass('highlighted')
      cy.elements().removeClass('faded')
      cy.elements().difference(coll.union(coll.connectedEdges())).addClass('faded')
      coll.addClass('highlighted')
      coll.connectedEdges().addClass('highlighted')
    })
    cy._highlightedCluster = '__ask__'
    if (coll.length) fitCapped(cy, coll, 60, reducedMotion)
  }

  const pickFromPalette = (node) => {
    track('cmdk_pick', { kind: 'node' })
    const mapMounted = tab !== 'opportunities'
    setSelectedId(node.id)
    setTab('graph')
    setAskOpen(false)
    clearAskHighlight()
    setPanelOpen(true)
    if (mapMounted) centreNode(node.id)
    else pendingCentre.current = node.id
  }

  const paletteActionsRaw = [
    { id: 'ask', label: 'Ask the map', hint: 'panel', run: openAsk },
    { id: 'brief', label: 'Generate research brief', hint: 'modal', run: () => briefMutation.mutate() },
    { id: 'map', label: 'Go to map', hint: 'tab', run: () => handleTabClick('graph') },
    { id: 'clusters', label: 'Go to clusters', hint: 'tab', run: () => handleTabClick('clusters') },
    { id: 'opps', label: 'Go to opportunities', hint: 'tab', run: () => handleTabClick('opportunities') },
    { id: 'list', label: listView ? 'Show the map' : 'Show nodes as a list', hint: 'view', run: () => { handleTabClick('graph'); setListView((v) => !v) } },
    { id: 'tour', label: 'Replay the tour', run: () => setTourOpen(true) },
  ]
  const paletteActions = paletteActionsRaw.map((a) => ({ ...a, run: () => { track('cmdk_action', { id: a.id }); a.run() } }))

  const centreNode = (nid) => {
    if (!cy) return
    const n = cy.getElementById(nid)
    if (n && n.length) cy.animate({ center: { eles: n }, zoom: Math.max(cy.zoom(), 1.1), duration: reducedMotion ? 0 : 300 })
  }

  // ── Error / not-found ──────────────────────────────────────────────────────
  if (projErr) {
    // The API answers 404 for an unknown id and 422 for a malformed one; only
    // a network failure or a 5xx is worth retrying.
    const notFound = [400, 404, 422].includes(projErr.status) || /404/.test(projErr.message || '')
    return (
      <div className="project-page">
        <header className="topbar">
          <Link to="/" className="crumb-brand" aria-label="Back to home"><Wordmark /></Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-name">Project</span>
        </header>
        <main id="main" className="project-main" tabIndex={-1}>
        <StateScreen
          variant="error"
          title={notFound ? 'Map not found' : 'Could not load this map'}
          message={notFound
            ? "This map doesn't exist or was deleted. Build a new one from the home page."
            : "The server didn't respond. Check your connection and try again."}
          actions={
            <>
              {!notFound && <button className="btn btn-primary" onClick={() => refetchProject()}>Retry</button>}
              <Link className="btn btn-secondary" to="/">Go home</Link>
            </>
          }
        />
        </main>
      </div>
    )
  }

  if (!project) {
    return <div className="full-center" style={{ minHeight: '100vh' }}><div className="spinner" role="status" aria-label="Loading project" /></div>
  }

  const clusters  = clustersData?.clusters ?? []
  const opps      = oppsData?.opportunities ?? []
  const oppCount  = opps.length
  const nodeCount = graphData?.stats?.node_count ?? 0
  const edgeCount = graphData?.stats?.edge_count ?? 0
  const isBuilding = project.status === 'building' || project.status === 'pending' || finishing
  const showClusters = tab === 'clusters'
  const sidebarLabel = showClusters ? 'Clusters' : askOpen ? 'Ask the map' : 'Entity detail'

  const tabs = [
    { id: 'graph', label: 'Map', short: 'Map' },
    { id: 'clusters', label: 'Clusters', short: 'Clusters', count: clusters.length },
    { id: 'opportunities', label: 'Opportunities', short: 'Opportunities', count: oppCount },
  ]

  return (
    <div className={`project-page${panelOpen ? ' panel-open' : ''}${` sheet-${sheetSnap}`}`}>

      {/* ── Top bar ── */}
      <header className="topbar">
        {/* aria-label supplements the visible glyphs — the crumb alone is not a reliable name (M-5) */}
        <Link to="/" className="crumb-brand" aria-label="Back to home">
          <span className="crumb-back" aria-hidden="true">←</span>
          <span className="crumb-kge" aria-hidden="true"><Wordmark /></span>
        </Link>
        <span className="crumb-sep" aria-hidden="true">/</span>
        {/* a visitor's own topic is masked in Clarity recordings; demo topics are public */}
        <h1 className="crumb-name crumb-topic" data-clarity-mask={project.protected ? undefined : 'true'}>{project.topic}</h1>
        <StatusBadge status={project.status} />
        {nodeCount > 0 && (
          <span className="topbar-meta">
            <Ticker value={nodeCount} digits={3} /> nodes · <Ticker value={edgeCount} digits={3} /> edges · <Ticker value={clusters.length} digits={2} /> clusters
          </span>
        )}
        {isBuilding && (
          <span className="topbar-meta">{project.region} · {project.goal}</span>
        )}
        <div className="header-actions">
          {isReady && (
            <>
              {/* aria-label for hidden file input (S-4, WCAG 4.1.2) */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.txt,.md"
                hidden
                onChange={onPickFile}
                aria-label="Upload a PDF, CSV, TXT or Markdown document to enrich the graph"
              />
              <button
                type="button"
                className="cmdk-chip"
                onClick={() => { track('cmdk_open', { via: 'chip' }); setPaletteOpen(true) }}
                aria-label="Search nodes and actions"
                aria-keyshortcuts="Meta+K Control+K"
              >
                <Icon name="search" size={14} />
                <span className="cmdk-chip-label">Search</span>
                <kbd className="cmdk-kbd">⌘K</kbd>
              </button>
{canEdit(project) && (
              <button
                type="button"
                className="btn btn-ghost btn-icon-mobile"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                title="Add a PDF or CSV to enrich the graph"
                aria-label="Upload a document to enrich the graph"
              >
                {uploadMutation.isPending ? '…' : <><Icon name="upload" /><span className="btn-label">Upload</span></>}
              </button>
              )}
              <button
                ref={briefBtnRef}
                type="button"
                className="btn btn-secondary btn-icon-mobile"
                onClick={() => briefMutation.mutate()}
                disabled={briefMutation.isPending}
                title="Generate a research brief"
                aria-label="Generate a research brief"
              >
                {briefMutation.isPending ? '…' : <><Icon name="brief" /><span className="btn-label">Brief</span></>}
              </button>
              <HelpButton size="sm" className="hide-on-mobile" onClick={() => setTourOpen(true)} label="Replay the tour" />
            </>
          )}
        </div>
      </header>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        nodes={graphData?.nodes || []}
        actions={paletteActions}
        onPickNode={pickFromPalette}
      />

      <main id="main" className="project-main" tabIndex={-1}>
      {/* ── Tab bar — exposed as tablist (M-2, WCAG 4.1.2) ── */}
      {isReady && nodeCount > 0 && (
        <div className="project-tab-bar" role="tablist" aria-label="Project views">
          {tabs.map((t) => (
            <button
              key={t.id}
              id={TAB_ID(t.id)}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={PANEL_ID}
              className={`tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => handleTabClick(t.id)}
            >
              <span className="tab-long">{t.label}</span>
              <span className="tab-short">{t.short}</span>
              {t.count > 0 && <span className="tab-count">{`\u00a0·\u00a0${pad(t.count)}`}</span>}
              {tab === t.id && <span className="tab-ind" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}

      {/* ── Body ── */}
      {isBuilding ? (
        <BuildingScreen
          topic={project.topic}
          progress={finishing ? finalProgress(lastProgress.current, graphData) : project.progress}
          preview={previewReady && previewGraph?.nodes?.length ? (
            <Suspense fallback={null}>
              <div className="build-preview-canvas">
                <GraphCanvas nodes={previewGraph.nodes} edges={previewGraph.edges} onNodeClick={() => {}} fitPadding={16} overlay={false} />
              </div>
            </Suspense>
          ) : null}
        />

      ) : project.status === 'error' ? (
        <StateScreen
          variant="error"
          title="Build failed"
          message={project.error_message || 'Something went wrong while building this graph.'}
          actions={
            <>
              {canEdit(project) && (
                <button className="btn btn-primary" onClick={() => rebuildMutation.mutate()} disabled={rebuildMutation.isPending}>
                  {rebuildMutation.isPending ? 'Restarting…' : 'Try again'}
                </button>
              )}
              <Link className={canEdit(project) ? 'btn btn-secondary' : 'btn btn-primary'} to="/">Go home</Link>
            </>
          }
        />

      ) : isReady && graphData && nodeCount === 0 ? (
        <StateScreen
          variant="empty"
          title="No graph to show"
          message="This topic didn't return enough open data to build a graph. Try a broader or more specific topic."
          actions={<Link className="btn btn-secondary" to="/">New topic</Link>}
        />

      ) : tab === 'opportunities' ? (
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={TAB_ID('opportunities')}
          style={{ display: 'flex', flex: 1, overflow: 'auto' }}
        >
          <OpportunityBoard opportunities={opps} loading={isReady && !oppsData} onShowOnMap={showOppOnMap} />
        </div>

      ) : (
        <div className={`graph-view${showClusters ? ' mode-clusters' : ''}`} id={PANEL_ID} role="tabpanel" aria-labelledby={TAB_ID(tab)}>
          {/* Canvas — always mounted so cluster highlights persist across tabs */}
          <div className="graph-canvas-wrap">
            {graphData ? (
              <Suspense fallback={<div className="full-center"><div className="spinner" role="status" aria-label="Loading graph" /></div>}>
                <GraphCanvas
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  selectedId={selectedId}
                  onNodeClick={handleNodeClick}
                  onCyInit={setCy}
                />
                {listView && (
                  <NodeList
                    nodes={graphData.nodes}
                    edges={graphData.edges}
                    selectedId={selectedId}
                    onSelect={(n) => handleNodeClick(n)}
                  />
                )}
                {!listView && <GraphLegend nodes={graphData.nodes} cy={cy} />}
                {reveal && tab === 'graph' && !listView && (
                  <GapReveal cy={cy} items={reveal} onDone={() => setReveal(null)}
                    onOpen={() => { setReveal(null); handleTabClick('opportunities') }} />
                )}
                <GraphControls cy={cy} reducedMotion={reducedMotion} selectedId={selectedId}
                  listView={listView} onToggleList={() => { track('list_view', { on: !listView }); setListView(!listView) }}
                  onFind={() => { track('cmdk_open', { via: 'rail' }); setPaletteOpen(true) }}
                  onAsk={openAsk} />
                {!askOpen && !listView && (
                  <button type="button" className="ask-bar" onClick={openAsk}>
                    <span aria-hidden="true">&gt;&nbsp;</span>
                    <span className="ask-bar-long">ask the map</span>
                    <span className="ask-bar-short">ask</span>
                  </button>
                )}
              </Suspense>
            ) : (
              <div className="full-center"><div className="spinner" role="status" aria-label="Loading graph" /></div>
            )}
          </div>

          {/* Backdrop — dims canvas when the panel is open on mobile */}
          <div className="panel-backdrop" onClick={closePanel} aria-hidden="true" />

          {/* Right panel (inspector / ask) · left list for clusters · bottom sheet on mobile */}
          <aside ref={sheetRef} className="graph-sidebar" aria-label={sidebarLabel}>
            <SheetHandle snap={sheetSnap} onSnap={setSheetSnap} onClose={closePanel} sheetRef={sheetRef} />
            <div className="sidebar-mobile-header">
              <span className="label">{sidebarLabel}</span>
              <button className="panel-close" onClick={closePanel} aria-label="Close panel">×</button>
            </div>

            {showClusters ? (
              <ClusterPanel
                clusters={clusters}
                activeClusterId={highlightClusterId}
                onClusterClick={handleClusterClick}
                loading={isReady && !clustersData}
                oppCountFor={(c) => opps.filter((o) => o.cluster_db_id === c.id).length}
                onSeeOpportunities={() => handleTabClick('opportunities')}
              />
            ) : askOpen ? (
              <AskPanel
                onAsk={(q) => { setAskedText(q); askMutation.mutate(q) }}
                question={askedText}
                pending={askMutation.isPending}
                result={askResult}
                error={askMutation.isError ? (askMutation.error?.message || 'Ask failed') : ''}
                onPickSource={(nid) => { track('source_click'); centreNode(nid) }}
                onHoverSource={hoverSource}
                onClose={closeAsk}
              />
            ) : (
              <EntityCard
                entity={entityData}
                maxBridge={Math.max(0, ...(graphData?.nodes || []).map((n) => n.bridge_score || 0)) || undefined}
                loading={!!selectedId && !entityData}
                nodes={graphData?.nodes}
                onNeighborClick={(nid) => { hoverSource(null); setSelectedId(nid) }}
                onNeighborHover={hoverSource}
                onAsk={selectedId ? openAsk : undefined}
              />
            )}
          </aside>
        </div>
      )}
      </main>

      {/* ── Brief reading view ── */}
      {brief && <BriefModal brief={brief} project={project} onClose={() => setBrief(null)} returnFocusRef={briefBtnRef} onNotice={setToast} />}

      {/* ── Toast — transient errors (replaces alert()) ── */}
      <Toast message={toast} onClose={() => setToast('')} />

      {/* ── Guided tour ── */}
      <Tour steps={projectTour} open={tourOpen} onClose={closeTour} />
    </div>
  )
}
