import { useEffect, useMemo, useRef, useCallback } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import Cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import { typeShape, SHAPE_SCALE } from '../graphTypes'
import { shortLabel } from '../format'
import { initialView } from '../graphFit'
import { attachOverlay } from '../graphOverlay'
import { attachLabelDeclutter, LABEL_MARGIN, TOP_GAP } from '../graphLabels'
import usePrefersReducedMotion from '../usePrefersReducedMotion'

// Register the cola physics layout once (guard against HMR double-registration).
try { Cytoscape.use(cola) } catch { /* already registered */ }

function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch { return fallback }
}

// B² graph style: type is encoded by SHAPE (set in buildElements), every node is
// the text colour, selection/highlight is the single accent. Colours are read
// from the CSS tokens so the canvas and the page never drift apart.
function coarsePointer() {
  try { return window.matchMedia('(pointer: coarse)').matches } catch { return false }
}

// Node labels keep one size ON SCREEN (px), whatever the zoom: the model-space
// font is px / zoom, capped so a far-out view hides its labels (Cytoscape
// drops anything under min-zoomed-font-size) instead of printing 5px noise.
const LABEL_PX = 10.5
const HUB_PX = 12
// The three hubs (and gap / selected names) hold their size down to a much wider view than the
// rest: a 230-node map fits at zoom ~0.25, and a map that opens with no names on it at all is
// the worse failure than a hub name beside a small node.
const HUB_CAP = 44
const LABEL_FONT = '"Mona Sans", system-ui, -apple-system, sans-serif'
const fontFor = (view, px, cap) => () => Math.min(cap, px / view.z)

