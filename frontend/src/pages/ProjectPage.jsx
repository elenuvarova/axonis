import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProject, getGraph, getClusters, getOpportunities, getEntity, getBrief, buildProject, uploadDocument, askQuestion } from '../api'

// Cytoscape + cola are heavy; load them only when a graph actually renders.
const GraphCanvas = lazy(() => import('../components/GraphCanvas'))

import EntityCard from '../components/EntityCard'
import GraphLegend from '../components/GraphLegend'
import CommandPalette from '../components/CommandPalette'
import GraphControls from '../components/GraphControls'
import ClusterPanel from '../components/ClusterPanel'
import OpportunityBoard from '../components/OpportunityBoard'
import AskPanel from '../components/AskPanel'
import { BuildingScreen, StateScreen, Toast } from '../components/states'
import HelpButton from '../components/HelpButton'
import Tour from '../components/Tour'
import usePrefersReducedMotion from '../usePrefersReducedMotion'
import { pad } from '../format'
import { renderMarkdown, escapeHtml } from '../markdown'
import Wordmark from '../components/Wordmark'
import Icon from '../components/icons'

const PANEL_ID   = 'project-sidebar-panel'
const TAB_ID     = (id) => `tab-${id}`
const BRIEF_TITLE_ID = 'brief-modal-title'

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
function fitCapped(cy, eles, padding, reduced) {
  const bb = eles.boundingBox()
  const zoom = Math.min(1.2, (cy.width() - padding * 2) / Math.max(bb.w, 1), (cy.height() - padding * 2) / Math.max(bb.h, 1))
  cy.animate({ zoom: Math.max(zoom, cy.minZoom()), center: { eles }, duration: reduced ? 0 : 400 })
}

