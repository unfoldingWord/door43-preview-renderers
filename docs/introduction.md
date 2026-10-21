# Introduction

Welcome to the **Door43 Preview Renderers** documentation.

This is a headless JavaScript library (no React dependency) for fetching unfoldingWord Bible translation resources from the Door43 Content Service (DCS) and turning them into HTML and print-ready PDF. It powers the preview and print features of the Door43 Preview App, but it can be used on its own in the browser or in Node.

## What is Door43?

Door43 is unfoldingWord's platform for Bible translation and related resources. The DCS catalog hosts interrelated resources — Aligned Bibles, Translation Notes, Translation Questions, Translation Words and their Links, Translation Academy, Open Bible Stories, and their variants — that this library knows how to fetch, assemble, and render.

## The staged pipeline

The library is a chain of stages. Each stage takes the previous stage's output, so you can run the whole chain or resume from any intermediate you already have:

```
getAllCatalogEntries(source, opts)   → CatalogSet      (network)
getResourceData(input, opts)         → ResourceData    (network; or cached/local)
renderHtmlData(resourceData, opts)   → HtmlData        (pure, no I/O)
renderHTML(htmlData, opts)           → HTML string     (media: 'screen' | 'print')
renderPdf(htmlData, opts)            → PDF             (WeasyPrint)
```

1. **Catalog** — `getAllCatalogEntries()` calls the DCS Book Package endpoint once and returns every related resource at the versions that belong together. [Learn more →](get-all-catalog-entries.md)
2. **Data** — `getResourceData()` fetches and parses one resource into a normalized object (USFM, TSV, Markdown, or OBS), pulling in the supporting resources it needs. [Learn more →](get-resource-data.md)
3. **HTML sections** — `renderHtmlData()` routes that data to the renderer for its subject and returns packaged sections (cover, copyright, body, TOC, CSS, appendices). [Learn more →](renderers.md)
4. **Document** — `renderHTML()` composes the sections into one self-contained HTML document, for the screen or for print. [Learn more →](render-html.md)
5. **PDF** — `renderPdf()` turns the print document into a PDF with WeasyPrint. [Learn more →](render-pdf.md)

## Getting started

```js static
import {
  getResourceData,
  renderHtmlData,
  renderHTML,
  renderPdf,
} from '@unfoldingword/door43-preview-renderers';

// 1–2. Fetch + parse a resource and what it depends on (network).
const resourceData = await getResourceData(
  { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['tit'] },
  { dcs_api_url: 'https://git.door43.org/api/v1' }
);

// 3. Render to reusable HTML sections (pure, no network).
const htmlData = renderHtmlData(resourceData, { renderOptions: { showChaptersInToc: true } });
htmlData.sections; // { cover, copyright, body, toc, css, appendices?, appendixTitles? }

// 4. Compose a standalone document — web or print.
const webHtml = renderHTML(htmlData);                       // continuous web page
const printHtml = renderHTML(htmlData, { media: 'print' }); // PagedJS/WeasyPrint-ready

// 5. …or render a PDF directly (needs the weasyprint binary, or a pdfServiceUrl).
const pdf = await renderPdf(htmlData, { pageSize: 'A4_PORTRAIT' });
```

See [Rendering options](./options.md) for every option each stage accepts.

If you only want the raw parsed data (no HTML), stop after `getResourceData()`:

```js static
import { getResourceData } from '@unfoldingword/door43-preview-renderers';

const data = await getResourceData({ owner: 'adipatealberto', repo: 'pid_rut_text_reg', ref: 'master', books: ['rut'] });
// → { type: 'usfm', subject: 'Bible', books: { rut: '\\id RUT ...' }, license, ... }
```

## What it can render

`getResourceData()` understands four DCS metadata types:

| Metadata type | Description |
|---|---|
| `rc` | Resource Container (the unfoldingWord standard) |
| `sb` | Scripture Burrito (OBS; the scripture flavor is not implemented yet) |
| `ts` | translationStudio projects (single-book Bibles, OBS) |
| `tc` | translationCore projects (aligned Bibles with an exported USFM) |

`renderHtmlData()` produces HTML for these subjects:

