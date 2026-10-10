# KGE redesign: UX/UI pattern references

Sources: Mobbin MCP (screens/sections) and Refero MCP (screens/flows/styles/sites), searched 10 Oct 2026.
Every reference below was returned by those tools. "Steal" is the specific pattern to lift into KGE. Gaps are listed at the end.

KGE surfaces mapped: Home/query → Build progress → Graph + inspector → Clusters → Opportunities → Ask → Brief → Upload → Recent projects → Tour → Mobile sheet.

---

## 1. Home / landing with one big query input

| Ref | Link | Steal |
|---|---|---|
| Perplexity Pro home (Mobbin) | https://mobbin.com/screens/ad31058d-575b-4324-9bda-590bb9eeae15 | Wordmark-only header, centred input with inline mode pill ("Search ▾") + model picker, task chips beneath, and a "Scheduled" dropdown offering recurring research ("Trend research · Weekly"). For KGE: topic in the field, **region + goal as inline pills inside the input**, not separate form rows. Recurring "re-run this graph weekly" is a future hook. |
| Perplexity home (Refero) | https://refero.design/pages/4728944e-1213-4412-8edb-025244cf36c5 · variant with recent/suggested list https://refero.design/pages/ec385bb7-3a20-4b9b-b196-fe7e11a8d411 | Same layout with a vertical list of recent/suggested queries under the box. Use this as the **recent projects** slot on the home: one text row per project, not cards. |
| Manus "What can I do for you?" (Refero flow 10436) | https://refero.design/flows/10436 | One centred task card with attachments, integrations and voice inline, and template chips (Create slides, Build website…) below. A collapsed rail gives a focus mode and an expanded rail shows Projects. For KGE: **attach a PDF/CSV right in the query card** so enrichment can start at creation time. |
| Sana AI home (Mobbin) | https://mobbin.com/screens/eb1a7750-d1c0-4b4c-8fc0-2ec45ef08cfa | Starter prompts as **full-width text rows split by hairlines** (no chips or cards). This is the closest to the editorial/mono direction: example research goals set as a ruled list. |
| WRITER home (Mobbin) | https://mobbin.com/screens/9652aa1a-2aeb-469c-8a84-12d4d01c788c | Mode chips (Deep research, Build dashboard…) plus 4 long-form example prompt tiles. Shows how to teach what a good prompt looks like: example **research goals written as full sentences**. |
| Parallel Deep Research landing (Refero flow 9052, step 1) | https://refero.design/pages/584f4d27-f377-454a-a904-4269cbff8436 | Research query box with a **compute/depth selector** (step 2: https://refero.design/pages/4dda51cf-5851-4bee-98c3-618442490e78). Maps to a KGE "graph depth / breadth" option. |
| Editorial hero + search (Mobbin sections) | Flim https://mobbin.com/sites/sections/9e7e811e-bd9f-4901-a54d-ece37ad5a5f1 · Serus https://mobbin.com/sites/sections/59e1bf61-234b-4bc6-8190-d88dea1ccbef · Campsite https://mobbin.com/sites/sections/e4547810-67d9-46bc-b103-77bb719fe9a6 | Flim: huge grotesk headline, mono nav ("HOME / PRICING / BLOG"), mono "SEARCH ⌘/" pill. **Serus: words fanned in an arc around the input**, which is "text as matter" almost literally. Campsite: command-palette-style input with typed scopes ("Search projects… / people… / tags…"). |

**Pattern to adopt:** one input-first screen. The topic goes in the field, `region` and `goal` are inline token pills, an attach button sits inside, and a depth selector is optional. Recent projects go below as a ruled text list with a mono timestamp and node count.

---

## 2. Graph / network / canvas with a detail inspector

