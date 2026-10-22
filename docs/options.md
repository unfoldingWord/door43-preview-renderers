# Rendering Options Reference

This is the practical, user-facing guide to every option you can pass through the
rendering pipeline. For the architecture/design rationale, see
[`rendering-pipeline.md`](./rendering-pipeline.md).

## The pipeline at a glance

Rendering happens in stages. You can run the whole thing or start from any
intermediate you already have cached:

```js
import { getResourceData, renderHtmlData, renderHTML, renderPdf } from '@unfoldingword/door43-preview-renderers';

// 1. Fetch + parse the resource (network)
const resourceData = await getResourceData(
  { owner: 'unfoldingWord', repo: 'en_ult', ref: 'v91', books: ['tit'] },
  { dcs_api_url: 'https://git.door43.org/api/v1' }
);

// 2. Render to reusable HTML sections (pure, no network — pass cached data here to skip step 1)
const htmlData = renderHtmlData(resourceData, { renderOptions: { editorMode: false } });

// 3a. Compose a web page                          3b. …or a print-ready document
const webHtml   = renderHTML(htmlData);            const printHtml = renderHTML(htmlData, { media: 'print' });

// 4. …or go straight to a PDF
const pdf = await renderPdf(htmlData, { pageSize: 'A4_PORTRAIT', outputPath: 'titus.pdf' });
```

Know a language rather than a repository? Call
`getAllCatalogEntries({ lang, subject, books })` first and pass the CatalogSet to
`getResourceData()`; `getResourceData()` itself needs `{ owner, repo, ref }`, a
CatalogSet, or a catalog entry. See [Find Resources](./find-resources.md).

Each option below is marked:

- ✅ **Active** — implemented and honored today.
- 🚧 **Planned** — accepted/parsed but **not yet honored** (Phase 1b; see the design doc). Safe to pass; currently a no-op.

---

## `getResourceData(input, options?)`

Fetches and parses a resource (and its dependencies) from DCS into a
`resourceData` object. `input` is a descriptor `{ owner, repo, ref, books? }`, a
CatalogSet from `getAllCatalogEntries()` (reused, no second blueprint call), a
catalog entry object, or an existing `resourceData` (returned unchanged).

| Argument / option | Type | Default | Status | Description |
|---|---|---|---|---|
| `input.owner` | string | — | ✅ | Repository owner (e.g. `unfoldingWord`). |
| `input.repo` | string | — | ✅ | Repository name (e.g. `en_tn`). |
| `input.ref` | string | — | ✅ | Tag, branch, or commit (e.g. `v91`, `master`). |
| `input.books` | string[] | `[]` | ✅ | Book ids to fetch (e.g. `['tit','rom']`). Empty = every book for the USFM subjects; the Bible-book TSV subjects need at least one; OBS and the OBS TSV subjects, TA and TW ignore it. |
| `options.dcs_api_url` | string | `https://git.door43.org/api/v1` | ✅ | DCS API base URL. |
| `options.quiet` | boolean | `false` | ✅ | Suppress progress logging. |
| `options.books` | string[] | `[]` | ✅ | Books, when `input` does not carry them (catalog-entry form). |

> The local/CLI sibling `getResourceDataFromDirectory(catalogEntries, dirPath, options)`
> (reads checked-out repos from disk instead of DCS, same output shape) is 🚧 planned.

---

### Catalog selection helpers

The rules `getResourceData()` applies to a book package before fetching extras are exported as pure functions, so a caller can compute the same set from a `CatalogSet` (door43-preview-app derives its cache identity from it):

| Function | Description |
|---|---|
| `filterCatalogEntries(catalogEntries, { subject?, books? })` | Keeps the main entry (`[0]`) plus the entries whose subject `requiredSubjectsMap[subject]` lists, at most two Aligned Bibles (via `selectAlignedBibles`), and — when `books` is given — only the original-language Bible of a testament the books belong to. Returns `[main, ...alignedBibles, ...others]`: the Aligned Bible pair in preference order (literal first, then simplified), the remaining entries in blueprint order. |
| `selectAlignedBibles(entries)` | At most two Aligned Bibles, literal (`ult`/`glt`) first and simplified (`ust`/`gst`) second when present, else the first two in blueprint order. Non-object entries are ignored. |
| `testamentOf(bookId)` | `'old'`, `'new'`, or `undefined`. |

