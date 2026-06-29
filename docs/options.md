# Rendering Options Reference

This is the practical, user-facing guide to every option you can pass through the
rendering pipeline. For the architecture/design rationale, see
[`rendering-pipeline.md`](./rendering-pipeline.md).

## The pipeline at a glance

Rendering happens in stages. You can run the whole thing or start from any
intermediate you already have cached:

```js
import { getResourceData, renderHtmlData, renderHTML, renderPdf } from 'door43-preview-renderers';

// 1. Fetch + parse the resource (network)
const resourceData = await getResourceData('unfoldingWord', 'en_ult', 'v89', ['tit'], {
  dcs_api_url: 'https://git.door43.org/api/v1',
});

// 2. Render to reusable HTML sections (pure, no network — pass cached data here to skip step 1)
const htmlData = renderHtmlData(resourceData, { renderOptions: { editorMode: false } });

// 3a. Compose a web page                          3b. …or a print-ready document
const webHtml   = renderHTML(htmlData);            const printHtml = renderHTML(htmlData, { media: 'print' });

// 4. …or go straight to a PDF
const pdf = await renderPdf(htmlData, { pageSize: 'A4_PORTRAIT', outputPath: 'titus.pdf' });
```

Each option below is marked:

- ✅ **Active** — implemented and honored today.
- 🚧 **Planned** — accepted/parsed but **not yet honored** (Phase 1b; see the design doc). Safe to pass; currently a no-op.

---

## `getResourceData(owner, repo, ref, books?, options?)`

Fetches and parses a resource (and its dependencies) from DCS into a
`resourceData` object.

| Argument / option | Type | Default | Status | Description |
|---|---|---|---|---|
| `owner` | string | — | ✅ | Repository owner (e.g. `unfoldingWord`). |
| `repo` | string | — | ✅ | Repository name (e.g. `en_tn`). |
| `ref` | string | — | ✅ | Git ref: tag, branch, or commit (e.g. `v89`, `master`). |
| `books` | string[] | `[]` | ✅ | Book ids to fetch (e.g. `['tit','rom']`). Empty = all books. |
| `options.dcs_api_url` | string | `https://git.door43.org/api/v1` | ✅ | DCS API base URL. |
| `options.quiet` | boolean | `false` | ✅ | Suppress progress logging. |

> The local/CLI sibling `getResourceDataFromDirectory(catalogEntries, dirPath, options)`
> (reads checked-out repos from disk instead of DCS, same output shape) is 🚧 planned.

---

## `renderHtmlData(resourceData, options?)`

Pure, synchronous. Turns parsed `resourceData` into reusable HTML **sections**.
No network — feed it the output of `getResourceData()` or any cached/hand-built
resource data.

| Option | Type | Default | Status | Description |
|---|---|---|---|---|
| `renderOptions` | object | `{}` | ✅ | Subject-specific knobs passed to the renderer (see below). |
| `books` | string[] **or** `{ id: range }` | `[]` | partial | Book ordering/selection. The **array form** and the **ids** of the object form are ✅ honored for ordering; per-book **reference ranges** (the object values) are 🚧 planned. |

**`books` object form** (ranges) — accepted now, range-filtering 🚧 planned:

```js
renderHtmlData(resourceData, {
  books: { '1ki': '10:1-13', '2ch': '9:1-12' }, // a story spanning two books
});
// range grammar: '10' | '10-12' | '10:1-13' | '10:1-12:5' | '*' (whole book)
```

**`renderOptions` by subject** (✅ Active):

| Subject | Key | Type | Description |
|---|---|---|---|
| Aligned Bible / Bible / Greek NT / Hebrew OT | `editorMode` | boolean | Keep implied-word brackets visible. |
| | `includeRawUsfmView` | boolean | Also produce a raw-USFM-as-HTML view in `sections.webView`. |
| | `showChaptersInToc` | boolean | Force chapter entries in the TOC (auto when < 3 books). |

**Returns** `HtmlData`:

```js
{
  subject, title, abbreviation, version, direction,
  sections: { cover, copyright, body, toc, css: { web, print? }, webView? },
}
```

---

## `renderHTML(htmlData, options?)`

Pure, synchronous. Composes the sections into **one self-contained HTML document**
for the screen or for print. Returns a string.