// `view.z` is the current zoom; makeStylesheet closes over it and
// handleCy refreshes the style whenever the zoom moves.
function makeStylesheet(view) {
  const text    = cssVar('--text', '#EDEDED')
  const text2   = cssVar('--text-2', '#8A8A8A')
  const bg      = cssVar('--bg', '#0E0E0E')
  const edge    = cssVar('--graph-edge', '#4A4A4A')
  const edgeStrong = cssVar('--line-control', '#6A6A6A')
  const accent  = cssVar('--accent', '#FF2BD6')

  return [
    {
      selector: 'node',
      style: {
        'shape': 'data(shape)',
        'background-color': text,
        // Only prominent nodes keep a persistent label so dense graphs stay
        // readable; the rest reveal theirs on hover / selection / highlight.
        'label': 'data(displayLabel)',
        'width': 'data(size)',
        'height': 'data(size)',
        'font-family': LABEL_FONT,
        'font-weight': 500,
        'font-size': fontFor(view, LABEL_PX, 20),
        // Below ~10px on screen a label is noise, not information: hide it
        // until the user zooms in (hover and selection still reveal it).
        'min-zoomed-font-size': 9.5,
        'color': text2,
        'text-valign': 'center',
        'text-halign': 'right',
        'text-margin-x': LABEL_MARGIN,
        // Text outline in the canvas colour keeps crossing edges from running
        // through the letters without a plate punching holes in the hulls.
        'text-outline-color': bg,
        'text-outline-width': 3,
        'text-outline-opacity': 0.9,
        // a hairline of canvas colour keeps nodes apart in dense clusters
        'border-width': 1,
        'border-color': bg,
        // A bigger invisible hit area on touch screens: nodes are 6-10px on a phone.
        'overlay-padding': coarsePointer() ? 14 : 8,
        'overlay-opacity': 0,
        'transition-property': 'opacity, background-color',
        'transition-duration': '0.15s',
      },
    },
    // Hubs read larger and in the full text colour.
    // They also paint above the other nodes, so no neighbouring glyph is drawn over a hub's label.
    { selector: 'node[?hub]', style: { 'font-size': fontFor(view, HUB_PX, HUB_CAP), 'color': text, 'z-index': 15 } },
    // Where the label collision pass moved a hub's label: left, above or below its node.
    { selector: 'node.label-l', style: { 'text-halign': 'left', 'text-margin-x': -LABEL_MARGIN } },
    { selector: 'node.label-t', style: { 'text-valign': 'top', 'text-halign': 'center', 'text-margin-x': 0, 'text-margin-y': -TOP_GAP } },
    { selector: 'node.label-b', style: { 'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-x': 0, 'text-margin-y': TOP_GAP } },
    // A lit cluster (Clusters tab, Ask): accent outline on the node, labels in the text colour.
    {
      selector: 'node.highlighted',
      style: { 'border-width': 1.5, 'border-color': accent, 'color': text, 'label': 'data(label)', 'z-index': 18 },
    },
    // Gap reveal: a lit cluster shows only its persistent labels, and the
    // three best-connected nodes per cluster speak up in the accent.
    { selector: 'node.gap-lit', style: { 'label': 'data(displayLabel)', 'color': text2 } },
    { selector: 'node.gap-top', style: { 'label': 'data(label)', 'color': accent, 'font-size': fontFor(view, HUB_PX, HUB_CAP), 'z-index': 19 } },
    // The label collision pass (graphLabels.js) drops labels that would cover something or run off the canvas.
    { selector: 'node.label-hidden', style: { 'label': '' } },
    // Reveal the full label whenever a node is focused (hover/select/highlight); after
    // label-hidden, so a hovered node whose label was dropped shows it at once.
    { selector: 'node.show-label, node.focus-label', style: { 'label': 'data(label)', 'color': text, 'z-index': 19 } },
    {
      // the selection is marked by the fill and the bracket corners (graphOverlay.js), no extra ring
      selector: 'node:selected',
      style: { 'background-color': accent, 'color': accent, 'label': 'data(label)', 'font-size': fontFor(view, HUB_PX, HUB_CAP), 'z-index': 20 },
    },
    // Ask: the node behind the citation the pointer / focus is on.
    {
      selector: 'node.cite-focus',
      style: {
        'background-color': accent, 'color': accent, 'label': 'data(label)', 'font-size': fontFor(view, HUB_PX, HUB_CAP), 'z-index': 30, 'opacity': 1,
        'outline-width': 1, 'outline-style': 'solid', 'outline-color': accent, 'outline-offset': 6,
      },
    },
    // faded nodes drop their label too, so it can't run under the focused ones
    { selector: 'node.faded', style: { 'opacity': 0.2, 'label': '' } },
    {
      selector: 'edge',
      style: { 'width': 1, 'line-color': edge, 'opacity': 1, 'curve-style': 'straight' },
    },
    // Edges by relation, without adding colour: structural links (is-a, part-of)
    // are brighter, weak or inferred ones dotted, the rest plain.
    { selector: 'edge[relation_type = "subclass_of"], edge[relation_type = "part_of"], edge[relation_type = "has_part"], edge[relation_type = "narrower"]', style: { 'line-color': edgeStrong, 'opacity': 0.8 } },
    { selector: 'edge[relation_type = "co_concept"], edge[relation_type = "search_result"]', style: { 'line-style': 'dotted' } },
    { selector: 'edge.highlighted', style: { 'line-color': accent, 'line-style': 'solid', 'opacity': 0.6, 'width': 1 } },
    { selector: 'edge.faded', style: { 'opacity': 0.2 } },
    // Edges of the hovered / selected node light up so its connections read at a glance.
    { selector: 'edge.focus-edge', style: { 'line-color': accent, 'line-style': 'solid', 'opacity': 0.75, 'z-index': 10 } },
    // Legend filters hide whole types (or isolated nodes); edges go with them.
    { selector: 'node.filtered', style: { 'display': 'none' } },
    // Focus depth: nodes further than N hops from the selection.
    { selector: '.out-of-focus', style: { 'display': 'none' } },
  ]
}

// Initial layout — locks grabbing while settling so accidental drags
// during the first animation don't disturb the physics.
const COLA = {
  name: 'cola',
  animate: true,
  refresh: 2,
  fit: true,
  padding: 72,  // clears the legend, controls and the ask bar that float over the canvas
  nodeSpacing: 14,
  edgeLength: 100,
  randomize: false,
  handleDisconnected: true,
  convergenceThreshold: 0.04,
  maxSimulationTime: 1400,
  ungrabifyWhileSimulating: true,
}

// Live layout: runs while the user interacts, pauses when idle (see handleCy).
// handleDisconnected:false puts ALL nodes in one physics simulation, so
// dragging any node creates ripples across the whole graph (including small
// isolated nodes that have no direct edges to the dragged one).
// ungrabifyWhileSimulating must be false so the user can keep dragging.
const COLA_LIVE = {
  name: 'cola',
  animate: true,
  refresh: 1,
  infinite: true,
  fit: false,
  nodeSpacing: 22,
  edgeLength: 100,
  handleDisconnected: false,
  ungrabifyWhileSimulating: false,
}


