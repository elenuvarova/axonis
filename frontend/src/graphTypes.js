// Single source of truth for entity-type shapes and labels, shared by the
// graph canvas (node shape), the entity card (type tag) and the graph legend.
// B² encodes type by SHAPE, not colour: every node is the text colour.
// Keep in sync with backend entity `type` values in models.py.

export const TYPE_SHAPE = {
  concept:      'ellipse',
  paper:        'diamond',
  organisation: 'rectangle',
  institution:  'rectangle',
  regulation:   'rectangle',
  product:      'triangle',
  person:       'ellipse',
  dataset:      'diamond',
}

// Legend / tag glyphs matching the Cytoscape shapes (all exist in Martian Mono).
export const SHAPE_GLYPH = {
  ellipse:   '●',
  diamond:   '◆',
  rectangle: '■',
  triangle:  '▲',
}

export const TYPE_LABEL = {
  concept:      'Concept',
  organisation: 'Org',
  institution:  'Institution',
  paper:        'Paper',
  regulation:   'Regulation',
  product:      'Product',
  person:       'Person',
  dataset:      'Dataset',
}

// Stable display order for the legend (most common types first).
export const TYPE_ORDER = [
  'concept', 'paper', 'institution', 'organisation',
  'regulation', 'product', 'person', 'dataset',
]

export function typeShape(type) {
  return TYPE_SHAPE[type] || 'ellipse'
}

export function typeGlyph(type) {
  return SHAPE_GLYPH[typeShape(type)]
}

export function typeLabel(type) {
  return TYPE_LABEL[type] || (type ? type[0].toUpperCase() + type.slice(1) : 'Other')
}