| Ref | Link | Steal |
|---|---|---|
| Memotron graph + preview split (Refero) | https://refero.design/pages/f3b58721-e1dc-4fcc-8853-d14defdfc538 | About 60/40 split: node-link graph on the left, preview/details card on the right. A **Graph / Timeline toggle and a Depth dropdown** sit above the graph. This is the closest direct analogue to KGE. |
| Memotron dark graph + metadata inspector (Refero) | https://refero.design/pages/b45d348e-68e6-4d55-951e-726be89edda5 · light: https://refero.design/pages/1f61c589-764c-43fd-a363-13eacac93467 | Selected node sits at the centre of a radial ego-graph. A fixed right **metadata inspector** and a bottom view switcher (Markdown / "Bird view") let you read the same node as prose or as graph. |
| Memotron overview graph (Refero) | https://refero.design/pages/5e6a5328-978b-44dd-8f3a-2d368160dbec · dark w/ "hide orphans": https://refero.design/pages/a651d4c1-f555-40ac-8041-8a1aa4d31985 | Whole-corpus graph of grey labelled dots, with Overview / Graph / Map tabs plus a search field. The **"hide orphan nodes" toggle** is a cheap way to declutter KGE graphs. |
| Parallel Deep Research result tree (Refero flow 9052, steps 12–16) | completed: https://refero.design/pages/2c65f963-3a49-4d54-883d-38dd875810ec · select node: https://refero.design/pages/b7473d4d-f2f1-47f9-9860-75858934f490 · basis/reasoning: https://refero.design/pages/6ed820a6-666b-4eb9-84bf-45f35d45b021 · drill down: https://refero.design/pages/0aeaf385-f09e-4359-8a68-6353109eb347 | After a research run you select a field node and get a **"Basis / Reasoning" panel with its sources**, then drill into the hierarchy. A Human / MACHINE tab (https://refero.design/pages/c1414ff8-41df-4bc8-b9d8-5b4e15252cfd) shows the same result as prose or as structured data. This is the best model for KGE's node inspector: **why this node exists + evidence links**. |
| Cofounder radial agent map (Mobbin) | map: https://mobbin.com/screens/318b6b9f-1fa5-41a0-85bb-be63657985de · node selected: https://mobbin.com/screens/e16a7369-dcf7-441a-aefb-0bdab51d6df6 | Hub-and-spoke circle diagram with dashed orbit lines, node labels as small pills, and a "2 agent updates · Review" toast. The selected node opens a right panel with stacked collapsibles (Agents / Tasks / Files / Context), and **Context is a raw JSON block set in mono**. Collapsible inspector sections fit KGE's node types well (paper / org / product). |
| WRITER blueprint canvas (Mobbin) | https://mobbin.com/screens/7bb09b9c-de27-4a19-8183-36df6bb26afc | Dotted-grid canvas, **minimap + zoom cluster bottom-left**, and a right property inspector with typed "Label : Type" field captions. Bottom bar holds collapsible Code / Log drawers. |
| Railway service canvas (Mobbin) | https://mobbin.com/screens/f0f3bdde-1afd-4a81-985e-a44650977893 | Dark dotted canvas with a few large node cards. The **right panel is an agent chat** describing what was built. This is the pattern for "Ask lives beside the graph" rather than on a separate tab. |
| Twenty workflow run (Mobbin) | https://mobbin.com/screens/88c3012e-b183-4c4f-8e97-70766e873c1b | Three panes: record fields on the left, a node graph in the middle (**completed nodes solid, pending nodes faded**), and the node inspector on the right with Output / Node / Input tabs. The faded-pending treatment carries straight into KGE's build-in-progress graph. |
| Craft whiteboard (Refero) | https://refero.design/pages/73652f2b-18ad-47d8-bb5f-031f114a5b4b | A light dotted grid with a **floating bottom-centre tool palette** and a contextual menu on the selected object. The palette is a minimal chrome model for graph tools (select / pan / filter / focus). |

**Pattern to adopt:** a full-bleed graph with floating chrome: top-left a view switch (Graph | Clusters | List), bottom-left zoom + minimap, and a right inspector that slides in on select. The inspector order is: type label in mono caps → title → "Why it's here" (basis + evidence count) → sources → related nodes. Pending or low-confidence nodes are drawn faded or dashed.

