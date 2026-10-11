# B² motion map: element → source picks

Researched 10 Oct 2026. This extends `docs/design-research/motion-and-component-sources.md` (MCS) and `osmo-and-cavalry.md` (OC). It doesn't repeat them; where a pick comes from there, it's tagged *(MCS)* or *(OC)*. Everything else was seen this session through WebFetch, the Motion docs MCP, the Osmo vault, or the Kokonut UI GitHub source. Items I saw only in search-result snippets are marked **[search only]**.

**B² recap:** a dark data room. Colours: `#0E0E0E` background, `#171717` panels, `#EDEDED` text, and one accent, LED magenta `#FF2BD6`. Type: Martian Mono for UI, Mona Sans for text. Graph nodes are the glyphs ● ◆ ■ ▲. Magenta means only three things: live, selected, spike.

**Current stack:** React 18.3, Vite 5, Cytoscape. No Tailwind, no TS, no animation library. Prefer copying logic into `styles.css` and theme tokens over adopting Tailwind.

---

## 0. Global rules for the whole map

1. **One engine per job.**
   - **Motion** (`motion/react`, MIT, free core) handles React state: AnimatePresence, `layoutId`, drag, variants.
   - **anime.js v4** (free) handles text and canvas-free DOM: `splitText`, `scrambleText`, `stagger`, and the new **`createLayout`** module.
   - Use **GSAP** (free since 2025, including SplitText and ScrambleText) only where an Osmo snippet is ported literally.
   - Don't run all three on one screen.
2. **Reduced motion: one hook.** Write `usePrefersReducedMotion()` once and wrap the app in `<MotionConfig reducedMotion="user">`. Every canvas loop needs four pause conditions: RM on, tab hidden, off-screen, and a visible ⏸ toggle (SC 2.2.2).
3. **Magenta is never the only signal.** Every magenta state needs a second cue: a glyph change, a `LIVE` / `SEL` text tag, or a bracket. That covers colour-blind users and the RM fallback in one go.
4. **Steps easing fits the terminal look.** `steps(n)` and linear for mechanical things (cursor, ticker, scramble). Use one soft ease, `cubic-bezier(.2,.8,.2,1)`, only for spatial moves (panels, sheet).

---

## 1. Letter sphere hero

| Pick | What to take | React port | RM fallback |
|---|---|---|---|
| **Own canvas-2D Fibonacci sphere**. Maths: Cavalry `Sphere Distribution.js` *(OC)*, rwxmad pen / `name-sphere-threejs` *(MCS)* | Golden-angle point distribution. Rotate Y each frame, project, then map z to size and opacity: far letters `#3a3a3a`, near ones `#EDEDED`. Draw one to three letters in magenta, using letters of the current topic. | About 80 LOC in a `useEffect` with rAF and a ResizeObserver, DPR capped at 2. Pointer drag sets angular velocity, then it eases back to idle spin. **No three.js needed** for ≤ 600 glyphs. | Draw one static frame at a nice angle and skip the rAF. Pause button top-right, labelled with Martian Mono `[ ❚❚ ]`. Mirror the topic words in a visually hidden `<ul>`. |
| **Magic UI Icon Cloud**: https://magicui.design/docs/components/icon-cloud | A 3D tag sphere with **built-in play/pause (`showControl`) and auto-pause on `prefers-reduced-motion`**. That's the a11y behaviour to copy. Props: `icons: ReactNode[]`, `images: string[]`. | Needs Tailwind and the shadcn CLI. Either copy the source and pass `<span>` glyph nodes as `icons` (untested whether text renders well), or just copy its pause/RM logic into the own sphere. | Built in (RM pauses rotation). Keep `showControl` true. |
| **21st.dev "Ball Study" (Meng To, ThreeUI)**: https://21st.dev/@mengto/components/ball-study | Visual reference closest to B²: glyphs on a spinning sphere that **accelerates on hover; clicked letters scatter and regrow**. Take the scatter-and-regrow idea for "click a letter, jump to that concept". | MIT, but install needs a 21st API key. I saw the listing only, not the source, so treat it as reference and build your own. | Not documented. Do your own. |

Also seen, not recommended:
- Scrolltide **Particle Globe** (points on a draggable sphere; paid $299 catalogue).
- TagCloud.js *(MCS)*. It's DOM-based and fine for ≤ 150 words, but it has no RM handling and can't produce the depth-grey look as nicely as canvas.

