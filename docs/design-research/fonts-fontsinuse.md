# Lacuna: type research (Fonts In Use and the wider web)

Date: 10 Oct 2026. Covers three directions: A Lexicon, B Signal, C Orbit.

**Licence rule (from coordinator):** every recommendation comes from one of three sources:
- **GOOGLE**: Google Fonts.
- **ADOBE**: Adobe Fonts. Web kits come with the designer's Creative Cloud plan.
- **FREE**: free for commercial web use, with the licence named: OFL on GitHub, Fontshare ITF FFL, Velvetyne or Collletttivo.

Paid foundry fonts appear only as *inspiration, not usable*, and each one comes with the closest usable alternative.

**Hard exclusions respected.** None of these are recommended: Geist, Instrument, JetBrains Mono, Archivo, IBM Plex, Inter, Manrope, Fraunces, Newsreader, IvyPresto, Space, DM, Fragment, Roboto Serif, Montserrat, Zodiak, Bricolage, General Sans, GT Standard, Saans, Outfit, Gambetta, Helvetica Neue, Georgia. Some of them appear inside Fonts In Use examples. They are named there only as facts about those projects.

## How things were checked
- **Fonts In Use:** every use cited in §1 was opened on its own page. Typefaces and foundries come from that page, not from listing pages. The listing-page summaries mislabelled at least two projects, which is why each page was opened:
  - The search listing said Plotly used "Relative / Relative Mono". The use page says Jubilat + Campaign Grotesk.
  - The search listing said Exodus used "Input Mono". The use page says Suisse Int'l + BallPill.
- **Google Fonts:** availability, variable axes and Cyrillic were checked live with the `fonts.googleapis.com/css2` API. A family that returned faces for the requested axis ranges counts as confirmed. Subsets were read from the CSS.
- **Adobe Fonts:** availability was checked by loading each `fonts.adobe.com/fonts/<slug>` page title. Adobe pages did not render style lists or language lists, so for Adobe families the **axes, width counts and Cyrillic are from memory. Check them before committing.**
- **Fontshare:** the catalogue and axes came from `api.fontshare.com/v2/fonts`. Every ITF family listed is Latin-only.
- **GitHub OFL families:** licence and latest release were checked with `gh api`:
  - Monaspace: OFL-1.1, v1.400, Mar 2026.
  - Junicode: OFL-1.1, v2.226, Jun 2026.
  - Mona Sans: OFL-1.1, v2.0.27, May 2026.
  - Commit Mono: MIT.

**Pages that failed:**
- `fontsinuse.com/formats` returned HTTP 500.
- `fontsinuse.com/formats/22/websites` returned 404.
- `fontsinuse.com/tags/2370/...` was the wrong tag (it lists skincare uses). The real data-visualization tag is `/tags/8572`.
- `velvetyne.fr/fonts/compagnon` returned 500, with and without the trailing slash. The Velvetyne licence below is from memory (Velvetyne publishes under OFL), not from that page.
- The Fontshare licence page returned no body text. The ITF FFL terms come from secondary sources: free for commercial web use when served through the Fontshare API or CDN; self-hosting and redistribution restricted.
- `fonts.adobe.com/fonts/roslindale`, `/roslindale-display` and `/freight-big` returned 404. Roslindale is **not** on Adobe Fonts. Freight is at `/fonts/freight`.

---

## 1. Fonts In Use examples (all pages fetched)

