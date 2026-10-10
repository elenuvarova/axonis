# KGE · B² — Principal layout reference

> The screenshots this file links to are third-party product screens (Mobbin, Refero, live sites). They stay out of this public repo; the same images sit on Figma page **06 · B² for KGE**.

**Principal layout = Railway (web app), 8 screens from Mobbin.**
Role: the absolute numbers only (side insets, gap ladder, panel widths, top bar). Railway does **not** supply colour, type, corner radius or the purple accent. Those come from the B² style refs: sharp corners, Martian Mono / Mona Sans, magenta LED.

Files are in `scratchpad/b2-refs/principal/`:
- `NN-clean.png` is the screen cropped and normalised to 1440 px wide.
- `NN-redline.png` is the same screen with measured bands drawn on it.
- `00-board.png` puts all 8 pairs side by side.

Scripts are in `scratchpad/b2-refs/scripts/` (`normalize.py`, `scan.py`, `edges.py`, `redline.py`). Raw numbers are in `scripts/measurements.json`.

**Scale.** Mobbin serves a 1440×900 viewport capture at 1920 px wide. The Mobbin footer was cropped, then the image was resized ×0.75, so **1 px in the clean/redline images = 1 CSS px at 1440 = 1.333 source px**. These are full-resolution sources, so precision is about ±1 px, not the ±1.5 px of a thumbnail.

**How gaps were measured.** Rows are scanned inside a fixed column strip. A row counts as ink when at least 2 px differ from the strip's modal background by more than T. T=14 counts hairlines and card borders as ink. T=30–40 counts text only. A gap is measured from the edge of one ink band to the next (glyph to glyph, or border to glyph). It is **not** a CSS margin: for text-to-text gaps the CSS margin is about 4–6 px smaller, because of the line-box leading.

---

## 1. Why Railway, judged against the brief's words

Brief words: *precise, technical, honest, calm-dense, "data room", not decorative.*

| Requirement | Railway |
|---|---|
| Same structure as the KGE Workspace | Top bar, then icon rail, then a **framed graph canvas** with service nodes, then a right panel. It is the only candidate where the canvas plus inspector is the main screen, not an add-on |
| Docked Ask panel | Railway's **Agent panel** is docked right at 342 px, with a composer at the bottom and a "Deploying 29 changes…" status strip above the input (04). That is very close to KGE's Ask panel and the Build-progress status |
| Build progress / live checklist | Deploy form with per-service "Ready to be deployed" rows (08), deploy logs as dense mono rows (03), and an Activity feed |
| Calm-dense | 5 distinct gap steps (§3). Dense rows (25 px log pitch) sit beside loose section breaks (30–36), so the hierarchy shows without decoration |
| Technical / honest | Mono for data (logs, variables, hashes) and plain status words ("Online", "Completed", "REMOVED"). No illustration in the product UI. The background texture appears only on the create/deploy screens, and B² will not take it |
| Situations covered | List, canvas plus inspector, docked assistant, command palette (query input), modal, empty state, form, logs: 8 situations from one app |

## 2. Screen set (one app, 8 screens)

