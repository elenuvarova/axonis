# KGE redesign: Osmo Vault picks + Cavalry usage

Date: 2026-10-10. Sources: `~/.claude/skills/osmo-vault` (244 components, mirrored 17 Sep 2026), `~/.claude/skills/cavalry` + its corpus at `~/mcp-servers/cavalry-assistant`, and the installed distribution scripts in `~/Library/Application Support/Cavalry/Scripts/`.

## Starting point in the codebase

- `frontend/package.json` has React 18, Cytoscape (+cola), react-query and react-router. **No GSAP, Motion or Lottie yet.** Every Osmo pick below adds `gsap` (and `@gsap/react` if you use `useGSAP`).
- Reduced motion is already handled in three places: `styles.css:1142` (`@media (prefers-reduced-motion: reduce)`), `GraphCanvas.jsx:134-160` (skips `cy.animate()`), and `ProjectPage.jsx:35` / `Tour.jsx:10` (`matchMedia`). Any new motion should reuse one shared `usePrefersReducedMotion()` hook instead of a fourth copy.
- The graph is Cytoscape. Osmo components belong *around* the graph (home, loader, panels, cards, brief), not inside the canvas.

---

## Part 1: Osmo Vault, 14 picks

All paths are relative to `~/.claude/skills/osmo-vault/resources/` (the guide is in `guides/`).

**GSAP licence.** Since 2025 GSAP and every plugin used below (SplitText, ScrambleText, Physics2D, Inertia, Observer, Flip, CustomEase, ScrollTrigger) are free, including for commercial use, so no Club membership is needed. Install with `npm i gsap @gsap/react` and import the plugins from `gsap/SplitText` and the other `gsap/*` paths. **Osmo's own code is paid membership material.** Copy in only the one component you use, never the vault wholesale, and don't republish it. KGE's repo is private, so a single adapted component is fine.

**Usual React/Vite port (applies to all picks):** put the `initX()` body in `useGSAP(() => {...}, {scope: ref})`, or in `useEffect` + `gsap.context(..., ref)` with `ctx.revert()` in cleanup. Query inside the ref, not `document`. Keep the `data-*` attribute names. StrictMode double-mounts in dev, so cleanup must be real. Replace `window.innerWidth <= 991` gating with `matchMedia('(hover: hover) and (pointer: fine)')` plus a change listener. Substitute KGE tokens for the Webflow CSS (hardcoded `PP Neue Montreal`, `em` sizing, dead `grid-*-gap`).

