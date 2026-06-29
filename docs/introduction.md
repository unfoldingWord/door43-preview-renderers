# Introduction

Welcome to the **Door43 Preview Renderers** documentation.

This is a headless JavaScript library (no React dependency) for fetching unfoldingWord Bible translation resources from the Door43 Content Service (DCS) and turning them into HTML and print-ready PDF. It powers the preview and print features used by tools like the Door43 Preview App, but it can be used on its own in the browser or in Node.

## What is Door43?

Door43 is unfoldingWord's platform for Bible translation and related resources. The DCS catalog hosts interrelated resources — Aligned Bibles, Translation Notes, Translation Questions, Translation Academy, Translation Words, Open Bible Stories, and their variants — that this library knows how to fetch, assemble, and render.

## The tiered pipeline

The library is organized as a tiered API, so you take it only as far as you need:

1. **Catalog** — `getAllCatalogEntriesForRendering()` calls the DCS Book Package endpoint once and returns every related resource (with version matching).
2. **Data** — `getResourceData()` fetches and parses one resource into a normalized JSON object (USFM, TSV, markdown, or OBS), pulling in any extras it needs to render.
3. **HTML** — `renderHtmlData()` routes that data to the right subject renderer and returns packaged HTML sections plus a complete `fullHtml` document.
4. **Print/PDF** — `assemblePrintDocument()` combines sections into a PagedJS-compatible print document, and `generatePdf()` produces a PDF.

## Getting started

The typical flow goes data → HTML → (optional) print:

```js static
import {
  getResourceData,
  renderHtmlData,
  renderHTML,
  renderPdf,
} from 'door43-preview-renderers';

// 1. Fetch + parse a resource (network).
const resourceData = await getResourceData('unfoldingWord', 'en_ult', 'master', ['tit'], {
  dcs_api_url: 'https://git.door43.org/api/v1',
});

// 2. Render to reusable HTML sections (pure, no network).
const htmlData = renderHtmlData(resourceData, { renderOptions: { editorMode: false } });
htmlData.sections; // { cover, copyright, body, toc, css, webView? }

// 3. Compose a standalone document — web or print.
const webHtml = renderHTML(htmlData);                       // continuous web page
const printHtml = renderHTML(htmlData, { media: 'print' }); // PagedJS/WeasyPrint-ready

// 4. …or render a PDF directly.
const pdf = await renderPdf(htmlData, { pageSize: 'A4_PORTRAIT' });
```

See [Rendering options](./options.md) for every option each stage accepts.

If you only want the raw parsed data (no HTML), call `getResourceData()` directly:

```js static
import { getResourceData } from 'door43-preview-renderers';

const data = await getResourceData('adipatealberto', 'pid_rut_text_reg', 'master', ['rut']);
// → { type: 'usfm', subject: 'Bible', books: { rut: '\\id RUT ...' }, license, ... }
```

## What it can render

`getResourceData()` understands four DCS metadata types:

| Metadata type | Description |
|---|---|
| `rc` | Resource Container (the unfoldingWord standard) |
| `sb` | Scripture Burrito |
| `ts` | translationStudio projects (single-book Bibles, OBS) |
| `tc` | translationCore projects (aligned Bibles with an exported USFM) |

`renderHtmlData()` produces HTML for these subjects:

| Subject(s) | Renderer |
|---|---|
| Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament | `renderAlignedBibleHtml` (USFM via Proskomma) |
| Open Bible Stories | `renderObsHtml` |
| TSV Translation Notes, TSV OBS Translation Notes | `renderTranslationNotesHtml` |
| TSV Translation Questions, TSV Study Notes, TSV Study Questions, TSV OBS Translation Questions, TSV OBS Study Notes, TSV OBS Study Questions | `renderTsvQuestionsHtml` |
| Translation Academy | `renderTranslationAcademyHtml` |
| Translation Words | `renderTranslationWordsHtml` |

`getResourceData()` can also fetch and parse additional subjects (for example, Translation Words Links) as supporting data for the renderers above, even where there is not yet a dedicated top-level HTML renderer for them.

## Core functions

### Catalog and data

- **`getAllCatalogEntriesForRendering()`** — all catalog entries for a Book Package, with intelligent version matching. [Learn more →](get-all-catalog-entries-for-rendering.md)
- **`getResourceData()`** — fetch and parse one resource into normalized data. [Learn more →](get-resource-data.md)
- **`getCatalogEntry()`** — fetch a single catalog entry's metadata.

### Rendering

- **`renderHtmlData()`** — the subject-aware HTML pipeline. [Learn more →](renderers.md)
- Subject renderers: `renderAlignedBibleHtml`, `renderObsHtml`, `renderTranslationNotesHtml`, `renderTsvQuestionsHtml`, `renderTranslationAcademyHtml`, `renderTranslationWordsHtml`, and the generic `renderHTML`.
- **`generateCopyrightAndLicenseHtml()`** / **`copyrightCss`** — copyright and license page (LICENSE.md is converted from Markdown to HTML).

### Print and PDF

- **`assemblePrintDocument()`**, **`generateTocHtml()`**, **`generateTocFromHtml()`**, **`buildCoverPage()`**, **`getPrintCss()`**, **`PAGE_SIZES`** — assemble PagedJS-compatible print documents.
- **`generatePdf()`** / **`generatePdfFromAssembled()`** — produce a PDF.

### Converters

- **`convertMarkdown()`**, **`convertNoteFromMD2HTML()`** — Markdown helpers used across the renderers. [Learn more →](converters.md)

### Constants

- **`BibleBookData`**, **`requiredSubjectsMap`**, **`subjectIdentifierMap`** — Bible book metadata and resource mappings. [Learn more →](constants.md)

## Architecture

- **src/constants.js** — Bible book data and resource mappings
- **src/getResourceData.js** — fetch and parse resource data (rc / sb / ts / tc)
- **src/getAllCatalogEntriesForRendering.js** — Book Package catalog entries with dependencies
- **src/renderHtmlData.js** — subject-aware HTML rendering router
- **src/renderers/** — per-subject HTML renderers + print assembly
- **src/converters/** — Markdown and USFM conversion utilities
- **src/pdf/** — PDF generation
- **src/api/** — low-level DCS communication

This separation lets you use only the parts you need and extend the library with new subjects.
