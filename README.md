# Door43 Preview Renderers

A headless JavaScript library for fetching unfoldingWord Bible translation resources from the Door43 Content Service (DCS) and rendering them to HTML and print-ready PDF. The rendering functions do not use React (it is only used by the styleguide demos; the `react` / `react-dom` peer declarations in `package.json` are a leftover tracked in [#32](https://github.com/unfoldingWord/door43-preview-renderers/issues/32)); runs in Node and in the browser.

## Features

- 🔎 Start from a language: find who publishes a subject and resolve the latest release
- 🔌 One call to the DCS Book Package endpoint resolves a resource and everything it depends on
- 📦 Parsed, normalized data for USFM, TSV, Markdown and Open Bible Stories resources
- 🧱 Subject-aware HTML sections (cover, copyright, body, table of contents, CSS, appendices)
- 📝 One self-contained document for the screen or for print, composed from those sections
- 📄 PDF via WeasyPrint (local binary or a hosted service)
- 🖥️ A command line that runs every stage
- ⚡ Composable stages: start from any cached intermediate

## Pipeline at a glance

The renderer is a **composable chain**. Each stage takes the previous stage's output, so you can run the whole thing or resume from any cached intermediate. Stage 2 can also read repositories checked out on disk (`getResourceDataFromDirectory`):

```
resolveResource(query, opts)         → owner/repo/ref  (network; optional stage 0: language + subject → publisher + release)
getAllCatalogEntries(source, opts)   → CatalogSet      (network)
getResourceData(input, opts)         → ResourceData    (network; or a cached ResourceData passed through)
renderHtmlData(resourceData, opts)   → HtmlData        (pure, no I/O)
renderHTML(htmlData, opts)           → HTML string     (media: 'screen' | 'print')
renderPdf(htmlData, opts)            → PDF             (WeasyPrint)
```

Stage 0 is for callers that know a language rather than a repository; `getAllCatalogEntries({ lang, subject, books })` runs it and keeps the blueprint it fetched, so nothing is requested twice.

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

Starting from a language instead of a repository:

```javascript
import { getAllCatalogEntries, getResourceData } from '@unfoldingword/door43-preview-renderers';

// 0–1. Find the publisher and its latest release, and fetch the book package once
const set = await getAllCatalogEntries({ lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] });
set.source; // → { owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v66', … }

// 2. Reuse that set: no second blueprint call
const resourceData = await getResourceData(set);
```

> **📖 All options are documented in [`docs/options.md`](docs/options.md)** — every
> argument for each stage, with defaults, examples, and recipes. The full list of
> pages is under [Documentation](#documentation).

### CLI usage

```bash
# What a language publishes, and its Translation Notes for Titus (publisher and release found for you)
door43-renderers findResources --lang es-419 --quiet
door43-renderers renderHtml --lang es-419 --subject "TSV Translation Notes" --book tit --quiet --output tn_tit.htmlData.json

# The latest release of a repository: leave out --ref
door43-renderers getResourceData --owner unfoldingWord --repo en_tn --book tit --quiet

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

Commands: `findResources`, `getAllCatalogEntries`, `getResourceData`, `renderHtml`, `assemblePrint`, `generatePdf`. Name the resource with `--owner` and `--repo`, or with `--lang` and `--subject` (plus an optional preferred `--owner` and `--stage`); `--ref` is optional and defaults to the latest release. Other options: `--book`, `--dcs-api-url`, `--output`, `--quiet`, `--page-size` (`A4` → `A4_PORTRAIT`, `A5` → `A5_PORTRAIT`, `USL` → `US_LETTER_PORTRAIT`, `TRADE`, `CQ` → `CROWN_QUARTO`), `--columns`, `--pdf-service-url`. See [`docs/cli.md`](docs/cli.md).

## API reference

### Stage 0: finding resources

For callers that know a language rather than an `owner/repo/ref`. Read-only DCS catalog lookups through the same request cache.

- `findResources({ lang, subject?, owner?, stage? })`: every published catalog entry for a language
- `resolveResource({ lang, subject, books?, owner?, stage?, ref? })`: the best publisher and release, as `{ owner, repo, ref, entry, catalogEntries }`. Candidates are tried in order (a requested owner, gateway-language publishers, newest release); the first whose book package carries the requested books and every subject they need wins
- `resolveRef({ owner, repo, ref? })`: a given ref, else the latest release, else the default branch
- `resolveTarget({ owner?, repo?, ref?, lang?, subject?, books?, stage? })`: what the CLI does with either form
- `listLanguages({ stage? })`: languages with published content

[More →](docs/find-resources.md)

### `getAllCatalogEntries(source, options?)`

Stage 1. Fetches the full book-package catalog (the blueprint) for a resource in one call to the DCS `/catalog/bp/` endpoint: the main entry plus every related resource at the versions that belong together. (The language form fetches the blueprint of each publisher it tries, and returns the chosen one without fetching it again.)

- `source`: a descriptor `{ owner, repo, ref, books? }`; the language form `{ lang, subject, books?, owner?, stage?, ref? }` (stage 0 first, then its blueprint is the result); a catalog entry object (its `url` gives the DCS API base); or an existing CatalogSet (returned unchanged)
- `options.dcs_api_url` (default `https://git.door43.org/api/v1`), `options.quiet`, `options.books` (with the catalog-entry form)

Returns a **CatalogSet**:

```javascript
{
  resourceVersion: 'v91',      // the resource's version (tag/branch)
  libraryVersion: '1.6.0',     // this library's npm version
  catalogEntries: [ /* main entry first, then every related resource */ ],
  source: { owner, repo, ref, books, dcsApiUrl }, // + lang, subject for the language form
}
```

The blueprint is the single source of truth for which resources and versions belong together; no client-side date or name matching is done. Filtering to what a subject actually needs for rendering (per `requiredSubjectsMap`, at most two Aligned Bibles preferring `ult`/`glt` + `ust`/`gst`, testament-aware original-language Bibles) happens in `getResourceData()`, which reuses a CatalogSet you pass it. [More →](docs/get-all-catalog-entries.md)

### `getResourceData(input, options?)`

Stage 2. Fetches one resource, parses it, fetches the supporting resources its subject needs, and returns normalized **ResourceData**.

- `input`: a descriptor `{ owner, repo, ref, books? }`, a CatalogSet (reused, no second blueprint call; this is how the language form reaches stage 2), a catalog entry object, or existing ResourceData (returned unchanged)
- `options.dcs_api_url`, `options.quiet`, `options.books`
- `books`: the books to fetch; what an empty list means, and which subjects ignore it, is [the `books` rule](skills/door43-renderers-maintainer/references/contracts.md#books-at-stage-2)

```javascript
const resourceData = await getResourceData(
  { owner: 'unfoldingWord', repo: 'en_ult', ref: 'v91', books: ['gen', 'exo'] },
  { quiet: true }
);

console.log(resourceData.type);    // 'usfm'
console.log(resourceData.subject); // 'Aligned Bible'
console.log(Object.keys(resourceData.books)); // ['gen', 'exo']
```

The shape depends on `type` (`usfm`, `tsv`, `obs`, `ta`, `tw`); TSV resources carry their supporting resources in `extras` and GL quotes per aligned Bible in each row's `GLQuotes`. The GL quotes are computed locally (`src/quotes/`) from the aligned Bibles and the original-language Bible; a quote that cannot be matched falls back to the original-language quote. [More →](docs/get-resource-data.md)

### `getResourceDataFromDirectory(catalogEntries, dirPath, options?)`

Stage 2 from repositories checked out on disk, one folder per repository (`en_tn`, `en_ult`, …): the same ResourceData, no DCS requests for content. Pass the CatalogSet from `getAllCatalogEntries()` (or one saved earlier). On the command line: `--dir <path>`, with `--catalog <file>` to skip the catalog request too. [More →](docs/get-resource-data.md)

### `renderHtmlData(resourceData, options?)`

Stage 3. Renders subject-specific HTML **sections** from ResourceData. Pure and synchronous, no network.

- `options.renderOptions`: renderer-specific options (e.g. `showChaptersInToc`, `editorMode`, `includeRawUsfmView`, `resolution`, `layout`)
- `options.books`: for the USFM subjects (Aligned Bible, Bible, Greek NT, Hebrew OT) the listed ids — array entries or object keys — select and order the books rendered, and unlisted books are omitted (`resourceData.requestedBooks` takes precedence when set); the TSV, OBS and manual renderers render every book in the data in catalog `sort` order. Object-form values add per-book reference ranges (TSV and USFM); `'*'` keeps a book whole

Supported subjects:

- `Aligned Bible`, `Bible`, `Greek New Testament`, `Hebrew Old Testament`
- `Translation Academy`, `Translation Words`
- `Open Bible Stories`
- `TSV Translation Notes` / `TSV OBS Translation Notes`
- `TSV Translation Questions` / `TSV Study Questions` / `TSV Study Notes` (+ their `TSV OBS …` variants)
- `TSV Translation Words Links` / `TSV OBS Translation Words Links` (by verse or story frame, or as a glossary with `renderOptions.layout: 'glossary'`)

Returns an **HtmlData** package:

```javascript
{
  subject: 'Aligned Bible',
  title: 'unfoldingWord® Literal Text',
  abbreviation: 'ult',
  version: 'v91',
  language: 'en',              // from the catalog entry → <html lang>
  direction: 'ltr',            // 'rtl' for Arabic, Hebrew, Farsi… → <html dir>
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
- `options.show`, `options.columns`, `options.language`, `options.direction` (both default to the resource's), `options.engine`, `options.print.*` (`pageSize`, `footerHtml`, `runningHeader`, `pageNumber.position`)

```javascript
const webHtml = renderHTML(htmlData);                       // continuous web page
const printHtml = renderHTML(htmlData, { media: 'print' }); // PagedJS/WeasyPrint-ready
```

[More →](docs/render-html.md)

### `renderPdf(htmlData, options?)`

Stage 5. Composes the print document and renders it with WeasyPrint: the local `weasyprint` binary, or a hosted service when `options.pdfServiceUrl` is set. Returns PDF bytes, or writes to `options.outputPath`. [More →](docs/render-pdf.md)

### Also exported

Stage 0 (`findResources`, `resolveResource`, `resolveRef`, `resolveTarget`, `listLanguages`), subject renderers (`renderAlignedBibleHtml`, `renderObsHtml`, `renderTranslationNotesHtml`, `renderTsvQuestionsHtml`, `renderTranslationWordsLinksHtml`, `renderTranslationAcademyHtml`, `renderTranslationWordsHtml`), the print assembler pieces (`assemblePrintDocument`, `generateTocHtml`, `generateTocFromHtml`, `buildAppendicesToc`, `renderAppendicesHtml`, `buildCoverPage`, `coverCss`, `getPrintCss`, `PAGE_SIZES`, `resolvePageSize`), the PDF back ends (`generatePdf`, `generatePdfFromAssembled`, `generatePdfViaService`), option helpers (`resolveComposeOptions`, `parseBooksOption`, `supportsBodyColumns`, `runningHeaderModeFor`), Markdown helpers (`convertMarkdown`, `convertNoteFromMD2HTML`), the copyright page (`generateCopyrightAndLicenseHtml`, `copyrightCss`), the blueprint filtering `getResourceData()` applies (`filterCatalogEntries`, `selectAlignedBibles`, `testamentOf`), `getCatalogEntry`, `fetchResource`, and the constants `BibleBookData`, `requiredSubjectsMap`, `subjectIdentifierMap`, `alignedBibleSubjects`. See [`docs/introduction.md`](docs/introduction.md).

## Documentation

The same pages, with live demos, are the [style guide](https://door43-preview-renderers.netlify.app) (`pnpm run styleguide:dev` locally).

| Page | What it covers |
|---|---|
| [Introduction](docs/introduction.md) | What the library does, the stages, what it can render, the public functions |
| [Full Pipeline](docs/pipeline.md) | The chain end to end, and resuming from a cached intermediate |
| [0 · Find Resources](docs/find-resources.md) | Stage 0: from a language and subject to a publisher and release |
| [1 · Get All Catalog Entries](docs/get-all-catalog-entries.md) | Stage 1: the book package (`/catalog/bp/`) as a CatalogSet |
| [2 · Get Resource Data](docs/get-resource-data.md) | Stage 2: fetch and parse; ResourceData shapes, `extras`, `GLQuotes` |
| [3 · Render HTML Data](docs/renderers.md) | Stage 3: subject renderers and the HtmlData sections |
| [4 · Render HTML](docs/render-html.md) | Stage 4: one document for the screen or for print |
| [5 · Render PDF](docs/render-pdf.md) | Stage 5: WeasyPrint, local or as a service |
| [Rendering Options](docs/options.md) | Every option of every stage, with defaults and status |
| [CLI](docs/cli.md) | The `door43-renderers` command |
| [Constants](docs/constants.md) | `BibleBookData`, `requiredSubjectsMap`, `subjectIdentifierMap`, `alignedBibleSubjects` |
| [Converters](docs/converters.md) | The Markdown helpers |
| [API Client](docs/api.md) | `fetchResource`, the small GitHub API helper |
| [Rendering Pipeline Design](docs/rendering-pipeline.md) | Design record for the staged API (what is implemented, what is still planned) |
| [PDF Service & App Integration Plan](docs/pdf-service-and-app-integration.md) | Planning record for the PDF service and door43-preview-app's use of this library |

For maintainers and AI agents: [`AGENTS.md`](AGENTS.md) and the [maintainer skill](skills/door43-renderers-maintainer/SKILL.md) with its [data and render contracts](skills/door43-renderers-maintainer/references/contracts.md).

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

The CLI runs the built library in `dist/` when there is one and the source in `src/` when there is not. After changing `src/`, run `pnpm build` (or delete `dist/`) so the CLI runs your change:

```bash
node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit
# or
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit
```

### Building

```bash
pnpm run build             # library → dist/index.esm.js (published) and dist/index.js
pnpm run dev               # rebuild on change
pnpm run styleguide:build  # style guide → styleguide/
pnpm run fetch-logos       # refresh src/assets/logos.generated.js from the CDN
```

The cover logos are bundled as data URIs in `src/assets/logos.generated.js`, which is committed; `prebuild` only fetches them when that file is missing. Only `dist/index.esm.js` and `src/cli.js` are published.

### Checks

```bash
pnpm run lint              # ESLint over the whole repo, no warnings allowed
pnpm run format            # Prettier: write
pnpm run format:check      # Prettier: check (what CI runs)
pnpm test                  # Jest (ESM; runs with --experimental-vm-modules)
pnpm run test:watch
pnpm run test:coverage     # enforces the global coverage threshold
```

CI (`.github/workflows/ci.yml`) runs lint, the format check, the coverage-gated tests, the build, and a check that the built package exports every public name, on every pull request and push to `main`.

### Releasing

1. Bump `version` in `package.json` in a pull request and merge it.
2. Publish a GitHub release whose tag is that version with a `v` in front (`v1.6.0`).
3. `npm-publish.yml` runs the tests, checks that the tag matches `package.json`, and publishes to npm; a version that is already on the registry is skipped. The workflow publishes with the `NPM_TOKEN` organization secret.

## Project structure

```
door43-preview-renderers/
├── src/
│   ├── index.js                     # public exports (CI checks the names)
│   ├── cli.js                       # door43-renderers command line
│   ├── constants.js                 # Bible books and resource mappings
│   ├── findResources.js             # stage 0: language + subject → owner/repo/ref
│   ├── getAllCatalogEntries.js      # stage 1: the book-package catalog
│   ├── catalogSelection.js          # which blueprint entries a render needs
│   ├── getResourceData.js           # stage 2: fetch + parse, with the extractors:
│   ├── *Helpers.js                  #   rcAlignedBible, tsBible, tsv, obs, ta, tw, bible
│   ├── quotes/                      # original-language → Gateway Language quote lookup
│   ├── dcsApi.js                    # DCS fetching with request-level caching
│   ├── renderHtmlData.js            # stage 3: subject router (+ rangeFilter.js)
│   ├── renderers/                   # subject renderers, shared helpers, print assembler
│   ├── renderHTML.js, renderOptions.js   # stage 4: composition
│   ├── pdf/                         # stage 5: WeasyPrint
│   ├── converters/                  # Markdown conversion
│   ├── api/                         # GitHub API helper
│   ├── assets/                      # bundled cover logos (generated, committed)
│   ├── fixtures/                    # demo and test fixtures (not published)
│   ├── *Demo.jsx, *Demo.md          # styleguide demos
│   └── __tests__/
├── docs/                            # documentation (the style guide pages)
├── scripts/                         # fetch-logos.mjs, gen-glquote-fixtures.mjs
├── skills/door43-renderers-maintainer/   # AI maintainer skill
├── .github/workflows/               # ci.yml (PRs, main), npm-publish.yml (releases)
├── AGENTS.md                        # guide for AI agents working in this repo
├── dist/                            # built library (generated)
└── styleguide/                      # built style guide (generated)
```

## Contributing

1. Branch from `main` and open a pull request against `main`.
2. Before pushing, run `pnpm run format`, `pnpm run lint` and `pnpm test`. A change to the public API also updates the docs page for its stage, [`docs/options.md`](docs/options.md) if it adds an option, and the export list in `.github/workflows/ci.yml` if it adds an export. A new page in `docs/` goes in `styleguide.config.cjs` and in the [Documentation](#documentation) table.
3. Request the `uwreview` bench as reviewer. Two independent reviewers comment on every push; see [`AGENTS.md`](AGENTS.md#reviews) for how rounds, fixes and follow-ups work. Keep fixtures small (well under 100 KB per PR), so the reviewers can read the whole change.
4. `main` requires the `test` check to pass. A person reviews and merges.

## License

MIT © [unfoldingWord](https://github.com/unfoldingWord)

## Links

- [GitHub Repository](https://github.com/unfoldingWord/door43-preview-renderers)
- [Documentation](https://door43-preview-renderers.netlify.app)
