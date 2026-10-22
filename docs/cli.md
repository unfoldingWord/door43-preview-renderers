# CLI Tool

The package ships a command line, `door43-renderers`, that runs the same staged
pipeline as the library: find what a language publishes, fetch the catalog, fetch
and parse a resource, render it to HTML sections, compose a print document, or
produce a PDF.

## Installation

```bash
npm install -g @unfoldingword/door43-preview-renderers
door43-renderers --help
```

From a checkout, run it with `pnpm cli` or `node src/cli.js`. It uses the built
library in `dist/` when there is one and the source in `src/` when there is not, so
after changing `src/` run `pnpm build` (or delete `dist/`) before trying the CLI:

```bash
pnpm cli getResourceData --owner unfoldingWord --repo en_tn --ref v91 --book tit
# or
node src/cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v91 --book tit
```

## Commands

| Command | What it runs | Output |
|---|---|---|
| `findResources` | `findResources()` | a summary of each catalog entry a language publishes, as JSON |
| `getAllCatalogEntries` | `getAllCatalogEntries()` | CatalogSet JSON |
| `getResourceData` | `getResourceData()` | ResourceData JSON |
| `renderHtml` | `getResourceData()` → `renderHtmlData()` | HtmlData JSON (sections + identity) |
| `assemblePrint` | … → `renderHTML(htmlData, { media: 'print' })` | a complete print-ready HTML document |
| `generatePdf` | … → `renderPdf()` | a PDF file (`--output` required) |

## Options

`findResources` needs only `--lang` (`--subject` and `--owner` narrow the list).
Every other command names the resource either by repository (`--owner` and
`--repo`) or by language (`--lang` and `--subject`):

- `--owner <owner>` — repository owner; with `--lang`/`--subject`, the preferred publisher
- `--repo <repo>` — repository name
- `--lang <code>` — language code, e.g. `en`, `es-419`; with `--subject`, the publisher and release are found for you ([stage 0](./find-resources.md))
- `--subject <subject>` — catalog subject, e.g. `"TSV Translation Notes"`
- `--stage <stage>` — catalog stage for `--lang` lookups: `prod` (default), `preprod`, `latest`, `branch`
- `--ref <ref>` — git tag, branch, or commit. Omitted: the latest release (the default branch if there is none). With `--lang`, a given ref is the one each publisher's package is checked at

Other options:

- `--book <bookId>` — one book id (e.g. `gen`, `tit`, `1jn`). `findResources` ignores it; `getAllCatalogEntries` records it on the CatalogSet (and with `--lang` the package must carry it). The data commands (`getResourceData`, `renderHtml`, `assemblePrint`, `generatePdf`) pass it on as `books`; which resources use it, and what happens without it, is [the `books` rule](https://github.com/unfoldingWord/door43-preview-renderers/blob/main/skills/door43-renderers-maintainer/references/contracts.md#books-at-stage-2)
- `--dcs-api-url <url>` — DCS API base (default `https://git.door43.org/api/v1`)
- `--output <file>` — write to a file instead of stdout
- `--quiet`, `-q` — no progress logging; JSON only, so the output pipes cleanly into `jq`
- `--page-size <size>` — `assemblePrint` / `generatePdf`: a short key mapped to a `PAGE_SIZES` key — `A4` → `A4_PORTRAIT` (default), `A5` → `A5_PORTRAIT`, `USL` → `US_LETTER_PORTRAIT`, `TRADE` → `TRADE`, `CQ` → `CROWN_QUARTO`; anything else falls back to `A4_PORTRAIT`
- `--columns <n>` — `assemblePrint` / `generatePdf`: body column count (continuous-flow bodies only; see [options](./options.md))
- `--dir <path>` — the data commands read the files from repositories checked out under `<path>`, one folder per repository named as its catalog entry names it (`en_tn`, `en_ult`, …), instead of from DCS (`getResourceDataFromDirectory`)
- `--catalog <file>` — start from a CatalogSet saved with `getAllCatalogEntries --output` instead of asking DCS; `--book` overrides its books. With `--dir`, nothing is fetched
- `--include-questions` — Translation Notes: fetch the package's Translation Questions (or OBS Translation Questions) and show each verse's or frame's questions under its notes. The data commands pass `extraSubjects` to `getResourceData`
- `--pdf-service-url <url>` — `generatePdf`: POST the assembled HTML to a hosted WeasyPrint service instead of running the local binary. The service receives the complete document, text and all, so use only a host you trust

## Examples

```bash
# What a language publishes, and the Translation Notes for Titus found from it
door43-renderers findResources --lang es-419 --quiet
door43-renderers renderHtml --lang es-419 --subject "TSV Translation Notes" --book tit --quiet

# The latest release of a repository (no --ref)
door43-renderers getResourceData --owner unfoldingWord --repo en_tn --book tit --quiet

# The book package for Titus, as JSON
door43-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit --quiet | jq '.catalogEntries[] | {owner, repo: .name, subject}'

# Parsed Translation Notes data, saved to a file
door43-renderers getResourceData --owner unfoldingWord --repo en_tn --ref v91 --book tit --quiet --output tn_tit.json

# HTML sections (what the styleguide fixtures are made from)
door43-renderers renderHtml --owner unfoldingWord --repo en_ult --ref v91 --book tit --quiet --output ult_tit.htmlData.json

# A print-ready HTML document, Trade size
door43-renderers assemblePrint --owner unfoldingWord --repo en_obs --ref v9 --page-size TRADE --output obs.html

# A PDF, no browser (needs `weasyprint` on the PATH)
door43-renderers generatePdf --owner unfoldingWord --repo en_tn --ref v91 --book tit --output tit_tn.pdf

# Offline, from local checkouts: save the package once, then render from disk
door43-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v91 --book tit --quiet --output tn_tit.set.json
door43-renderers generatePdf --catalog tn_tit.set.json --dir ~/checkouts --output tit_tn.pdf

# Translation Notes with each verse's Translation Questions
door43-renderers generatePdf --owner unfoldingWord --repo en_tn --ref v91 --book tit --include-questions --output tit_tn_tq.pdf

# The same PDF via a hosted WeasyPrint service
door43-renderers generatePdf --owner unfoldingWord --repo en_tn --ref v91 --book tit \
  --pdf-service-url https://weasyprint-pdf.example.com --output tit_tn.pdf

# A non-English resource on a custom DCS host
door43-renderers getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --dcs-api-url https://qa.door43.org/api/v1
```

## Output format

### getAllCatalogEntries

```json
{
  "resourceVersion": "v91",
  "libraryVersion": "1.6.0",
  "catalogEntries": [ { "name": "en_tn", "owner": "unfoldingWord", "subject": "TSV Translation Notes", "...": "..." } ],
  "source": { "owner": "unfoldingWord", "repo": "en_tn", "ref": "v91", "books": ["tit"], "dcsApiUrl": "https://git.door43.org/api/v1" }
}
```

The main entry is first, followed by every related resource in the book package.
With `--lang`/`--subject`, `source` also carries `lang` and `subject`, and
`owner`/`repo`/`ref` are the publisher and release that were found.

### findResources

One summary per published entry, in the order the catalog search returns them:

```json
[
  { "owner": "es-419_gl", "repo": "es-419_tn", "ref": "v66", "subject": "TSV Translation Notes",
    "title": "…", "released": "2024-07-17T20:13:08Z", "language_is_gl": true, "language_direction": "ltr" }
]
```

The library's `findResources()` returns the full catalog entries instead.

### getResourceData / renderHtml

The ResourceData and HtmlData shapes are described in
[Get Resource Data](./get-resource-data.md) and [Render HTML Data](./renderers.md).

### assemblePrint / generatePdf

A complete HTML document (stdout or `--output`), or a PDF written to `--output`.
