# Rendering Pipeline Architecture

**Status:** Proposed (design doc — not yet implemented)
**Decision:** Clean break to a staged API (drop the old positional `owner, repo, ref, books, options` signatures; update all callers in the same pass — no back-compat aliases).

---

## 1. Goal

Turn the renderer library into a **composable chain** where every stage is a
`stage(input, options) → output` function and `input` is exactly the previous
stage's output. A caller can:

- run the **whole chain** from `{ owner, repo, ref }` (the 90% case),
- **resume from any stage** by handing in cached/serialized intermediate data
  (e.g. "I already have the `htmlData`, don't fetch"),
- **substitute a source** — e.g. a CLI that reads local checked-out repos
  instead of DCS — by producing the same `ResourceData` shape.

The product of this library is therefore **three data contracts** plus **one
options schema**, not five hard-wired functions. Freeze those and "start
anywhere with my own data" is free. (The `en_tn_jud.json` dumps you already
keep are proof the intermediates serialize cleanly — that file *is* a cached
`ResourceData`.)

---

## 2. Current state & problems

```
getAllCatalogEntriesForRendering(owner|entry, …5 positional…) → { version, catalogEntries }
getResourceData(owner, repo, ref, books, opts, is_extra)      → resourceData
renderHtmlData(owner, repo, ref, books, opts)                 → { …sections, resourceData }
renderHTML(content, opts)                                     → trivial <div> wrapper (placeholder)
renderPdf(renderResult, opts)                                 → Buffer | path   ✅ already chain-shaped
```

| # | Problem | Evidence |
|---|---|---|
| 1 | Front stages only accept `owner/repo/ref` → cannot inject cached/local data; always re-fetch | `getResourceData.js:72`, `renderHtmlData.js:42` |
| 2 | `getResourceData` re-resolves the catalog even when already held. `options.catalogEntry` skips `/catalog/entry/` but `getFilteredCatalogEntries` still re-hits `/catalog/bp/` | `getResourceData.js:84-96`, `:299` |
| 3 | `getAllCatalogEntriesForRendering` uses positional type-sniffing (`ownerOrCatalogEntry, repoOrBooks, refOrOptions…`) — the anti-pattern to avoid | `getAllCatalogEntriesForRendering.js:50-95` |
| 4 | No composition stage: `renderHTML` is a placeholder, and document assembly only exists for print (`assemblePrintDocument`). No single "compose these sections into a deliverable" function | `htmlRenderer.js:10`, `printDocumentAssembler.js` |
| 5 | `version` from the catalog stage is the **npm package version**, but the cover wants the **resource** version (e.g. `v89`) | `getAllCatalogEntriesForRendering.js:2-5,118` vs `renderPdf.js:78` |

`renderPdf` is already the target shape (consumes the prior object). The work is
bringing the front stages into line and adding one real composition stage.

---

## 3. The staged pipeline

```
 source descriptor                  online (network)        online OR local            pure (no I/O)            pure (no I/O)         I/O (binary/file)
┌───────────────────┐   stage 1   ┌──────────────┐ stage 2 ┌──────────────┐ stage 3  ┌──────────┐  stage 4   ┌──────────┐ stage 5 ┌──────────┐
│ {owner,repo,ref,  │ ──────────▶ │  CatalogSet  │ ──────▶ │ ResourceData │ ───────▶ │ HtmlData │ ─────────▶ │ html     │ ──────▶ │ PDF      │
│  books?}          │ getAll-     │              │ getRes. │              │ renderH. │ (sections│ renderHTML │ (string) │ renderP.│  bytes   │
└───────────────────┘ Catalog-    └──────────────┘ Data    └──────────────┘ tmlData  │ +css+toc)│            └──────────┘ df       └──────────┘
                      Entries                          ▲                              └──────────┘
                                  getResourceDataFromDirectory(catalogEntries, dir)  ◀── CLI / local working copies (same ResourceData shape)
```

- Every box between the edges is **JSON-serializable** → persist any of them and
  resume from the next stage.
- Stages 3 & 4 are **pure, no I/O** → identical behavior in the browser
  (door43-preview-app), Node, a CLI, or a server.
- **One options object** (§6) flows through the whole chain; each stage reads
  only the keys it cares about.

### Why stages 3 and 4 are separate