## 2. Glyph-matrix / ASCII backdrop

| Pick | What to take | React port | RM |
|---|---|---|---|
| **Magic UI Glyph Matrix** *(MCS)*: /docs/components/glyph-matrix | A canvas grid of mutating glyphs. Set `glyphs="·•+×◆■▲"` and `color` to `#2a2a2a`. Let a few cells flash magenta when a spike event arrives. | Tailwind component, but the logic is a small canvas. Copy it. | `mutationRate=0`, giving a static frame. |
| **Osmo Interactive Dots Grid (Background)**: `osmo-vault/resources/interactive-dots-grid-background.md` | Zero deps, canvas, pointer-reactive, sections stay grid-aligned, colours accept `var(--token)`. Swap `arc()` for `fillText(glyph)`. | Easiest port: one effect, rAF, ResizeObserver, cleanup. | One static draw. No pointer reaction. |
| **drei `AsciiRenderer`**: https://drei.docs.pmnd.rs/abstractions/ascii-renderer | Only if a three.js scene already exists (e.g. a 3D sphere variant). Props: `characters=' .:-+*=%@#'`, `fgColor`, `bgColor`, `resolution=0.15`, `invert`. **`color` is very expensive. Keep it off.** | Child of `<Canvas>`. Adds a DOM layer. | Render one frame (`frameloop="demand"`). |

## 3. Text scramble / decode on labels and titles

