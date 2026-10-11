import { useEffect, useMemo, useRef, useCallback } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import Cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import { typeShape } from '../graphTypes'
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
        'min-zoomed-font-size': 6,
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
    { selector: 'node.show-label', style: { 'label': 'data(label)', 'color': text, 'z-index': 19 } },
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
    { selector: 'node.faded', style: { 'opacity': 0.2 } },
    {
      selector: 'edge',
      style: { 'width': 1, 'line-color': edge, 'opacity': 1, 'curve-style': 'straight' },
    },
    { selector: 'edge.highlighted', style: { 'line-color': accent, 'opacity': 1, 'width': 1 } },
    { selector: 'edge.faded', style: { 'opacity': 0.2 } },
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

// Live layout started on grab — runs until the node is released.
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
    const label = n.name.length > 24 ? n.name.slice(0, 22) + '…' : n.name
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
  for (const e of edges) {
    els.push({ data: { id: e.id, source: e.source, target: e.target, relation_type: e.relation_type } })
  }
  return els
}

export default function GraphCanvas({
  nodes = [], edges = [],
  selectedId, onNodeClick, onCyInit,
}) {
  // Respect the user's motion preference: disable Cytoscape physics animation and
  // cy.animate() calls when prefers-reduced-motion is active (WCAG 2.3.3).
  const prefersReducedMotion = usePrefersReducedMotion()
  const reducedRef = useRef(prefersReducedMotion)
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
    const bootLayout = cy.layout({ ...COLA, edgeLength, animate: !reducedRef.current })
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
      liveLayout.current = cy.layout({ ...COLA_LIVE, edgeLength })
      liveLayout.current.run()
    })
    bootLayout.run()

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
        const keep = evt.target.closedNeighborhood()
        cy.batch(() => {
          cy.elements().difference(keep).addClass('faded')
          // Reveal labels for the hovered node and its neighbours.
          keep.nodes().addClass('show-label')
        })
      }, 40)
    })
    cy.on('mouseout', 'node', () => {
      if (cy._highlightedCluster) return
      clearTimeout(hoverTimer)
      cy.batch(() => {
        cy.elements().removeClass('faded')
        cy.nodes().removeClass('show-label')
      })
    })
    // No grab/free handlers needed — COLA_LIVE runs continuously after boot.
  }, [onCyInit])

  // Stop live layout if the component unmounts while a node is being dragged.
  useEffect(() => () => { if (liveLayout.current) liveLayout.current.stop() }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes().unselect()
      if (selectedId) cy.getElementById(selectedId).select()
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