| # | Project | Fonts In Use URL | Typefaces (foundry) | Usable? | Fits |
|---|---|---|---|---|---|
| 1 | **Network Imaginaries**, Hackers & Designers publication made in the ChattyPub chat-to-print tool (2021) | https://fontsinuse.com/uses/66048/network-imaginaries | Compagnon Light/Bold (Velvetyne), Anthony (Velvetyne), Movement (NM Type), Authentic Sans (authentic.website), Literata (Type-Together) | Compagnon, Anthony, Authentic Sans: **FREE**. Literata: **GOOGLE** | **A** (+B): typewriter mono as the structure, literary serif text. This is the closest "network + manuscript" reference found. |
| 2 | **Utterances: Composing a Care-Informed Research Practice** (2024) | https://fontsinuse.com/uses/73388/utterances-composing-a-care-informed-research | Authentic Sans 60, DINdong, Euripides (GitHub), Victor Mono, Abordage, Compagnon Regular/Italic, Director (Velvetyne) | All free or libre. Victor Mono is **GOOGLE** | **A**: a research publication built entirely from libre fonts, with a cursive-italic mono. |
| 3 | **Breathless in Glowing Air**, exhibition posters + book (2025) | https://fontsinuse.com/uses/74834/breathless-in-glowing-air-exhibition-posters- | Carta Nueva (Sharp Type), Suisse Int'l (Swiss Typefaces), **Junicode Italic** | Junicode: **FREE (OFL)**. The other two: inspiration only | **A**: Junicode Italic used as the "literary texture" voice. |
| 4 | **Wildness**, online literary journal (2017) | https://fontsinuse.com/uses/16931/wildness-website-2017 | Cormorant (Christian Thalmann) | **GOOGLE** | **A**: one-family large-size Cormorant on the web, which validates the shortlist pick for display use. |
| 5 | **A Further Sea**, speculative web archive. Text columns are driven by live wind and tide data (2026) | https://fontsinuse.com/uses/79264/a-further-sea | LL Ivory + LL Ivory Mono (Lineto) | Inspiration only. Closest usable: Junicode or Literata + Victor Mono / Martian Mono | **A**: proportional serif + mono pairing, with "text as matter" moved by data. Very close to the Lexicon moodboard. |
| 6 | **HOLO.g**, digital archive of a fictional museum (2021) | https://fontsinuse.com/uses/44238/holo-g-digital-archive-of-holo-museum | Editorial New (Pangram Pangram), DNP Shuei Mincho, Pitch (Klim) in a console window, Autark | Inspiration only. Closest usable: Freight Big (ADOBE) or Cormorant + Input Mono (ADOBE) | **A/B**: editorial serif archive with a terminal-mono layer. |
| 7 | **Felt**, collaborative map-making app, brand + site (2021) | https://fontsinuse.com/uses/41826/felt | Roslindale Display Condensed (DJR), GT Alpina (Grilli), Atlas Grotesk (Commercial Type) | Inspiration only. Roslindale is not on Adobe Fonts. Closest usable: Freight Big (ADOBE) + Forma DJR (ADOBE) | **A**: oversized expressive serif on a tool product. |
| 8 | **Women Artists 1300–1900**, National Gallery Prague (2025) | https://fontsinuse.com/uses/73313/women-artists-1300-1900-exhibition-at-the-nat | Azeret + Azeret Mono (Displaay) | **Azeret Mono only** is free (GOOGLE, OFL). The proportional Azeret is paid Displaay | **A/B**: proportional + mono system on floor-plan diagrams. Validates the shortlisted Azeret Mono. |
| 9 | **Jülich Brain Atlas**, 3D open-source brain atlas (2022) | https://fontsinuse.com/uses/52106/juelich-brain-atlas | Karelia (Monokrom), Stanley (Optimo) | Inspiration only | **A/C**: a science atlas pairing a "mechanistic" sans with a "nostalgic" serif. Text is superimposed on imagery at several analysis levels. |
| 10 | **Kiel Institute**, research-institute identity built on a variable grid (2025) | https://fontsinuse.com/uses/72162/kiel-institut | Suisse Int'l, Suisse Int'l Mono, Suisse Works (Swiss Typefaces) | Inspiration only. Closest usable: Neue Haas Unica (ADOBE) + Forma DJR Mono (ADOBE) | **A/B**: a research brand on a grid with a sans + mono + serif trio. |
| 11 | **Build Australia website** (2026) | https://fontsinuse.com/uses/78547/build-australia-website | RJ Afilador, RJ Schema (Robert Janes), **Martian Mono** (Evil Martians) | Martian Mono: **GOOGLE** | **B**: Martian Mono as the supporting voice on a live website. |
| 12 | **Eleventy LibDoc**, documentation starter (2025) | https://fontsinuse.com/uses/72250/eleventy-libdoc | Recursive (Arrow Type) | **GOOGLE** | **B**: one variable family runs the whole doc UI, from sans to code. |
| 13 | **CSAIL website**, MIT CS & AI Lab (2018) | https://fontsinuse.com/uses/24727/csail-website | Basis Grotesque + Basis Grotesque Mono (Colophon) | Inspiration only | **B**: a research-lab site in one grotesque + mono family, slashed zero. |
| 14 | **CarbonPlan**, climate-data identity (2022) | https://fontsinuse.com/uses/51291/carbonplan | Relative, Relative Mono, plus a "faux mono" hybrid (Colophon) | Inspiration only. Closest usable: **Recursive**, whose MONO axis gives a real proportional-to-mono hybrid | **B**: mono for data labels, proportional for reading, and a hybrid for captions. A strong system model for Lacuna. |
| 15 | **Spade**, data-platform identity, "UI-as-identity" (2026) | https://fontsinuse.com/uses/77753/spade | NaN SuperX Sans (NaN), FT Polar + FT Polar Mono (Frost Type) | Inspiration only | **B**: the mono-driven technical tone of a data product. |
| 16 | **Sanity**, CMS identity (c. 2025) | https://fontsinuse.com/uses/77799/sanity | KMR Waldenburg (Kimera), IBM Plex Mono | Waldenburg is paid. Plex is **excluded** | **B**: a reference for a dark grotesk + mono dev-tool look only. |
| 17 | **TIEFPLAN**, fictional underground-planning office (2025) | https://fontsinuse.com/uses/67379/tiefplan | TWK Everett + TWK Everett Mono (Weltkern) | Inspiration only. Closest usable: Martian Grotesk / Mono or Monaspace | **B**: all-caps mono captions in square brackets on data maps. |
| 18 | **Synesthésie ¬ MMAINTENANT**, flyers + browser-based flyer software (2019) | https://fontsinuse.com/uses/32468/synesthesie-mmaintenant-flyers-and-software | Syne, Syne Tactile, Syne Mono (Bonjour Monde) | **GOOGLE** (OFL) | **C/B**: a generative "crop-and-repeat" tool with a wide display grotesk. Kinetic type as software. |
| 19 | **GitHub homepage** (2022) | https://fontsinuse.com/uses/50805/github-homepage-2022 | Mona Sans (Degarism × GitHub), Menlo | Mona Sans: **GOOGLE** / OFL | **C**: a variable-width grotesk across the whole product site. |
| 20 | **The Next F1 Race**, scroll-driven countdown site (2023) | https://fontsinuse.com/uses/53729/the-next-f1-race | Nickel Gothic (DJR Font of the Month), Figtree, **Unbounded** | Figtree and Unbounded: **GOOGLE**. Nickel Gothic: inspiration only | **C**: the **width axis animates labels** as the user scrolls. This is exactly Orbit's mechanic. Unbounded for numerals. |
| 21 | **Le Figurant**, book cover (2024) | https://fontsinuse.com/uses/64345/le-figurant-by-eric-chasse | Flexible (Art Grootfontein), **Anybody** (Etcetera Type), Breul Grotesk | Anybody: **GOOGLE** | **C**: width-gradient "staircase" type. Anybody's 50–150 width range in use. |
| 22 | **Web Graphic Experiments**, Keita Yamada (2021) | https://fontsinuse.com/uses/40419/web-graphic-experiments-by-keita-yamada | Arges Condensed (Blaze), Aventa, Oroban (Blaze) | Inspiration only | **C**: an endless, disorienting kinetic web index. |
| 23 | **Morescope**, carbon-data platform (2024) | https://fontsinuse.com/uses/64860/morescope | Sagace (Alexandre Créquer), Spline Sans (SorkinType) | Spline Sans: **GOOGLE** | **C/B**: a data-viz SaaS with an expressive display face over a free sans. |
| 24 | **Plotly website** (2020) | https://fontsinuse.com/uses/35187/plotly-website | Jubilat (Darden), Campaign Grotesk (PSTL) | Inspiration only | **A/C**: a slab serif for chart figures and a wide grotesk for small text. |

