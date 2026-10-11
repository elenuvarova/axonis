# KGE redesign: UI and motion sources for "text as matter"

Researched 10 Oct 2026 with WebFetch, WebSearch and the Motion docs MCP. Each item says whether I saw it directly or only in search results. Component names are only ones I saw on a page or in a tool result.

## 0. Constraints from the current codebase (read first)

`frontend/package.json` today has React 18.3, Vite 5, Cytoscape 3.30 with cytoscape-cola and react-cytoscapejs, React Query and React Router. It has **no Tailwind, no TypeScript and no animation library**.

- **Tailwind dependency.** shadcn/ui, Aceternity, Magic UI, Kokonut UI, Motion Primitives and Bklit all ship as Tailwind-styled components through the shadcn registry. Adopting any of them means first adding Tailwind and the shadcn `components.json`. Plain JSX works; TypeScript is optional.
  - **Alternative:** copy a component's logic and restyle it in the existing `styles.css` and `theme.js` tokens. For a strictly monochrome system with few components, this is often cleaner.
- **CSP.** The site already sends a CSP (Umami commit e028960).
  - troika-three-text builds fonts in a Web Worker created from a blob. It needs `worker-src blob:`, or `configureTextBuilder({useWorker:false})`.
  - Self-hosted fonts are needed for canvas and WebGL text. Do not rely on a font CDN.
- **Reduced motion.** Every "text as matter" effect below needs a static fallback, because WCAG 2.2 SC 2.3.3 and 2.2.2 apply:
  - Hero spheres and tunnels need a pause control.
  - Scramble and decode effects can be a screen-reader trap. Put the real string in `aria-label` and mark the scrambling glyphs `aria-hidden`.
  - Tools: Motion has `useReducedMotion` and `<MotionConfig reducedMotion="user">`. anime.js `splitText` has an `accessible` option.

---

## 1. Motion libraries (the engine layer)