---

## 3. Progress of an AI agent doing multi-step work

| Ref | Link | Steal |
|---|---|---|
| Elicit report status rail (Mobbin) | https://mobbin.com/screens/6b7e1d2e-50e7-4414-b2b6-b542449be72f | Right rail "Status" checklist with counts: Gather papers (50 found) → Screen papers (10 included) → Extract data (50 data points) → Generate report [Save PDF], plus a **Details ↗ link per step**. The top shows a step-dots pager over pipeline artifacts. **Best fit for KGE's build screen**: each stage gets a counter (concepts found, papers linked, orgs resolved). |
| Microsoft Copilot "See my thinking" (Mobbin) | https://mobbin.com/screens/ae62408b-0082-4e4b-a874-4eb1058be971 | A vertical timeline of typed steps (Reading `domain` chips, Thinking, Searching "query") ending in "Your report is ready!" + [Go to report]. Each step is a **verb label + mono domain chip**, which reads very well in a mono system. |
| ChatGPT deep research Activity panel (Mobbin) | https://mobbin.com/screens/73833b79-1dd5-4354-8fc4-a2e99c33a75e | A right panel with Activity / "23 Sources" tabs, a running narration of reads and searches, and a footer "Research completed in 5m · 23 sources". The **elapsed time + source count footer** works as a summary line. |
| Perplexity in-progress steps (Mobbin) | https://mobbin.com/screens/75d9f23e-7934-44c7-b1fd-77a77ba712e6 | Collapsible step rows ("Searching the web ›", "Searching for … ⌄") that expand to show the actual query plus result rows, then a "+7 more" link. Answer / Links / Images tabs sit at the top. Use **collapsed by default, expandable for the curious**. |
| Mistral Le Chat researching card (Mobbin) | https://mobbin.com/screens/fe862903-a604-4b11-80fc-a809c70f14be | A compact card: "Researching…", a source-favicon stack + "54 Sources", **"15 min estimate"**, and [Cancel]. The time estimate and cancel control are essential for long builds. |
| Gemini deep research (Mobbin) | https://mobbin.com/screens/d90bc856-6175-43cd-965e-d27cf51ed088 | "I'll let you know when the research is finished. **You can leave this chat in the meantime**" plus a side panel streaming a italic thinking paragraph over skeleton lines. This is the pattern for non-blocking builds: let users go to Recent projects. |
| Parallel deep research running states (Refero flow 9052, steps 7–11) | initial: https://refero.design/pages/0ad4ae80-78f8-45e2-a604-e19c3e7f323d · early results: https://refero.design/pages/6e06cc9e-6ab9-4a5e-af44-04ba109c961f · activity toggle: https://refero.design/pages/7ffa2b1b-2e01-438a-a070-d9e08880cadc · near done: https://refero.design/pages/af21062d-7008-4431-a4e8-0dcb058c5d24 | **Early results render while running**, and an activity-visibility toggle hides the log. The **structure fills in progressively**, which is exactly what a building graph should do. |
| Grok DeepSearch stepper (Refero) | https://refero.design/pages/047ee35d-9a1c-4c90-b380-73455cf879e8 (flow https://refero.design/flows/5329) | A narrow left stepper (Thinking → Querying → Browsing & Compiling → Completed) next to the right summary panel. |
| Devin test-run timeline (Mobbin) | https://mobbin.com/screens/c99e107b-7eb4-4b38-91f7-f6ba4ea9a6d6 | A right log of steps with a **mono timestamp column** (0:14, 0:17…), green check + result sub-line per step, and a segmented scrubber timeline at the bottom. The timestamp gutter is a strong mono-grid motif. |
| Base44 "Creating Your App" (Refero) | https://refero.design/pages/35d11929-563b-487c-9e36-0060fbc3bcdd | Left: task list with circular per-task progress + a "change request" input **while building**. Right: big centred status. Letting the user steer mid-build ("also include…") is the steal. |

