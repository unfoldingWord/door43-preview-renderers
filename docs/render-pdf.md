# Render PDF

`renderPdf()` turns the result of `renderHtmlData()` into a print-ready PDF using
[WeasyPrint](https://weasyprint.org/) — a native CSS Paged Media engine (no
browser, no PagedJS reflow). It assembles the cover, copyright, table of contents
and `@page` rules, then renders the paged document.

```js static
import { getResourceData, renderHtmlData, renderPdf } from 'door43-preview-renderers';

const resourceData = await getResourceData('unfoldingWord', 'en_tn', 'v89', ['tit'], {
  dcs_api_url: 'https://git.door43.org/api/v1',
});
const htmlData = renderHtmlData(resourceData);

// PDF bytes (Buffer); pass `outputPath` to write to disk instead.
const pdf = await renderPdf(htmlData, { pageSize: 'A4_PORTRAIT' });
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