Other fetched and checked uses, left out as weaker fits:
- Generative Gallery website: Grafier + Factor A, both paid.
- Exodus data-viz magazine: Suisse Int'l + BallPill.

**What the examples show:**
1. The most "knowledge-tool" references (CarbonPlan, CSAIL, Spade, Kiel, TIEFPLAN, Women Artists, A Further Sea) all use **one proportional family plus its own mono sibling**. Lacuna should do the same: pick fonts that are either one superfamily or deliberately metrics-related.
2. Libre type dominates the research and archive publications (Network Imaginaries, Utterances, Breathless). Velvetyne's Compagnon and Junicode Italic are the "manuscript" voice in that scene.
3. The width-axis animation in *The Next F1 Race* is the proven pattern for Orbit.

---

## 2. Type systems per direction

Legend: **G** = GOOGLE · **AD** = ADOBE (CC web kit) · **F** = FREE (licence named) · ✓ Cyrillic confirmed · ~ partial (cyrillic-ext only) · ✗ Latin-only · ? unverified

### A: Lexicon (paper & ink, words as nodes)

**A1 (top pick): Junicode 2 / Forma DJR Text / Forma DJR Mono**

| Role | Font | Source / licence | Axes | Cyrillic | Why |
|---|---|---|---|---|---|
| Display + italic | **Junicode 2** (Peter S. Baker) | **F**, OFL, GitHub `psb1558/Junicode-font` | Variable: **wght (5 stops), wdth (Condensed → Expanded), plus a custom "Enlarge" axis**; separate italic VF | ? (Greek + medieval scripts, made for MUFI medievalists; check Cyrillic) | Built *for medievalists*. A lacuna is literally a gap in a manuscript. The italic is calligraphic. The Enlarge axis can grow a single word-node in place, which suits "text as matter". Proven as the literary italic in Breathless in Glowing Air. |
| UI / text | **Forma DJR Text** (+ Micro for 11–12 px UI, Deck/Display for headers) | **AD** | Adobe serves optical-size families. The DJR site describes a variable designspace. | ? | An editorial grotesk by a type designer known for editorial work. Optical sizes cover map labels up to headers. One superfamily. |
| Mono | **Forma DJR Mono** | **AD** | ? | ? | The same skeleton as the UI face, so it follows the "proportional + own mono" pattern from CarbonPlan and CSAIL. |