`renderHtmlData` (stage 3) does the *expensive* work once: USFM→HTML, GL-quote
conversion, markdown conversion, TOC extraction → produces reusable `sections`.
`renderHTML` (stage 4) is *cheap* composition: pick which sections to include,
which CSS, columns, headers. So you can re-compose screen vs print vs
"body-only excerpt" from one cached `HtmlData` **without re-rendering the body.**

---

## 4. Data contracts

Freeze these. They are the API.

### 4.1 `CatalogSet` — output of stage 1

```js
{
  resourceVersion: string,     // e.g. "v89" — from catalogEntry.branch_or_tag_name / release.tag_name
  libraryVersion:  string,     // npm package version of this renderer lib (was mislabeled `version`)
  catalogEntries:  Array<CatalogEntry>,  // [0] is the main entry; rest are filtered extras
  source: { owner, repo, ref, books, dcsApiUrl },  // echoed back for traceability/caching
}
```

> Fixes problem #5: `resourceVersion` (the resource) and `libraryVersion` (this
> lib) are no longer conflated.

### 4.2 `ResourceData` — output of stage 2

Self-describing, so downstream needs **nothing else**. Subject payload shapes are
unchanged from today (see the `uw-book-packages` skill); the contract promotes
cover/identity fields and `requestedBooks` to **required**:

```js
{
  type: 'usfm' | 'tsv' | 'obs' | 'ta' | 'tw',
  subject: string,             // routes the renderer
  title: string,
  abbreviation: string,        // cover logo selection
  version: string,             // resource version for the cover (== CatalogSet.resourceVersion)
  requestedBooks: Array<string>,   // selection baked in (removes books threading)
  books | stories | manuals | articles | front | back,  // subject-specific payload
  extras?: { ult, ust, ta, tw, twl, ugnt, … },          // for TSV resources
  license: string,
}
```

### 4.3 `HtmlData` — output of stage 3

```js
{
  subject: string,
  title: string,
  abbreviation: string,        // carried so stage 4/5 never need resourceData
  version: string,
  direction: 'ltr' | 'rtl',    // resource default; an option can override at compose time
  sections: {
    cover:      string,        // HTML snippet
    copyright:  string,        // HTML snippet (license page)
    toc:        Array<{ id, title, sections? }>,   // TOC *data* — always produced
    body:       string,        // main content HTML (carries hidden .header-title spans for running headers)
    appendices: {              // keyed by kind; built by scanning body for referenced articles
      ta?: { [articleId]: { title, html } },   // Translation Academy articles cited by TN
      tw?: { [articleId]: { title, html } },   // Translation Words articles cited by TN
    },
    css:        { web: string, print: string },
  },
}
```