**Pattern to adopt:** a two-column build screen. The left column is a ruled stage list (mono index `01 02 03…`, verb label, live counter, elapsed time, expand for log). The right column is the **graph drawing itself in real time** (nodes fade in, pending stages dashed). Footer holds "≈ N min · Cancel · You can leave, we'll keep building".

---

## 4. Report / brief reading view with citations

| Ref | Link | Steal |
|---|---|---|
| Elicit research report (Mobbin) | https://mobbin.com/screens/6b7e1d2e-50e7-4414-b2b6-b542449be72f | **Serif display title**, date eyebrow, lede paragraph, ABSTRACT / METHODS / RESULTS small-caps section labels, inline citation glyphs after sentences, and a results table. A right rail holds Status + "Ask anything about the report" chat, plus [Save PDF]. This is the closest editorial-report reference. |
| Copilot report References list (Mobbin) | https://mobbin.com/screens/ae62408b-0082-4e4b-a874-4eb1058be971 | "References 31 ⌃" collapsible: numbered rows with favicon + domain chip on line 1 and title on line 2. Use this as the **end-of-brief bibliography**. |
| Gemini Notebook (NotebookLM) three-pane (Mobbin) | chat + quiz: https://mobbin.com/screens/dc509dd4-d7ba-455d-89ed-5da12020ed3b · report + export: https://mobbin.com/screens/0f98a3f0-60a1-4ff6-9c48-1e21c4d9b714 | Sources (checkbox list) | Chat with **superscript numbered citation bubbles** | Studio > Report with "View prompt and 8 sources", Export to Docs/Sheets, and Good/Bad report feedback. The checkbox-scoped sources are useful for KGE: **toggle uploaded docs in or out of the brief**. |
| Perplexity research page (Refero) | https://refero.design/pages/4e086268-37b9-4104-ab13-4f8d786bde21 · overflow menu: https://refero.design/pages/88fadff2-36b9-4b14-81dd-76f3fdd42d55 | A long-form page with a large title, review/source count, bullet findings, top-right **overflow menu (bookmark / export / delete)**, and a pinned follow-up input at the bottom. |
| Grok compiled report (Refero flow 5329, steps 10–14) | long-form: https://refero.design/pages/944a0c70-5cb2-499c-892d-4920631e879b · table: https://refero.design/pages/a267b341-3c5a-4684-a4bc-97ef5540233d · citations: https://refero.design/pages/6ea5b85b-1991-43ce-b7a3-69cf77c72b15 | Report → **structured key-events table** → conclusion → "Key citations" list. Shows rhythm for a long brief: prose, then a table, then prose, then sources. |
| Anthropic research article (Refero) | https://refero.design/pages/1ec3888e-2e13-482b-b6ac-7527433a0301 | Centred bold title + black "Read the paper" CTA, single-column academic text with inline charts. This is the typographic register for the printable brief. |
| Langdock canvas doc (Mobbin) | https://mobbin.com/screens/7c1c4ec7-4d53-4625-9310-e9cde1b4417b | Chat on the left, an editable doc on the right with [Export ▾] and a **select-text → "Editing instructions…" inline prompt**. Future: "rewrite this section" on the brief. |
| Semrush report builder (Mobbin) | https://mobbin.com/screens/68236566-2be5-437b-910a-a65f39ef111a | A paged print-preview canvas with **"page break" markers** and [Generate PDF report], plus a widget TOC on the left. Good reference for the print/PDF mode of the brief. |

**Pattern to adopt:** a 65–70ch reading column with a serif or grotesk display title, mono eyebrows (`BRIEF · 10 OCT 2026 · 142 NODES · 38 SOURCES`), and small-caps section labels. Inline `[n]` citations open a source popover, and each cited node links back to the graph. A sticky left TOC sits on desktop, with [Download .md] [Print] in the top bar. A paged print stylesheet keeps the same typography.

---

## 5. Card / board of scored items with filters and sort