### anime.js v4 — https://animejs.com/
- **What it is:** a modular JS animation engine with Timer, Animation, Timeline, Animatable, Draggable, Scope, Scroll (onScroll observer), SVG, Stagger, Spring, Utils, Easings and WAAPI modules.
- **Licence and cost:** the site says "100% free" and sponsor-funded. The homepage names no licence, but the GitHub repo is MIT (checked against https://github.com/juliangarnier/anime per the site's pointer; confirm the LICENSE file before shipping).
- **React:** framework-agnostic. Use it inside `useEffect` and `useRef`, with `createScope` for cleanup.
- **Specific techniques that fit KGE:**
  1. **`splitText`** (lines, words, chars; options `accessible`, `includeSpaces`; methods `addEffect()`, `revert()`, `refresh()`). Docs: https://animejs.com/documentation/text. Use it for the hero headline and the reveal of section titles in the Research Brief.
  2. **`scrambleText`** (params include `chars`, `cursor`, `revealRate`, `settleDuration`, `perturbation`, `from`, `seed`). Same docs page.
     - Node-label decode when a node is selected.
     - Opportunity scores settling.
     - Build-progress stage names.
     - This is the free alternative to Motion+'s paid ScrambleText.
  3. **SVG `createDrawable` (line drawing) and `morphTo` (shape morph).** Docs: https://animejs.com/documentation/svg.
     - Edges drawing in on the build-progress screen.
     - The ® / logo mark morphing in the hero.
     - Motion paths, for words travelling along a curve.
  4. **Grid stagger on a timeline.** https://animejs.com/documentation/timeline. Use it for an ASCII/dot-matrix loader: cells flip from the centre outward.
  5. **onScroll observer.** https://animejs.com/documentation/events/onscroll. Use it for scroll-linked kinetic type on the landing page.
- **Community demos:** https://codepen.io/collection/Poerqa

### Motion (motion.dev, formerly Framer Motion) — https://motion.dev/
- **Licence and cost:**
  - The core is MIT and free.
  - **Motion+** is a paid one-time purchase (Solo) or an annual per-seat Team plan. It includes Motion UI components and sections, 490+ premium examples, the AI Kit and the Motion+ MCP. The site did not show a price.
- **React:** first-class (`motion/react`). It is the natural React-state animation layer for KGE.
- **Free APIs that fit KGE:**
  1. **Layout animation and `layoutId` shared elements.** https://motion.dev/docs/react-layout-animations. Free example: "AnimateView: App Store", https://examples.motion.dev/react/animate-view-app-store.
     - An Opportunity card expands into a detail view.
     - A node label in the graph morphs into the heading of the node-detail panel.
  2. **`AnimatePresence` exit animations.** Use them for tab switches (Graph, Clusters, Opportunities, Ask) and for opening and closing the brief modal.
  3. **Path drawing** (free example "Path drawing", https://examples.motion.dev/react/path-drawing) and **useTransform path drawing** (https://examples.motion.dev/react/use-transform). Use them for edge-draw on build progress and sparkline drawing in opportunity cards.
  4. **`useReducedMotion` and `MotionConfig`**, for global reduced-motion handling.
- **Paid (Motion+) items I saw in the MCP results.** Metadata only; I did not see the source.
  - `ScrambleText` (`motion-plus/react`). Demos: https://examples.motion.dev/react/scramble-text, …/scramble-text-hover, …/scramble-text-stagger-center.
  - "Scatter text" with `splitText`: https://examples.motion.dev/react/split-text-scatter
  - "Scroll Text Lines" with `Ticker`: https://examples.motion.dev/react/scroll-text-lines. Editorial horizontal type bands; good for the hero.
  - `Typewriter`: about 1.3 kb, has screen-reader support. A candidate for **Ask answer streaming**.
  - `AnimateNumber`: https://examples.motion.dev/react/number-counter. Use it for node and edge counts during the build and for opportunity scores.
  - Motion UI "Scramble reveal": https://motion.dev/ui/components/scramble-reveal
  - Motion UI "Stats: Live engagement panel": https://motion.dev/ui/sections/react-stats-live-panel. Ticking counter plus a path-drawn sparkline; a good model for the build-progress telemetry.
- **Recommendation:** use Motion (free) for React state transitions and anime.js (free) for text splitting and scrambling, SVG and grid staggers. Buy Motion+ only if `Typewriter` and `AnimateNumber` are worth it. anime.js `scrambleText` plus a small streaming component covers most of the same ground.

---

## 2. Component registries (Tailwind + shadcn)

### shadcn/ui — https://ui.shadcn.com/ (MIT, free; Vite install guide at /docs/installation/vite)
- **What it is:** an accessible headless base layer. The current docs list each component under `/docs/components/base/<name>`, built on Base UI.
- **What to adopt, and where it goes in KGE:**

| Primitive | URL | KGE surface |
|---|---|---|
| **Command** | /docs/components/base/command | ⌘K palette: jump to a node, run "Ask", switch tab, open brief. Strong fit for the mono/terminal look |
| **Sheet** | /docs/components/base/sheet | Node-detail side panel (replaces a custom drawer) |
| **Tabs** | /docs/components/base/tabs | Graph, Clusters, Opportunities, Ask, Upload |
| **Dialog** | /docs/components/base/dialog | Research Brief modal, Upload |
| **Tooltip** / **Hover Card** | /docs/components/base/tooltip, /hover-card | Node hover preview, score explanations |
| **Resizable** | /docs/components/base/resizable | Split view: graph and detail/Ask panel |
| **Chart** | /docs/components/base/chart | Score breakdowns in opportunity cards. The page didn't confirm the underlying library; historically it is Recharts |
| **Empty**, **Skeleton**, **Spinner**, **Progress** | /docs/components/base/empty etc. | Empty states, loading states |
| **Message**, **Message Scroller**, **Bubble** | /docs/components/base/message, /message-scroller | Ask Q&A thread (these are new chat primitives) |
| **Kbd** | /docs/components/base/kbd | Keyboard hints in the tour and the command palette |

### Aceternity UI — https://ui.aceternity.com/components
- **Licence and cost:** the components are labelled "Free, copy-paste". Blocks and templates are "All-Access", a one-time payment. The licence terms are at /licence, which I did not fetch.
- **React:** yes. Tailwind, Motion, shadcn CLI (`npx shadcn@latest add @aceternity/<name>`).
- **Picks I saw:**
  1. **ASCII Art** — https://ui.aceternity.com/components/ascii-art. Image to ASCII.
     - Props include `charset` (presets "standard", "blocks", "binary", "dots", "braille"…), `animationStyle` "fade" | "typewriter" | "matrix", `animateOnView`, `inverted`.
     - Use it for **empty states** and **hero imagery**, e.g. a domain illustration rendered in mono glyphs.
  2. **Encrypted Text** — https://ui.aceternity.com/components/encrypted-text.
     - Scrambled glyphs resolve character by character (`revealDelayMs`, `flipDelayMs`, `charset`, separate classes for encrypted and revealed text).
     - Use it for **node-detail titles** and **Ask answer headings**.
  3. **Multi Step Loader** — https://ui.aceternity.com/components/multi-step-loader. Takes `loadingStates[]`, `duration` and `loop`.
     - A ready skeleton for the **build-progress screen**: Wikidata, then OpenAlex, then clustering, then scoring.
     - Feed it real backend stages, not timed ones.
  4. **Terminal** (/components/terminal), **Canvas Text** (/components/canvas-text), **Text Generate Effect** (/components/text-generate-effect), **Placeholders And Vanish Input** (/components/placeholders-and-vanish-input), **Dither Shader** (/components/dither-shader), **Grid and Dot Backgrounds** (/components/grid-and-dot-backgrounds).
     - Placeholders And Vanish Input fits the **topic input on the landing page**.
     - Text Generate Effect fits **Ask streaming**.
  5. **Labs → SVG Path Morphing** (/labs/svg-path-morphing). Use it for the ® mark morph.

### Magic UI — https://magicui.design/docs/components (open source; GitHub magicuidesign/magicui; licence not stated on the page, the repo is MIT as far as I know, so check it)
- **Picks I saw:**
  1. **Glyph Matrix** — /docs/components/glyph-matrix. A canvas grid of mutating glyphs.
     - Props: `glyphs` (default `"01·•+*/\<>="`), `cellSize`, `mutationRate`, `interval`, `fadeBottom`, `color`.
     - The best off-the-shelf **ASCII/dot-matrix background** for the hero and the build-progress screen. Set `mutationRate` to 0 under reduced motion.
  2. **Hyper Text** (/docs/components/hyper-text), **Morphing Text** (/docs/components/morphing-text), **Spinning Text** (/docs/components/spinning-text, text on a circle), **Text Animate** (/docs/components/text-animate), **Typing Animation** (/docs/components/typing-animation).
     - Spinning Text gives an **orbit label around the selected node** or a circular badge on the landing page.
  3. **Kinetic Text** — /docs/components/kinetic-text. Animates the font weight of characters on hover, so it needs a variable font. Use it for hero headlines.
  4. **Number Ticker** (/docs/components/number-ticker). Use it for build counters and opportunity scores. This is the free alternative to Motion+ AnimateNumber.
  5. **Animated Beam** (/docs/components/animated-beam), **Dot Pattern** (/docs/components/dot-pattern), **Flickering Grid** (/docs/components/flickering-grid), **Terminal** (/docs/components/terminal), **Icon Cloud** (/docs/components/icon-cloud, a sphere of icons whose technique adapts to a word sphere), **Globe** (/docs/components/globe).
     - Animated Beam fits the "sources → graph" diagram on the landing page.
     - Terminal fits the build log.

### Motion Primitives — https://motion-primitives.com/docs (open source; licence not named on the page; Pro tier at pro.motion-primitives.com, contents unseen)
- **Text effects:** Text Effect, Text Loop, Text Morph, Text Roll, **Text Scramble** (/docs/text-scramble), Text Shimmer, **Text Shimmer Wave** (/docs/text-shimmer-wave).
  - Text Shimmer and Text Shimmer Wave work as a monochrome "thinking…" indicator for **Ask**.
- **Other picks:**
  - **Morphing Dialog** (/docs/morphing-dialog): an opportunity card morphs into a dialog.
  - **Transition Panel** (/docs/transition-panel): tab content.
  - **Animated Number** and **Sliding Number**: scores.
  - **Spinning Text** (/docs/spinning-text).
  - **Progressive Blur** (/docs/progressive-blur): fades the graph edges under overlays.
  - **In View** (/docs/in-view).

### Kokonut UI — https://kokonutui.com/ (MIT per the GitHub README; Kokonut UI Pro is paid)
- **What it is:** 100+ components; React, Tailwind, Motion, shadcn CLI (`npx shadcn@latest add @kokonutui/<name>`).
- **What I saw:** the homepage and the docs index named only **particle-button**, **liquid-glass-card**, **shimmer-text** and **ai-prompt**. The full catalogue didn't render to the fetcher.
- **Fit:**
  - **ai-prompt** is a candidate for the **Ask input**.
  - **shimmer-text** works for loading states.
  - Liquid glass is off-direction for a flat monochrome system. Skip it.

### Bklit UI — https://bklit.com/ (chart registry is MIT; Bklit Studio is proprietary)
- **What it is:** a design-engineered data-viz registry. React, visx, motion, shadcn registry, Base UI. Install with `npx shadcn@latest add @bklit/<chart>`.
- **Picks that fit the editorial data-viz direction:**
  - **Sankey Chart** (/docs/components/sankey-chart): source → concept → opportunity flow in the brief.
  - **Sunburst Chart** (/docs/components/sunburst-chart): cluster hierarchy in the Clusters tab.
  - **Radar Chart** (/docs/components/radar-chart): opportunity score dimensions on the cards.
  - **Live Line Chart** (/docs/components/live-line-chart): build-progress throughput.
  - **Heatmap Chart** (/docs/components/heatmap-chart): papers per year × cluster.
  - Utilities: Tooltip, Legend, Brush.
- **Caveat:** no network graph or bubble-pack chart is listed.

---

## 3. Inspiration and snippet catalogues

### Uiverse — https://uiverse.io/
- **Not fetched:** HTTP 403 on both the homepage and /loaders, and search returned no uiverse pages.
- I know it as an MIT-licensed community gallery of HTML/CSS and Tailwind snippets, but I did not see it today. Treat it as unverified.

### CodePen trending — https://codepen.io/trending
- **Not fetched:** HTTP 403. The pens below came through freefrontend.com, codemyui.com and search instead.

### FreeFrontend — https://freefrontend.com/ (curated links to CodePen and Codrops; licence is per author, so check each pen)
- **Text on path, circle or spiral:**
  - **Text on Spiral Path**: https://codepen.io/anon/pen/ByoNYrZ
  - **Seamless SVG Text on Path Animation**: https://codepen.io/ccrch/pen/qEddXma
  - Codrops **Circular SVG Text Animation**: https://tympanus.net/codrops/2021/03/03/circular-svg-text-animation/
  - **CSS Scroll-Driven Circular Typographic Scramble**: https://codepen.io/anon/pen/NPrrpzJ
  - **Text In A Circle**: https://codepen.io/anon/pen/BEKWPx
  - Fit: the hero, and orbiting labels around the selected node.
- **Scramble and decode:**
  - **Text Decoder Animation**: https://codepen.io/anon/pen/RNWRbgq
  - **Hacker Text Scramble Glitch Effect**: https://codepen.io/dspstudio/pen/OPJZMKX
  - **Scroll Driven Text Unscramble in CSS** (freefrontend item dated 2026-07-23)
- **Particles from text:**
  - **Interactive Particles Text** (three.js): https://codepen.io/sanprieto/pen/XWNjBdb
  - **Interactive WebGL Liquid Particle Typography**: https://codepen.io/anon/pen/mdzqQKW
  - **Three.js Particle Morphing Animation**: https://codepen.io/anon/pen/XJmjZEN
  - **Interactive Particle Morphing with Three.js & GLSL**: https://codepen.io/VoXelo/pen/VYLJYBz
- **3D text depth:**
  - **Cyberspace Text** (Z-axis starfield of type): https://codepen.io/anon/pen/wLxObg
  - **Text Slicer Gradient**: https://codepen.io/anon/pen/boyOYm
- **Kinetic and variable type:**
  - **Kinetic Typography Experiment GSAP**: https://codepen.io/filipz/pen/QwwQYRE
  - **Variable Font Animation**: https://codepen.io/tannerdolby/pen/zYrRrVq
- **Dot matrix (closest match):** **Reveal Hidden Text Effect** (a canvas grid of circles that reacts to the cursor), https://codepen.io/anon/pen/oNNjbqZ, and **Stippling on Text**, https://codepen.io/anon/pen/zYXYLro
- **WebGL text:** Codrops **Responsive and SEO-Friendly WebGL Text**, https://tympanus.net/codrops/2025/06/05/how-to-create-responsive-and-seo-friendly-webgl-text/. Directly relevant to keeping WebGL type accessible.
- **No matches:** none of the freefrontend lists had an ASCII or force-graph example.

### CodeMyUI — https://codemyui.com/
- **Loading Text Spinning around a Sphere** ("Text Ring Loading Animation" by Jon Kantner; probably pure CSS): https://codemyui.com/loading-text-spinning-around-a-sphere/. Gist archive: https://gist.github.com/CodeMyUI/2872edd8c41eef8e10124f21aaba8a54. A direct fit for a **build-progress loader** in the text-sphere style.
- **Scramble:**
  - **Decryption Effect On Click**: https://codemyui.com/decryption-effect-click/
  - **Console Style Text Animation With Randomised Cursor**: https://codemyui.com/console-style-text-animation-randomised-cursor/
  - **Clean Word Scrambler Effect**: https://codemyui.com/clean-word-scrambler-effect/
- **Other:**
  - **SVG Text Spinning Wheel**: https://codemyui.com/svg-text-spinning-wheel/
  - **Nixie Tube … Random Number Generator** (counter idea): https://codemyui.com/nixie-tube-cold-cathode-display-random-number-generator/
  - **ASCII Art and CSS Styled Directory Structure** (an ASCII tree for an Upload file list or cluster hierarchy): https://codemyui.com/ascii-art-and-css-styled-directory-structure/

### Scrolltide — https://www.scrolltide.co/
- **Licence and cost:** paid, $299 one-time lifetime (early access), for personal and client use.
- **What it is:** a prompt-driven library: 117 templates, 46 components, 55 shaders, 18 sections. Stack is React, Next, Tailwind, Framer Motion, GSAP, Three.js and Lenis. You paste a prompt into an AI tool rather than installing a package.
- **Names I saw that fit:**
  - Components: **Dither Lens**, **Grid Warp**, **Block Field**, **Spiral Slider**, **Intro Loader**
  - Shaders: **Halftone Tide**, **Halftone Sun**
  - Fit: landing hero and intro loader.
- **Verdict:** inspiration rather than a dependency. Most of the catalogue is colourful and liquid, not monochrome.

### prompt-motion — https://prompt-motion.com/
- **What it is:** a curated gallery of motion videos, each with the prompt or skill that made it. Rights belong to the creators. It names no licence or price; it has an email newsletter.
- **Relevant filters:** **Kinetic type** (97), **Particles** (43), **Diagrams**, **Charts**, **Code**.
- **Entries I saw:** the slugs were truncated, e.g. `/rneayan-ea6129` (oscilloscope style) and `/rneayan-474bcf` (risograph style). I couldn't confirm which are ASCII or text spheres.
- **Use:** a moodboard for motion briefs and promo video, not runtime UI.

---

## 4. Product-UX reference: Manus — https://manus.im/

The homepage and docs fetched cleanly but describe features, not UI. Patterns confirmed from a third-party teardown (https://aiuxplayground.com/teardowns/manus/output) and secondary reviews:

- **Status line names the current phase.** "Manus is working · Generating meeting summary". A floating chip shows elapsed time and stays visible while you scroll.
  - KGE: the build-progress screen should name the live stage ("Querying OpenAlex · 312 papers") with an elapsed timer that stays pinned when the user leaves the screen.
- **Mid-run steering.** You can message the agent without cancelling (the teardown flags that there is no explicit cancel, which is a gap).
  - KGE: let users refine the topic or exclude a source while the build runs, and do include Cancel.
- **The plan is a to-do list.** The goal becomes a checklist that the agent ticks off (secondary source: https://site.joinleland.com/library/a/manus-ai-agents).
  - KGE: show build stages as a checklist that ticks off as each one completes.
- **Live "Manus's Computer" view and session replay.** Every step can be rewatched afterwards (secondary sources: https://www.quicknode.com/builders-guide/tools/manus, Joinleland). I couldn't verify the replay UI itself; there is no official doc page on it.
  - KGE: **build replay**, a scrubber that replays how the graph grew, node by node. The data is already there if build events are logged. This is a strong, distinctive feature.
- **Artifact cards and a completion chip.** A "1/1 ✓" chip ties the output back to the task. Artifacts open in a full-screen preview with a filmstrip.
  - KGE: the brief, opportunities and exports as artifact cards, plus a preview modal.
- **Wide Research.** The docs describe parallel sub-agents, then aggregation, but not the progress UI (https://manus.im/docs/features/wide-research.md).

---

## 5. Typographic particle sphere, word cloud on a sphere, text as particles

| # | Library / technique | Licence | React | Notes |
|---|---|---|---|---|
| 1 | **TagCloud.js** — https://github.com/cong-min/TagCloud | MIT, ~6 KB, no deps | Community wrapper `@frank-mayer/react-tag-cloud`, or call it in `useEffect` | DOM-based 3D word sphere that rolls with the mouse. Options: `radius`, `maxSpeed`, `initSpeed`, `direction`, `keep`, `useHTML`. Words stay **real DOM text**, so they are selectable and readable by screen readers. Best for ≤ ~150 words. **No reduced-motion handling**: set speed to 0 yourself. Tutorial: https://dev.to/asmitbm/animated-text-sphere-in-javascript-using-tagcloud-js-1p72 |
| 2 | **troika-three-text** (via drei `<Text>` in react-three-fiber) — https://github.com/protectwise/troika/tree/main/packages/troika-three-text | MIT (repo) | Yes, through `@react-three/drei` `Text` | SDF text in WebGL straight from .ttf/.otf/.woff. `curveRadius` bends text around a cylinder (text-on-curve, text rooms). `styleRanges` colours ranges. `glyphGeometryDetail` enables per-glyph vertex effects. Work happens in a Worker, so it **needs CSP `worker-src blob:`** or `useWorker:false`. Use `preloadFont` to avoid a first-frame stall. Best for **3D word rooms and tunnels** and a hero word sphere with hundreds of labels |
| 3 | **Fibonacci-sphere label layout in three.js** — CodePen by rwxmad: https://codepen.io/rwxmad/embed/preview/QWJxBbG; R3F npm `name-sphere-threejs` (MIT): https://github.com/KHUNTPRIYANSH/name-sphere-threejs-npm | MIT (npm) | R3F | The core maths for an even word sphere. Combine it with troika text for real KGE concepts |
| 4 | **Text → particles** (sample text pixels on a canvas, then feed positions to a points shader) — e.g. https://codepen.io/sanprieto/pen/XWNjBdb, https://codepen.io/VoXelo/pen/VYLJYBz | Per author | Port to R3F `<points>` | A "registered-mark particle field" / topic word that dissolves into the graph. Thousands of particles are cheap on the GPU, but keep DPR ≤ 2 and pause when off-screen |
| 5 | **ASCII post-processing** — `@react-three/postprocessing` `ASCII` effect: https://react-postprocessing.docs.pmnd.rs/effects/ascii (adapted from emilwidlund/ASCII; props for font, characters, fontSize, cellSize, color, invert) | MIT (pmndrs) | Yes | Renders any R3F scene (including the 3D graph) as live ASCII. Ikeda-style hero or a "matrix" view toggle for the graph. Alternative without WebGL: Aceternity **ASCII Art** or Magic UI **Glyph Matrix** (both canvas 2D) |
| 6 | **Pretext** (Cheng Lou) — `@chenglou/pretext`, https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.3/README.md | Check repo | Framework-agnostic | Multiline text measurement and line layout without the DOM: `prepare()` once, then `layout()` as pure arithmetic. Line layout feeds Canvas, SVG or WebGL. Needs `Intl.Segmenter`. Lets you flow brief or answer text **along spirals or around graph nodes** in canvas without reflow cost. Early version (0.0.x) |

**Performance:**
- Pause any rAF loop when the element is off-screen (IntersectionObserver), when the tab is hidden, and under `prefers-reduced-motion`.
- Cap DPR at 2.
- Use one WebGL context per page. Don't run a hero R3F scene and a WebGL graph at the same time.
- Lazy-load three.js (~150 KB+ gzip) only on routes that need it.

**Accessibility:**
- WebGL and canvas text is invisible to assistive tech. Mirror labels in a visually hidden list, or follow the Codrops "SEO-friendly WebGL text" pattern (DOM text kept, canvas draws over it).
- Give every auto-moving hero a Pause button (WCAG 2.2.2).

---

## 6. Graph renderers better suited to typographic nodes than Cytoscape

| Option | Licence | Render | Typographic-node fit | Scale | Notes |
|---|---|---|---|---|---|
| **react-force-graph-2d / -3d** — https://github.com/vasturiano/react-force-graph | MIT | Canvas 2D / three.js | **Best fit.** `nodeCanvasObject(node, ctx, globalScale)` paints any glyph, word or mono label. Example: text-nodes 2D https://vasturiano.github.io/react-force-graph/example/text-nodes/index-2d.html, 3D …/index-3d.html, text-on-links …/text-links/index-3d.html. `nodeThreeObject` takes any Object3D in 3D (works with troika text). `linkDirectionalParticles` and `emitParticle(link)` animate "flow" along edges, e.g. Ask highlighting the path of an answer | Thousands of nodes comfortably in 2D | d3-force under the hood. `cooldownTicks` / `cooldownTime` / `warmupTicks` freeze layout (warmup is good for reduced motion: pre-settle, then render static). `autoPauseRedraw` saves CPU. **The most direct Cytoscape replacement for KGE** |
| **sigma.js v3 + graphology** — https://www.sigmajs.org/, https://github.com/jacomyal/sigma.js | MIT | WebGL | Medium. Labels are drawn on a canvas layer and customisable; node shapes need WebGL "node programs" (`@sigma/node-image`, `@sigma/node-piechart`). graphology gives ForceAtlas2, Louvain communities (for Clusters) and metrics | Tens of thousands of nodes | Best if graphs grow large. React bindings exist (`@react-sigma`, not mentioned on the homepage) |
| **d3-force + own canvas renderer** | ISC | Canvas 2D | Full control: mono labels, text on arcs, letter-built nodes | ~2–5k nodes | The most work, the most art direction. react-force-graph is essentially this, prepackaged |
| **cosmos.gl** — https://github.com/cosmograph-org/cosmos | MIT | GPU (WebGL shaders) for layout and render | Weak for text: no built-in labels. You draw an HTML or canvas overlay, with helpers like `getSampledLinkPositionsMap()` | Hundreds of thousands of points | Overkill for KGE's graph sizes, but a striking particle-field look (Anadol-like). Vanilla JS API; no React wrapper seen. v3 is under active development |
| **Cytoscape (current)** | MIT | Canvas | Style-sheet driven. Custom typographic nodes are awkward (labels and shapes are limited to its style model) | Fine at KGE scale | Keep it only if the redesign accepts styled dots plus labels |

**Recommendation:** move the graph view to **react-force-graph-2d**, painting nodes with `nodeCanvasObject`. Draw mono labels whose size is weighted by importance, and render concept nodes as words, not dots. Use `linkDirectionalParticles` for Ask highlights. Offer **react-force-graph-3d** with troika text as an optional "immersive" mode. Keep a **list/table fallback view** of nodes for keyboard and screen-reader users. Canvas graphs are not accessible on their own.

---

## 7. Top 15 picks mapped to product surfaces

| # | Pick | Surface | URL |
|---|---|---|---|
| 1 | react-force-graph-2d `nodeCanvasObject` text nodes + `linkDirectionalParticles` | Graph view, Ask highlighting | https://vasturiano.github.io/react-force-graph/example/text-nodes/index-2d.html |
| 2 | anime.js v4 `splitText` + `scrambleText` | Hero headline, node-label decode, score settle | https://animejs.com/documentation/text |
| 3 | Motion `layoutId` shared-element transitions | Opportunity card → detail; node → detail panel | https://motion.dev/docs/react-layout-animations |
| 4 | shadcn Command / Sheet / Tabs / Dialog / Resizable / Tooltip | Base layer: ⌘K, node panel, tabs, brief modal, split view | https://ui.shadcn.com/docs/components |
| 5 | Magic UI Glyph Matrix | Hero background, build-progress backdrop | https://magicui.design/docs/components/glyph-matrix |
| 6 | troika-three-text / drei `Text` (curveRadius) + Fibonacci sphere | Landing hero word sphere, 3D word room | https://github.com/protectwise/troika/tree/main/packages/troika-three-text |
| 7 | TagCloud.js | Lightweight DOM word sphere: domain concepts during build, empty state | https://github.com/cong-min/TagCloud |
| 8 | Aceternity Multi Step Loader (fed real stages) + Manus-style phase line, timer and checklist | Build-progress screen | https://ui.aceternity.com/components/multi-step-loader |
| 9 | Build replay scrubber (Manus "replay" pattern) | Post-build: replay how the graph grew | https://aiuxplayground.com/teardowns/manus/output |
| 10 | Aceternity Encrypted Text / Motion Primitives Text Shimmer Wave | Ask: "thinking" state and answer headings | https://ui.aceternity.com/components/encrypted-text · https://motion-primitives.com/docs/text-shimmer-wave |
| 11 | Magic UI Number Ticker (free) or Motion+ AnimateNumber | Build counters, opportunity scores | https://magicui.design/docs/components/number-ticker |
| 12 | Bklit Sankey / Sunburst / Radar | Brief (source → opportunity flow), Clusters, opportunity score card | https://bklit.com/docs/components/sankey-chart |
| 13 | Aceternity ASCII Art | Empty states, upload placeholder, hero imagery | https://ui.aceternity.com/components/ascii-art |
| 14 | Text on spiral or path (SVG `textPath`) + Magic UI Spinning Text | Hero, orbit label around selected node, tour callouts | https://codepen.io/anon/pen/ByoNYrZ · https://magicui.design/docs/components/spinning-text |
| 15 | `@react-three/postprocessing` ASCII effect | Optional "ASCII mode" for the 3D graph or hero | https://react-postprocessing.docs.pmnd.rs/effects/ascii |

**Honourable mentions:**
- CodeMyUI "Loading Text Spinning around a Sphere" (CSS loader): https://codemyui.com/loading-text-spinning-around-a-sphere/
- Magic UI Animated Beam (landing "sources → graph" diagram)
- Motion+ Typewriter (Ask streaming, with screen-reader support)
- Pretext (canvas text flow along curves)
- sigma.js (if graphs exceed ~5k nodes)

**Couldn't fetch:** uiverse.io (403), codepen.io/trending (403), the Kokonut UI full catalogue (didn't render), the Manus replay UI (no official docs; secondary sources only).