> Changes vs today's `renderHtmlData` (`renderHtmlData.js:60-63`): **drop** the
> attached `resourceData` (identity fields promoted onto `HtmlData`) and **drop**
> `fullHtml` (that's now `renderHTML(htmlData)`). **Add** `appendices` and
> `direction`. `sections.toc` is always the structured *data* — the screen view's
> interactive chapter/verse selector is built from it by the app; whether a static
> TOC *page* is rendered is an option (§6, `show.toc`).

### 4.4 stage 4 output — a single HTML string

A self-contained HTML document with exactly the sections the options selected,
the right CSS (`web` vs `print`), and (for print) `@page`/PagedJS structure.

---

## 5. Stage-by-stage API

Two rules govern every signature:

> **R1 — `stage(input, options)`, never scattered positionals.** `input` is
> exactly the previous stage's output. `options` is the one schema in §6.
>
> **R2 — Flexibility via a discriminated `input` object, not positional
> type-sniffing.** Branch on a named key (`input.catalogEntries ? … : …`).

### Stage 1 — `getAllCatalogEntries(source, options) → CatalogSet`  *(online)*

```js
// source = { owner, repo, ref, books? }   |   catalogEntry   |   CatalogSet (passthrough)
export async function getAllCatalogEntries(source, options = {}) {
  if (source.catalogEntries) return source;           // already a CatalogSet
  // { owner, repo, ref } or single catalogEntry → call /catalog/bp/ ONCE, filter, select bibles
}
```

- **Renamed** from `getAllCatalogEntriesForRendering` → `getAllCatalogEntries`
  (pairs with the existing singular `getCatalogEntry`). No alias.
- **De-overloaded** (kills problem #3) and absorbs `getFilteredCatalogEntries`
  (subject filtering via `requiredSubjectsMap`, ≤2 Aligned Bibles).

### Stage 2 — `getResourceData(input, options) → ResourceData`  *(online)*

```js
// input = CatalogSet   |   { owner, repo, ref, books? }   |   ResourceData (passthrough)
export async function getResourceData(input, options = {}) {
  if (isResourceData(input)) return input;            // already done
  const catalogSet = input.catalogEntries
    ? input                                           // reuse — NO second /catalog/bp/ call  (fixes #2)
    : await getAllCatalogEntries(input, options);     // { owner, repo, ref } → resolve first
  // …extract & parse main + extras from catalogSet.catalogEntries over HTTP…
}
```

- `is_extra` moves from a 6th positional arg into `options.isExtra`.
- `books` comes from `input`/`options`, lands in `ResourceData.requestedBooks`.

### Stage 2′ — `getResourceDataFromDirectory(catalogEntries, dirPath, options) → ResourceData`  *(local / CLI)*

The local twin of stage 2 — same output shape, content read from disk instead of
DCS. Per your spec:

```js
// catalogEntries: FULL catalogEntry objects (the parsed manifest — subject, title,
//                 metadata_type, ingredients[]). [0] is the main resource.
// dirPath:        directory containing one subdir per repo, named by repo.name.
export async function getResourceDataFromDirectory(catalogEntries, dirPath, options = {}) {
  // For each entry needed for the requested book(s), for each ingredient:
  //   read the file at `${dirPath}/${entry.repo.name}/${ingredient.path}`
  // Reuse the SAME extractors as stage 2 (extractRcTsvData, extractRcAlignedBibleData, …)
  // → emit identical ResourceData.
}
```

- **No `manifest.yaml` read** — the full `catalogEntry` already *is* the parsed
  manifest. `ingredients[].path` + `repo.name` locate every file on disk, and
  `subject`/`metadata_type` route the extractor.
- **Supports RC, SB, and TC** — all three store whole files (USFM/Markdown/TSV)
  addressed by ingredient `path`. **TS is not supported** (chunked dirs/text files
  that don't map to single ingredient files).
- Stages 3–5 are **unchanged** for the CLI. Internally, stage 2 and stage 2′
  differ only in a **content provider** (HTTP-from-DCS vs `fs`-rooted-at-`dirPath`)
  that the shared extractors call; TA/TW need a directory-tree read (trivial on
  disk; the archive zip online).
- *Future:* the plan is to move to SB-only, with a TC/RC/SB→SB converter (or a
  DCS "download repo as SB ZIP"). The catalogEntry-driven design above is
  forward-compatible — an SB ZIP unpacks to the same ingredient-path layout.

### Stage 3 — `renderHtmlData(resourceData, options) → HtmlData`  *(pure)*

```js
export function renderHtmlData(resourceData, options = {}) {   // no async, no network
  // route by resourceData.subject → subject renderer (renderers themselves unchanged)
  // read resourceData.requestedBooks (drop the `books` positional)
}
```

Drops the `owner, repo, ref, books` params and the internal `getResourceData`
call (`renderHtmlData.js:42-45`).

### Stage 4 — `renderHTML(htmlData, options) → string`  *(pure, replaces the placeholder)*

**One** composition function. There is no separate web/print function — `options`
(§6) decides which sections to include, which CSS, and the layout:

```js
export function renderHTML(htmlData, options = {}) {
  const opts = withDefaults(options, htmlData);   // media-aware defaults (§6.2)
  // include sections.cover/copyright/toc/body/appendices per opts.show
  // pick sections.css[opts.media]; for media==='print' emit @page + running headers/footers
  // (print path delegates to the existing assemblePrintDocument internals)
}
```

- `media: 'screen'` → omits cover/copyright/toc by default, web CSS, no `@page`.
  This is door43-preview-app's stop point (it then drives PagedJS / the
  interactive selector in-browser).
- `media: 'print'` → includes cover/copyright/toc by default, print CSS, `@page`
  rules, running headers/footers, per-section page numbers.

### Stage 5 — `renderPdf(input, options) → Buffer | path`  *(I/O)*

```js
// input = HtmlData (renders the print HTML internally via renderHTML)
//       | print HTML string (already composed) → straight to WeasyPrint
export async function renderPdf(input, options = {}) { … }   // forces media:'print'
```

Already chain-shaped (`renderPdf.js:53`); just teach it to also accept an
already-composed print string so `renderHTML(htmlData, {media:'print'}) →
renderPdf(htmlString)` doesn't double-assemble.

### Orchestrator — `renderPreview(request) → string | Buffer | path`

```js
// request spreads the §6 options plus { owner, repo, ref, books?, output: 'html'|'pdf' }
export async function renderPreview(request) {
  const catalogSet   = await getAllCatalogEntries(request, request);
  const resourceData = await getResourceData(catalogSet, request);
  const htmlData     = renderHtmlData(resourceData, request);
  if (request.output === 'pdf') return renderPdf(htmlData, request);
  return renderHTML(htmlData, request);
}
```

---

## 6. The options schema

One object, threaded through every stage; each stage reads only its slice. Group
by concern. **All keys optional**; defaults shown.

### 6.1 Shape

```js
{
  // ── Source / infrastructure (stages 1–2) ──────────────────────────────
  dcsApiUrl: 'https://git.door43.org/api/v1',
  quiet: false,
  isExtra: false,                 // internal: skip dependency resolution for extras

  // ── Content selection (stages 1–2 fetch; stage 4 display-filter) ──────
  books: [],                      // [] = all books in the resource; subset to limit
  // reference: { 'tit': '1:1-1:9' }   // (FUTURE) per-book chapter/verse ranges

  // ── Document composition (stage 4) ────────────────────────────────────
  media: 'screen',                // 'screen' | 'print'  (renderPdf forces 'print')
  show: {                         // which top-level parts to include (defaults below are media-aware)
    cover:      undefined,        // default: print=true,  screen=false
    copyright:  undefined,        // license page — default: print=true, screen=false
    toc:        undefined,        // static TOC page — default: print=true, screen=false
    body:       true,
    appendices: true,             // true | false | ['ta','tw'] — which appendix kinds to include
  },
  columns: 1,                     // body column count
  direction: undefined,           // 'ltr' | 'rtl' — defaults to htmlData.direction

  // ── Print-only (stages 4–5; ignored when media==='screen') ────────────
  print: {
    pageSize: 'A4_PORTRAIT',      // PAGE_SIZES key | friendly label | { width, height }
    margins:  undefined,          // { top, right, bottom, left } CSS lengths; theme default otherwise
    runningHeader: true,          // show the running header (text comes from the renderer — see 6.3)
    footerHtml: undefined,        // optional footer block on the copyright page (e.g. app version)
    pageNumber: {
      position: 'bottom',         // 'top' | 'bottom'  (default bottom)
      show: {                     // which sections get a running page number
        cover: false, copyright: false, toc: true, body: true, appendices: true,
      },
    },
  },

  // ── Subject-specific rendering (stage 3) ──────────────────────────────
  renderOptions: {},              // passed verbatim to the subject renderer

  // ── PDF backend (stage 5) ─────────────────────────────────────────────
  outputPath: undefined,          // write file vs return bytes
  weasyprintPath: undefined,
  baseUrl: undefined,
  timeoutMs: undefined,
}
```

### 6.2 `show` defaults are media-aware

| Section | `screen` default | `print` default | Notes |
|---|---|---|---|
| `cover` | `false` | `true` | |
| `copyright` | `false` | `true` | license page |
| `toc` | `false` | `true` | static TOC *page*; the TOC *data* is always in `htmlData.sections.toc` so the app can build its interactive selector regardless |
| `body` | `true` | `true` | |
| `appendices` | `true` | `true` | empty array → nothing rendered |

An explicit boolean in `options.show` always wins over the media default.

### 6.3 Running headers are render-time + CSS Paged Media (print only)

There is **no token-template option**. The running-header *content* is produced by
the renderer (stage 3), which emits hidden `<span class="header-title">Titus 1:1</span>`
markers in the body. Print CSS captures the nearest marker per page via
`string-set: doctitle content(text)` and echoes it into a `@page` margin box with
`content: string(doctitle)` (this is how `getPrintCss()` already works —
`printDocumentAssembler.js:295-303`).

Consequences:
- **Screen view:** `@page` margin boxes don't render and `.header-title` is
  `display:none` — so running headers never appear in the continuous web view.
  They surface only under WeasyPrint (PDF) or the PagedJS print-preview.
- **Options are toggles only:** `print.runningHeader` (on/off) and
  `print.pageNumber.position` (`top`/`bottom`, default `bottom`) +
  `print.pageNumber.show` (per-section). What the header *says*
  (`{book} {chapter}:{verse}`) is fixed by the renderer, not configured here.

### 6.4 Which stage reads what

| Option group | 1 getAllCatalogEntries | 2 getResourceData | 3 renderHtmlData | 4 renderHTML | 5 renderPdf |
|---|:--:|:--:|:--:|:--:|:--:|
| `dcsApiUrl`,`quiet` | ✅ | ✅ | | | |
| `isExtra` | | ✅ | | | |
| `books` | ✅ (fetch) | ✅ (fetch) | ordering | display filter | — |
| `renderOptions` | | | ✅ | | |
| `media`,`show`,`columns`,`direction` | | | | ✅ | (forces print) |
| `print.*` (pageSize, runningHeader, pageNumber, …) | | | | ✅ | ✅ |
| `outputPath`,`weasyprintPath`,`baseUrl`,`timeoutMs` | | | | | ✅ |

> `books` at stages 1–2 = *what to fetch*; at stage 4 = *which of the fetched
> books to display* (intersection). Same key, fetch-time vs compose-time meaning.

---

## 7. Cross-cutting decisions

- **One options object** (§6) threaded through; no positional `is_extra`, no
  `books` positional past stage 2.
- **Books live in the data, not the args** — baked into
  `ResourceData.requestedBooks`; stage 4 filters to a display subset.
- **Pure middle, side-effecting edges** — stages 3 & 4 do no I/O.
- **Serialization = caching** — `JSON.stringify` any intermediate
  (`catalogSet.json`, `resourceData.json`, `htmlData.json`); resume from the next
  stage. (Your `en_tn_jud.json` is exactly this.)

---

## 8. Migration plan (clean break)

**Phase 1a — Composition skeleton + signature flip. ✅ DONE (branch `feat/staged-pipeline`).**
- ✅ `renderHtmlData(resourceData, options)` — pure, synchronous, takes data
  directly; dropped the internal `getResourceData` call and the `owner/repo/ref/books`
  positionals; promotes `subject/title/abbreviation/version/direction` onto HtmlData;
  no longer attaches `resourceData`/`fullHtml`. (`src/renderHtmlData.js`)
- ✅ `renderHTML(htmlData, options)` — unified composition (screen + print),
  media-aware `show`, CSS pick, print path delegates to `assemblePrintDocument`.
  (`src/renderHTML.js`)
- ✅ `resolveComposeOptions` + `parseBooksOption` options helper, incl. array/object
  `books` parsing with reference ranges. (`src/renderOptions.js`)
- ✅ `resolvePageSize` moved to `printDocumentAssembler.js` so `renderHTML` stays
  Node-free; `renderPdf.js` re-exports it.
- ✅ `index.js` exports updated; both demos (`RenderHtmlDataDemo.jsx`,
  `RenderPDFDemo.jsx`) switched to staged `getResourceData → renderHtmlData → renderHTML`.
- ✅ Tests: rewrote `renderHtmlData.test.js` to the data-in/sync contract; added
  `renderHTML.test.js` + `renderOptions.test.js`. 19 suites / 143 tests pass; lint + build green.

**Phase 1b — Per-renderer content contract (PENDING).**
1. ✅ **DONE (appendices)** — TN now emits `sections.appendices = { ta, tw }`
   keyed by article (no longer embedded in `body`); a shared
   `renderAppendicesHtml()` composes them for screen (renderHTML) and print
   (assemblePrintDocument), preserving the original markup. Verified end-to-end.
   *(Still pending: promoting `requestedBooks`/`direction` into the data layer.)*
2. ✅ **DONE** — anchors rewritten to the `<res>-<book>-<chap|front>-<verse|intro>[-<noteId>]`
   scheme via a centralized prefix rewrite in `renderHtmlData` (`src/renderers/anchors.js`):
   renderers keep emitting internally-consistent `nav-…`, and `renderHtmlData` swaps the
   prefix to `resourceData.abbreviation`. Renderers + markdown converter untouched; verified
   on real TN data (`nav-jud-front-intro-xh5n` → `tn-jud-front-intro-xh5n`). Resource-level
   `<res>` anchor added to the screen wrapper (print wrapper TBD).
3. ✅ **DONE** — reference-range filtering (`books` object form) applied as a
   stage-3 pre-filter in `renderHtmlData` (`src/rangeFilter.js`): TSV resources
   are sliced by chapter/verse object; Aligned-Bible USFM is sliced by `\c`/`\v`
   (header preserved, boundary verses trimmed). Verified end-to-end — sliced
   alignment-marked USFM renders cleanly through Proskomma. Renderers untouched.
4. ✅ **DONE** — `show` (cover/copyright/toc/appendices), `print.pageNumber.position`
   (top/bottom), and `print.runningHeader` (on/off) are wired through `renderHTML`
   into `assemblePrintDocument`/`getPrintCss`, with defaults that preserve the
   current output. *(Pending: per-section `print.pageNumber.show` — needs named
   pages — and `print.margins`.)*

**Phase 1b — COMPLETE.** Remaining minor follow-ups (not blocking): promoting
`requestedBooks`/`direction` into the data layer (Phase 2 territory), per-section
`print.pageNumber.show` (needs named pages), `print.margins`, and the resource-level
anchor in the print wrapper.

**Phase 2 — Source stages.**
5. ✅ **DONE** — `getAllCatalogEntries(source, options)` (renamed from
   `getAllCatalogEntriesForRendering`, no alias); discriminated source; returns a
   CatalogSet with `resourceVersion`/`libraryVersion` split. (Filtering stays in
   `getResourceData` to keep the "all" semantics honest.)
6. ✅ **DONE** — `getResourceData(input, options)` discriminated input (descriptor
   | CatalogSet reuse | catalog entry | ResourceData passthrough); reuses a passed
   CatalogSet via `options.preEntries` (no redundant `/catalog/entry/` or
   `/catalog/bp/`); `is_extra`→`options.isExtra`. CLI + demos rewired; verified
   end-to-end on real DCS data.
7. ⏳ **PENDING (2c)** — `getResourceDataFromDirectory(catalogEntries, dirPath, options)`:
   needs a content-provider abstraction (HTTP vs `fs`) threaded through every
   extractor (incl. the TA/TW archive-zip path) so they can read
   `${dirPath}/${repo.name}/${ingredient.path}` from disk. RC/SB/TC only — not TS.
   A cross-cutting refactor; best as a focused follow-up.

**Phase 3 — Tail + orchestrator.**
8. Teach `renderPdf(input, options)` to accept a composed print string; force
   `media:'print'`.
9. Add `renderPreview(request)`.

**Phase 4 — Callers (the coordinated clean-break).**
10. `src/index.js` — drop `getAllCatalogEntriesForRendering` + the placeholder
    `renderHTML`; export `getAllCatalogEntries`, `getResourceDataFromDirectory`,
    `renderHTML`, `renderPreview`.
11. `src/RenderPDFDemo.jsx` / `src/RenderHtmlDataDemo.jsx` — switch to staged calls
    (`RenderPDFDemo.jsx:71-84` hand-builds `renderResult` from `data.resourceData`
    — that goes away).
12. **door43-preview-app** — staged API; stop at `renderHTML(htmlData, {media:'screen'})`
    for in-browser PagedJS + interactive selector.
13. Tests — update `__tests__/renderPdf.test.js`, `__tests__/tsvQuestionsRenderer.test.js`
    to the new contracts; add a stage-contract test that feeds a hand-built
    `ResourceData` straight into `renderHtmlData`, and a hand-built `HtmlData` into
    `renderHTML`.

---

## 9. Resolved (2026-06-29)

- **Running headers** — render-time content + CSS Paged Media; print/PDF/PagedJS
  only, never the continuous web view. Options are toggles only (§6.3).
- **Page number** — `print.pageNumber.position` (`top`/`bottom`, default bottom),
  per-section `show`.
- **Appendices** — keyed by kind, `{ ta: {...}, tw: {...} }` (§4.3); `show.appendices`
  accepts `true | false | ['ta','tw']`.
- **Local dir source** — full catalogEntry-driven, no `manifest.yaml`; RC/SB/TC
  supported, TS not. Future: SB-only via a converter / DCS SB-ZIP download (§5 2′).

### Still open

- **Per-book reference ranges** (`options.reference`) — deferred to a later
  iteration, or part of v1?
- **`renderHTML('screen')` body scope** — does the headless screen output need the
  full interactive nav that door43-preview-app renders today, or just clean body
  HTML the app wraps with its own React selector? (The TOC *data* is available
  either way.)
```
