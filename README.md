# Door43 Preview Renderers

A headless JavaScript library for fetching unfoldingWord Bible translation resources from the Door43 Content Service (DCS) and rendering them to HTML and print-ready PDF. No React dependency; runs in Node and in the browser.

## Features

- 🔌 One call to the DCS Book Package endpoint resolves a resource and everything it depends on
- 📦 Parsed, normalized data for USFM, TSV, Markdown and Open Bible Stories resources
- 🧱 Subject-aware HTML sections (cover, copyright, body, table of contents, CSS, appendices)
- 📝 One self-contained document for the screen or for print, composed from those sections
- 📄 PDF via WeasyPrint (local binary or a hosted service)
- 🖥️ A command line that runs every stage
- ⚡ Composable stages: start from any cached intermediate

## Pipeline at a glance

The renderer is a **composable chain**. Each stage takes the previous stage's output, so you can run the whole thing or resume from any cached or local intermediate:

```
getAllCatalogEntries(source, opts)   → CatalogSet      (network)
getResourceData(input, opts)         → ResourceData    (network; or cached/local)
renderHtmlData(resourceData, opts)   → HtmlData        (pure, no I/O)
renderHTML(htmlData, opts)           → HTML string     (media: 'screen' | 'print')
renderPdf(htmlData, opts)            → PDF             (WeasyPrint)
```

## Installation

### As a library

```bash
# Using pnpm (recommended)
pnpm add @unfoldingword/door43-preview-renderers

# Using npm
npm install @unfoldingword/door43-preview-renderers

# Using yarn
yarn add @unfoldingword/door43-preview-renderers
```

### CLI tool

The package installs a `door43-renderers` command:

```bash
# Install globally
npm install -g @unfoldingword/door43-preview-renderers
door43-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit

# Or run it without installing
npx -p @unfoldingword/door43-preview-renderers door43-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit
```

## Usage

### Library usage

```javascript
import {
  getResourceData,
  renderHtmlData,
  renderHTML,
  renderPdf,
} from '@unfoldingword/door43-preview-renderers';

// 1–2. Fetch + parse a resource and the resources it depends on (network)
const resourceData = await getResourceData(
  { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['tit'] },
  { dcs_api_url: 'https://git.door43.org/api/v1' }
);

// 3. Render to reusable HTML sections (pure, no network).
//    Already have cached resourceData? Skip steps 1–2 and pass it straight in.
const htmlData = renderHtmlData(resourceData, {
  renderOptions: { showChaptersInToc: true },
});

console.log(htmlData.sections.body); // HTML body string

// 4. Compose a self-contained document — web or print
const webHtml = renderHTML(htmlData); // continuous web page
const printHtml = renderHTML(htmlData, { media: 'print', print: { pageSize: 'A4_PORTRAIT' } });

// 5. …or render a PDF (requires the `weasyprint` binary, or a pdfServiceUrl)
const pdf = await renderPdf(htmlData, { pageSize: 'A4_PORTRAIT', outputPath: 'titus.pdf' });
```

> **📖 All options are documented in [`docs/options.md`](docs/options.md)** — every
> argument for each stage, with defaults, examples, and recipes.

### CLI usage

```bash
# The book package for Titus, as JSON (quiet = JSON only, pipes into jq)
door43-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit --quiet | jq '.catalogEntries[] | {owner, repo: .name, subject}'

# Parsed resource data, saved to a file
door43-renderers getResourceData --owner unfoldingWord --repo en_tn --ref v91 --book tit --output tn_tit.json

# HTML sections (HtmlData JSON)
door43-renderers renderHtml --owner unfoldingWord --repo en_ult --ref v91 --book tit --quiet --output ult_tit.htmlData.json

# A print-ready HTML document
door43-renderers assemblePrint --owner unfoldingWord --repo en_obs --ref v9 --page-size TRADE --output obs.html

# A PDF, no browser (needs `weasyprint` on the PATH, or --pdf-service-url)
door43-renderers generatePdf --owner unfoldingWord --repo en_tn --ref v91 --book tit --output tit_tn.pdf

# A custom DCS host
door43-renderers getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --dcs-api-url https://qa.door43.org/api/v1
```

Commands: `getAllCatalogEntries`, `getResourceData`, `renderHtml`, `assemblePrint`, `generatePdf`. Options: `--owner`, `--repo`, `--ref` (all required), `--book`, `--dcs-api-url`, `--output`, `--quiet`, `--page-size`, `--columns`, `--pdf-service-url`. See [`docs/cli.md`](docs/cli.md).

## API reference

### `getAllCatalogEntries(source, options?)`