| # | Component (file) | What it does | KGE surface | Adapting notes | A11y / reduced-motion |
|---|---|---|---|---|---|
| 1 | **Text Scramble (Load, Scroll, Hover)**: `text-scramble-load-scroll-hover.md` | Uses SplitText to split into chars, then ScrambleTextPlugin resolves random glyphs into the real text. Triggered by `data-scramble="load"` / `"scroll"` / hover. | Hero headline, project title on open, node-inspector title when a node is selected, Brief section headers. This is the core "ASCII / text as matter" gesture. | GSAP + ScrambleText + SplitText + ScrollTrigger. Use a mono charset (`01#/\\_-`) to match the moodboard. Re-run on selection change, keyed on node id. | Screen readers can read garbage mid-scramble, so set `aria-label` with the final text on the element and put `aria-hidden` on the split spans. Under reduced motion, render the final text immediately. |
| 2 | **Scramble Text Cursor**: `scramble-text-cursor.md` | A custom cursor whose label scrambles to the `data-cursor-text` of whatever you hover. Edge-aware flip. | Graph view: the cursor label shows "OPEN CONCEPT" / "PAPER" / "ORG" over nodes. Opportunities cards: "EXPAND". | Built for DOM targets. For Cytoscape nodes, drive the label from `cy.on('mouseover','node')` rather than `data-cursor-hover`. It contains a one-time `innerWidth` gate, so fix it with a pointer media query. | Decorative only. Never put the only label in the cursor; keep native tooltips and aria. Disable on touch and under reduced motion (fall back to the system cursor). |
| 3 | **Masked Text Reveal (guide)**: `guides/masked-text-reveal.md` | A reusable SplitText line/word/char reveal function from behind a mask, triggered on scroll. | Brief modal sections, Clusters panel headers, home "how it works". This is the sober baseline reveal that pairs with the louder scramble. | GSAP + SplitText + ScrollTrigger. SplitText `autoSplit` + `onSplit` returns a context, which is clean in React. For a scroll container (modal), pass `scroller: modalRef`. Watch descender clipping (see `solve-cut-off-letters-split-text.md`, a ⚠ entry whose snippet is in its Documentation). | Under reduced motion, set opacity to 1 with no translate. SplitText keeps an `aria-label` on the parent by default (v3.13+). Verify. |
| 4 | **Radial Text Marquee**: `radial-text-marquee.md` | Generates an SVG `textPath` on a circular arc and loops text along it. Configurable radius, speed and spacer glyph (e.g. `®`). Viewport play/pause. | Home hero: a ring or arc of real terms from recent projects. Build-progress screen: a ring of entity names discovered so far. This is the "text on paths/spirals" moodboard item. | GSAP + ScrollTrigger. Long script that measures text geometry. In React, render once, then re-init when the term list changes. Already has some `prefers-reduced-motion` code; check it actually stops. | Auto-running motion over 5 s fails **SC 2.2.2**, so add a visible pause button plus `:focus-within` pause. Put `aria-hidden` on the SVG and provide a plain `<ul>` of the same terms for SR users. |
| 5 | **Draggable Marquee (Directional)**: `draggable-marquee-directional.md` | A looping marquee you can drag or fling. It reverses with scroll direction. | Home: "recent topics" or a trending-terms strip. Clusters: a strip of cluster labels. | GSAP + Observer + ScrollTrigger. **Uses `cloneNode`**, so render the duplicate set in JSX with `aria-hidden="true"` rather than porting the clone. | Same 2.2.2 pause requirement. Draggable needs a keyboard alternative: the real items must be focusable links elsewhere (or in the first copy only). |
| 6 | **Interactive Dots Grid (Background)**: `interactive-dots-grid-background.md` | Zero-dep `<canvas>` dot grid that lights up or pushes around the pointer. Aligned across stacked sections. Per-section colours via `data-dots-color-*`. | Home and empty states: a mono dot field as the "ASCII/char grid" texture. Could swap the dot for glyphs (`·+×®`) with a small change to the draw routine. | No deps. Easiest port of the set: one `useEffect` with an RAF and a ResizeObserver, cancelled in cleanup. Colours accept `var(--token)`, so it maps cleanly to KGE light/dark tokens. | Decorative, so `aria-hidden`. Under reduced motion, draw one static frame and skip the pointer reaction. Pause the RAF when the tab is hidden. |
| 7 | **Glowing Interactive Dots Grid**: `glowing-interactive-dots-grid.md` | DOM dots with InertiaPlugin: shockwave on click, glow on hover. | Alternative to #6 for a smaller hero block, or for the moment a build starts (one shockwave on submit). | GSAP + Inertia. DOM-heavy (one element per dot), so keep it small. #6 is better for full-bleed areas. | As #6. Avoid big flashes: stay under 3 per second (SC 2.3.1). |
| 8 | **Stacking Cards Parallax**: `stacking-cards-parallax.md` (alt: `stacking-sticky-cards-bounce.md`, `stacking-cards-3d-css.md`) | Cards stick and stack with scale/parallax as you scroll. | Opportunities board: each opportunity card stacks over the previous one, editorial-style. | GSAP + ScrollTrigger, short (231 lines). `stacking-cards-3d-css.md` is pure CSS sticky with no JS, which is the safest. The Bounce variant has three `innerWidth` gates to fix. | Make sure stacked cards don't hide focusable content when tabbing: either scroll the focused card into view or drop the stacking on keyboard focus. Under reduced motion, use a plain list. |
| 9 | **Number Odometer**: `number-odometer.md` | Rolling-digit counter that keeps punctuation and %. Group stagger. Custom start value. | Build-progress screen: live counts of concepts/papers/orgs/products. Project header stats, cluster sizes. | GSAP + ScrollTrigger. For live build counts, call the tween imperatively on each update instead of using the scroll trigger. Two `innerWidth` uses. **Already has a `prefers-reduced-motion` branch**, one of the few in the vault. | Wrap in `aria-live="polite"` with the final number text, and throttle announcements (e.g. every 10 s) or SR users get spammed. Hide the digit strips from SR. |
| 10 | **Skeleton Loader Text**: `skeleton-loader-text.md` | Skeleton bars over SplitText lines that pulse, then wipe away when content is ready. Colours pulled from CSS vars. | Ask Q&A answer while streaming, Brief modal while generating, inspector while loading entity detail. | GSAP + ScrollTrigger + SplitText. It has a proper `cleanup()` and resize handling, which ports well. Drive it from react-query `isLoading` instead of load. | Pair with `aria-busy="true"` on the region. Under reduced motion, show static bars with no pulse. |
| 11 | **Welcoming Words Loader** / **Number Loader in 3 Steps**: `welcoming-words-loader.md`, `number-loader-in-3-steps.md` (louder alt: `crisp-loading-animation.md`) | A word-cycling loader / a 0→100 count loader. GSAP only, short. | Build-progress screen: cycle through real pipeline stages ("FETCHING PAPERS → EXTRACTING ENTITIES → LINKING → CLUSTERING"), ideally driven by real SSE/poll status rather than a fake timer. | Swap the timeline's fixed durations for state-driven steps. Small and easy. | Never fake progress. Announce stage changes via `aria-live`. Under reduced motion, crossfade or swap text instantly. |
| 12 | **Falling Text with Gravity**: `falling-text-with-gravity.md` | SplitText chars thrown with Physics2D: velocity, angle, gravity, then fade. | One-shot moments: deleting a project from Recent, clearing a search, or the hero title "dissolving" into the graph when a build starts (text becomes matter becomes nodes). | GSAP + Physics2D + SplitText (+ ScrollTrigger in the original, drop it and trigger on an event). Returns a context, so cleanup is easy. | Pure decoration. Skip entirely under reduced motion. Make sure the action completes and focus moves independently of the animation. |
| 13 | **Magnetic Hover Effect**: `magnetic-hover-effect.md` | Elements drift toward the cursor with `data-magnetic-strength`. GSAP `quickTo`. | Primary CTAs: "Build graph", "Generate Brief", "Ask". Optionally the theme toggle and help button. | GSAP only, tiny. Has an `innerWidth` gate, so use a pointer media query. | Magnetic offset must not move the hit area away from a keyboard focus ring; reset on focus. Disable under reduced motion. Fine otherwise. |
| 14 | **Pixelated Page Transition**: `pixelated-page-transition.md` (alt: `page-name-transition-wipe.md`) | A grid of pixel blocks covers the screen in random order, then reveals. The "pixel" variant needs GSAP only, no Barba. | Home → Project route change in react-router. The page-name variant could flash the topic name ("CRISPR") during the wipe, which is very on-brief for kinetic type. | Most transitions in the vault assume Barba + Lenis. Take the GSAP-only pixel version and drive it from a router wrapper (see the `page-transitions` skill). `pixelated-wave-page-transition.md` uses `cloneNode`, so avoid it in React. | Full-screen cover is risky for vestibular users. Keep it under ~600 ms. Under reduced motion, use an instant swap or plain opacity fade. Move focus to the new page `<h1>` after the transition. |

