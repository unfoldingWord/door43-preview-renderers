# Render HTML

`renderHTML(htmlData, options)` is **stage 4** — it composes the reusable sections
from `renderHtmlData()` into one self-contained HTML document. Pure and synchronous
(no network, no Proskomma), so it runs instantly in the browser, Node, or a CLI.

- `media: 'screen'` → a continuous web page (omits cover/copyright/toc by default).
- `media: 'print'` → a paged, PagedJS/WeasyPrint-ready document (cover/copyright/toc
  on by default), honoring `print.pageSize`, page-number position, and the running header.
- `show` toggles which sections appear; `columns`/`direction` control layout.

The demo below composes either a **cached `HtmlData` fixture** or a resource fetched
**live from DCS** (any owner/repo/ref/book) — the same source picker as the
[Render PDF](./render-pdf.md) demo. Only fetching the resource data touches the
network; changing the media and `show` toggles recomposes with zero latency. See
[Rendering Options](./options.md) for the full option reference.