Stage 1. Fetches the full book-package catalog (the blueprint) for a resource in one call to the DCS `/catalog/bp/` endpoint: the main entry plus every related resource at the versions that belong together.

- `source`: a descriptor `{ owner, repo, ref, books? }`, a catalog entry object (its `url` gives the DCS API base), or an existing CatalogSet (returned unchanged)
- `options.dcs_api_url` (default `https://git.door43.org/api/v1`), `options.quiet`, `options.books` (with the catalog-entry form)

Returns a **CatalogSet**:

```javascript
{
  resourceVersion: 'v91',      // the resource's version (tag/branch)
  libraryVersion: '1.5.6',     // this library's npm version
  catalogEntries: [ /* main entry first, then every related resource */ ],
  source: { owner, repo, ref, books, dcsApiUrl },
}
```

The blueprint is the single source of truth for which resources and versions belong together; no client-side date or name matching is done. Filtering to what a subject actually needs for rendering (per `requiredSubjectsMap`, at most two Aligned Bibles preferring `ult`/`glt` + `ust`/`gst`, testament-aware original-language Bibles) happens in `getResourceData()`, which reuses a CatalogSet you pass it. [More →](docs/get-all-catalog-entries.md)

### `getResourceData(input, options?)`

Stage 2. Fetches one resource, parses it, fetches the supporting resources its subject needs, and returns normalized **ResourceData**.

- `input`: a descriptor `{ owner, repo, ref, books? }`, a CatalogSet (reused, no second blueprint call), a catalog entry object, or existing ResourceData (returned unchanged)
- `options.dcs_api_url`, `options.quiet`, `options.books`

```javascript
const resourceData = await getResourceData(
  { owner: 'unfoldingWord', repo: 'en_ult', ref: 'v91', books: ['gen', 'exo'] },
  { quiet: true }
);

console.log(resourceData.type);    // 'usfm'
console.log(resourceData.subject); // 'Aligned Bible'
console.log(Object.keys(resourceData.books)); // ['gen', 'exo']
```

The shape depends on `type` (`usfm`, `tsv`, `obs`, `ta`, `tw`); TSV resources carry their supporting resources in `extras` and GL quotes per aligned Bible in each row's `GLQuotes`. [More →](docs/get-resource-data.md)

### `renderHtmlData(resourceData, options?)`

Stage 3. Renders subject-specific HTML **sections** from ResourceData. Pure and synchronous, no network.

- `options.renderOptions`: renderer-specific options (e.g. `showChaptersInToc`, `editorMode`, `includeRawUsfmView`, `resolution`, `layout`)
- `options.books`: for the USFM subjects (Aligned Bible, Bible, Greek NT, Hebrew OT) the listed ids — array entries or object keys — select and order the books rendered, and unlisted books are omitted (`resourceData.requestedBooks` takes precedence when set); the TSV, OBS and manual renderers render every book in the data in catalog `sort` order. Object-form values add per-book reference ranges (TSV and USFM); `'*'` keeps a book whole

Supported subjects:

- `Aligned Bible`, `Bible`, `Greek New Testament`, `Hebrew Old Testament`
- `Translation Academy`, `Translation Words`
- `Open Bible Stories`
- `TSV Translation Notes` / `TSV OBS Translation Notes`
- `TSV Translation Questions` / `Study Questions` / `Study Notes` (+ OBS variants)
- `TSV Translation Words Links` (by verse, or as a glossary with `renderOptions.layout: 'glossary'`); `TSV OBS Translation Words Links` is routed here but its data extraction is still a stub ([#21](https://github.com/unfoldingWord/door43-preview-renderers/issues/21))

Returns an **HtmlData** package:

```javascript
{
  subject: 'Aligned Bible',
  title: 'unfoldingWord® Literal Text',
  abbreviation: 'ult',
  version: 'v91',
  direction: 'ltr',
  sections: {
    cover: '<h1 ...',
    copyright: '<div ...',
    body: '<section class="bible-book" ...',
    toc: [{ id: 'ult-tit', title: 'Titus', book: 'tit' }],
    css: { web: '...', print: '...' },
    appendices: undefined,   // { ta, tw } for Translation Notes and Translation Words Links
    webView: null,
  },
}
```

[More →](docs/renderers.md)

### `renderHTML(htmlData, options?)`

Stage 4. Composes an HtmlData package into **one self-contained HTML document** for the screen or for print. Pure and synchronous; returns a string.

- `options.media`: `'screen'` (default; continuous page, cover/copyright/toc off) or `'print'` (paged, PagedJS/WeasyPrint-ready, cover/copyright/toc on)
- `options.show`, `options.columns`, `options.direction`, `options.engine`, `options.print.*` (`pageSize`, `footerHtml`, `runningHeader`, `pageNumber.position`)

```javascript
const webHtml = renderHTML(htmlData);                       // continuous web page
const printHtml = renderHTML(htmlData, { media: 'print' }); // PagedJS/WeasyPrint-ready
```

[More →](docs/render-html.md)

### `renderPdf(htmlData, options?)`

Stage 5. Composes the print document and renders it with WeasyPrint: the local `weasyprint` binary, or a hosted service when `options.pdfServiceUrl` is set. Returns PDF bytes, or writes to `options.outputPath`. [More →](docs/render-pdf.md)

### Also exported

Subject renderers (`renderAlignedBibleHtml`, `renderObsHtml`, `renderTranslationNotesHtml`, `renderTsvQuestionsHtml`, `renderTranslationWordsLinksHtml`, `renderTranslationAcademyHtml`, `renderTranslationWordsHtml`), the print assembler pieces (`assemblePrintDocument`, `generateTocHtml`, `generateTocFromHtml`, `buildAppendicesToc`, `renderAppendicesHtml`, `buildCoverPage`, `coverCss`, `getPrintCss`, `PAGE_SIZES`, `resolvePageSize`), the PDF back ends (`generatePdf`, `generatePdfFromAssembled`, `generatePdfViaService`), option helpers (`resolveComposeOptions`, `parseBooksOption`, `supportsBodyColumns`, `runningHeaderModeFor`), Markdown helpers (`convertMarkdown`, `convertNoteFromMD2HTML`), the blueprint filtering `getResourceData()` applies (`filterCatalogEntries`, `selectAlignedBibles`, `testamentOf`), `getCatalogEntry`, `fetchResource`, and the constants `BibleBookData`, `requiredSubjectsMap`, `subjectIdentifierMap`, `alignedBibleSubjects`. See [`docs/introduction.md`](docs/introduction.md).

## Development

### Prerequisites

- Node.js 22 (what CI and the publish workflow use)
- pnpm 11

### Setup

```bash
git clone https://github.com/unfoldingWord/door43-preview-renderers.git
cd door43-preview-renderers
pnpm install
```

### Style guide

Interactive demos of every stage, in pipeline order:

```bash
pnpm run styleguide:dev
# http://localhost:6060
```

### CLI from source

The CLI imports the built library, so build first:

```bash
pnpm build
node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit
# or
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit
```

### Building

```bash
pnpm run build             # library → dist/
pnpm run dev               # rebuild on change
pnpm run styleguide:build  # style guide → styleguide/
```

### Testing

```bash
pnpm test                  # Jest (ESM; runs with --experimental-vm-modules)
pnpm run test:watch
pnpm run test:coverage     # enforces the global coverage threshold
pnpm run lint
pnpm run format
```

CI runs lint, the coverage-gated tests, the build and an export check on every pull request and push to `main`. Pull requests target `main` and are reviewed by the `uwreview` bench.

## Project structure

```
door43-preview-renderers/
├── src/
│   ├── index.js                     # public exports
│   ├── cli.js                       # door43-renderers command line
│   ├── constants.js                 # Bible books and resource mappings
│   ├── getAllCatalogEntries.js      # stage 1: the book-package catalog
│   ├── getResourceData.js           # stage 2: fetch + parse, with the extractors:
│   ├── *Helpers.js                  #   rcAlignedBible, tsBible, tsv, obs, ta, tw, bible
│   ├── dcsApi.js                    # DCS fetching with request-level caching
│   ├── renderHtmlData.js            # stage 3: subject router (+ rangeFilter.js)
│   ├── renderers/                   # subject renderers, shared helpers, print assembler
│   ├── renderHTML.js, renderOptions.js   # stage 4: composition
│   ├── pdf/                         # stage 5: WeasyPrint
│   ├── converters/                  # Markdown conversion
│   ├── api/                         # GitHub API helper
│   ├── fixtures/                    # demo fixtures (not published)
│   ├── *Demo.jsx, *Demo.md          # styleguide demos
│   └── __tests__/
├── docs/                            # styleguide pages
├── skills/door43-renderers-maintainer/   # AI maintainer skill
├── .github/workflows/               # ci.yml (PRs, main), npm-publish.yml (releases)
├── dist/                            # built library (generated)
└── styleguide/                      # built style guide (generated)
```

## Contributing

Contributions are welcome. Open a pull request against `main`.

## License

MIT © [unfoldingWord](https://github.com/unfoldingWord)

## Links

- [GitHub Repository](https://github.com/unfoldingWord/door43-preview-renderers)
- [Documentation](https://door43-preview-renderers.netlify.app)
