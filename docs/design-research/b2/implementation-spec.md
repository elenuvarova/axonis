# B² → code: implementation spec

Source of truth: Figma file `v69tJC9W32VFiA57qXfIOg`, page **07 · B² hi-fi** (screens B²-01…13, components, variable collection "B²", text styles `B²/*`). References and reasoning: page **06 · B² for KGE**. Spacing numbers come from the Railway principal-layout measurement (`principal-layout.md`).

Branch: `redesign/b2`. Frontend: React 18 + Vite, plain CSS (`frontend/src/styles.css`), Cytoscape graph. No Tailwind.

## 1. Tokens (replace the current colour tokens; dark only)

```css
--bg:#0E0E0E; --panel:#171717; --raised:#1F1F1F;
--line:#2A2A2A; --line-strong:#3A3A3A;
--text:#EDEDED; --text-2:#8A8A8A; --text-3:#555555;   /* text-3: decorative / inactive only (fails AA for text) */
--accent:#FF2BD6; --accent-soft:rgba(255,43,214,.14); --on-accent:#0E0E0E;
--inverse:#EDEDED; --on-inverse:#0E0E0E;
--s-half:4px; --s-1:8px; --s-2:16px; --s-3:24px; --s-4:32px; --s-5:48px;
--topbar:54px; --inspector:360px; --panel-inset:16px; --page-inset:78px; --gutter:8px;
--radius:0;
```
B² is dark by definition: the theme toggle is removed from the UI and `data-theme` is forced to `dark` (keep `theme.js` so tests keep passing; no light palette in this pass).

## 2. Type (self-hosted; CSP is `font-src 'self'`)

`@fontsource/martian-mono` (300, 400, 500) and `@fontsource/mona-sans` (400, 500), imported in `main.jsx`.

| Style | Family | Weight | Size / line | Tracking |
|---|---|---|---|---|
| display | Martian Mono | 500 | 48/54 | −3% |
| h1 | Martian Mono | 500 | 28/34 | −2% |
| h2 | Martian Mono | 500 | 20/26 | −1% |
| h3 | Martian Mono | 500 | 15/20 | 0 |
| ui | Martian Mono | 400 | 13/18 | 0 |
| ui-small | Martian Mono | 400 | 11/16 | 0 |
| label | Martian Mono | 500 | 11/14, UPPERCASE | +8% |
| counter | Martian Mono | 300 | 40/44 | −3% |
| body | Mona Sans | 400 | 15/24 | 0 |
| body-small | Mona Sans | 400 | 13/20 | 0 |

Glyphs NOT in Martian Mono (render as boxes): `▸ ↗ ↔ ❚`. Use `> → + ‖` instead.

## 3. Components (match Figma "B² components")

- **Button** `[ LABEL ]` text in brackets, Martian 13/500, padding 8×16, radius 0. Primary: bg inverse / text on-inverse. Secondary: 1px text-colour border. Ghost: text-2, no border. Focus: 2px accent outline, offset 2.
- **Chip** 11px mono, padding 4×8, 1px line-strong border; selected = raised bg + text border; live = accent-soft bg + accent border + accent dot + accent text.
- **Badge** glyph + UPPERCASE label: `● READY`, `◐ BUILDING` (accent), `× ERROR` (text-2).
- **Tab** label style, text-2; active = accent text + 1px accent bottom border.
- **Metric row** label (80px) · 20-cell bar (6×8 cells, accent filled / line-strong empty) · value; hairline bottom.
- **Cluster row** the row background IS the meter (accent-soft width = score), index · name/meta · score in accent.
- **Opportunity card** panel bg, 1px line; rank + risk labels → big score (counter style at 56px) + `/100` → title (h2) → why (body-small, text-2) → evidence 5 bars → `[ SHOW ON MAP ]` + ghost "HOW IT'S SCORED →".
- **Log line** time (text-2) · source · message, 2px left rule (accent on the live line).
- **Toast** raised bg, line-strong border: `[OK]` accent · message · action · ×.

## 4. Screens

- **Home** (B²-01): top bar 54 (`AXONIS / axonis.app`, right: HOW IT WORKS · EXAMPLES). Left column at page inset 78, width ≤600: label line, display headline `MAP ANY DOMAIN / → CONCEPTS / → RESEARCH / → OPPORTUNITIES` (last line accent), body, query block (panel, 1px text border, padding 24): `> ` prompt input (h2 size) + Region / Goal as pill-styled selects + `[ BUILD ↵ ]` primary. TRY chips. Recent table below (ID · TOPIC · REGION · STATUS · UPDATED; delete moves to a row action, no red ×). Right: interactive letter sphere (`LetterSphere.jsx`, 2D canvas, no dependency; replaced the 7 MB looping video on 11 Oct 2026). It auto-spins slowly (~40 s per turn), can be dragged with inertia, and has a `[ PAUSE ]` toggle. Under `prefers-reduced-motion` there is no auto-spin and no toggle, but dragging still works.
- **Build** (B²-02): honest version — the backend only reports "building". Checklist of the real pipeline steps (existing timer logic), each row `[✓] / [>] / [ ]`; a real elapsed counter (mm:ss); a log panel listing step transitions with real timestamps; note "You can leave — the map keeps building". No fake entity counts.
- **Workspace** (B²-03): top bar (crumb, status badge, counts, ⌘K placeholder chip optional, UPLOAD ghost, `[ BRIEF ]` secondary); tabs MAP / CLUSTERS · n / OPPORTUNITIES · n; framed canvas with 8px gutter, faint dot grid; legend top-left (`● CONCEPT n · ◆ PAPER n · ■ ORG n · ▲ PRODUCT n`); controls stack bottom-left (+ − FIT); right panel 360 / inset 16 = inspector.
- **Ask** (B²-04): Ask is no longer a tab — it is a right-panel mode. Entry: `[ ASK ABOUT THIS ]` in the inspector and a `> ask the map` bar on the canvas. Answer shows numbered source markers in accent; referenced nodes get accent highlight on the graph; × returns to inspector.
- **Clusters** (B²-08), **Opportunities** (B²-05), **Brief** modal styled as reading view (B²-06: label line, h1, body in Mona Sans, citations in accent mono, export buttons), **Mobile** (B²-07/13): sheet styling, 44px touch targets.

## 5. Graph (Cytoscape, keep the library)

Node shape = type: concept `ellipse`, paper `diamond`, organisation `rectangle`, product `triangle`. Fill text colour (#EDEDED), no border; selected = accent fill + accent label + dashed accent ring; neighbours keep full opacity, rest fade to .2. Edges 1px line-strong; highlighted edges accent. Labels Martian Mono 9–11px text-2, hubs larger in text colour. Ask highlights = accent border + label.

## 6. Motion & accessibility

One shared `usePrefersReducedMotion` hook. Reduced motion: video → poster, no transitions beyond opacity. Keep existing aria-live, focus management, tour. Tour spotlight: accent corner brackets. All text pairs must keep ≥4.5:1 (text-3 only decorative/inactive).

## 7. Done means

`NODE_ENV=test npm test` green (update tests to new copy where needed), `npm run build` green, CSP unchanged except what's needed (video is same-origin → covered by `default-src 'self'`), screenshots of Home / Build / Workspace / Ask / Opportunities / Brief / mobile taken against a running app.