**A2: all Adobe, more polished and bookish: Freight Big + Text / Neue Haas Unica / Input Mono Narrow**

| Role | Font | Source | Notes |
|---|---|---|---|
| Display | **Freight Big / Freight Display** (Joshua Darden) | **AD** (`/fonts/freight`) | High-contrast, very expressive italics. The closest usable stand-in for the Editorial New, GT Alpina and Roslindale looks in HOLO.g and Felt. Cyrillic: ?. |
| Text | **Freight Text** for long reading, or **Neue Haas Unica** (Monotype, Toshi Omagari) for UI | **AD** | Unica is the TM Research Archive and ArtReview-site grotesk, quiet and Swiss. Cyrillic: ?. |
| Mono | **Input Mono** in the Narrow/Condensed widths (DJR / Font Bureau) | **AD** (confirmed on Adobe Fonts) | Four widths × seven weights + italics. Narrow widths make dense marginal annotations. |

Alternatives inside A2: **Kepler** (AD, Slimbach; optical sizes and widths, warm italic), **Lust** (AD, Positype; flamboyant display italic, hero words only), **Garamond Premier** (AD).

**A3: fully free, with Cyrillic throughout: Cormorant / Golos Text (or Onest) / Martian Mono**

| Role | Font | Source | Axes | Cyrillic |
|---|---|---|---|---|
| Display | **Cormorant** (the parent family, *not* Cormorant Garamond) | **G** | ital, wght 300–700 | ✓ |
| UI / text | **Golos Text** (Paratype) or **Onest** | **G** | wght 400–900 / 100–900 | ✓ / ✓ |
| Mono | **Martian Mono** | **G** | **wdth 75–112.5, wght 100–800** | ✓ |

Other free serifs worth a look for A:
- **Literata** (G): opsz 7–72, wght, italic; Cyrillic ✓. Used in Network Imaginaries. The best *reading* serif here.
- **Alegreya** (G): calligraphic italic; Cyrillic ✓.
- **Piazzolla** (G): opsz, sharp italic; Cyrillic ✓.
- **Playfair 2** (G): opsz 5–1200 and wdth 87.5–112.5; Cyrillic ✓; dramatic at huge sizes.
- **Victor Mono** (G): cursive-italic mono; Cyrillic ✓. Use it as the "hand annotation" mono.
- **Compagnon** (F, Velvetyne): a typewriter face with italic, as in Network Imaginaries and Utterances.
- Fontshare **Sentient**, **Erode** and **Boska** (F, ITF FFL, roman and italic variable files): Latin-only, and must be served from the Fontshare CDN.

### B: Signal (black data room, all mono, letter-sphere hero)

**B1 (top pick): the Monaspace superfamily, with Mona Sans for reading**