| Option | Type | Default | Status | Description |
|---|---|---|---|---|
| `media` | `'screen'` \| `'print'` | `'screen'` | ✅ | Layout target. `screen` = continuous web page; `print` = paged, PagedJS/WeasyPrint-ready. |
| `show.cover` | boolean | screen `false` / print `true` | screen ✅ / print 🚧 | Include the cover page. |
| `show.copyright` | boolean | screen `false` / print `true` | screen ✅ / print 🚧 | Include the license/copyright page. |
| `show.toc` | boolean | screen `false` / print `true` | screen ✅ / print 🚧 | Include a static Table of Contents page. (The TOC *data* is always on `htmlData.sections.toc` for an app's interactive selector.) |
| `show.body` | boolean | `true` | ✅ | Include the main content. |
| `show.appendices` | boolean \| `['ta','tw']` | `true` | screen ✅ / print 🚧 | Include the TA/TW appendices (now a keyed `{ ta, tw }` section). Screen honors the boolean; print always includes them, and per-kind `['ta','tw']` selection is 🚧 planned. |
| `columns` | number | `1` | print ✅ / screen 🚧 | Body column count (currently applied to print only). |
| `direction` | `'ltr'` \| `'rtl'` | from `htmlData.direction` | ✅ | Text direction. |
| `engine` | `'weasyprint'` \| `'pagedjs'` | `'weasyprint'` | ✅ | Print engine. `pagedjs` injects the PagedJS polyfill `<script>` for in-browser preview. |
| `print.pageSize` | string \| `{width,height}` | `'A4_PORTRAIT'` | ✅ | Page size (see [Page sizes](#page-sizes)). `media:'print'` only. |
| `print.footerHtml` | string | `''` | ✅ | Extra footer HTML on the copyright page (e.g. app version). |
| `print.margins` | `{top,right,bottom,left}` | theme default | 🚧 | Page margins. |
| `print.runningHeader` | boolean | `true` | 🚧 | Show the running header (book/chapter, from the renderer). |
| `print.pageNumber.position` | `'top'` \| `'bottom'` | `'bottom'` | 🚧 | Where the page number prints. |
| `print.pageNumber.show` | per-section booleans | toc/body/appendices `true` | 🚧 | Which sections get a page number. |

> **About running headers:** the header text (`{book} {chapter}:{verse}`) comes
> from the renderer and only appears in print/PDF (and the PagedJS preview) — never
> in the continuous web view. It's CSS Paged Media, not a configurable template.

---

## `renderPdf(input, options?)`

Assembles the print document and runs WeasyPrint. `input` is the `htmlData` from
`renderHtmlData()` (it assembles the print view internally). Requires the
`weasyprint` binary on `PATH` (or pass `weasyprintPath`).

> Note: `renderPdf` currently takes **flat** options (`pageSize`, `columns`, …),
> whereas `renderHTML` nests print options under `print.*`. These will be
> reconciled in a later phase; for now use the names in this table.

| Option | Type | Default | Status | Description |
|---|---|---|---|---|
| `pageSize` | string \| `{width,height}` | `'A4_PORTRAIT'` | ✅ | Page size (see below). |
| `columns` | number | renderer default | ✅ | Body column count. |
| `direction` | `'ltr'` \| `'rtl'` | renderer default | ✅ | Text direction. |
| `footerHtml` | string | — | ✅ | Footer HTML (e.g. app version). |
| `title` | string | `htmlData.title` | ✅ | Cover title override. |
| `version` | string | `htmlData.version` | ✅ | Cover version override. |
| `abbreviation` | string | `htmlData.abbreviation` | ✅ | Cover abbreviation (selects the logo). |
| `outputPath` | string | — | ✅ | Write the PDF here instead of returning bytes. |
| `weasyprintPath` | string | `weasyprint` | ✅ | Path/name of the WeasyPrint binary. |
| `baseUrl` | string | — | ✅ | Base URL for resolving relative resources. |
| `timeoutMs` | number | — | ✅ | Kill WeasyPrint after this many ms. |
| `quiet` | boolean | `false` | ✅ | Suppress WeasyPrint stderr in error messages. |

Returns a `Buffer` of PDF bytes, or the `outputPath` string when `outputPath` is set.

### Page sizes

Pass a **key**, a friendly **label** (portrait assumed), or an explicit
`{ width, height }` object.

| Key | Label | Size |
|---|---|---|
| `A4_PORTRAIT` / `A4_LANDSCAPE` | `A4` | 210×297mm |
| `A5_PORTRAIT` | `A5` | 148.5×210mm |
| `US_LETTER_PORTRAIT` / `US_LETTER_LANDSCAPE` | `US Letter` | 8.5×11in |
| `TRADE` | `Trade` | 6×9in |
| `CROWN_QUARTO` | `Crown Quarto` | 189×246mm |

```js
renderPdf(htmlData, { pageSize: 'TRADE' });
renderPdf(htmlData, { pageSize: { width: '160mm', height: '240mm' } });
```

---

## Anchors (deep-linking)

Every rendered element gets a unique, hierarchical `id` prefixed with the
resource abbreviation, so an app can put `#anchor` in the URL and scroll to it.
The prefix is the resource's `abbreviation` (e.g. `tn`, `tw`, `ta`, `ult`, `obs`):

| Level | Pattern | Example |
|---|---|---|
| Resource | `<res>` | `tn` |
| Book | `<res>-<book>` | `tn-rut` |
| Chapter | `<res>-<book>-<chap\|front>` | `tn-rut-4`, `tn-rut-front` |
| Verse | `<res>-<book>-<chap\|front>-<verse\|intro>` | `tn-rut-4-1`, `tn-rut-front-intro` |
| Note (TN) | `<res>-<book>-<chap>-<verse>-<noteId>` | `tn-rut-4-1-e2fa` |

Internal cross-references (`href="#…"`) and the Table of Contents use the same
anchors, so links resolve within the document. ✅ Active (the resource-level
`<res>` anchor currently appears in the **screen** wrapper; adding it to the
print wrapper is planned).

## Common recipes

**Web preview (body only):**
```js
const html = renderHTML(htmlData); // screen, no cover/copyright/toc
```

**Full web page (with cover + license):**
```js
const html = renderHTML(htmlData, { show: { cover: true, copyright: true } });
```

**In-browser PagedJS print preview:**
```js
const html = renderHTML(htmlData, { media: 'print', engine: 'pagedjs', print: { pageSize: 'US Letter' } });
```

**PDF to a file, two columns, Trade size:**
```js
await renderPdf(htmlData, { pageSize: 'TRADE', columns: 2, outputPath: 'titus.pdf' });
```

**Resume from cached data (no network):**
```js
const htmlData = renderHtmlData(JSON.parse(fs.readFileSync('resourceData.json')));
const pdf = await renderPdf(htmlData, { outputPath: 'out.pdf' });
```
