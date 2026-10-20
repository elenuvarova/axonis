// Typographic binding for every piece of text the app shows, static or
// generated (opportunity cards, Ask answers, the brief):
//  - short words (articles, 1-2 letter words, a few function words) are
//    tied to the next word with a no-break space, so no line ends on "a",
//    "of", "to", "the"…;
//  - a number is tied to the word after it ("58 nodes");
//  - a dash or a middle dot never starts a line: the space before it is no-break;
//  - the same number + word tie holds when React split them into two text
//    nodes ("{n} nodes" renders as "8" and " nodes"): see tieAcross.
// Applied to text nodes as they appear, so new copy and model output are
// covered without anyone remembering to do it. Inputs, code and the graph
// canvas are left alone.
const NBSP = ' '
const FUNCTION_WORDS = 'the|and|for|but|nor|via|per|its|our|not|with|from|into|onto|than'
const SHORT = new RegExp(`(^|[\\s\\u00A0(\\[“‘"'«/])((?:[A-Za-z]{1,2}|${FUNCTION_WORDS})) (?=\\S)`, 'gi')
const NUMBER = /(\d) (?=[A-Za-z%])/g
const DASH = / ([—–·]) /g
const SKIP = 'input, textarea, select, code, pre, kbd, script, style, svg, canvas, [contenteditable], [data-no-typo]'

export function bind(text) {
  if (!text || text.length < 3) return text
  let t = text.replace(DASH, `${NBSP}$1 `).replace(NUMBER, `$1${NBSP}`)
  // twice, so runs like "a map of the domain" bind each short word
  t = t.replace(SHORT, `$1$2${NBSP}`).replace(SHORT, `$1$2${NBSP}`)
  return t
}

// A text node that opens with " word" after a number in the previous sibling,
// or closes with "number " before a word in the next one, gets a no-break space
// at that seam. prev / next are the neighbours' text (or null).
export function tieAcross(text, prev, next) {
  let t = text
  if (prev && /\d$/.test(prev) && /^ [A-Za-z%]/.test(t)) t = NBSP + t.slice(1)
  if (next && /^[A-Za-z%]/.test(next) && /\d $/.test(t)) t = t.slice(0, -1) + NBSP
  return t
}

// Neighbour text only counts when it sits right next to the node (text, a phrasing
// tag, or the Ticker's number), not a block of its own. Decided by tag and class:
// asking getComputedStyle for each sibling forces layout inside the observer,
// which hurts on long lists.
const PHRASING = new Set(['A', 'ABBR', 'B', 'EM', 'I', 'MARK', 'SMALL', 'STRONG', 'SUB', 'SUP', 'TIME'])
function seam(sibling) {
  if (!sibling) return null
  if (sibling.nodeType === Node.TEXT_NODE) return sibling.nodeValue
  if (sibling.nodeType === Node.ELEMENT_NODE && (PHRASING.has(sibling.tagName) || sibling.classList.contains('ticker'))) return sibling.textContent
  return null
}

function fixNode(node) {
  const parent = node.parentElement
  if (!parent || parent.closest(SKIP)) return
  const next = tieAcross(bind(node.nodeValue), seam(node.previousSibling), seam(node.nextSibling))
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