| Ref | Link | Steal |
|---|---|---|
| Attio companies table (Refero) | https://refero.design/pages/361d1d78-a133-43a7-b1ca-52a9ee163e15 · toolbar: https://refero.design/pages/4230ed22-90d5-4524-8348-840c69529946 | A Sort / Filter / View settings / Import-Export toolbar over a dense table, with **connection-strength dots** and category badges. Dots are a monochrome-friendly way to show evidence strength (●●●○○). |
| Attio "Startup fundraising" template (Refero) | https://refero.design/pages/5741d3fc-3314-4e21-85d3-cad597c0b8a4 | Table on the left + context sidebar on the right inside one modal: **list + inspector for scored items**. |
| Teal company tracker (Refero) | https://refero.design/pages/fc73a219-3578-4380-ac3c-0de126afcb30 | A company table with **star "excitement" rating** column, grouping and customisable columns. Shows a user-adjustable score next to a system score. |
| The Org prospect filters (Refero) | https://refero.design/pages/13805aae-571f-440b-a19d-2f6cd30b0d85 | A collapsible-category left filter sidebar, a People/Companies segmented control, a paginated card list and **saved filter sets**. |
| Whop discover sort menu (Mobbin) | https://mobbin.com/screens/59cef983-96aa-42af-b85b-501f61455823 | A sort popover listing explicit sort keys (Highest Budget, Most Paid Out…), filter dropdowns on the right and [× Clear]. For KGE: **sort by Score / Evidence / Risk / Novelty**. |
| Airtable gallery (Mobbin) | https://mobbin.com/screens/0e9a986f-01cd-4332-ac89-ba5c36853ae3 | Gallery cards that list labelled fields vertically (Status pill, Progress %, Assigned…), with Status / Assigned / Timeline filter buttons. Model for **opportunity cards as "spec sheets"**: label/value rows, not marketing blurbs. |
| Dovetail configure grid (Mobbin) | https://mobbin.com/screens/72992baa-9e2a-4859-8c9d-1021428530c6 | A "Configure" popover with Display / Filter by / Sort by sections plus a Grid toggle, and a "Chat with data in project" pill pinned at the bottom (Ask over the board). |
| Linear filtered issues (Refero) | https://refero.design/pages/3fd6537e-7354-4f82-abeb-d20d8e39b4b6 (flow https://refero.design/flows/6670) · dark grouped list: https://refero.design/pages/58ac6637-2009-4f3e-86c3-382b0dbfd942 | Filter chips stacked in the top bar (Assignee, Priority, Label) and grouped rows with status glyphs. The **triage density** to aim for when the list view is preferred over cards. |

**Pattern to adopt:** Opportunities as a toggle between Cards and Table. Each card is a spec sheet: mono rank `#01`, title, one-line thesis, and three labelled meters (Score as a numeral, Evidence as ●●●○○ dots, Risk as low/med/high text), plus a cited-node count and "Open in graph". The toolbar has filter chips, a sort popover with explicit keys, and Clear.

---

## 6. Q&A answer with source chips / citations

