import { useEffect, useMemo, useRef, useCallback } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import Cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import { typeShape } from '../graphTypes'
import { shortLabel } from '../format'
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
function makeStylesheet() {
  const text    = cssVar('--text', '#EDEDED')
  const text2   = cssVar('--text-2', '#8A8A8A')
  const bg      = cssVar('--bg', '#0E0E0E')
  const edge    = cssVar('--line-strong', '#3A3A3A')
  const accent  = cssVar('--accent', '#FF2BD6')
  const mono    = '"Martian Mono", ui-monospace, monospace'

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
        'font-family': mono,
        'font-size': 11,
        // Below ~9px on screen a label is noise, not information: hide it
        // until the user zooms in (hover and selection still reveal it).
        'min-zoomed-font-size': 9,
        'color': text2,
        'text-valign': 'center',
        'text-halign': 'right',
        'text-margin-x': 6,
        // Label plate: a bg-coloured block behind the text so crossing edges
        // and neighbouring labels never run through the letters.
        'text-background-color': bg,
        'text-background-opacity': 0.88,
        'text-background-padding': 2,
        'text-background-shape': 'rectangle',
        'border-width': 0,
        'overlay-padding': 8,
        'overlay-opacity': 0,
        'transition-property': 'opacity, background-color',
        'transition-duration': '0.15s',
      },
    },
    // Hubs read larger and in the full text colour.
    { selector: 'node[?hub]', style: { 'font-size': 13, 'color': text } },
    // Reveal the full label whenever a node is focused (hover/select/highlight).
    { selector: 'node.show-label, node.focus-label', style: { 'label': 'data(label)', 'color': text, 'z-index': 19 } },
    {
      selector: 'node:selected',
      style: {
        'background-color': accent, 'color': accent, 'label': 'data(label)', 'font-size': 13, 'z-index': 20,
        'outline-width': 1, 'outline-style': 'dashed', 'outline-color': accent, 'outline-offset': 6,
      },
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 1.5, 'border-color': accent, 'color': accent, 'label': 'data(label)', 'z-index': 18,
        'outline-width': 1, 'outline-style': 'solid', 'outline-color': accent, 'outline-offset': 5,
      },
    },
    // faded nodes drop their label too, so it can't run under the focused ones
    // Ask: the node behind the citation the pointer / focus is on.
    {
      selector: 'node.cite-focus',
      style: {
        'background-color': accent, 'color': accent, 'label': 'data(label)', 'font-size': 13, 'z-index': 30, 'opacity': 1,
        'outline-width': 1, 'outline-style': 'solid', 'outline-color': accent, 'outline-offset': 6,
      },
    },
    { selector: 'node.faded', style: { 'opacity': 0.2, 'label': '' } },
    {
      selector: 'edge',
      style: { 'width': 1, 'line-color': edge, 'opacity': 1, 'curve-style': 'straight' },
    },
    { selector: 'edge.highlighted', style: { 'line-color': accent, 'opacity': 1, 'width': 1 } },
    { selector: 'edge.faded', style: { 'opacity': 0.2 } },
    // Edges of the hovered / selected node light up so its connections read at a glance.
    { selector: 'edge.focus-edge', style: { 'line-color': accent, 'z-index': 10 } },
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
  // isn't an unreadable wall of overlapping text. Everything else reveals its
  // label on hover / selection / cluster highlight. Small graphs label all.
  const N = nodes.length
  const K = N <= 12 ? N : Math.min(20, Math.max(10, Math.round(N * 0.2)))
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
  for (const n of nodes) {
    const degree = n.degree || 0
    const bridge = n.bridge_score || 0
    const size = Math.max(7, Math.min(22, 7 + degree * 60 + bridge * 14))
    const label = shortLabel(n.name)
    const isHub = hubs.has(n.id)
    els.push({
      data: {
        id: n.id, label, displayLabel: labelled.has(n.id) ? label : '',
        fullName: n.name, type: n.type, shape: typeShape(n.type), hub: isHub,
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
}) {
  // Respect the user's motion preference: disable Cytoscape physics animation and
  // cy.animate() calls when prefers-reduced-motion is active (WCAG 2.3.3).
  const prefersReducedMotion = usePrefersReducedMotion()
  const reducedRef = useRef(prefersReducedMotion)
  const fitPaddingRef = useRef(fitPadding)
  reducedRef.current = prefersReducedMotion
  const cyRef = useRef(null)
  const liveLayout = useRef(null)
  // Stable ref so Cytoscape event handlers always call the current prop.
  const onNodeClickRef = useRef(onNodeClick)
  useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])

  const elements = useMemo(() => buildElements(nodes, edges), [nodes, edges])
  const presetLayout = useMemo(() => ({ name: 'preset' }), [])
  const initialStylesheet = useMemo(() => makeStylesheet(), [])

  const handleCy = useCallback((cy) => {
    // react-cytoscapejs calls this on every re-render, not just on mount; set
    // up layout and listeners once per instance or each tap would stack another
    // physics loop, refit the view and clear the highlighted cluster.
    if (cyRef.current === cy) return
    if (liveLayout.current) { liveLayout.current.stop(); liveLayout.current = null }
    cyRef.current = cy
    cy._highlightedCluster = null
    if (onCyInit) onCyInit(cy)

    // Phase 1: settle nodes into position (finite, fits viewport).
    // Phase 2: once settled, switch to infinite physics so nodes stay alive
    // even without user interaction. Skipped under prefers-reduced-motion.
    // Small graphs get longer edges so they fill the frame instead of clumping
    // in the middle with their labels piled on top of each other.
    const edgeLength = cy.nodes().length < 40 ? 120 : COLA.edgeLength
    const bootLayout = cy.layout({ ...COLA, padding: fitPaddingRef.current, edgeLength, animate: !reducedRef.current })
    bootLayout.one('layoutstop', () => {
      if (cy.destroyed()) return
      // Keep labels at a readable size: a small graph should not be fitted to a huge zoom.
      if (cy.zoom() > 1.1) { cy.zoom(1.1); cy.center() }
      // On a phone a fitted graph is a speck; start at a zoom where labels read (~9px), centred on the biggest hub.
      if (cy.width() < 600 && cy.zoom() < 0.85 && cy.nodes().length) {
        const hub = cy.nodes().max((n) => n.data('size')).ele
        cy.zoom({ level: 0.85, position: hub.position() })
        cy.center(hub)
      }
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
        if (!userMoved && cy.nodes().length) cy.fit(undefined, fitPaddingRef.current)
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
      style={{ width: '100%', height: '100%' }}
    >
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
