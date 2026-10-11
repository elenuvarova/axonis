import { useEffect, useMemo, useRef, useState } from 'react'
import { typeGlyph, typeLabel } from '../graphTypes'
import { pad } from '../format'

// List view of the graph: the same nodes as a sortable table, for keyboard and
// screen-reader users (and anyone who wants to scan rather than look). Each
// name is a button that selects the node, so the inspector works as on the map.
const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'links', label: 'Links', numeric: true },
  { key: 'degree', label: 'Degree', numeric: true },
  { key: 'bridge_score', label: 'Bridge', numeric: true },
]

export default function NodeList({ nodes = [], edges = [], selectedId, onSelect }) {
  const [sort, setSort] = useState({ key: 'links', dir: 'desc' })
  const [q, setQ] = useState('')
  // Switching to the list moves focus into it, so Tab continues through the
  // table instead of jumping back to the top of the page.
  const filterRef = useRef(null)
  useEffect(() => { filterRef.current?.focus() }, [])

  const links = useMemo(() => {
    const m = {}
    for (const e of edges) { m[e.source] = (m[e.source] || 0) + 1; m[e.target] = (m[e.target] || 0) + 1 }
    return m
  }, [edges])

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = nodes
      .filter((n) => !query || (n.name || '').toLowerCase().includes(query))
      .map((n) => ({ ...n, links: links[n.id] || 0 }))
    const col = COLUMNS.find((c) => c.key === sort.key)
    list.sort((a, b) => {
      const av = a[sort.key] ?? (col.numeric ? 0 : ''), bv = b[sort.key] ?? (col.numeric ? 0 : '')
      const r = col.numeric ? av - bv : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? r : -r
    })
    return list
  }, [nodes, links, sort, q])

  const toggleSort = (key) => setSort((s) => s.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: COLUMNS.find((c) => c.key === key).numeric ? 'desc' : 'asc' })

  return (
    <div className="node-list">
      <div className="node-list-head">
        <label className="label" htmlFor="node-list-filter">List · {pad(rows.length, 3)} of {pad(nodes.length, 3)} nodes</label>
        <input
          id="node-list-filter"
          ref={filterRef}
          className="node-list-filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter by name"
          spellCheck={false}
        />
      </div>
      <div className="node-list-scroll">
        <table className="node-table">
          <caption className="sr-only">Graph nodes. Sorted by {sort.key} {sort.dir === 'asc' ? 'ascending' : 'descending'}. Choose a name to open it in the inspector.</caption>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={c.numeric ? 'is-num' : ''}
                  aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="node-sort" onClick={() => toggleSort(c.key)}>
                    {c.label}
                    <span aria-hidden="true" className="node-sort-mark">{sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className={n.id === selectedId ? 'is-selected' : ''} aria-current={n.id === selectedId ? 'true' : undefined}>
                <td>
                  <button type="button" className="node-name" onClick={() => onSelect(n)} title={n.name}>{n.name}</button>
                </td>
                <td className="node-type"><span aria-hidden="true">{typeGlyph(n.type)} </span>{typeLabel(n.type)}</td>
                <td className="is-num">{pad(n.links, 3)}</td>
                <td className="is-num">{(n.degree || 0).toFixed(3)}</td>
                <td className="is-num">{(n.bridge_score || 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="node-list-empty">No node name contains “{q}”.</p>}
      </div>
    </div>
  )
}