function buildElements(nodes, edges) {
  // Persistent labels go to the most-connected nodes only, so a dense graph
  // isn't an unreadable wall of overlapping text (graphLabels.js then drops
  // the ones that would still cover something). Everything else reveals its
  // label on hover / selection / cluster highlight. Small graphs label all.
  const N = nodes.length
  const K = N <= 12 ? N : Math.min(28, Math.max(12, Math.round(N * 0.3)))
  const labelled = new Set(
    [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0)).slice(0, K).map((n) => n.id)
  )

  // Hubs = the three best-connected nodes. A star graph's leaves all share one
  // degree, so a degree cut-off alone would promote every leaf to a hub.
  const hubs = new Set(
    [...nodes].filter((n) => (n.degree || 0) > 0)
      .sort((a, b) => (b.degree || 0) - (a.degree || 0)).slice(0, 3).map((n) => n.id)
  )
  const els = []
  // Seed positions on a golden-angle spiral, hubs in the middle. Without
  // them every node starts at (0,0): the first fit measures zero-length
  // edges (Cytoscape warns once per edge) and cola starts from a heap.
  const order = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0)).map((n) => n.id)
  const rank = new Map(order.map((id, i) => [id, i]))
  const GOLDEN = Math.PI * (3 - Math.sqrt(5))
  for (const n of nodes) {
    const degree = n.degree || 0
    const bridge = n.bridge_score || 0
    // 9px floor: a circle and a square under that are the same speck. Shapes are
    // scaled so a diamond carries the same visual weight as a square.
    const shape = typeShape(n.type)
    const size = Math.min(26, Math.max(9, Math.min(22, 7 + degree * 60 + bridge * 14)) * (SHAPE_SCALE[shape] || 1))
    const label = shortLabel(n.name)
    const isHub = hubs.has(n.id)
    const r = rank.get(n.id) ?? 0
    els.push({
      position: { x: Math.cos(r * GOLDEN) * 18 * Math.sqrt(r + 1), y: Math.sin(r * GOLDEN) * 18 * Math.sqrt(r + 1) },
      data: {
        id: n.id, label, displayLabel: labelled.has(n.id) ? label : '',
        fullName: n.name, type: n.type, shape, hub: isHub,
        size,
        cluster_id: n.cluster_id || '0',
        source: n.source, source_url: n.source_url, description: n.description,
        degree: n.degree, bridge_score: n.bridge_score, betweenness: n.betweenness,
      },
    })
  }
  // An edge whose endpoint was filtered out server-side would make Cytoscape
  // warn and drop it anyway; skip it here.
  const ids = new Set(nodes.map((n) => n.id))
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue
    els.push({ data: { id: e.id, source: e.source, target: e.target, relation_type: e.relation_type } })
  }
  return els
}