| Role | Font | Source / licence | Axes | Cyrillic | Why |
|---|---|---|---|---|---|
| Display + UI mono | **Monaspace** in five metrics-compatible voices: Neon (neo-grotesk), Argon (humanist), Xenon (slab-serif), Radon (handwriting), Krypton (mechanical) | **F**, OFL-1.1, GitHub `githubnext/monaspace` v1.400 | Each VF has **wght, wdth (normal → wide) and slant/italic**. The "texture healing" feature evens out the texture of mono text. | ✓ (README credits a Cyrillic design team and has Bulgarian/Serbian alternates) | Because all five voices share metrics, **each graph entity type can get its own voice on the same grid without breaking it**. For example: concepts in Neon, papers in Xenon, orgs in Krypton, AI hypotheses in Radon. The width axis can "breathe" the letter-sphere. No other free option is this systematic. |
| Reading sans | **Mona Sans** (G / OFL, GitHub) | **G** | wdth 75–125, wght 200–900 | ✗ (Latin + Vietnamese) | The same GitHub type system, so it harmonises with Monaspace. For Cyrillic, swap in **Onest** (G, ✓). |

Risk: Monaspace and Mona Sans together read as "GitHub-adjacent" to developers. Lean on Xenon, Radon and Krypton rather than Neon, and use the Martian or Recursive system if that matters.

**B2: Martian Mono / Onest, with an optional ASCII display face**

| Role | Font | Source | Axes | Cyrillic |
|---|---|---|---|---|
| Display + UI | **Martian Mono** (Evil Martians) | **G** | **wdth 75–112.5, wght 100–800** | ✓ |
| Reading sans | **Onest** | **G** | wght 100–900 | ✓ |
| Optional ASCII/dot hero | **Doto** (G; ROND 0–100, wght 100–900; ✗) or **Sixtyfour** (G; BLED and SCAN "CRT" axes; ✗) | **G** | | |

Why B2: it keeps the shortlist pick and has the widest width range of any free mono checked. It is proven on a live site (Build Australia). It has full Cyrillic. Doto and Sixtyfour give an Ikeda/CRT look for the sphere without needing a canvas font.

**B3: Recursive, one font that morphs between sans and mono**

| Role | Font | Source | Axes | Cyrillic |
|---|---|---|---|---|
| Everything | **Recursive** (Arrow Type) | **G** | **MONO 0–1, CASL 0–1, wght 300–1000, slnt −15–0, CRSV** | ~ (cyrillic-ext) |
| Paid-look alternative | **Input Mono + Input Sans** (DJR) | **AD** | 4 widths × 7 weights, static | ? |

Why B3: animate MONO from 1 to 0 when a node is "read", so the data-room mono turns into a proportional reading face. This is the CarbonPlan "faux mono" idea, done properly with a real axis. Proven in Eleventy LibDoc.

Other monos checked on Google Fonts:
- **Ubuntu Sans Mono**: ital, wght; Cyrillic ✓; with **Ubuntu Sans** (wdth 75–100) as a reading pair.
- **Cascadia Mono**: Cyrillic ✓.
- **Google Sans Code**: ital, wght 300–800; Latin-only.
- **Reddit Mono** / **SUSE Mono**: Latin-only.
- **Chivo Mono**: Latin-only.
- **Necto Mono** (Collletttivo, OFL, one style): ✗ Latin-only.

### C: Orbit (kinetic grotesk, text on rings, bubble packs)

**C1 (top pick): Obviously Variable / Mona Sans / Martian Mono**

| Role | Font | Source | Axes | Cyrillic | Why |
|---|---|---|---|---|---|
| Display (kinetic) | **Obviously Variable** (OH no Type, James Edmondson) | **AD** (confirmed: `/fonts/obviously-variable`) | wdth from compressed to extended, plus wght (from memory, check) | ? (probably Latin-only) | A characterful width range on a usable licence. Animate wdth along rings and when bubbles grow, as in *The Next F1 Race*. It is more distinctive than Unbounded. |
| Body / UI | **Mona Sans** | **G** | **wdth 75–125**, wght 200–900 | ✗ | Its own width axis lets bubble labels *fit by width, not by size*, and it matches the display mechanic. |
| Mono | **Martian Mono** | **G** | wdth 75–112.5, wght | ✓ | Axis ticks and counts. Its width axis stays consistent with the system. |

**C2: fully free, with Cyrillic: Science Gothic / Onest / Martian Mono**

| Role | Font | Source | Axes | Cyrillic |
|---|---|---|---|---|
| Display | **Science Gothic** | **G** | **wdth 50–200**, wght 100–900. This is the widest width range found on Google Fonts. | ✓ |
| Body | **Onest** | **G** | wght 100–900 | ✓ |
| Mono | **Martian Mono** | **G** | wdth, wght | ✓ |

Note: Science Gothic is squarish and technical, which suits the sci-fi "orbit" feel. Test that look before committing.