**Honourable mentions (if needed later):** `variable-font-weight-hover.md` (weight ripples across chars near the cursor, with a reduced-motion branch, good for the Clusters list); `typewriter-effect.md` (Ask answer streaming feel, no deps, but uses `cloneNode`); `highlight-text-on-scroll.md` (Brief reading progress); `lottie-setup.md` (for Cavalry Lottie output, see Part 2; has a reduced-motion branch); `interactive-pixel-grid.md`; `3d-cards-tornado.md` (3D text-tunnel feel, but `cloneNode` and heavy); `film-grain-effect.md` (mono texture overlay); `cursor-coordinates.md` (live X/Y mono readout, very "technical poster", zero deps).

### Cross-cutting accessibility rules for this set

1. **No Osmo resource handles reduced motion except** odometer, radial marquee, variable-weight hover and lottie-setup, and even those need checking. Add one `useReducedMotion()` gate and a `gsap.matchMedia()` block per component.
2. **Auto-playing marquees (#4, #5)** fail WCAG 2.2.2 without a real pause control. Hover-pause is not enough on touch.
3. **Split/scrambled text (#1, #3, #10, #12):** the accessible name must be the final string. Hide fragments from assistive tech.
4. **Custom cursors (#2) and magnetic elements (#13):** only on `(hover: hover) and (pointer: fine)`. Never the sole carrier of information.
5. **Mobile bottom sheet:** none of these belong inside the sheet except #9/#10/#11. Keep sheet motion to the existing native-feeling slide.

---

## Part 2: Cavalry for KGE

### Availability on this machine

- **Installed:** `/Applications/Cavalry.app`, version **2.8.0**. The bundle also contains `CavalryCLI.app` and `CavalryPlayer.app`. Not launched.
- The scripting bridge (Stallion, `127.0.0.1:8080`) and a patched local MCP server (`~/mcp-servers/cavalry`) are set up. Note that the skill's verification was done on **2.7.2**, so re-probe attribute names after this version bump (`api.hasAttribute`).
- **Ready-made distributions** are installed in `~/Library/Application Support/Cavalry/Scripts/distributions/`, among them **`Sphere Distribution.js`** (Fibonacci sphere with 3D rotation, perspective and backface culling, made for a Duplicator's Custom Distribution), `Helix`, `Archimedean Spiral`, `Galaxy Spiral`, `Phyllotaxis`, `Torus`, `Lorenz Attractor` and `Wave Grid`. These cover most of the moodboard's sphere/spiral/tunnel forms.

### Where Cavalry fits, and where it doesn't

Cavalry is an **offline authoring tool**. Its output is a file (video, PNG/SVG frames, possibly Lottie), not a live React component. So:

- **Use it for:** brand motion loops (hero, loader, empty states), marketing and social assets, Brief covers, OG images, and static/animated "typographic network posters" generated from real graph JSON. In short, anything where art direction matters more than interactivity.
- **Don't use it for:** the live graph, inspector, cards or anything that must reflect user data in real time, or be keyboard- and screen-reader-accessible. Those stay as Cytoscape, DOM and Osmo/GSAP. Rule of thumb: Cavalry makes the *look* and the *showreel*; the app re-implements the key gestures live (sphere of letters → canvas/three.js or CSS 3D) where interactivity is needed.

### Scene recipes

Node and attribute names below come from the corpus name tables (`prompts/cavalry-best-practices.md`), which the skill rates as reliable. Behavioural details still need a read-back or render per the skill's loop (`api.stop()` first, verify via `api.writeToFile` + `api.renderPNGFrame`).

**R1: Letter sphere, the hero / loader loop**
- `textShape` with a single glyph or a term (e.g. alphabet, or real entity initials) → `subMesh` with `levelMode: 3` (characters), or one textShape per char fed to a `duplicator` with `autoId`.
- `duplicator` → `api.setGenerator(dup, "generator", "customDistribution")` driven by a `javaScript` utility holding **Sphere Distribution.js** (n0 radius, n1 count, n2–n4 rotation, n5 perspective, n6 cull). Animate n3 (rotation Y) linearly for the spin. Use one `oscillator` on n2 for wobble.
- Depth cue: `shapeScale`/`shapeOpacity` from the projected scale (the script outputs a scale; map it through a `numberRange`) so far letters are small and grey and near ones white. One accent letter in electric blue via `colorArray` + `arrayIndex`.
- Loop: animation curves with `postInfinity: 1` (loop), length = one full rotation, e.g. 6 s at 30 fps = 180 frames.

**R2: Text on a spiral / ring, the build-progress screen and section dividers**
- An `ellipse` primitive or an Archimedean spiral path → `textShape.textPath` connected to it, with `pathLoop: true`. Animate `pathTravel` for the crawl. Use `forceMonospacing: true` with a mono font for the ASCII feel.
- Alternative: a `duplicator` with `pathDistribution` (`generator.inputShape` = spiral, `useRotation: true`) over per-word text shapes, with a `stagger` on opacity so words "arrive" in sequence, mimicking entity discovery.
- Output: a short loop video or frames for the loader. The live product equivalent is Osmo #4 (Radial Text Marquee).

**R3: Typographic network poster from real graph JSON, for social cards, the Brief cover and OG images**
- Export the project's graph from KGE (`nodes[{id,label,type,degree}]`, `edges[{source,target}]`) to `graph.json`. In Cavalry, `api.loadAsset(path)` + `api.jsonFromAsset(assetId)` (both in the API reference). Or put it in a Google Sheet via `api.loadGoogleSheet` / the `spreadsheet` + `spreadsheetLookup` nodes for non-script edits.
- Layout: compute positions in the script (or pre-compute in KGE with cola and export x/y) → `duplicator` with `arrayDistribution` (or `customDistribution`) placing `textShape` labels. Font size is mapped from `degree`, and weight/case from `type` (concept / paper / org / product). Edges: a `connectShape` (the corpus shows `sourceDistribution`, with `strokeMaterial.id -> connectShape.stroke`), or a script that generates line paths per edge.
- Variants: loop over topics/projects in one script, swap the JSON, then `api.renderPNGFrame(path, scale)` or `api.renderSVGFrame(...)` per variant. This gives 1200×630 OG, 1080×1350 social and A4 Brief cover from a single scene. **This is the highest-value Cavalry use for KGE.** The posters are built from real data, so they are honest marketing.

**R4: ASCII / char-grid field and tunnel, for empty states and background loops**
- `duplicator` + `gridDistribution` (`generator.count` [x,y], `sizeMode`) over a monospaced `textShape`. Use `noise` (`generator.frequency`, `generator.seed`, which need the `generator.` prefix) driving the glyph index via `colorArray`/`arrayIndex`-style lookup, or `shapeScale` for a density map. Animate the noise offset for flowing ASCII.
- Tunnel variant: the `Cylinder` / `Torus` / `Helix` distribution scripts with a camera-like perspective param animated forward. This is the "3D text tunnel" from the moodboard.

**R5: ® particle field / kinetic wordmark, for the logo sting and the Brief modal intro**
- A `textShape` wordmark → `subMesh` per character with `oscillator` (`waveType`, `frequency`, `stagger` on, `strength`) on position.y and rotation. One oscillator is connected to many attributes; stagger creates the offset, per the skill's hygiene rule. Add a scattered field of `®` glyphs via `randomDistribution` with slow `noise` drift. Accent: a single acid-yellow glyph.

### Export path to the web

What the skill/corpus confirms:
- **`api.renderPNGFrame(path, scale%)`** (verified on 2.7.2 to produce a correct 1920×1080 PNG) and **`api.renderSVGFrame(path, scale%, skipComps)`**: stills for OG/social/Brief covers. SVG is ideal for the Brief cover (crisp, small, themeable).
- **Render Queue**: `api.addRenderQueueItem(compId)`, `api.render(id)`, `api.renderAll()`, `api.backgroundRenderAll()`. Use these to batch-render variants from a script.
- `api.exportSceneAs` saves a scene file, not a web export.

What the skill does **not** cover: **Lottie export is not documented anywhere in the skill or its corpus.** The only Lottie item on this machine is the *Lottie Importer* script (Canvalry Scripts), which goes the other way, Lottie → Cavalry. Cavalry does offer Lottie as a render format in its Render Manager (general knowledge, unverified here). It supports only a subset of features, and procedural setups (Duplicators, JS distributions, sub-meshes) tend to bake into per-frame shapes, giving large JSON. **Check the Render Manager's format list in 2.8.0 and test one R1 export before planning around Lottie.** Also check whether your licence tier gates it.

Recommended web pipeline:
1. **Hero/loader loops (R1, R2, R4, R5):** render a PNG sequence → encode to **WebM (VP9, alpha if needed) + MP4 (H.264) fallback** with ffmpeg → `<video autoplay muted loop playsinline poster="frame0.webp">` behind `aria-hidden`. Target ≤ 1–2 MB, 6–8 s loop. Monochrome compresses very well. Under `prefers-reduced-motion`, show the poster frame only and don't autoplay; add a pause button if it runs over 5 s next to content (SC 2.2.2).
2. **Lottie (only if the test export is small):** use for small UI loops (loader glyph, empty-state icon) via `lottie-web` or `@lottiefiles/dotlottie-web`. Osmo's `lottie-setup.md` already has init plus a reduced-motion branch. A theming advantage: a mono Lottie can be recoloured for dark mode, a video can't.
3. **Data-driven stills (R3):** a script loops over projects → `renderSVGFrame`/`renderPNGFrame` → files committed to `frontend/public/og/` or generated on demand offline. Live per-user posters inside the app would need the same layout redone in SVG/canvas in React. Cavalry can't run server-side for users (CavalryCLI exists in the bundle, but headless rendering on the Hetzner/Coolify box would need a Linux build and licence, which is out of scope).
4. **Design source of truth:** export key frames as SVG and lift exact spacing, glyph sizes and easing into CSS tokens / GSAP eases so the live Osmo-based motion matches the Cavalry showreel. The free `Easey` script copies duration + cubic-bezier out for devs (see `references/02-ecosystem-and-learning.md`).

### Practical next steps
1. Open Cavalry → Scripts → Stallion, then `cavalry_ping`. Build R1 with Sphere Distribution.js, render one PNG, and test a Lottie export of the same comp to settle the Lottie question with real numbers (file size, fidelity).
2. Add a `GET /api/projects/:id/graph.json` export (or reuse the existing graph endpoint) for R3.
3. In the app: install `gsap @gsap/react`, add a shared reduced-motion hook, then port #1 (scramble), #6 (dots grid), #9 (odometer), #11 (loader) first, because they cover home + build-progress with the least risk.
