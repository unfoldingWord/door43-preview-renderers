# Render PDF

There are **two ways** to turn an `HtmlData` into a PDF — the demo below runs both
side by side so you can compare:

- **WeasyPrint** (`renderPdf()`) — a native CSS Paged Media engine (Python binary,
  **no browser**). This is the headless library/CLI path: fast, high fidelity, runs
  in Node. It needs the `weasyprint` binary installed, so in the styleguide it only
  works on **localhost** (via the dev server). It cannot run on a static deploy.
- **PagedJS** (`renderHTML(htmlData, { media: 'print', engine: 'pagedjs' })`) — a
  client-side paginator that runs **in the browser**, so it works **anywhere**
  (including the static Netlify deploy). Produce a PDF with the browser's
  *Save as PDF*. Slower than WeasyPrint and needs the print dialog, but zero server.

## `renderPdf()` (WeasyPrint, Node/CLI)

```js static
import { getResourceData, renderHtmlData, renderPdf } from 'door43-preview-renderers';

const resourceData = await getResourceData(
  { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v89', books: ['tit'] }
);
const htmlData = renderHtmlData(resourceData);

// PDF bytes (Buffer); pass `outputPath` to write to disk instead.
const pdf = await renderPdf(htmlData, { pageSize: 'A4_PORTRAIT' });
```

Or straight from the command line (headless, no browser, no server):

```
node src/cli.js generatePdf --owner unfoldingWord --repo en_tn --ref v89 --book tit --output tit.pdf
```

## Options

`renderPdf(htmlData, options)` — `options` are PDF-rendering specific (see the full
[Rendering options](./options.md) reference):

- `pageSize` — a `PAGE_SIZES` key (`'A4_PORTRAIT'`, `'US_LETTER_PORTRAIT'`,
  `'TRADE'`, …), a friendly label (`'A4'`, `'US Letter'`), or an explicit
  `{ width, height }` object using CSS lengths (e.g. `{ width: '6in', height: '9in' }`).
- `columns`, `direction` (`'ltr'`/`'rtl'`), `footerHtml`
- `title`, `version`, `abbreviation` — cover overrides (default to the render result)
- `outputPath` — write the PDF here and resolve with the path instead of returning bytes
- `weasyprintPath`, `baseUrl`, `timeoutMs`, `quiet` — forwarded to WeasyPrint

## Requirements

WeasyPrint is a **server-side** (Python) tool, so `renderPdf()` runs in Node, not
the browser. Install the binary:

```bash static
pipx install weasyprint   # or:  brew install weasyprint
```

## Demo

The demo below renders the HTML in your browser, then POSTs the rendered sections
to a small styleguide dev-server endpoint (`/api/render-pdf`, wired via
`configureServer` in `styleguide.config.cjs`) that runs `renderPdf()` and streams
the PDF back to embed. It therefore requires `weasyprint` on the PATH of the
machine running the styleguide.