| Ref | Link | Steal |
|---|---|---|
| Perplexity iOS answer (Mobbin) | https://mobbin.com/screens/ed2a7c24-231d-4447-b16d-d168444ba252 | **Inline grey mono source tags after sentences** (`hojicha +1`), an action row (share/download/rewrite/copy + "9 sources" stack), and related follow-ups as ↳ rows. The `label +N` tag maps directly to KGE "node chips" that highlight nodes on hover. |
| Comet iOS answer (Mobbin) | https://mobbin.com/screens/0a584c18-4690-4661-9a0d-d7b33917bee8 | "1 step completed ›" collapsed above the answer, bold headings, and inline `morningstar +2` tags. |
| ChatGPT iOS sources sheet (Mobbin) | https://mobbin.com/screens/3eaf4e44-fdce-48bc-965b-b194ed9c43ac | Tapping Sources opens a **bottom sheet listing sources** (site, title, snippet). Use it on mobile for "nodes used in this answer". |
| Dropbox Dash thinking + sources (Mobbin) | https://mobbin.com/screens/f4ca9d48-c17a-40e5-98a2-f3a293483967 | "Thinking… ⌄" with sub-steps ("Analyzing 20 sources from Gmail") and a bordered source list card (title + updated date) + "Show more". The attached PDF shows as a chip above the question. |
| Exa Answer with citations (Refero flow 12018) | streaming: https://refero.design/pages/89b79373-9f9f-4809-b68f-2070e15d131a · sources: https://refero.design/pages/a44122e8-2a88-4e60-9a76-151d4c133579 | Query → streamed answer → citations/sources panel for judging credibility, in a playground layout. |
| Parallel research chat (Refero flow 9073) | sourced results: https://refero.design/pages/f80013ae-0724-48f9-808c-78c5bdebde8a · summary + source list: https://refero.design/pages/cdf27bb7-2337-4511-b537-edc6aa76d116 | A multi-turn chat with a speed/factual **mode switch** and a consolidated source list at the end. |
| Factory in-doc assistant (Refero flow 7718) | https://refero.design/pages/cb5162db-6c67-4d7b-8ce3-b00769568f22 | An assistant panel docked beside the article, so the content stays visible while the answer arrives. This is the model for **Ask docked next to the graph**, with answers highlighting nodes on the canvas. |

**Pattern to adopt:** the answer is prose with inline mono node tags (`[Solid-state electrolyte]`, `[CATL +2]`). Hover pulses the node in the graph, and clicking focuses it. A "Used N nodes · M sources" line sits below, and follow-ups are ↳ rows. On mobile, sources and nodes open as a bottom sheet.

---

## 7. Monochrome / brutalist / typographic / mono-font styles (Refero styles)

These are marketing-site styles. Refero has no in-app style systems, so pair them with the product-screen refs above. IDs can be opened with `refero_get_style`.

| Style | Source URL · Refero style ID | What to take |
|---|---|---|
| **mono (frm.fm)** | https://mono.frm.fm/en · `4b3c372c-aff6-4608-bafb-1dde853c4805` | Architectural grid, 1px rules, boxed navigation, condensed uppercase tracked labels, no radius or shadow. **Strongest primary candidate** for "mono grids". |
| **Factory.ai** | https://factory.ai · `f1ed1d46-4e76-41fe-a9f8-3017e55dc6ee` | "Technical-brutalist blueprint": pale grey canvas, Geist tight headlines, mono code blocks, dotted motifs/wireframe frames, a **single tiny orange accent for status dots only**. A good model for one functional accent (e.g. "live / building"). |
| **Control (cntrl.site)** | https://cntrl.site · `94565ee3-1022-4150-bec1-2863506e2951` | Oversized heavy headlines, mono utility labels, sharp-corner thin-border buttons, and grid canvas screenshots in faux windows. Accents act as functional markers. |
| **19–86** | https://19-86.fr · `7a8c99db-5ce7-4fa4-b491-8f1fcac18991` | Archive list: full-width 1px horizontal rules, tabular alignment, a monumental numeral, small dot markers. The template for the **Recent projects / Clusters list** as an index. |
| **Nofilter.space** | https://www.nofilter.space · `d2639b27-614d-45cf-b048-6bb76e67159e` | Broadsheet grid, oversized wordmark, checkbox-square nav, edge-to-edge blocks with thin borders. The template for the **Opportunities grid as a newspaper index**. |
| **Fonts In Use** | https://fontsinuse.com · `470e5fb7-8e29-4b30-acc5-fb2907d86b51` | A specimen-catalog density: condensed display labels, compact metadata under items, small sharp filter inputs. |
| **PlanetScale** | https://planetscale.com · `c0f79217-5105-4765-bf7a-8ccc9a3284c4` | **Monospace everywhere** (headlines included), rigid tables with thin borders, square tabs/buttons. Shows mono can carry a whole UI. |
| **099.supply** | https://099.supply · `ce3ec092-ab2a-41ac-8dbc-4d23d6f0231a` | A dark, all-monospace "terminal workbench": black/charcoal panels, white labels over grey support text. Candidate for **dark mode**. |
| **Anthropic** | https://anthropic.com · `72140292-15fd-4052-bf1b-ecfa9eda9d9a` | A research-journal register: grotesk + serif pairing, mono metadata labels, abstract neural-mesh visual. Fits the Brief view. |
| **shadcn/ui** | https://ui.shadcn.com · `c14c0a94-1037-449e-bf5b-4cb972656ac7` | Monochrome component baseline with black as the only action colour. A pragmatic implementation base under a more editorial skin. |
| Also seen | Midjourney (ASCII sphere hero, mono nav) `1e85631f-1e2e-41fa-a5dc-b1604bdbe25a` · mostlikely.at (grainy black forms, thin top bar) `f28e4392-f903-4e65-8b7e-6f6599e2f905` · Elvina Prasad (academic monumental type) `44fde25c-8772-40f6-a828-f78046cf4f07` · Index (midnight grid + mono labels) `e88523e4-3ecc-48e0-a768-4acad4bd2cde` | The Midjourney ASCII sphere is a direct precedent for "text as matter" (an object made of characters). It could be the empty-state or build-loading visual: a graph rendered in glyphs. |

