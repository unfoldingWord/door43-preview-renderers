# Render HTML

`renderHTML(htmlData, options)` is **stage 4** — it composes the reusable sections
from `renderHtmlData()` into one self-contained HTML document. Pure and synchronous
(no network, no Proskomma), so it runs instantly in the browser, Node, or a CLI.

- `media: 'screen'` → a continuous web page (omits cover/copyright/toc by default).
- `media: 'print'` → a paged, PagedJS/WeasyPrint-ready document (cover/copyright/toc
  on by default), honoring `print.pageSize`, page-number position, and the running header.
- `show` toggles which sections appear; `columns`/`direction` control layout.

The demo below composes a **cached `HtmlData` fixture** — change the media and `show`
toggles and watch it recompose with zero latency. See
[Rendering Options](./options.md) for the full option reference.