| Subject(s) | Renderer |
|---|---|
| Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament | `renderAlignedBibleHtml` (USFM via Proskomma) |
| Open Bible Stories | `renderObsHtml` |
| TSV Translation Notes, TSV OBS Translation Notes | `renderTranslationNotesHtml` |
| TSV Translation Questions, TSV Study Notes, TSV Study Questions, TSV OBS Translation Questions, TSV OBS Study Notes, TSV OBS Study Questions | `renderTsvQuestionsHtml` |
| TSV Translation Words Links, TSV OBS Translation Words Links | `renderTranslationWordsLinksHtml` (by verse, or as a glossary) (`TSV OBS Translation Words Links` is routed here too, but its data extraction is still a stub — see [#21](https://github.com/unfoldingWord/door43-preview-renderers/issues/21)) |
| Translation Academy | `renderTranslationAcademyHtml` |
| Translation Words | `renderTranslationWordsHtml` |

`getResourceData()` also fetches the supporting resources each of these needs (aligned Bibles, Translation Academy, Translation Words, Translation Words Links, the original-language Bibles) and hands them to the renderer as `extras`.

## Core functions

### Catalog and data

- **`getAllCatalogEntries()`** — all catalog entries for a Book Package, in one call. [Learn more →](get-all-catalog-entries.md)
- **`getResourceData()`** — fetch and parse one resource into normalized data. [Learn more →](get-resource-data.md)
- **`getCatalogEntry()`** — fetch a single catalog entry's metadata.
- **`filterCatalogEntries()`**, **`selectAlignedBibles()`**, **`testamentOf()`** — the pure blueprint filtering `getResourceData()` applies, exported for callers that need the same set. [Learn more →](get-resource-data.md)

### Rendering

- **`renderHtmlData()`** — the subject-aware HTML sections pipeline. [Learn more →](renderers.md)
- Subject renderers: `renderAlignedBibleHtml`, `renderObsHtml`, `renderTranslationNotesHtml`, `renderTsvQuestionsHtml`, `renderTranslationWordsLinksHtml`, `renderTranslationAcademyHtml`, `renderTranslationWordsHtml`.
- **`renderHTML()`** — compose HtmlData into one document for screen or print. [Learn more →](render-html.md)
- **`generateCopyrightAndLicenseHtml()`** / **`copyrightCss`** — copyright and license page (LICENSE.md is converted from Markdown to HTML).

### Print and PDF

- **`renderPdf()`** — HtmlData → PDF (local `weasyprint`, or a hosted service via `pdfServiceUrl`). [Learn more →](render-pdf.md)
- **`assemblePrintDocument()`**, **`generateTocHtml()`**, **`generateTocFromHtml()`**, **`buildAppendicesToc()`**, **`renderAppendicesHtml()`**, **`buildCoverPage()`**, **`getPrintCss()`**, **`PAGE_SIZES`**, **`resolvePageSize()`** — the pieces `renderHTML()` uses for print documents.
- **`generatePdf()`** / **`generatePdfFromAssembled()`** / **`generatePdfViaService()`** — the WeasyPrint back ends behind `renderPdf()`.

### Options and helpers

- **`resolveComposeOptions()`**, **`parseBooksOption()`**, **`supportsBodyColumns()`**, **`runningHeaderModeFor()`** — option normalization used by the composition stage. [Learn more →](options.md)
- **`convertMarkdown()`**, **`convertNoteFromMD2HTML()`** — Markdown helpers used across the renderers. [Learn more →](converters.md)

### Constants

- **`BibleBookData`**, **`requiredSubjectsMap`**, **`subjectIdentifierMap`**, **`alignedBibleSubjects`** — Bible book metadata and resource mappings. [Learn more →](constants.md)

## Architecture

- **src/getAllCatalogEntries.js** — stage 1: the Book Package catalog (one `/catalog/bp/` call)
- **src/getResourceData.js** — stage 2: fetch and parse (rc / sb / ts / tc), filtering the blueprint to what the subject needs via **src/catalogSelection.js**
- **src/\*Helpers.js** (`rcAlignedBibleHelpers`, `tsBibleHelpers`, `tsvHelpers`, `obsHelpers`, `taHelpers`, `twHelpers`, `bibleHelpers`) — the per-format extractors behind stage 2; `twlQuoteTrimming.js` / `twQuoteTrim.js` narrow Translation Words Links quotes to the term
- **src/dcsApi.js** — DCS content and license fetching, with request-level caching
- **src/renderHtmlData.js** — stage 3: the subject router; **src/rangeFilter.js** applies per-book reference ranges
- **src/renderers/** — per-subject renderers, shared helpers, and the print document assembler
- **src/renderHTML.js**, **src/renderOptions.js** — stage 4: composition and option defaults
- **src/pdf/** — stage 5: WeasyPrint (local binary or HTTP service)
- **src/converters/** — Markdown conversion
- **src/constants.js** — Bible book data and resource mappings
- **src/cli.js** — the `door43-renderers` command line
- **src/api/** — a small GitHub API client (`fetchResource`), separate from the DCS fetching above

This separation lets you use only the parts you need and extend the library with new subjects.