**Suggested lock (for the design-system step):** primary **mono (frm.fm)**, adding Factory.ai's single functional accent for live/building state and 19–86's ruled archive lists. PlanetScale is the precedent for mono body text. Reject soft radii, glows and gradient bars (Vapi/Langbase/Krea direction).

---

## 8. Mobile: graph/map with bottom sheet; onboarding tour

### Bottom sheet over a canvas (map analogues; no mobile graph found)
| Ref | Link | Steal |
|---|---|---|
| Pangea map + sheet (Mobbin) | https://mobbin.com/screens/35d864c0-77f9-492e-8ffb-595593434807 | Segmented control (My Travels / Explore) and filter pills float over the canvas. The half-height sheet has a grabber, title, share/close, chip actions, and the tab bar stays visible. A full template for the KGE mobile graph: **view switch + filters float, node sheet at 40%**. |
| Bump place sheet (Mobbin) | https://mobbin.com/screens/6e595a2b-8cf0-4099-8bc1-52b9ccc6223f | Selected pin shows a **label callout on the canvas** while the sheet holds details; a distance chip sits on the sheet edge. |
| Cash App ATM sheet (Mobbin) | https://mobbin.com/screens/f70ac04e-6599-4cd0-b4b6-9178f7fc177b | A minimal monochrome sheet: logo, big title, one data row, secondary + black primary button. Closest to the target aesthetic. |
| Pangea Charging (Mobbin) | https://mobbin.com/screens/f30de3e6-09d9-4012-b0f1-0de74c0208f3 | A selected pin turns into a **large circled marker** and the canvas stays interactive above the sheet. |
| ChatGPT iOS sources sheet (Mobbin) | https://mobbin.com/screens/3eaf4e44-fdce-48bc-965b-b194ed9c43ac | Sheet used for a citations list (reuse for Ask on mobile). |