| Pick | What to take | React port | RM / a11y |
|---|---|---|---|
| **anime.js `scrambleText`**: https://animejs.com/documentation/text/scrambletext | `animate(el, { innerHTML: scrambleText({ chars, cursor, revealRate, settleDuration, perturbation, from, seed }) })`. A mono charset (`01/\\_-#`) fits Martian Mono. Use `seed` for a deterministic decode, so the same node always decodes the same way. | `useEffect` keyed on node id, `createScope` for cleanup. Free. | `aria-label` = final string. Scramble spans get `aria-hidden`. Under RM, set the text directly. |
| **Osmo Text Scramble (Load, Scroll, Hover)**: `resources/text-scramble-load-scroll-hover.md` *(OC #1)* | Load, scroll and hover triggers through `data-scramble`. Production-tested timings. | GSAP + SplitText + ScrambleText (all free). `useGSAP` with scope. | As above. |
| **Kokonut UI `matrix-text`**: github.com/kokonut-labs/kokonutui `components/kokonutui/matrix-text.tsx` | MIT, Motion-based. Letters flip through **0/1** (`getRandomChar`) one by one (`letterInterval=100`, `letterAnimationDuration=500`). Good for the build-screen headline. Swap the binary for the glyph set. | 162 lines of plain React + `motion/react`. Remove `cn` and Tailwind classes and you have a copy-paste component. | Not handled in source. Add the RM branch. |

Also seen: Aceternity Encrypted Text *(MCS)*; Motion+ `ScrambleText` and "Scramble text: Stagger from center" (paid); Motion Primitives Text Scramble (/docs/text-scramble); CodePen "GSAP SplitText + ScrambleText Cursor Effect", https://codepen.io/creativeocean/pen/NPWLwJM (via freefrontend).

## 4. Terminal typing / log stream (build screen + Ask "thinking")

The build log must show **real** SSE or poll events. Every catalogue terminal below is scripted, so take their look and timing, not their data model.

| Pick | What to take | React port | RM / a11y |
|---|---|---|---|
| **Own append-only log**, styled after **Kokonut `ai-loading`** (`@kokonutui/ai-loading`; /docs/ai/ai-loading) | Kokonut gives a scrolling code-style log with an SVG progress arc. It **stops animating off-screen via IntersectionObserver**, and its `LoadingAnimation` takes `progress` 0–100 with an aria-label. Copy the IntersectionObserver pause and the arc. Replace its fake 2-second interval with the event stream. | `<ol role="log" aria-live="polite">`. New line: opacity 0→1 plus a 2px y-shift, 120 ms. Magenta `▍` cursor blinks with `steps(1)`. Auto-scroll only while the user is at the bottom. | RM: lines appear without fade and the cursor is static. Throttle aria-live to stage changes, not every line. |
| **Magic UI Terminal**: https://magicui.design/docs/components/terminal | API shape worth copying: `<Terminal sequence startOnView>` with `<TypingAnimation duration={60}>` (ms per char) and `<AnimatedSpan>` (fade-in line). Use it for the **landing-page demo of a build**, where scripted is fine. | Tailwind. Copy the sequencing logic. | Not documented. Show all lines at once under RM. |
| **Aceternity Terminal**: https://ui.aceternity.com/components/terminal | Props `commands[]`, `outputs{idx: string[]}`, `typingSpeed=50`, `delayBetweenCommands=800`, `initialDelay=500`, **`enableSound` (default true, set it false)**. Has bash highlighting and auto-scroll. | Tailwind. | Not documented. |

**Ask "thinking" state:**
- Motion Primitives **Text Shimmer Wave** *(MCS)* as a mono "thinking…" line.
- Kokonut **`ai-text-loading`** (MIT, motion, 82 lines; `texts[]`, `interval=1500`). Feed it **real** phase names ("retrieving 12 nodes", "ranking paths"), never fake ones.
- Manus pattern *(MCS)*: the phase line, an elapsed timer and a ticking checklist.
- Motion+ `Typewriter` (paid, has SR support) and Motion UI "Terminal session" / "Terminal hero" (paid) are optional.

## 5. Odometer / number ticker

| Pick | What to take | React port | RM |
|---|---|---|---|
| **NumberFlow** (`@number-flow/react`): https://number-flow.barvian.me/ | Dependency-free. Transitions when `value` changes. Props: `trend` (±1/0), `format` (Intl), `plugins: [continuous]`, timing props, **`respectMotionPreference` (default true)**, `useCanAnimate`. Best fit for **live build counts**, which update many times. Use `tabular-nums` (Martian Mono is already mono). | Plain React component, no Tailwind. | Built in. |
| **Osmo Number Odometer**: `resources/number-odometer.md` *(OC #9)* | Rolling digit strips with punctuation kept and a group stagger. **One of the few Osmo files with a real RM branch** (line 68). | GSAP. Call the tween on each update instead of on scroll. | Built in (jumps to the end value). |
| **Magic UI Number Ticker**: /docs/components/number-ticker | `value`, `startValue`, `direction`, `delay`, `decimalPlaces`. Good for one-shot stat reveals on Opportunities. | Tailwind; logic is small. | Not documented. |

Extra: Aceternity **Text Flipping Board** (https://ui.aceternity.com/components/text-flipping-board) is a split-flap board with `text`, `rows`, `duration≈1.2`, and `sound=false`. It suits a one-off "TOPIC: CRISPR" moment on the build screen. Its colour-code syntax `{O}` could carry the magenta tile. RM support is not documented.

Paid alternative: Motion+ `AnimateNumber`.

## 6. Magenta pulse on live / spike

| Pick | What to take | React port | RM |
|---|---|---|---|
| **Own CSS keyframe ring** | A `::after` ring scales 1→2.4 while opacity goes .6→0 over 1.6 s, `infinite`, in magenta. Use it on the `LIVE` dot, a spike badge and a fresh log line. Cap it at under 3 flashes per second (SC 2.3.1). | Pure CSS: `.is-live::after{animation:kge-ping 1.6s cubic-bezier(0,0,.2,1) infinite}`. | No animation. A solid magenta dot plus the text `LIVE`. |
| **Magic UI Pulsating Button / Ripple**: /docs/components/pulsating-button, /docs/components/ripple | Reference for ring timing and stacking (Ripple = concentric rings). Ripple fits the moment a build starts. | Tailwind. Read it for values. | n/a |
| **Motion "Loading: Pulse dots"**, free: https://examples.motion.dev/react/loading-three-dots-pulse (MotionScore S) | Free source via the MCP. A three-dot pulse for "streaming…" in mono. | `motion/react`. | `MotionConfig` user. |

**In canvas (graph spike):** in `nodeCanvasObject`, draw an expanding ring for about 1.2 s after a spike event, then stop. Don't loop it forever. Osmo `elastic-pulse-button.md` is hover-only: skip it for status, but it's fine for the CTA.

## 7. Graph node hover/selection (canvas) + edge particles for the Ask path

| Pick | What to take | React port | RM |
|---|---|---|---|
| **react-force-graph "Highlight nodes/links"**: https://vasturiano.github.io/react-force-graph/example/highlight/ | On hover, dim non-neighbours to `#2a2a2a` and keep neighbours and links at `#EDEDED`. Selected node goes magenta, with a glyph frame `[◆]` drawn in the canvas. | `nodeCanvasObject` draws ● ◆ ■ ▲ via `fillText` with the mono label. **`nodePointerAreaPaint`** sets a hit area matching the glyph plus label box. `autoPauseRedraw` stays true. | No transition tween. State swaps instantly. |
| **react-force-graph "Emit link particles on demand"**: …/example/emit-particles/ and "Directional moving particles" …/directional-links-particles/ | For the Ask answer path, call `emitParticle(link)` hop by hop along the path in magenta (`linkDirectionalParticleColor`, `linkDirectionalParticleWidth≈2`, `linkDirectionalParticleSpeed≈0.01`), staggered about 150 ms per hop so the path reads in order. | Imperative `fgRef.current.emitParticle(link)`. | **No particles.** Draw the path links magenta and solid, with step numbers `01 02 03` at the midpoints. |
| **If you stay on Cytoscape** | Cytoscape style can do it: `line-style: dashed` plus an animated `line-dash-offset` gives magenta "marching ants" along the path. Selection uses the `:selected` style. Hover uses the `.faded` class on the non-neighbourhood. | `requestAnimationFrame` updating `line-dash-offset` on the path edges only. | Solid magenta edges, no offset animation (`GraphCanvas.jsx` already skips `cy.animate()` under RM, per OC). |

Also: react-force-graph "Click to focus on node" (/click-to-focus/) for zoom-to-selection.

## 8. Bracketed button hover `[ BUILD ]`

| Pick | What to take | React port | RM |
|---|---|---|---|
| **"Wire Frame" corner-bracket CSS** (savvy.co.il, *Buttons hover effects ideas*, #5): https://savvy.co.il/en/blog/css/buttons-hover-effects-ideas | `::before` and `::after` 14px L-brackets with 2px borders, top-left and bottom-right. On hover they grow to `calc(100% - 8px)`, a 0.4s ease, colour to accent. **B² variant:** use literal `[` `]` glyphs in Martian Mono that translate ±4px outward on hover/focus-visible, label to magenta. Or use the corner-L version for cards. | Pure CSS. Apply on `:hover, :focus-visible`. | Instant colour/bracket swap (`transition: none`). |
| **Osmo Button with CSS Character Stagger**: `resources/button-with-css-character-stagger.md` | Each char rolls up through a `text-shadow: 0 1.3em currentColor` duplicate, staggered by `offsetIncrement = 0.01`. Pairs well with brackets for primary CTAs. | It splits chars with a tiny script: render the spans in JSX with `aria-hidden` and put `aria-label` on the button. | No roll. |
| Motion "Rolling text button: Staggered" / Motion UI "Button: Staggered rolling text" | The same idea with Motion `splitText`. **Paid (Motion+).** Reference only. | — | — |

Also seen **[search only]**: Framer "Animated Corner Bracket Button" and "Reticle Button" (Framer marketplace, no code).

## 9. Tab / segment switch (Graph · Clusters · Opportunities · Ask)

| Pick | What to take | React port | RM |
|---|---|---|---|
| **Motion `layoutId` indicator** (free): docs `react-layout-animations`; free example "Shared layout animation", https://examples.motion.dev/react/shared-layout-animation | A magenta 2px underline, or a `[ ]` bracket pair, shared via `layoutId="tab-ind"` that slides between tabs. Panels crossfade with AnimatePresence `mode="wait"`. | `motion/react`, no Tailwind needed. | `MotionConfig reducedMotion="user"` drops the transform and keeps opacity. |
| **Osmo Bouncy Content Tabs**: `resources/bouncy-content-tabs.md` | Notable because its script **keeps `aria-selected`, `tabindex` and `aria-controls` in sync and generates the ids**. That's the a11y wiring to copy even if Motion does the animation. | GSAP. Port the ARIA logic; skip the bounce. | Drop the bounce. |
| **Kokonut `smooth-tab`** (MIT, motion, 343 lines) or **Motion Primitives Animated Background** (/docs/animated-background: `defaultValue`, `onValueChange`, `enableHover`, `transition`; children need a `data-id`) | Ready sliding-pill implementations. | Kokonut uses Tailwind and lucide; strip both. Motion Primitives uses Tailwind. | Add the RM branch. |

Paid: Motion "Smooth Tabs" (directional content) and Motion UI "Smooth tabs" (directional blur crossfade).

## 10. Panel / inspector slide-in

| Pick | What to take | React port | RM |
|---|---|---|---|
| **Motion AnimatePresence + `x`** (free; Transitions docs) | Inspector: `initial={{x: 24, opacity: 0}}` to `{x: 0, opacity: 1}`, 180 ms, ease `[.2,.8,.2,1]`. Exit is faster (120 ms). On open, the title runs `scrambleText` (§3) **after** the slide lands. | Panel as a non-modal `<aside>`, so focus doesn't trap and the graph stays usable. | Opacity only, no translate. No scramble. |
| **shadcn Sheet**: /docs/components/base/sheet *(MCS)* | Use it when the inspector must be modal (mobile, narrow). Base UI primitives handle the focus trap. | Tailwind + shadcn, or copy the Base UI usage directly (`@base-ui/react`). | — |
| **Motion `layoutId`**: the node label morphs into the panel heading *(MCS)* | Only works for DOM labels. Canvas glyphs can't share a layoutId: fake it by spawning a DOM clone at the node's screen coords. | — | Skip. |

Also: Osmo `side-navigation-with-wipe-effect.md`, a GSAP wipe panel, if a louder reveal is wanted.

## 11. Command palette ⌘K

| Pick | What to take | React port | RM |
|---|---|---|---|
| **shadcn Command** (built on **cmdk**): /docs/components/base/command | `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup heading`, `CommandItem`, `CommandShortcut`. Groups: Nodes, Actions (Ask, Build, Brief), Tabs. Mono throughout. Matched characters in magenta. | `cmdk` works without Tailwind: install `cmdk` and style it with tokens. | Dialog appears without scale. |
| **Kokonut `action-search-bar`** (MIT, motion, 350 lines) | Debounced filter with an AnimatePresence results list. Actions carry `description`, `short` (shortcut) and `end` fields, a good row anatomy for `◆ concept · ⌘↵`. | Uses shadcn `Input` and Tailwind. Restyle. | Add the RM branch. |
| Motion UI **Command palette** / "Navigation: Command palette" | A sliding selection highlight via shared layout on Base UI Dialog. **Paid.** Copy the idea: one `layoutId` highlight bar behind the active item. | — | — |

## 12. Toast

| Pick | What to take | React port | RM |
|---|---|---|---|
| **shadcn Toast** (now **Base UI Toast**; no Sonner): /docs/components/base/toast | `toast.add({title, description, type, actionProps})`. `toast.promise` moves loading→success→error, which fits "Brief generating…". | `@base-ui/react` toast without Tailwind is fine. | Base UI handles stacking/swipe; add `transition:none` under RM. |
| **Own mono toast**: bottom-left, `#171717`, 1px `#2a2a2a` border, a prefix tag `[OK]` / `[ERR]` / `[LIVE]` (magenta only for live or spike) | 140 ms y-slide. A 4 s progress hairline that pauses on hover/focus. | `role="status"` (or `alert` for errors). | No slide. |
| Reference: Motion "Toast: Stacked notifications" (S), "Toast: Notifications list", "Base UI: Toast". **Paid.** Magic UI **Animated List** (/docs/components/animated-list, `delay=1000`) | Animated List is for a sequenced *event feed* (e.g. "new paper found"), not for toasts. Its demo uses index keys, so use stable ids for a live stream. | — | — |

## 13. Skeleton / loading in mono

| Pick | What to take | React port | RM |
|---|---|---|---|
| **Own glyph skeleton** | Bars made of `░░░░░░` (or `▒`) in `#2a2a2a`, with a highlight band that steps across using `steps(12)`, like a terminal redraw rather than a smooth shimmer. | CSS only. `aria-busy="true"` on the region. | Static bars. |
| **Osmo Skeleton Loader Text**: `resources/skeleton-loader-text.md` *(OC #10)* | Bars over SplitText lines that wipe away when ready. Has proper `cleanup()` and resize handling. | GSAP. Drive it from react-query `isLoading`. | Static. |
| **Kokonut `shimmer-text`** / Motion Primitives **Text Shimmer** *(MCS)* | A text-shaped shimmer for single-line labels ("loading entity…"). | Tailwind. | Static. |

Paid: Motion UI "Skeleton" (mask-wipe handoff to content).

## 14. Page transition Home → Workspace

| Pick | What to take | React port | RM |
|---|---|---|---|
| **Osmo Pixelated Page Transition**: `resources/pixelated-page-transition.md` (**GSAP only, no Barba**) *(OC #14)* | Grid blocks cover in random order, then reveal. **B²:** blocks are `#171717` cells, each flashing a glyph (·+◆). The last cells to cover show the topic word in magenta. | Drive it from a router wrapper: cover, `navigate()`, wait for the workspace's first paint, reveal. ≤ 600 ms total. | Instant swap or a 150 ms opacity fade. Move focus to the `<h1>`. |
| **Motion AnimatePresence keyed on `location.pathname`** (free, works on React 18) | The simplest option. Combine it with the letter sphere collapsing into the graph: the sphere scales down and fades while graph nodes fade in. | `mode="wait"`. | Opacity only. |

**Not usable now:**
- Motion **AnimateView** is now free (`motion/react-animate-view`), but it **requires React 19.3+** (React `ViewTransition`). The same goes for the Motion UI "Mask wipe".
- Motion+ `useCurtains` (pixel/blinds/iris) is paid.
- The other Osmo transitions assume Barba + Lenis.

## 15. Bottom sheet (mobile)

| Pick | What to take | React port | RM |
|---|---|---|---|
| **shadcn Drawer** (now **Base UI**, no longer Vaul): /docs/components/base/drawer | `snapPoints` (0–1 = viewport fraction, px or rem) and `swipeDirection="down"`. Snaps: peek (node title + glyph), half (inspector), full (Ask). | `@base-ui/react` drawer, restyled with tokens. | Base UI handles the motion; set `transition:none` under RM. Keep a visible close `[ × ]` button (non-gesture alternative). |
| **Motion `drag` + `useDragControls`** (free docs: react-drag, react-use-drag-controls) | Hand-rolled sheet: `drag="y"`, `dragConstraints`, velocity-based snap on `onDragEnd`. The grab handle is a mono `━━` drag control. | `motion/react`. | Snap without spring. |
| Reference: Motion "Sheet Modal" (A), Motion UI "Sheet" (native `<dialog>`, fade-up + flick dismiss), "Sheet overlay". **Paid.** Osmo `expanding-bottom-navigation.md` (a pill morphing into a menu, GSAP) | — | Kokonut `smooth-drawer` wraps shadcn Drawer but imports `next/image` and `next/link`, so it's Next-only as shipped. | — |

## 16. Spotlight tour

| Pick | What to take | React port | RM |
|---|---|---|---|
| **Keep and restyle the existing `Tour.jsx`** | It already has a reduced-motion check (OC). Visual: a `box-shadow: 0 0 0 9999px rgba(14,14,14,.82)` cutout, or an SVG mask, around the target. **Magenta corner brackets** (the §8 Wire Frame CSS) frame the target. Tooltip in Martian Mono with `01/05`, `[ NEXT ]`, `[ SKIP ]`, and `Kbd` hints (shadcn Kbd). | No new dependency. | Cutout jumps between targets, no tween. |
| **react-joyride** (MIT) or **driver.js** (MIT, framework-agnostic) **[search only]** | Use one if Tour.jsx gets too complex: they give a spotlight, beacon and next/back/skip. **Avoid Intro.js and Shepherd** (AGPL unless commercial, per the Inline Manual comparison, Mar 2026). | Verify React 18 support and keyboard/SR behaviour yourself. No independent a11y audit was found. | — |

**Don't confuse these:**
- Aceternity "Spotlight" / "Spotlight New" and Motion Primitives "Spotlight" (/docs/spotlight) are **lighting and cursor effects**, not tours.

## 17. Cards stagger on Opportunities

| Pick | What to take | React port | RM |
|---|---|---|---|
| **Motion variants `staggerChildren`** (free; Transitions docs) | Cards rise 8px and fade, stagger 40 ms, capped at the first 12 visible cards (the rest appear instantly). The score uses NumberFlow (§5) after the card lands. | `motion.ul` + `motion.li` variants, no Tailwind. | No stagger, all visible. |
| **anime.js `createLayout`** (v4 Layout module): https://animejs.com/documentation/layout | **For sort/filter changes** (by score, cluster): `layout.update(() => reorder())` animates DOM order, `enterFrom` / `leaveTo` and staggered changes. A free FLIP-style alternative to Motion `layout`. Methods: `record`, `animate`, `update`, `revert`. | `useLayoutEffect`, `revert()` in cleanup. React re-renders must happen inside the update callback, or call record/animate around the commit. | Skip the layout animation and apply the change directly. |
| **Osmo Elements Reveal on Scroll**: `resources/elements-reveal-on-scroll.md` | `data-reveal-group` with nested groups and independent `data-stagger` / distance. Useful if the board scrolls long. Also Osmo `layout-grid-flip.md` (GSAP Flip) for a list↔grid density toggle. | GSAP + ScrollTrigger. | Static. |

Also seen: Magic UI **Blur Fade** (/docs/components/blur-fade). Motion "Physical stagger" (distance-based) is **paid**. Stacking-cards ideas from Osmo are in *(OC #8)*.

---

## 18. Licences and Tailwind

| Source | Licence / cost | Tailwind? | Note |
|---|---|---|---|
| Motion core (`motion/react`) | MIT, free | No | AnimateView is free but needs React 19.3 |
| **Motion+** (ScrambleText, Typewriter, AnimateNumber, useCurtains, Ticker, Carousel, Motion UI components and sections, most examples tagged paid) | **Paid**: one-time Solo or annual per-seat Team | Motion UI components use Base UI; styling varies | Free examples seen: Shared layout animation, Path drawing, Drag, Loading: Pulse dots, Modal dialog via docs |
| anime.js v4 | Free (MIT on GitHub, per MCS) | No | New this pass: `createLayout`, Three.js adapter |
| GSAP + all plugins | Free incl. commercial since 2025 | No | Needed only for Osmo ports |
| **Osmo vault** | **Paid membership. Don't republish** the code or commit the vault; copy one adapted component at a time into the private repo | No (Webflow CSS; swap tokens) | Only number-odometer and radial-text-marquee have RM branches |
| shadcn/ui | MIT | **Yes** (or use cmdk / Base UI directly without it) | Toast and Drawer are now Base UI (no Sonner, no Vaul) |
| Magic UI | Open source (repo MIT per MCS; verify) | **Yes** | Icon Cloud has built-in pause + RM |
| Aceternity UI | Components free copy-paste; blocks paid | **Yes** | Terminal sound defaults ON |
| Motion Primitives | Open source (licence not on page); Pro paid | **Yes** | — |
| Kokonut UI | **MIT** (in file headers), Pro paid | **Yes**, plus lucide; smooth-drawer needs Next | Source readable at github.com/kokonut-labs/kokonutui |
| Bklit | Charts MIT | Yes (shadcn registry) | No network, ticker or pulse component: only Live Line Chart applies (build throughput) |
| NumberFlow | Licence not shown on site (check npm) | No | RM built in |
| react-force-graph | MIT | No | — |
| 21st.dev items (Ball Study etc.) | Item MIT; install needs a 21st API key | Yes | Reference only |
| Scrolltide | $299 one-time | Yes (React/Next/Tailwind/GSAP) | Particle Globe and Mesh Flow are references only |
| react-joyride / driver.js | MIT **[search only]** | No | Intro.js and Shepherd are AGPL |

## 19. Couldn't reach / nothing relevant

- **uiverse.io:** 403 again on /buttons; searches returned no uiverse pages.
- **codepen.io/trending:** blocked (per MCS). Pens came via freefrontend and search.
- **prompt-motion.com:** the slugs carry no tags. Only the "Kinetic type" (97), "Particles" (43) and "Code" (21) filters are relevant, and they need a manual browse. Moodboard only.
- **manus.im:** nothing new beyond the MCS teardown (phase line, elapsed timer, checklist, replay). Applied in §4.
- **freefrontend:** nothing new on ASCII, sphere or odometer. New scramble pens are listed in §3.
- **codemyui:** "Terminal Style Text Effect" (https://codemyui.com/terminal-style-text-effect/) and "Typewriter Effect for Individual Words in Text Block" are minor references for §4.