**C3: playful-wide, Latin-only, free: Anybody (or Unbounded) / Familjen Grotesk / Spline Sans Mono**
- **Anybody** (G): ital, **wdth 50–150**, wght 100–900; ✗. In use in Le Figurant and EXKi.
- **Unbounded** (G): wght only, no width axis; Cyrillic ✓.
- **Familjen Grotesk** (G / Fontshare OFL): ital, wght 400–700; ✗.
- **Spline Sans Mono** (G): ital, wght 300–700; ✗.

Other display options for C:
- **Roc Grotesk Variable** (AD; Kostić; wide widths; Cyrillic ?).
- **Termina** (AD; Fort Foundry; extended static; as in "Data Set Go!").
- **Hubot Sans** (G; wdth 75–125; ✗). Mona's sibling, more technical.
- **Syne** (G; wght 400–800; Greek ✓, Cyrillic ✗). The Synesthésie generative tool.
- **Panchang** (F, Fontshare ITF FFL; wght 200–800; ✗). No uses on Fonts In Use.
- **Tilt Warp** and **Climate Crisis** (G): novelty only.

---

## 3. Verdict on the current shortlist

| Font | Verdict |
|---|---|
| **Cormorant Garamond** | Keep the idea, but switch to the parent **Cormorant**, which has the more dramatic display cuts. Same licence, Cyrillic ✓. Garamond revivals have hairline italics that fall apart in UI below about 20 px, so use it for display only. For a stronger "manuscript" story, **Junicode 2** is better. |
| **Hanken Grotesk** | Fine but generic. Only cyrillic-ext is served, which means partial Cyrillic. **Onest** or **Golos Text** do the same job with full Cyrillic. For A, Forma DJR (AD) is better. |
| **Azeret Mono** | Good, and validated in use (Women Artists, Prague). Latin-only. Only the mono is free; the proportional Azeret is paid Displaay. |
| **Martian Mono** | **Keep. It is the strongest free mono checked:** wdth and wght axes, full Cyrillic, and live in use. Works in B and C. |
| **Host Grotesk** | Neutral, Latin-only. No advantage over Onest. |
| **Unbounded** | Has Cyrillic, but **no width axis**, and it carries a crypto/web3 association (it comes from Polkadot). For Orbit, Obviously Variable, Science Gothic or Anybody do the width job it can't. Keep it only for numerals, as in *The Next F1 Race*. |
| **Familjen Grotesk** | Pleasant but Latin-only, and it lacks the kinetic range Orbit needs. |
| **Spline Sans Mono** | OK, Latin-only. Martian Mono and Monaspace beat it on axes and Cyrillic. |
| **Public Sans** | A government-neutral face. Too anonymous for any of the three directions. |
| **Red Hat Mono** | Latin-only, no width axis. It is outclassed by Martian Mono and Monaspace. |

---

## 4. Top recommendation per direction

- **A Lexicon:** **Junicode 2** (display + italic; FREE, OFL) + **Forma DJR Text/Micro** (ADOBE) + **Forma DJR Mono** (ADOBE).
  - The free, Cyrillic-safe fallback is Cormorant + Golos Text + Martian Mono.
- **B Signal:** **Monaspace** (Xenon, Krypton and Radon as entity voices, Neon for UI; FREE, OFL, Cyrillic ✓) + **Mona Sans** for reading (GOOGLE). Use Onest instead of Mona Sans if Cyrillic is needed.
  - Runner-up: **Martian Mono + Onest (+ Doto for the sphere)**, all Google, all Cyrillic except Doto.
- **C Orbit:** **Obviously Variable** (ADOBE, kinetic width display) + **Mona Sans** (GOOGLE, width-fitting labels) + **Martian Mono** (GOOGLE).
  - The fully free, Cyrillic alternative is Science Gothic + Onest + Martian Mono.

## 5. Open checks before committing
1. On the live Adobe Fonts pages, confirm Cyrillic, styles and variable status for Forma DJR, Freight, Obviously Variable, Roc Grotesk Variable and Input. The pages did not render language lists through the fetch tool.
2. Check Junicode 2's Cyrillic coverage in the release glyph set.
3. Fontshare fonts (ITF FFL) should be loaded from the Fontshare CDN, not self-hosted.
4. Mona Sans, Azeret Mono, Anybody, Syne, Familjen and Spline Sans Mono have no Cyrillic. If a Russian or Ukrainian UI is planned, use the Onest, Golos, Martian or Monaspace routes.