| # | Screen | Source (Mobbin) | KGE situation it answers |
|---|---|---|---|
| 01 | Projects home: sidebar + project card + filter row | [07669dc9-b62b-4bbe-a27e-c4a1063c9cd0](https://mobbin.com/screens/07669dc9-b62b-4bbe-a27e-c4a1063c9cd0) | Home (recent projects), Opportunities filter row |
| 02 | Canvas + wide inspector, Deployments list | [4cf04ea1-134b-4256-b677-00e9a74db42d](https://mobbin.com/screens/4cf04ea1-134b-4256-b677-00e9a74db42d) (flow "View deploy logs") | Workspace, Clusters list rows |
| 03 | Canvas + inspector, deploy logs (mono rows) | [7df5adc3-37d8-4c7a-a80f-227b5175304f](https://mobbin.com/screens/7df5adc3-37d8-4c7a-a80f-227b5175304f) (flow "Searching logs") | Build progress log, dense data rows |
| 04 | Canvas + docked Agent panel + deploying strip | [dc41507b-f66d-4641-b3ea-eba7d7cac4c4](https://mobbin.com/screens/dc41507b-f66d-4641-b3ea-eba7d7cac4c4) (flow "Creating services with AI") | Docked Ask panel, **inspector width** |
| 05 | "What would you like to create?" palette | [3b76fe18-ec45-402f-b902-ae363a7a4db4](https://mobbin.com/screens/3b76fe18-ec45-402f-b902-ae363a7a4db4) | Home query input, command menu |
| 06 | Modal "2 changes applied" | [131e5390-18b7-4eb6-9715-bb5d9497c7fb](https://mobbin.com/screens/131e5390-18b7-4eb6-9715-bb5d9497c7fb) (flow "Activity detail") | Upload modal |
| 07 | Templates, "No published templates found" | [aff493b4-bbdf-4376-a995-2828d02cab0d](https://mobbin.com/screens/aff493b4-bbdf-4376-a995-2828d02cab0d) (flow "Deploying a template") | Empty / error state |
| 08 | Deploy template: centred form + "Ready to be deployed" cards | [07e36b02-4394-4369-98aa-fda1b5b0a402](https://mobbin.com/screens/07e36b02-4394-4369-98aa-fda1b5b0a402) | Build progress checklist, centred Home column |

Flows the screens came from: [Creating services with AI](https://mobbin.com/flows/8214c6ae-bc23-40f7-aac9-7a138dc8633c), [Deploying a template](https://mobbin.com/flows/5973e16c-f6df-4e4a-bf98-839da06485e4), [Adding a service](https://mobbin.com/flows/b5cbb0a2-dcbb-4675-9456-7473fe44f2a6), [Searching logs](https://mobbin.com/flows/eb0244b7-db53-45f1-a3e6-90b24b91ba91), [View deploy logs](https://mobbin.com/flows/6caa5617-cb4a-44b2-9af6-bf9a6db34444), [Activity detail](https://mobbin.com/flows/a2bbe838-0b98-483c-be7e-ad3ff072f8bf). Raw downloads of 25 Railway screens are in `raw/railway/` and can extend the set later.

## 3. The gap ladder

All gaps from 4 to 100 px, across every strip on all 8 screens, clustered. The screen count shows how many *unrelated* screens produce each value, which is what makes it a step rather than content.

| Step | Measured (ink, px@1440) | Count / screens | Where it appears | Suggested B² token |
|---|---|---|---|---|
| **S1 · row** | 6–8 | 29 gaps / 4 screens (02 03 04 08) | between history cards (7, 7, 7, 8), log rows, two-line pairs (title→meta 8), agent list lines | `--s-1: 8` |
| **S2 · label→content** | 13–18 | 11 / 6 screens | tab label→underline 13, url row→card 17, HISTORY→list 18–19, empty title→body 17 | `--s-2: 16` |
| **S3 · block** | 21–27 | 33 / 6 screens | sidebar rows (25, row pitch 38), palette rows (27, pitch 42), agent paragraph breaks (21–23), form card rhythm (25–27) | `--s-3: 24` |
| **S4 · section** | 30–36 | 13 / 6 screens | inspector header→tabs 31, tabs→content 30, form card→card 30–31, modal block 30–36 | `--s-4: 32` |
| **S5 · page tier** | 43–50 (one outlier at 55–57) | 9 / 4 screens | page title→first row 41–43, sidebar group breaks 45–50, palette group break 49, modal header→body 57 | `--s-5: 48` |

**Verdict under Rule 1.** There are **5 distinct steps**, and they are modulated, not uniform: S1 sits inside lists, S3 between rows of a menu, S4 between sections of a panel. Section ÷ label-gap = 32/16 ≈ 2.0. Page tier ÷ block = 48/24 = 2.0. Section ÷ the 13 px label gap ≈ 2.4, which is inside the 2.3–2.7 "readable boundary" band. Compare the rejected candidates in §8, which show one step at about 1.1–1.5.

**Row pitches** (top of one ink band to the next, useful for list tokens):
- log rows: 25 px (03)
- agent body text line pitch: 19–20 px (04)
- sidebar nav: 38 px, with a group break pitch of 57–60 (01, 07)
- palette items: 42 px (05)
- history cards: 89–90 px, which is an 82 px card plus a 7–8 px gap (02)

**Inside a card** (Rule: every container needs its own ref):
- History card (02): border to first text 20 top / 21 bottom, left padding 16 (badge), title→meta 8. So outer padding is 16–20 and the inner pair gap is 8. The padding is not uniform, and that is what groups the content.
- Service card (08): title→sub 7, sub→status about 28. The status line is pushed to the bottom as its own group.
- Empty-state card (07): top border to title 74 (icon included), title→body 17, body line to line 5, body to bottom about 32.
- Agent notice card (04): title→body 33 (it includes a heading row), body lines 6–9.

## 4. Side insets: page vs inside panels

| Context | Measured | Screens |
|---|---|---|
| Page content inside the main frame (list pages) | **77 L / 78 R** (content column 287–1354 = 1067 wide) | 01, 07 |
| Wide inspector drawer (861 px) | **46 L / 47 R** | 02, 03 |
| Narrow docked panel (342 px, Agent) | **16 L / 14 R** | 04 |
| Modal (975 px) | **31 L / 31 R** | 06 |
| Palette (400 px) | about 11 (items run almost to the edge, with highlighted row fill) | 05 |
| Centred form column | 548 wide, centred (430 each side at 1440) | 08 |
| Shell gutter | 8 px between the canvas frame and the window edge (right/bottom) and between the canvas frame and the Agent panel | 01–04 |

Reading: **the inset scales with the container**. The ratio of inset to container width is about 5% at every level: 46/861 = 5.3%, 16/342 = 4.7%, 31/975 = 3.2%, 77/1222 = 6.3%. It is a contextual inset, not one global number.

## 5. Panel widths and chrome

| Element | Measured @1440 |
|---|---|
| Top bar | **54 px** (53 + 1 px hairline at y 53–55). Breadcrumb at left, status pill + "Agent" at right |
| Icon rail (workspace) | 54 px wide, the same as the top-bar height |
| Account sidebar (list pages) | 210 px |
| Canvas frame | x 54–1432, y 54–896, with an 8 px gutter to the window |
| Inspector, wide drawer | 861 px (x 571–1432), floating 22 px below the top bar (top 76). About 60% of the viewport |
| Docked Agent panel | **342 px** (x 1090–1432), with 8 px between it and the canvas frame |
| Command palette | 400 px, top about 290 (vertically centred) |
| Modal | 975 px, header 72 px tall (118→190), with a hairline under the header and a footer bar |
| Form column | 548 px, centred |

**Conflict with a locked KGE token (Rule 4).** KGE locks the inspector at 360–380 px. Railway's inspector is an 861 px drawer, and adopting it would re-lay out the Workspace. Split by role:
- **KGE inspector (360–380) takes Railway's docked Agent panel geometry**: 342 px wide, 16/14 inset, 8 px gutter. 342 is within 5% of 360. Keep 360, with a 16 inset.
- **Railway's 861 px drawer with its 46 inset maps to the KGE Brief reading view.** A long Mona Sans text column of about 768 px of content suits it.
- The ladder (§3) stays one system across both.

## 6. Mobile: a gap, recorded (Rule 11 not met)

Railway has **no mobile client in either corpus**:
- Mobbin iOS "Railway project dashboard" returned unrelated apps.
- A deep search for "Railway mobile web projects canvas on phone" returned only Craft, Freeform and Brave.
- Refero `search_apps "Railway"` does not list it.

No Railway responsive-web captures were found either. So the principal app **cannot** answer how the layout adapts on a phone. Do not borrow a second app's mobile ladder silently. The options are:
1. Treat mobile as a documented derivation from this ladder: page inset steps down to 16 (the Agent-panel inset), the inspector and Ask panel become bottom sheets with 16 inset, and lists keep S1/S3. Mark that as "derived, no external ref".
2. Run a separate, explicitly labelled mobile-principal hunt.

The only shortlisted service with both surfaces is Linear. Linear Mobile is light-themed with rounded "glass" sheets ([ed788cb0](https://mobbin.com/screens/ed788cb0-3715-4383-9cbd-783d2a55bdf8), [f02d53ae](https://mobbin.com/screens/f02d53ae-347f-46d6-9ce4-96063f4edc90)), which conflicts with the sharp B² direction.

## 7. Mapping to KGE screens

| KGE screen | From Railway | Numbers to use |
|---|---|---|
| **Home** (big query input + recent projects) | 08 centred column + 05 palette rows + 01 page header | Column of about 548. Input-to-list break S4 (32). Recent rows pitch 38–42, separated by S1–S3. Page title → first row S5 (48) |
| **Build progress** (live checklist + counters) | 08 "Ready to be deployed" cards, 04 deploying strip, 03 log rows | Checklist cards: 16–20 padding, title→meta 8, card→card 30 (S4). Live log in mono at 25 px pitch. Status strip pinned above the composer |
| **Workspace** (top bar, view tabs, canvas, inspector, Ask) | 02/03/04 | Top bar 54. Rail 54. Canvas frame with 8 gutter. Inspector 360 with 16 inset (Agent-panel geometry). Panel header → tabs 31, tabs → content 30. Tab label → underline 13 |
| **Clusters list** | 02 deployments history | Rows as framed cards: 82 tall, 7–8 gap (S1), 16 L padding. A section label ("HISTORY") gets 18–19 to the list. Or flat rows at a 38 px pitch (sidebar rhythm) for the denser variant |
| **Opportunities card grid + filters** | 01 projects grid + filter row | Filter row → grid S3 (24–30), header → filter row S5. **The grid gutter cannot be measured: the screen has only 1 card.** Extend the set from `raw/railway/` or pull another Railway grid screen; do not take it from another app |
| **Brief reading view** | 02/03 wide drawer | 861 drawer with a 46 inset, or the page content inset of 77 for a full page. Header → body 31/30 |
| **Upload modal** | 06 modal (structure), 05 palette (width class) | Header 72 with a hairline, body inset 31, block gaps 30–36, footer bar. Width is a KGE decision (Railway shows 400 for the palette and 975 for the modal). Record the choice |
| **Error / empty state** | 07 empty card | Bordered card in the content column. Icon block → title, title → body 17, body lines 5, about 32 to the bottom border. Section header above it at S4 |

## 8. Shortlist: the two rejected candidates

**Linear (web + iOS, Mobbin).** It has both surfaces, so it was the Rule-11 favourite.
- Measured the dark issue list [e142df2a](https://mobbin.com/screens/e142df2a-3527-499c-8f81-1b715947ac0c): gaps 18–26, essentially **one step** (about 24 everywhere).
- Properties panel on the detail screen [f00cc4fb](https://mobbin.com/screens/f00cc4fb-4083-43fc-a0fb-703a6c4ef771): 18–23, one step again.
- Detail main column has more range (8/11/20/30/44/56), but only in one place.
- The Mobbin corpus is mostly **light** web. iOS is light with rounded glass sheets.
- It has no canvas-plus-inspector or docked-assistant structure.
- Rejected: a single rhythm in its list and panel screens, and the wrong surface treatment for "data room".

**Factory (web, Refero).** It is the most "terminal" in skin: dark, mono, CLI-style.
- Measured from 1120 px previews (thumbnail precision, ±1.5 px): files/review screen [ff846bec](https://refero.design/pages/ff846bec-3644-453c-bb42-bdf422435d56) gaps 9–15, almost all one step, with a top tier of about 21 (ratio about 1.5).
- The home and workspace screens [6382118d](https://refero.design/pages/6382118d-b5ce-4dd5-9bbd-31fe80733c93) and [4a58b0ca](https://refero.design/pages/4a58b0ca-0faa-487b-9557-ccd207302fed) are almost empty: centred text plus a bottom composer, with no ladder to read.
- It has no right inspector, no list/grid screens and no mobile.
- Rejected: one step, and it covers too few situations. It may still serve as a **style/element** reference for the mono command input.

Clean copies of the rejected screens are in `scratchpad/b2-refs/rejected/`.

## 9. Caveats

- All numbers are ink-to-ink. To turn a text-to-text gap into a CSS margin, subtract about 4–6 px. The ladder tokens in §3 are the rounded systematic values.
- The data from Railway is screen geometry only. Its rounded cards, Inter-like sans, purple CTA and textured hero backgrounds are **not** part of this reference. Under Rule 10, colour and type come from the B² style refs.
- Missing situations in this set: card-grid gutter, loading skeleton, mobile. Fill them from Railway first (see `raw/railway/`, 25 screens).