export default function ProjectPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const reducedMotion = usePrefersReducedMotion()
  const fileInputRef = useRef(null)
  const briefBtnRef  = useRef(null)
  const briefModalRef = useRef(null)
  const [tab, setTab] = useState('graph')
  const [askOpen, setAskOpen] = useState(false)
  const [askedText, setAskedText] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const pendingCentre = useRef(null)
  const [highlightClusterId, setHighlightClusterId] = useState(null)
  const [cy, setCy] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [brief, setBrief] = useState(null)
  const [askResult, setAskResult] = useState(null)
  const [toast, setToast] = useState('')
  const [tourOpen, setTourOpen] = useState(false)
  const tourStarted = useRef(false)
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

  // ── Brief focus management (C-3, WCAG 2.4.3, 2.1.2) ──────────────────────
  useEffect(() => {
    if (brief && briefModalRef.current) {
      const firstFocusable = briefModalRef.current.querySelector(
        'button:not([disabled]), [href], input:not([disabled])'
      )
      firstFocusable?.focus()
    } else if (!brief) {
      briefBtnRef.current?.focus()
    }
  }, [brief])

  const handleBriefKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { setBrief(null); return }
    if (e.key !== 'Tab') return
    const modal = briefModalRef.current
    if (!modal) return
    const focusable = [...modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )]
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }, [])

  // ── Panel Escape to close (mobile sheet / ask mode) (C-3) ────────────────
  useEffect(() => {
    if (!panelOpen && !askOpen) return
    const handler = (e) => { if (e.key === 'Escape' && !brief && !tourOpen && !paletteOpen) closePanel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [panelOpen, askOpen, brief, tourOpen, paletteOpen]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Mutations ─────────────────────────────────────────────────────────────
  const briefMutation = useMutation({
    mutationFn: () => getBrief(id),
    onSuccess: (data) => setBrief(data),
    onError: (e) => setToast(e.message || 'Could not generate brief. Please try again.'),
  })

  const rebuildMutation = useMutation({
    mutationFn: () => buildProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadDocument(id, file),
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
    mutationFn: (question) => askQuestion(id, question),
    onSuccess: (data) => { setAskResult(data); highlightNodes(data.highlighted_nodes) },
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
  const { data: clustersData } = useQuery({
    queryKey: ['clusters', id], queryFn: () => getClusters(id), enabled: isReady,
  })
  const { data: oppsData } = useQuery({
    queryKey: ['opportunities', id], queryFn: () => getOpportunities(id), enabled: isReady,
  })
  const { data: entityData } = useQuery({
    queryKey: ['entity', id, selectedId], queryFn: () => getEntity(id, selectedId), enabled: !!selectedId,
  })

  // First-time project tour — auto-starts once the graph is on screen.
  useEffect(() => {
    if (tourStarted.current) return
    const nodes = graphData?.stats?.node_count ?? 0
    if (project?.status !== 'ready' || !graphData || nodes === 0) return
    tourStarted.current = true
    let done = false
    try { done = !!localStorage.getItem('kge-tour-project') } catch { /* ignore */ }
    if (done) return
    setTab('graph')
    const t = setTimeout(() => setTourOpen(true), 750)
    return () => clearTimeout(t)
  }, [project, graphData])

  // ⌘K / Ctrl+K opens the node & action palette (map must be ready).
  useEffect(() => {
    if (project?.status !== 'ready') return
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !brief && !tourOpen) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [project?.status, brief, tourOpen])

  // A node picked from the palette while the map was unmounted (Opportunities
  // tab) is centred once the new canvas has finished its first layout.
  useEffect(() => {
    const nid = pendingCentre.current
    if (!cy || !nid) return
    pendingCentre.current = null
    cy.one('layoutstop', () => centreNode(nid))
  }, [cy]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // The canvas remounts when returning from Opportunities; apply once its layout has settled.
  useEffect(() => {
    if (!cy || !pendingCluster.current) return
    const clusterId = pendingCluster.current
    pendingCluster.current = null
    highlightCluster(cy, clusterId, { fit: false })
    const t = setTimeout(() => {
      const els = cy.nodes(`[cluster_id = "${clusterId}"]`)
      if (els.length) fitCapped(cy, els, 60, reducedMotion)
    }, reducedMotion ? 100 : 1700)
    return () => clearTimeout(t)
  }, [cy]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearAskHighlight = () => {
    if (cy) cy.nodes('.cite-focus').removeClass('cite-focus')
    if (cy && cy._highlightedCluster === '__ask__') clearHighlights(cy)
  }

  const handleTabClick = (tabId) => {
    setTab(tabId)
    if (askOpen) { setAskOpen(false); clearAskHighlight() }
    if (tabId === 'clusters') setPanelOpen(true)
    else if (tabId === 'graph') setPanelOpen(!!selectedId)
    else setPanelOpen(false)
  }

  // Where focus goes back to when Ask closes (the opener may have unmounted;
  // fall back to the canvas "ask the map" bar).
  const askReturnFocus = useRef(null)
  const openAsk = () => {
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
    const mapMounted = tab !== 'opportunities'
    setSelectedId(node.id)
    setTab('graph')
    setAskOpen(false)
    clearAskHighlight()
    setPanelOpen(true)
    if (mapMounted) centreNode(node.id)
    else pendingCentre.current = node.id
  }

  const paletteActions = [
    { id: 'ask', label: 'Ask the map', hint: 'panel', run: openAsk },
    { id: 'brief', label: 'Generate research brief', hint: 'modal', run: () => briefMutation.mutate() },
    { id: 'map', label: 'Go to map', hint: 'tab', run: () => handleTabClick('graph') },
    { id: 'clusters', label: 'Go to clusters', hint: 'tab', run: () => handleTabClick('clusters') },
    { id: 'opps', label: 'Go to opportunities', hint: 'tab', run: () => handleTabClick('opportunities') },
    { id: 'tour', label: 'Replay the tour', run: () => setTourOpen(true) },
  ]

  const centreNode = (nid) => {
    if (!cy) return
    const n = cy.getElementById(nid)
    if (n && n.length) cy.animate({ center: { eles: n }, zoom: Math.max(cy.zoom(), 1.1), duration: reducedMotion ? 0 : 300 })
  }

  // ── Error / not-found ──────────────────────────────────────────────────────
  if (projErr) {
    const notFound = /404/.test(projErr.message || '')
    return (
      <div className="project-page">
        <header className="topbar">
          <Link to="/" className="crumb-brand" aria-label="Back to home"><Wordmark /></Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-name">Project</span>
        </header>
        <StateScreen
          variant="error"
          title={notFound ? 'Project not found' : 'Could not load this project'}
          message={notFound
            ? "This project doesn't exist or may have been deleted."
            : "The server didn't respond. Check your connection and try again."}
          actions={
            <>
              {!notFound && <button className="btn btn-primary" onClick={() => refetchProject()}>Retry</button>}
              <Link className="btn btn-secondary" to="/">Go home</Link>
            </>
          }
        />
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
  const isBuilding = project.status === 'building' || project.status === 'pending'
  const showClusters = tab === 'clusters'
  const sidebarLabel = showClusters ? 'Clusters' : askOpen ? 'Ask the map' : 'Entity detail'
  const briefDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const tabs = [
    { id: 'graph', label: 'Map', short: 'Map' },
    { id: 'clusters', label: 'Clusters', short: 'Clust', count: clusters.length },
    { id: 'opportunities', label: 'Opportunities', short: 'Opps', count: oppCount },
  ]

  return (
    <div className={`project-page${panelOpen ? ' panel-open' : ''}`}>

      {/* ── Top bar ── */}
      <header className="topbar">
        {/* aria-label supplements the visible glyphs — the crumb alone is not a reliable name (M-5) */}
        <Link to="/" className="crumb-brand" aria-label="Back to home">
          <span className="crumb-back" aria-hidden="true">←</span>
          <span className="crumb-kge" aria-hidden="true"><Wordmark /></span>
        </Link>
        <span className="crumb-sep" aria-hidden="true">/</span>
        <h1 className="crumb-name crumb-topic">{project.topic}</h1>
        <StatusBadge status={project.status} />
        {nodeCount > 0 && (
          <span className="topbar-meta">
            {pad(nodeCount, 3)} nodes · {pad(edgeCount, 3)} edges · {pad(clusters.length)} clusters
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
                onClick={() => setPaletteOpen(true)}
                aria-label="Search nodes and actions"
                aria-keyshortcuts="Meta+K Control+K"
              >
                <Icon name="search" size={14} />
                <span className="cmdk-chip-label">Search</span>
                <kbd className="cmdk-kbd">⌘K</kbd>
              </button>
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
            </button>
          ))}
        </div>
      )}

      {/* ── Body ── */}
      {isBuilding ? (
        <BuildingScreen topic={project.topic} progress={project.progress} />

      ) : project.status === 'error' ? (
        <StateScreen
          variant="error"
          title="Build failed"
          message={project.error_message || 'Something went wrong while building this graph.'}
          actions={
            <>
              <button className="btn btn-primary" onClick={() => rebuildMutation.mutate()} disabled={rebuildMutation.isPending}>
                {rebuildMutation.isPending ? 'Restarting…' : 'Try again'}
              </button>
              <Link className="btn btn-secondary" to="/">Go home</Link>
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
                <GraphLegend nodes={graphData.nodes} cy={cy} />
                <GraphControls cy={cy} reducedMotion={reducedMotion} selectedId={selectedId} />
                {!askOpen && (
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
          <aside className="graph-sidebar" aria-label={sidebarLabel}>
            <div className="sidebar-drag-handle" aria-hidden="true" />
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
                onPickSource={centreNode}
                onHoverSource={hoverSource}
                onClose={closeAsk}
              />
            ) : (
              <EntityCard
                entity={entityData}
                loading={!!selectedId && !entityData}
                onNeighborClick={(nid) => { hoverSource(null); setSelectedId(nid) }}
                onNeighborHover={hoverSource}
                onAsk={selectedId ? openAsk : undefined}
              />
            )}
          </aside>
        </div>
      )}

      {/* ── Brief modal — reading view ──
          role="dialog" + aria-modal + aria-labelledby + focus trap + Escape (C-3)  */}
      {brief && (
        <div
          className="brief-overlay"
          onClick={() => setBrief(null)}
          aria-hidden="true"
        >
          <div
            ref={briefModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={BRIEF_TITLE_ID}
            className="brief-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleBriefKeyDown}
          >
            <div className="brief-modal-header">
              <span id={BRIEF_TITLE_ID} className="label brief-modal-title">
                Research brief · {project.topic} · {project.region} · {briefDate}
              </span>
              <div className="brief-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label="Download brief as Markdown"
                  onClick={() => {
                    const blob = new Blob([brief.markdown], { type: 'text/markdown' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = brief.filename
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }}
                >
                  .md
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label="Print brief"
                  onClick={() => {
                    const win = window.open('', '_blank')
                    if (!win) { setToast('Allow pop-ups to print the brief.'); return }
                    win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(brief.filename)}</title>
<style>
  body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#1a1f26;line-height:1.7}
  h1{font-size:2em;border-bottom:2px solid #eee;padding-bottom:.3em;margin-bottom:.5em;letter-spacing:-.02em}
  h2{font-size:1.35em;border-bottom:1px solid #eee;padding-bottom:.2em;margin:2em 0 .6em}
  h3{font-size:1.1em;margin:1.5em 0 .4em}
  p{margin:.7em 0}
  ul,ol{margin:.7em 0;padding-left:1.4em}
  li{margin:.25em 0}
  strong{font-weight:600}
  a{color:#6d28d9;text-decoration:none}
  code{background:#f0f0f3;padding:1px 5px;border-radius:4px;font-size:.9em}
  table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.95em}
  th,td{border:1px solid #ddd;padding:7px 12px;text-align:left}
  th{background:#f7f7f7;font-weight:600}
  hr{border:none;border-top:1px solid #eee;margin:2em 0}
  @media print{body{margin:20px}button{display:none}}
</style></head><body>
<button onclick="window.print()" style="margin-bottom:24px;padding:8px 16px;cursor:pointer">Print / Save PDF</button>
<article>${renderMarkdown(brief.markdown)}</article>
</body></html>`)
                    win.document.close()
                  }}
                >
                  Print
                </button>
                <button type="button" className="btn btn-ghost brief-close" onClick={() => setBrief(null)} aria-label="Close brief">×</button>
              </div>
            </div>
            <div
              className="brief-content brief-rendered"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(brief.markdown) }}
            />
          </div>
        </div>
      )}

      {/* ── Toast — transient errors (replaces alert()) ── */}
      <Toast message={toast} onClose={() => setToast('')} />

      {/* ── Guided tour ── */}
      <Tour steps={projectTour} open={tourOpen} onClose={closeTour} />
    </div>
  )
}