### Onboarding tooltips / spotlight tour
| Ref | Link | Steal |
|---|---|---|
| monday.com coach mark (Mobbin) | https://mobbin.com/screens/8e52a60c-69ba-41b3-9828-3c9d44328ef6 | The whole UI fades to a white veil except the target button. The tooltip has "3 of 3", [Finish], × and an arrow. A **light-veil spotlight** suits monochrome better than a dark scrim. |
| MD Vinyl tooltip (Mobbin) | https://mobbin.com/screens/499c9722-98a4-42ac-9c3a-eb365a53f289 | A tooltip anchored above the bottom nav with a "1/3" counter, title, one sentence and an outlined [Next]. |
| Google Drive circular spotlight (Mobbin) | https://mobbin.com/screens/c75ea239-a35c-4fd8-a71a-468ce51b390c | A Material-style expanding circle reveal around the target icon. |
| Tango guided tour (Refero) | https://refero.design/pages/8a3b9459-7662-42c7-b8e1-2f03b96dd21c | A dark overlay, glowing target box, **hand-drawn curved arrow** and [Next]. |
| Hashnode AI tour modal (Refero) | https://refero.design/pages/9de296fd-0293-4009-846f-aed7664582cc (flow https://refero.design/flows/3918) | Centred "Step 2 of 4" modal with Previous/Next. An alternative to anchored tips for concept explanation (what's a cluster, what's evidence strength). |
| Wrike first-run popup (Refero) | https://refero.design/pages/7b3d87e9-a931-4b71-989c-38add44f6861 | Small top-left welcome popup with **Next + Skip** over the live tool, so the user isn't blocked. |

**Pattern to adopt:** 4–5 anchored tips on a white veil. Each tip has a mono `02/05` counter, a one-line label, and Next / Skip. The tour runs on the **first completed graph**, not on the empty home. On mobile the graph is full-screen with floating view + filter controls, the node inspector becomes a 3-detent sheet (peek: title + type; half: why + top sources; full: everything), and the tab bar is Graph / Opportunities / Ask / Brief.

---

## Upload PDF/CSV (bonus)
| Ref | Link | Steal |
|---|---|---|
| ChatGPT project "Add sources" (Mobbin) | https://mobbin.com/screens/79091b4e-7bab-4066-aa7a-92eb9deba604 | A large dashed drop zone plus 4 equal source tiles (Upload / Text input / Drive / Slack). |
| Grok Project Sources (Mobbin) | https://mobbin.com/screens/8522468b-ba24-44ba-a528-80e4bcb87c5a | Minimal monochrome modal with a drop zone, **"Add sources later"** escape link and a black [Create] button. |
| Lindy files (Mobbin) | https://mobbin.com/screens/50bd3a40-45f3-44a4-a9da-fe935dffefe1 | An uploaded file row with a **"Syncing" status** and enable toggle, so per-file processing state is visible. |
| Exa agent input data (Refero flow 12021) | https://refero.design/flows/12021 | CSV upload or pasted JSON → confirm imported rows → the dataset shows as **attached to the query**. Matches the KGE CSV-enrich flow. |
| Mistral upload (Mobbin) | https://mobbin.com/screens/a5bb0993-1f68-42ff-a51a-68f7c360681a | Drop zone that states limits ("Up to 100 files, 100 MB per file") and links to supported extensions. |

---

## Gaps (searched, nothing usable returned)
- **Obsidian graph, Kumu, Heptabase, Tana, Neo4j Bloom, Figma inspector, Miro inspector:** not returned. Heptabase isn't a Refero site, and Miro results were only empty-board screens. Memotron (Refero) and Parallel's result tree are the best graph+inspector substitutes. Kumu/Obsidian/Bloom need a manual capture.
- **Manus agent progress:** Refero only has the Manus task-entry flow (10436), not the running-task view. Elicit, Copilot, ChatGPT and Parallel cover the progress pattern.
- **Consensus, Arc Search, Exa home:** Consensus isn't in Refero, Arc wasn't returned, and the Exa home query returned real-estate noise. Exa is covered only via its Answer and Agent flows.
- **Dealroom, Crunchbase, Product Hunt:** not returned. Attio, Teal, The Org and Whop are substitutes for scored lists. No ref combines a numeric score + evidence + risk on one card, so this card is original design work.
- **Mobile graph/network with bottom sheet:** none. Only map analogues (Pangea, Bump, Cash App).
- **Monochrome *in-app* product UI:** Refero styles cover marketing pages only. The closest in-app monochrome screens are Grok's project-sources modal and Cash App's sheet. The editorial in-app layer has to be synthesised.
- **Clusters list view:** no dedicated reference found. Proposed treatment: the 19–86 ruled archive list with Linear's grouped-row density.
