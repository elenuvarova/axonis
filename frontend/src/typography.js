// Typographic binding for every piece of text the app shows, static or
// generated (opportunity cards, Ask answers, the brief):
//  - short words (articles, 1-2 letter words, a few function words) are
//    tied to the next word with a no-break space, so no line ends on "a",
//    "of", "to", "the"…;
//  - a number is tied to the word after it ("58 nodes");
//  - a dash never starts a line: the space before — and – is no-break.
// Applied to text nodes as they appear, so new copy and model output are
// covered without anyone remembering to do it. Inputs, code and the graph
// canvas are left alone.
const NBSP = ' '
const FUNCTION_WORDS = 'the|and|for|but|nor|via|per|its|our|not|with|from|into|onto|than'
const SHORT = new RegExp(`(^|[\\s\\u00A0(\\[“‘"'«/])((?:[A-Za-z]{1,2}|${FUNCTION_WORDS})) (?=\\S)`, 'gi')
const NUMBER = /(\d) (?=[A-Za-z%])/g
const DASH = / ([—–]) /g
const SKIP = 'input, textarea, select, code, pre, kbd, script, style, svg, canvas, [contenteditable], [data-no-typo]'

export function bind(text) {
  if (!text || text.length < 3) return text
  let t = text.replace(DASH, `${NBSP}$1 `).replace(NUMBER, `$1${NBSP}`)
  // twice, so runs like "a map of the domain" bind each short word
  t = t.replace(SHORT, `$1$2${NBSP}`).replace(SHORT, `$1$2${NBSP}`)
  return t
}

function fixNode(node) {
  const parent = node.parentElement
  if (!parent || parent.closest(SKIP)) return
  const next = bind(node.nodeValue)
  if (next !== node.nodeValue) node.nodeValue = next
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) { fixNode(root); return }
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest?.(SKIP)) return
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = it.nextNode(); n; n = it.nextNode()) fixNode(n)
}

export function startTypography(root = document.getElementById('root')) {
  if (!root || typeof MutationObserver === 'undefined') return () => {}
  walk(root)
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') fixNode(r.target)
      else r.addedNodes.forEach(walk)
    }
  })
  obs.observe(root, { childList: true, subtree: true, characterData: true })
  return () => obs.disconnect()
}
