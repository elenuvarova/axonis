# Lacuna: typeface research (Refero + Mobbin)

Date: 2026-10-10. Sources: Refero MCP (`refero_search_styles` with 14 queries, `refero_get_style` on 33 styles) and Mobbin MCP (`search_sections`, `search_screens`).

**How to read this**
- Font names in the table come only from what Refero's style extraction returned. Where Refero suggested a "Substitute", it is shown in *italics*.
- **Mobbin returns screenshots only. It gives no font metadata.** Mobbin rows are visual-pattern references and carry no font names.
- Licence labels (GOOGLE / ADOBE / FREE / PAID) are **not** from the tools. They come from my own type knowledge. Check each one on fonts.google.com, fonts.adobe.com or the foundry page before use. Rows marked "verify" are the ones I am least sure about.
- Exclusion list fonts are tagged **[EXCL]** where they show up, and none of them are recommended.

---

## 1. Reference table (31 refs)

Directions: **A** = Lexicon (paper & ink, editorial serif), **B** = Signal (black data room, mono-first), **C** = Orbit (kinetic wide grotesk, rings, bubbles).

| # | Site | Source / ID | Fonts found (*Refero substitute*) | Dir | What's notable about the type |
|---|---|---|---|---|---|
| 1 | mono.frm.fm | Refero style `4b3c372c-aff6-4608-bafb-1dde853c4805` | NH (*Helvetica Neue*), S-Condensed (*Impact*), EV (*Roboto Thin*), S-Works (*Bebas Neue Pro*) | A/B | Four families, all set at hairline-to-regular weight. Hierarchy comes from tracking: condensed labels at +0.1–0.2em, headings at −0.02em. 1px rules and 0 radius. A good model for a "grid of rules". |
| 2 | 099.supply | `ce3ec092-ab2a-41ac-8dbc-4d23d6f0231a` | Söhne Mono only, 400, 16px (*Space Mono [EXCL], Fira Code*) | B | One mono, one size, one weight for the whole UI on #000. Hierarchy is white vs #888 only. The purest "terminal catalogue". |
| 3 | Midjourney | `1e85631f-1e2e-41fa-a5dc-b1604bdbe25a` | JetBrains Mono [EXCL], DM Sans [EXCL] (*Fira Code, Source Code Pro*) | B | Mono for every role, with 30px headings at weight 400 ("headings do not shout"). The hero is an **ASCII-generated sphere**, the closest match to the "letter spheres" moodboard. |
| 4 | PlanetScale | `c0f79217-5105-4765-bf7a-8ccc9a3284c4` | ui-monospace system stack, 400–700 (*Recursive Mono*, JetBrains [EXCL]) | B | A light-theme site set fully in mono, with headlines included. Sharp 0px corners, plus electric blue links and an orange CTA. Shows that mono-first also works on paper white. |
| 5 | Factory.ai | `f1ed1d46-4e76-41fe-a9f8-3017e55dc6ee` | Geist [EXCL], Geist Mono [EXCL] | B | Display at −0.048em tracking, weight 400 only. A dotted-grid "technical brutalism" with an orange status accent. Note the stack, don't reuse it. |
| 6 | Parallel | `9bcb461d-a371-499a-a109-574ca537de5f` | gerstnerProgramm (*Inter [EXCL]*), ftSystemMono (*Roboto Mono*) | A/B | A humanist grotesk paired with a mono for toggles and data readouts ("Human/Machine"). The hero is a **dense field of random characters** on a blueprint-blue panel. |
| 7 | Hyperstudio | `8c796b69-7c95-425b-b716-5544ff14b530` | Aeonik 400/700 (*Inter*), Input mono (*IBM Plex Mono [EXCL]*) | B | Geometric grotesk at 63px / 0.95 line height plus Input mono at −0.037em for data. Imagery is a **pixel-dot hand** on black. Amber "NEW" tags. |
| 8 | cthdrl | `20aba0df-9f33-4217-a804-0548abb5ad6d` | NB Akademie (wide) (*Montserrat [EXCL]*), NB Akademie Mono (*Space Mono [EXCL]*) | B/C | A **wide** grotesk display at 121px / 0.85, paired with its own mono at 11px / −0.045em. Cream #e7ded1 on #000 with fine geometric arcs. Sits between Signal and Orbit. |
| 9 | Anthropic | `72140292-15fd-4052-bf1b-ecfa9eda9d9a` | Anthropic Sans, Anthropic Serif (*Playfair Display, Lora*), Anthropic Mono (*JetBrains [EXCL]*) | A | A research-journal setup: serif at 91px only on dark cards, grotesk at 61px / −0.02em on ivory, mono for DATE/CATEGORY metadata. Emphasis comes from a thick underline, not color. |
| 10 | Claude | `5369aa4f-1813-4e6d-949e-32a75ff7d920` | Anthropic Serif wt 330 (*Lora*), Anthropic Sans 400–600 (*Inter*) | A | The serif display is set at weight **330**: authority from lightness. The page reads like a "Vellum journal". |
| 11 | Visual (designstripe) | `698dceaf-3382-4e5a-a71b-dca92c0055aa` | fontSerif 300/400 (*Playfair Display*), fontMono 300–500 (*IBM Plex Mono [EXCL]*) | A | **Serif headlines with mono for ALL body, nav and buttons.** Muted lime #fff347 accent on parchment, dotted grids. This is Lexicon almost exactly. |
| 12 | Symbolic.ai | `b49ec76c-1410-44cb-9de1-b5ac58255949` | Suisse Works Book/Medium (*Lora*), Open Runde, Geist Mono [EXCL], Grenze Gotisch | A | An editorial serif display over a soft rounded sans. Paper-card layering on #fdfcf5. |
| 13 | Fonts In Use | `470e5fb7-8e29-4b30-acc5-fb2907d86b51` | Benton Sans RE (*Inter*), Relay Cond (*Oswald*) | A | An archive index: dense 14px sans plus condensed titles, 2px radius. Useful for paper and entity list views. |
| 14 | Medium | `4784cf2e-58ed-4b0c-8e6d-8758f595d997` | GT Super (display 120px), Söhne (UI), custom content sans | A | A high-contrast serif display at poster size with a quiet grotesk UI. The classic "literary" pairing. |
| 15 | ARTWORLD | `66aea62e-9ee2-45d7-ac30-6a69166a7e59` | Cardinal Fruit + Italic 300 (*Playfair Display / Italic*), Cardinal Classic Italic, Graphik Light (*Inter*) | A | **Lines of names alternate between serif roman and italic**, set over a huge cropped black sans wordmark. Directly usable for lists of concepts and authors. |
| 16 | Metalab | `0d6932a8-426f-4ac5-a30c-b0d8ab437967` | PP Eiko wt 240 (*Playfair Display*), Basis Grotesque Pro (*Inter*) | A | A hairline serif display at 88px with tight tracking: "type as art object". |
| 17 | Freshman | `0459f838-4b02-4ab9-b6b1-f3cc6f053034` | TT Firs Neue, Editorial New wt 200 (*Lora*), Altform (*IBM Plex Mono*), Wasted Year | A/C | A brash heavy sans wordmark paired with a whisper-light serif (wt 200) for menus. A single red accent. |
| 18 | Henry (henry.codes) | `2aa3e531-d3d6-472a-8ada-76cbf9435dd2` | Neue Montreal (*Inter*), Louize Display (*Anton*), Louize (*Merriweather*), Manuka 226–371px (*Oswald*) | A/C | Newsprint brutalism with a distressed serif display at 132px / 0.8. Background type at 371px is used **as texture**, which fits "text as matter". |
| 19 | V–A–C | `ffef8672-f789-4329-8895-47e50f517d31` | Diagramatika Text / Display (*IBM Plex Sans [EXCL]*) | A | A cultural catalogue grid with rotated vertical labels and 150px section gaps. One family in two optical cuts. |
| 20 | Linear Changelog | `11d3e58a-87d7-4a9a-bbf5-720f4fd3ffc6` | Inter Variable [EXCL] wt 510/590, Berkeley Mono (*Space Mono [EXCL]*) | B | Uses odd variable weights (510, 590). Berkeley Mono is kept strictly for timestamps and code. |
| 21 | ClickHouse | `289021a2-4f3b-45b2-9009-972d72393ab7` | Basier 600 (headings), Inter [EXCL], **Inconsolata** 600 | B | A dark console with a chartreuse #faff69 accent, the closest match to the "acid yellow" accent. Inconsolata is the one free mono found in actual use. |
| 22 | Warp | `40a9c295-7a6f-48b3-ae15-2c4d171cf8fb` | Matter + Matter Mono (*General Sans [EXCL], Manrope [EXCL], DM Sans [EXCL]*), Geist Mono [EXCL], DM Mono [EXCL] | B | Display tracking runs from −0.04em at 64px to −0.01em at 20px. One family covers everything. |
| 23 | Telepathic Instruments | `1637a507-9db3-4140-88df-0287b2b0b346` | Suisse Intl (100px, −0.03em), Suisse Intl Mono (*JetBrains [EXCL]*) | B/C | A "lab instrument" grotesk with a sister mono. Single amber accent. |
| 24 | Elektron | `362d9644-ce48-40af-8c2a-35753ec54b5e` | Neue Haas Grotesk Text/Display Pro, digi one v2 (*Dot Digital-7*), Analog One V2 (*Share Tech Mono*) | B | A dark control panel: Neue Haas at 64px / 0.95 / −0.04em, with **LCD and digital fonts for readouts**. |
| 25 | teenage engineering | `2055406e-755a-4276-af43-09d6b06a78f3` | te-20 wt 100/300, te-40 wt 300 (custom; *Inter*) | B/C | Industrial and whisper-thin (weights 100–300), with electric blue #0071bb used only for interaction. |
| 26 | lorenzodaldosso.it (ldd) | `cde2f25f-20b8-4110-b281-cbc26ed3690b` | LDD custom pixel font 135px (*Press Start 2P*), Neue Montreal | B/C | A **giant pixel/ASCII display** on cream next to a tiny clean sans. Shows how to bring an ASCII grid onto the paper theme. |
| 27 | GT Planar | `8ac461ad-1f30-4829-bb6e-dc68f1d2b6dd` | GT Planar 300/400/700, 11–274px, tracking −0.2em to +0.7em (*Space Mono [EXCL]*) | C | One family pushed across a huge scale and tracking range, with a kinetic radial-streak hero. A model for kinetic display type. |
| 28 | Regis Grumberg | `89597bc3-4e67-4f32-b72f-f45a6690e104` | **Anton** 500 (to 150px), Montserrat [EXCL], monospace, Times | C | **White letters arc into a circular spiral** on black, with a round CTA at the centre. This is the "text on rings" reference. |
| 29 | Co Projects | `f404451e-34c6-4762-83bf-93e4e2885b02` | Alpha, Takt (custom; *Inter, Open Sans*) | C | Massive black **circular letterforms** used as the brand graphic. Weight 400 only. |
| 30 | Basement Foundry | `94f48092-a2f1-4fc8-8530-25b400355d1b` | Basement Grotesque Black **Expanded** 120px, JetBrains Mono [EXCL], Inter [EXCL], plus specimen faces | C | Expanded black grotesk specimens against mono UI rails. Single orange accent. |
| 31 | Haus Otto | `cd8f4ba1-3a00-4435-9ef2-8c075d0fdf26` | Monument Regular/Medium, wordmark at 216px (*IBM Plex Sans [EXCL]*) | C | The scale itself is the identity: a 216px wordmark at weight 400. |
| — | Operate | `a0f473eb-0310-4df5-b5f6-5bc124ad5954` | muoto, denim, cinetype (*Space Mono [EXCL]*) | C | **Bubble data-viz hero** (outlined circles plus a waveform on a ledger grid). Cinetype is tracked to +0.3em. |
| — | Adcker / Egstad | `2fbe6cdf-…5255949` / `f3159058-…a85c` | nhm, psl (*Barlow Condensed*), **Kumbh Sans**; EG Metaphor at 399px with Times New Roman body | C/A | Poster-scale headlines at 173–399px. Egstad pairs a monumental sans with a Times body. |
| M1 | Gumloop (Mobbin) | [screen](https://mobbin.com/screens/83aea83f-d68a-4578-9308-59f8c19daeaf) | not reported by Mobbin | B/C | A **dotted, character-like sphere graph** with floating file nodes. Visual reference for the letter-sphere graph. |
| M2 | Gemini Notebook (Mobbin) | [screen](https://mobbin.com/screens/34b48c43-bdb2-4a72-ae35-8a624c62ad9b) | not reported | A | A three-pane layout (sources / chat / mind-map) for a research-to-map product. Structure reference only. |
| M3 | SSENSE, Frontify (Mobbin) | [section](https://mobbin.com/sites/sections/4de98a06-dbff-4e54-83c6-a301c519bba0), [section](https://mobbin.com/sites/sections/9dc7cb3d-08cc-4c17-bb89-4373060676f2) | not reported (visually: a grotesk caps headline over a large serif deck, and a serif display on off-white) | A | Visual references for an editorial serif hero. |

---

## 2. Frequency of non-excluded fonts

### 2a. Fonts the sites actually use (from Refero extraction)
| Font / family | Count | Where | Licence (my labels; verify) |
|---|---|---|---|
| Söhne / Söhne Mono (Klim) | 2 | Medium, 099 | PAID |
| Neue Montreal (Pangram Pangram) | 2 | Henry, ldd | PAID for commercial use (free licence covers personal use only) |
| Suisse Intl / Mono / Works (Swiss Typefaces) | 2 | Telepathic, Symbolic | PAID |
| GT Super / GT Planar (Grilli Type) | 2 | Medium, GT Planar | PAID |
| Neue Haas Grotesk Text/Display | 2 (Elektron; mono.frm.fm "NH" likely) | Elektron, mono | **ADOBE** (on Adobe Fonts) |
| Anthropic Sans / Serif / Mono | 2 | Anthropic, Claude | custom, not available |
| Anton | 1 (+1 as substitute) | Regis Grumberg | **GOOGLE** |
| Inconsolata | 1 | ClickHouse | **GOOGLE** |
| Kumbh Sans | 1 | Adcker | **GOOGLE** |
| Grenze Gotisch | 1 | Symbolic | **GOOGLE** |
| Open Runde | 1 | Symbolic | **FREE** (OFL, GitHub) |
| Times / Times New Roman | 2 | Egstad, Regis Grumberg | system |
| Matter, Aeonik, Input, NB Akademie (+Mono), Gerstner Programm, FT System Mono, Berkeley Mono, Favorit Mono, Melange, Basier, Benton Sans, Relay Cond, Editorial New, TT Firs Neue, Louize, Diagramatika, Graphik, Cardinal Fruit, PP Eiko, Basis Grotesque, Monument, Basement Grotesque | 1 each | see table | PAID or custom (Benton Sans may be on Adobe Fonts: verify) |

Excluded fonts seen: Inter (5: Linear, ClickHouse, Warp, Foundry, Symbolic), Geist/Geist Mono (4: Factory, Langbase, Warp, Symbolic), JetBrains Mono (2: Midjourney, Foundry), DM Sans (Midjourney), DM Mono (Warp), Montserrat (Regis Grumberg).

### 2b. Free alternatives Refero itself proposed as substitutes (non-excluded)
| Substitute | Times proposed | For |
|---|---|---|
| **Playfair Display** (GOOGLE) | 5 | Anthropic Serif, designstripe serif, Cardinal Fruit + Italic, PP Eiko |
| **Lora** (GOOGLE) | 4 | Anthropic Serif ×2, Editorial New, Suisse Works |
| **Oswald** (GOOGLE) | 4 | Relay Cond, Manuka, Anton, Kumbh Sans |
| **Fira Code** (GOOGLE) | 3 | Söhne Mono, JetBrains (Midjourney), monospace |
| Roboto Mono, Source Code Pro, Recursive Mono, Press Start 2P, Share Tech Mono, Anton, Merriweather, Barlow Condensed, Open Sans (GOOGLE) | 1 each | various |

Takeaway: the strong references almost all use **paid or custom** fonts. A licence-safe system has to be built from mappings, not copied from any one site.

---

## 3. Suggested type systems (licence-safe only)

Every font below is GOOGLE, ADOBE or FREE, and none is on the exclusion list. Licence labels are my knowledge, so verify before shipping.

### A. Lexicon (paper & ink)
Derived from Anthropic, Claude, designstripe, ARTWORLD, Medium, Metalab and mono.frm.fm. The common pattern is a light-to-regular serif display with a strong italic, a quiet grotesk for UI, and mono kept for metadata (DATE / CATEGORY / source counts).

**A1. "Journal" (Adobe-led)**
- Display + text serif: **Freight Big Pro** (display) + **Freight Text Pro** (reading). **ADOBE.** Big has a high-contrast italic, matching how ARTWORLD alternates roman and italic for names, and Medium's GT Super scale.
- UI grotesk: **Neue Haas Grotesk Text** (**ADOBE**). This maps to mono.frm.fm's NH and the Anthropic Sans role.
- Mono (metadata, IDs, citations): **Red Hat Mono** (**GOOGLE**).

**A2. "Open stacks" (all free)**
- Display: **Playfair** (Playfair Display, opsz axis) (**GOOGLE**). It is Refero's most frequent substitute for these refs (5×). Use light weights at large opsz, never bold, following the Claude/Metalab weight-330/240 lesson.
- Text serif: **Source Serif 4** (**GOOGLE**, opsz, good italic).
- UI: **Switzer** (**FREE**, Fontshare ITF licence). Closest free match to the Suisse/Neue Haas role.
- Mono: **Spline Sans Mono** (**GOOGLE**). Following designstripe, mono can carry all nav and buttons.
- Alternate serifs with strong italics: **Erode** or **Sentient** (**FREE**, Fontshare), or **Cormorant** (**GOOGLE**) for extreme display italics.

### B. Signal (black data room)
Derived from 099, Midjourney, PlanetScale, Elektron, cthdrl, Hyperstudio, ClickHouse and Linear. The common pattern is one mono for most UI at weight 400 (headings don't shout), a grotesk only for long reading, and a special readout or pixel face for the ASCII and LCD moments.

**B1. "Terminal" (all free)**
- Primary UI + headings mono: **Martian Mono** (**GOOGLE**; weight + width axes, so one family covers 099-style single-mono UI and wider display numerals).
- Reading sans: **Host Grotesk** (**GOOGLE**) or **Hanken Grotesk** (**GOOGLE**).
- ASCII / pixel layer (letter spheres, counters): **Departure Mono** (**FREE**, OFL). The Refero substitute for the ldd pixel display was **Press Start 2P** (**GOOGLE**) if a chunkier pixel face is wanted.
- Accent: one acid color only (ClickHouse #faff69 shows the role: CTA and active state only).

**B2. "Console" (Adobe + Google)**
- Display / reading sans: **Neue Haas Grotesk Display + Text** (**ADOBE**). Elektron uses exactly this on #000 at 64px / 0.95 / −0.04em.
- Mono (UI chrome, tables, timestamps): **Azeret Mono** (**GOOGLE**) or **Inconsolata** (**GOOGLE**; ClickHouse ships it).
- Readout face: **Share Tech Mono** (**GOOGLE**), the Refero substitute for Elektron's Analog One. Use it only for numbers and counters.

### C. Orbit (kinetic wide grotesk, rings, bubbles)
Derived from cthdrl (wide NB Akademie), Basement Foundry (Black Expanded), GT Planar (extreme tracking range), Regis Grumberg (spiral text, Anton), Co Projects (circular letterforms), Haus Otto (216px wordmark) and Operate (bubble viz). The common pattern is a wide or expanded display that can animate on width or tracking axes, a calm body sans, and a mono for labels on rings.

**C1. "Variable orbit" (all free)**
- Display: **Anybody** (**GOOGLE**, width axis 50–150 plus weight). Animate width for kinetic type, and set it extended on text rings.
- Body: **Hanken Grotesk** (**GOOGLE**).
- Mono (ring labels, bubble values): **Chivo Mono** (**GOOGLE**).
- Free alternates for the display: **Unbounded** (**GOOGLE**, wide), **Panchang** (**FREE**, Fontshare, extended), **Mona Sans / Hubot Sans** with width axis (**FREE**, OFL; also on Google Fonts, verify).

**C2. "Wide system" (Adobe-led)**
- Display: **Acumin Pro Wide / Extra Wide** (**ADOBE**). Alternate: **Aktiv Grotesk Extended** (**ADOBE**, verify).
- Body: **Acumin Pro** regular width (**ADOBE**). One superfamily, so wide headings and normal body share DNA, the way cthdrl pairs NB Akademie with its own mono.
- Mono: **Martian Mono** (**GOOGLE**). Its width axis can be pushed wide to sit next to the expanded display.
- Poster or condensed counterpoint, if needed: **Anton** (**GOOGLE**). Regis Grumberg uses Anton for its spiral hero.

---

## 4. Caveats
- Refero's "Substitute" field is an automated suggestion and often generic (Inter, Playfair). Treat it as a starting point, not a match.
- The excluded fonts were not recommended, even where Refero proposed them (Space Mono, IBM Plex, Montserrat, Helvetica Neue, General Sans, Manrope, DM Sans).
- Some Refero font names are obfuscated (Adcker's "nhm/psr/psl", designstripe's "fontSerif/fontMono"), so the real family is unknown.
- Exa, Elicit and Are.na did not come up as Refero styles in these searches. Nothing Phone did not appear either.
