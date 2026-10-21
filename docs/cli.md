# CLI Tool

The package ships a command line, `door43-renderers`, that runs the same staged
pipeline as the library: fetch the catalog, fetch and parse a resource, render it
to HTML sections, compose a print document, or produce a PDF.

## Installation

```bash
npm install -g @unfoldingword/door43-preview-renderers
door43-renderers --help
```

From a checkout, the CLI imports the built library, so run `pnpm build` once, then:

```bash
pnpm cli getResourceData --owner unfoldingWord --repo en_tn --ref v91 --book tit
# or
node src/cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v91 --book tit
```

## Commands

| Command | What it runs | Output |
|---|---|---|
| `getAllCatalogEntries` | `getAllCatalogEntries()` | CatalogSet JSON |
| `getResourceData` | `getResourceData()` | ResourceData JSON |
| `renderHtml` | `getResourceData()` → `renderHtmlData()` | HtmlData JSON (sections + identity) |
| `assemblePrint` | … → `renderHTML(htmlData, { media: 'print' })` | a complete print-ready HTML document |
| `generatePdf` | … → `renderPdf()` | a PDF file (`--output` required) |

## Options

- `--owner <owner>` — repository owner (required)
- `--repo <repo>` — repository name (required)
- `--ref <ref>` — git tag, branch, or commit (required by every command; there is no default)
- `--book <bookId>` — one book id (e.g. `gen`, `tit`, `1jn`); omit for whole-resource output (OBS, TA, TW)
- `--dcs-api-url <url>` — DCS API base (default `https://git.door43.org/api/v1`)
- `--output <file>` — write to a file instead of stdout
- `--quiet`, `-q` — no progress logging; JSON only, so the output pipes cleanly into `jq`
- `--page-size <size>` — `assemblePrint` / `generatePdf`: a short key mapped to a `PAGE_SIZES` key — `A4` → `A4_PORTRAIT` (default), `A5` → `A5_PORTRAIT`, `USL` → `US_LETTER_PORTRAIT`, `TRADE` → `TRADE`, `CQ` → `CROWN_QUARTO`; anything else falls back to `A4_PORTRAIT`
- `--columns <n>` — `assemblePrint` / `generatePdf`: body column count (continuous-flow bodies only; see [options](./options.md))
- `--pdf-service-url <url>` — `generatePdf`: POST the assembled HTML to a hosted WeasyPrint service instead of running the local binary. The service receives the complete document, text and all, so use only a host you trust

## Examples

```bash
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
  "libraryVersion": "1.5.6",
  "catalogEntries": [ { "name": "en_tn", "owner": "unfoldingWord", "subject": "TSV Translation Notes", "...": "..." } ],
  "source": { "owner": "unfoldingWord", "repo": "en_tn", "ref": "v91", "books": ["tit"], "dcsApiUrl": "https://git.door43.org/api/v1" }
}
```

The main entry is first, followed by every related resource in the book package.

### getResourceData / renderHtml

The ResourceData and HtmlData shapes are described in
[Get Resource Data](./get-resource-data.md) and [Render HTML Data](./renderers.md).

### assemblePrint / generatePdf

A complete HTML document (stdout or `--output`), or a PDF written to `--output`.