export default function GraphCanvas({
  nodes = [], edges = [],
  selectedId, onNodeClick, onCyInit,
  fitPadding = COLA.padding, // smaller for the build-screen preview box
  overlay = true,            // ruler, registration marks, selection brackets
  clusterRanks,              // { cluster_id: 1-based place in the Clusters list }, numbers the hulls
}) {
  // Respect the user's motion preference: disable Cytoscape physics animation and
  // cy.animate() calls when prefers-reduced-motion is active (WCAG 2.3.3).
  const prefersReducedMotion = usePrefersReducedMotion()
  const reducedRef = useRef(prefersReducedMotion)
  const fitPaddingRef = useRef(fitPadding)
  reducedRef.current = prefersReducedMotion
  const cyRef = useRef(null)
  const overlayRef = useRef(null)
  const liveLayout = useRef(null)
  // Stable ref so Cytoscape event handlers always call the current prop.
  const onNodeClickRef = useRef(onNodeClick)
  useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])

  const elements = useMemo(() => buildElements(nodes, edges), [nodes, edges])
  const presetLayout = useMemo(() => ({ name: 'preset' }), [])
  const clusterRanksRef = useRef(clusterRanks)
  const ranksKey = clusterRanks ? Object.entries(clusterRanks).join('|') : '' // a new object each render, same content
  clusterRanksRef.current = clusterRanks
  const labelView = useRef({ z: 1 })
  const initialStylesheet = useMemo(() => makeStylesheet(labelView.current), [])

  const handleCy = useCallback((cy) => {
    // react-cytoscapejs calls this on every re-render, not just on mount; set
    // up layout and listeners once per instance or each tap would stack another
    // physics loop, refit the view and clear the highlighted cluster.
    if (cyRef.current === cy) return
    if (liveLayout.current) { liveLayout.current.stop(); liveLayout.current = null }
    cyRef.current = cy
    cy._highlightedCluster = null
    cy._clusterRanks = clusterRanksRef.current || null
    if (onCyInit) onCyInit(cy)
    if (overlayRef.current) {
      const detach = attachOverlay(cy, overlayRef.current)
      cy.one('destroy', detach)
    }
    // the label pass waits while the layout is moving nodes (boot layout, live physics)
    let booting = true
    cy.one('destroy', attachLabelDeclutter(cy, { paused: () => booting || !!liveLayout.current }))

    // Label size is constant on screen, so the model-space font follows the
    // zoom. Only nodes are restyled, at most once a frame and only after the zoom
    // moved by more than 5%; a trailing update settles the exact value at the end.
    let zoomFrame = 0, zoomTail = 0
    const applyZoom = () => {
      if (cy.destroyed()) return
      labelView.current.z = cy.zoom()
      cy.nodes().updateStyle()
    }
    const syncLabelSize = () => {
      if (!zoomFrame) {
        zoomFrame = requestAnimationFrame(() => {
          zoomFrame = 0
          if (cy.destroyed()) return
          if (Math.abs(cy.zoom() / labelView.current.z - 1) > 0.05) applyZoom()
        })
      }
      clearTimeout(zoomTail)
      zoomTail = setTimeout(() => { if (cy.zoom() !== labelView.current.z) applyZoom() }, 160)
    }
    cy.on('zoom', syncLabelSize)
    cy.one('destroy', () => { cancelAnimationFrame(zoomFrame); clearTimeout(zoomTail) })
    // Mona Sans is loaded on demand: draw the labels again once it is in
    try { document.fonts?.load('500 12px "Mona Sans"').then(() => { if (!cy.destroyed()) cy.nodes().updateStyle() }).catch(() => {}) } catch { /* no font API */ }

    // Phase 1: settle nodes into position (finite, fits viewport).
    // Phase 2: once settled, switch to infinite physics so nodes stay alive
    // even without user interaction. Skipped under prefers-reduced-motion.
    // Small graphs get longer edges so they fill the frame instead of clumping
    // in the middle with their labels piled on top of each other.
    const edgeLength = cy.nodes().length < 40 ? 120 : COLA.edgeLength
    const bootLayout = cy.layout({ ...COLA, padding: fitPaddingRef.current, edgeLength, animate: !reducedRef.current })
    bootLayout.one('layoutstop', () => {
      booting = false
      if (cy.destroyed()) return
      // Fit into the area the floating legend/controls/ask bar leave free
      // (zoomed to a readable level around the main hub on a phone).
      initialView(cy)
      if (reducedRef.current) return
      startLive()
      settleSoon()
    })
    bootLayout.run()

    // Live physics while someone is interacting; it pauses after a few idle
    // seconds so an open tab doesn't spin the CPU (and a phone's battery)
    // forever. Pointer activity or a drag wakes it again.
    let idleTimer = null
    function startLive() {
      if (liveLayout.current || reducedRef.current || cy.destroyed()) return
      liveLayout.current = cy.layout({ ...COLA_LIVE, edgeLength })
      liveLayout.current.run()
    }
    function settleSoon(ms = 5000) {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        if (liveLayout.current) { liveLayout.current.stop(); liveLayout.current = null }
      }, ms)
    }
    cy.on('grab', () => { clearTimeout(idleTimer); startLive() })
    cy.on('free', () => settleSoon())
    cy.on('mouseover', 'node', () => { startLive(); settleSoon() })

    // Until the user pans or zooms, keep the graph fitted to the canvas when
    // the canvas changes size (first paint before layout, rotating a phone,
    // the inspector opening). After that, the view is theirs.
    let userMoved = false
    cy.on('scrollzoom pinchzoom', () => { userMoved = true })
    cy.on('dragpan', () => { userMoved = true })
    const container = cy.container()
    if (container && typeof ResizeObserver !== 'undefined') {
      let last = { w: container.clientWidth, h: container.clientHeight }
      const ro = new ResizeObserver(() => {
        const w = container.clientWidth, h = container.clientHeight
        if (!w || !h || (Math.abs(w - last.w) < 24 && Math.abs(h - last.h) < 24)) return
        last = { w, h }
        cy.resize()
        if (!userMoved && cy.nodes().length) initialView(cy)
      })
      ro.observe(container)
      cy.one('destroy', () => { ro.disconnect(); clearTimeout(idleTimer) })
    }

    cy.on('tap', 'node', (evt) => { onNodeClickRef.current?.(evt.target.data()) })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.batch(() => cy.elements().removeClass('faded'))
        onNodeClickRef.current?.(null)
      }
    })

    cy.on('dbltap', (evt) => {
      if (evt.target === cy) cy.animate({ fit: { padding: 72 }, duration: reducedRef.current ? 0 : 400 })
    })

    // Hover → fade non-neighbours. Debounced 40 ms so fast mouse movement
    // doesn't fire a cascade of batch style recalculations.
    let hoverTimer = null
    cy.on('mouseover', 'node', (evt) => {
      if (cy._highlightedCluster) return
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => {
        const node = evt.target
        const keep = node.closedNeighborhood()
        // Reveal labels for the hovered node and at most its 8 best-connected
        // neighbours; a hub with 30 neighbours otherwise becomes a wall of text.
        const top = node.neighborhood().nodes().sort((a, b) => (b.data('degree') || 0) - (a.data('degree') || 0)).slice(0, 8)
        cy.batch(() => {
          cy.elements().difference(keep).addClass('faded')
          node.addClass('show-label')
          top.addClass('show-label')
          node.connectedEdges().addClass('focus-edge')
        })
      }, 40)
    })
    cy.on('mouseout', 'node', () => {
      if (cy._highlightedCluster) return
      clearTimeout(hoverTimer)
      cy.batch(() => {
        cy.elements().removeClass('faded')
        cy.nodes().removeClass('show-label')
        cy.edges().removeClass('focus-edge')
        // keep the selected node's edges lit after the pointer leaves
        cy.nodes(':selected').connectedEdges().addClass('focus-edge')
      })
    })
  }, [onCyInit])

  // Hull numbers follow the Clusters list: same order, same "01"
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy._clusterRanks = clusterRanksRef.current || null
    cy.emit('render')
  }, [ranksKey])

  // Stop live layout if the component unmounts while a node is being dragged.
  useEffect(() => () => { if (liveLayout.current) liveLayout.current.stop() }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes().unselect()
      cy.edges().removeClass('focus-edge')
      if (selectedId) cy.getElementById(selectedId).select().connectedEdges().addClass('focus-edge')
    })
  }, [selectedId])

  const nodeCount = nodes.length
  const edgeCount = edges.length

  return (
    // role="img" gives the canvas an accessible name and announces it as a graphic.
    // Full keyboard node-navigation (roving tabindex within Cytoscape) is a planned
    // follow-up; until then, the Clusters and Entity panels offer equivalent data.
    <div
      role="img"
      aria-label={`Knowledge graph: ${nodeCount} nodes, ${edgeCount} connections. Use the Clusters tab or click a node to inspect entities.`}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {/* Before the Cytoscape mount so its ref exists when the cy callback runs */}
      {overlay && <canvas ref={overlayRef} className="graph-overlay" aria-hidden="true" />}
      <p className="sr-only">
        This is an interactive force-directed graph showing {nodeCount} entities and {edgeCount} relationships.
        Use the Clusters tab in the sidebar to explore groups of related nodes, or the Ask the map bar to query the graph.
      </p>
      <CytoscapeComponent
        elements={elements}
        stylesheet={initialStylesheet}
        layout={presetLayout}
        cy={handleCy}
        className="cytoscape-container"
        style={{ width: '100%', height: '100%' }}
        minZoom={0.2}
        maxZoom={2.5}
        boxSelectionEnabled={false}
      />
    </div>
  )
}