## `renderHtmlData(resourceData, options?)`

Pure, synchronous. Turns parsed `resourceData` into reusable HTML **sections**.
No network — feed it the output of `getResourceData()` or any cached/hand-built
resource data.

| Option | Type | Default | Status | Description |
|---|---|---|---|---|
| `renderOptions` | object | `{}` | ✅ | Subject-specific knobs passed to the renderer (see below). |
| `books` | string[] **or** `{ id: range }` | `[]` | ✅ | **USFM subjects** (Aligned Bible, Bible, Greek NT, Hebrew OT): the ids — array entries, or the object's keys — select and order the books rendered; a book in the data but not listed is **omitted**. `resourceData.requestedBooks`, when a caller sets it, takes precedence over this option. **TSV, OBS and manual subjects**: every book in the data is rendered, in catalog `sort` order, whatever is listed. Object form values add a per-book **reference range** (TSV and USFM); `'*'` or `true` keeps that book whole. |

**`books` object form** (ranges) — ✅ active for TSV and USFM resources. For TSV the listed books are narrowed and the rest render whole; for USFM the keys are also the selection, so list every book you want (`'*'` for a whole one):

```js
renderHtmlData(resourceData, {
  books: { '1ki': '10:1-13', '2ch': '9:1-12' }, // a story spanning two books
});
// range grammar: '10' | '10-12' | '10:1-13' | '10:1-12:5' | '10:5' | '*' (whole book)
```

**`renderOptions` by subject** (✅ Active):

| Subject | Key | Type | Description |
|---|---|---|---|
| Aligned Bible / Bible / Greek NT / Hebrew OT | `editorMode` | boolean | Keep implied-word brackets visible. |
| TSV Translation Notes, TSV Questions/Study Notes, TSV Translation Words Links (scripture columns) | `editorMode` | boolean | Keep the `{…}` supplied-word braces in the ULT \| UST scripture columns. Default off: the braces are dropped, as the Aligned Bible renderer hides them. |
| | `includeRawUsfmView` | boolean | Also produce a raw-USFM-as-HTML view in `sections.webView`. |
| OBS-based TSV subjects (`obs-tn`, `obs-tq`, `obs-sn`, `obs-sq`) | `resolution` | `'none'` \| `'360px'` \| `'2160px'` | Whether to include the story-frame **pictures**, and at what size. Default `'none'`. The frame **text** is always rendered — the notes and questions are about it — so only the pictures are optional. Set it when producing `HtmlData`; both the HTML and the PDF built from that package then include them. Note the pictures are remote CDN URLs, so rendering with them on needs network access. |
| TSV Translation Words Links | `layout` | `'verse'` \| `'glossary'` | `'verse'` (default) reads the book in order: each verse with its scripture columns and the table of words in it, the cited Translation Words articles collected as the `tw` appendix with back-references. `'glossary'` is the book's vocabulary: one entry per article cited, grouped Key Terms / Names / Other and sorted by title, with the article body inline and the verses (with the literal Bible's quote) where it occurs; no appendix. |
| | `includeScripture` | boolean | Verse layout: show the verse as parallel scripture columns (ULT \| UST) above its word table. Default `true`. |
| | `includeArticles` | boolean | Include the Translation Words article bodies — as the `tw` appendix (verse layout) or inline (glossary). `false` gives a plain word list / concordance. Default `true`. |
| | `dedupe` | `'none'` \| `'chapter'` \| `'book'` | Verse layout: list a word only the first time it occurs in the chapter / in the book. A verse whose every word was already listed is omitted. Default `'none'`. |
| All book-scoped subjects (Aligned Bible, TSV Translation Notes, TSV Questions/Study Notes, TSV Translation Words Links) | `showChaptersInToc` | boolean | Force chapter entries in the TOC on or off. **Default: on for a single-book document, off once it covers more than one book** — the TOC then lists book names only, each linking to the start of that book. Chapter `id` anchors are always emitted either way, so deep links keep working; only the `data-toc-title` marker is withheld. |

**Returns** `HtmlData`:

```js
{
  subject, title, abbreviation, version, language, direction,
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
| `show.cover` | boolean | screen `false` / print `true` | ✅ | Include the cover page. |
| `show.copyright` | boolean | screen `false` / print `true` | ✅ | Include the license/copyright page. |
| `show.toc` | boolean | screen `false` / print `true` | ✅ | Include a static Table of Contents page. (The TOC *data* is always on `htmlData.sections.toc` for an app's interactive selector.) |
| `show.body` | boolean | `true` | ✅ | Include the main content. |
| `show.appendices` | boolean \| `['ta','tw']` | `true` | ✅ (boolean) | Include the TA/TW appendices (a keyed `{ ta, tw }` section). The boolean is honored in screen and print; per-kind `['ta','tw']` selection is 🚧 planned. |
| `columns` | number | `1` | print ✅ / screen 🚧 | Body column count. Print only, and only for **continuous-flow bodies**: an Aligned Bible book, or the story frames of an OBS-based TSV resource (`obs-tn`, `obs-tq`, …) — the rule targets `.section.bible-book` and `.obs-frames-body`. Bible-versed Notes and Questions are laid out per verse or per chapter, not as running text, so it does nothing there. Use `supportsBodyColumns(subject)` to test whether it applies. |
| `language` | string | from `htmlData.language`, else `'en'` | ✅ | Language code written as `<html lang>`. |
| `direction` | `'ltr'` \| `'rtl'` | from `htmlData.direction` | ✅ | Text direction, written as `<html dir>` (anything but `'rtl'` is `'ltr'`). In print, `rtl` also starts the book on a left-hand page (WeasyPrint takes the page progression from the root element) and mirrors the running headers: the title on the right-hand page, a range's first reference in the right corner. A quote running the other way from the resource is isolated in `<bdi dir>` when the sections are rendered. |
| `engine` | `'weasyprint'` \| `'pagedjs'` | `'weasyprint'` | ✅ | Print engine. `pagedjs` injects the PagedJS polyfill `<script>` for in-browser preview. |
| `print.pageSize` | string \| `{width,height}` | `'A4_PORTRAIT'` | ✅ | Page size (see [Page sizes](#page-sizes)). `media:'print'` only. |
| `print.footerHtml` | string | `''` | ✅ | Extra footer HTML on the copyright page (e.g. app version). |
| `print.margins` | `{top,right,bottom,left}` | theme default | 🚧 | Page margins. |
| `print.runningHeader` | boolean | `true` | ✅ | Running header in the page margin. `false` turns it off; otherwise the layout is chosen by subject — scripture shows the **first and last reference on each page** ("Ruth 1:1 … Ruth 1:18") and no resource name, Open Bible Stories shows **none**, and everything else pairs the **resource or manual name on the verso** with the **reference or article title on the recto**. Renderers mark the tracked points with hidden `.running-title` / `.running-ref` spans. **WeasyPrint only** — PagedJS resolves `string()` to empty, so the browser preview shows no running header. |
| `print.pageNumber.position` | `'top'` \| `'bottom'` | `'bottom'` | ✅ | Where the page number prints (the counter moves to `@top-center`/`@bottom-center`). |
| `print.pageNumber.show` | per-section booleans | toc/body/appendices `true` | 🚧 | Which sections get a page number (needs named pages per section). |

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
| `direction` | `'ltr'` \| `'rtl'` | from `htmlData.direction` | ✅ | Text direction (see `renderHTML`). |
| `language` | string | from `htmlData.language`, else `'en'` | ✅ | Language code for `<html lang>`. |
| `footerHtml` | string | — | ✅ | Footer HTML (e.g. app version). |
| `title` | string | `htmlData.title` | ✅ | Cover title override. |
| `version` | string | `htmlData.version` | ✅ | Cover version override. |
| `abbreviation` | string | `htmlData.abbreviation` | ✅ | Cover abbreviation (selects the logo). |
| `outputPath` | string | — | ✅ | Write the PDF here instead of returning bytes. |
| `pdfServiceUrl` | string | — | ✅ | POST the assembled HTML to a hosted WeasyPrint HTTP service (e.g. [door43-preview-app/weasyprint-service](https://github.com/unfoldingWord/door43-preview-app/tree/develop/weasyprint-service)) instead of using the local binary — for hosts/browsers without `weasyprint`. |
| `weasyprintPath` | string | `weasyprint` | ✅ | Path/name of the WeasyPrint binary (local mode). |
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
