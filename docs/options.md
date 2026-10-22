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
| `input.books` | string[] | `[]` | ✅ | Book ids to fetch (e.g. `['tit','rom']`). What an empty list means, and which subjects ignore it: [the `books` rule](https://github.com/unfoldingWord/door43-preview-renderers/blob/main/skills/door43-renderers-maintainer/references/contracts.md#books-at-stage-2). |
| `options.dcs_api_url` | string | `https://git.door43.org/api/v1` | ✅ | DCS API base URL. |
| `options.quiet` | boolean | `false` | ✅ | Suppress progress logging (the URLs fetched). Warnings (a book or supporting resource that could not be read, GL quotes that could not be worked out) are still reported. |
| `options.logger` | `{ info, warn }` | the console | ✅ | Where progress (`info`) and warnings (`warn`) go, per call. Also taken by `getAllCatalogEntries` and the stage-0 functions. The CLI passes one that writes to stderr. |
| `options.books` | string[] | `[]` | ✅ | Books, when `input` does not carry them (catalog-entry form). |
| `options.extraSubjects` | string[] | `[]` | ✅ | Blueprint subjects to fetch as extras beyond the ones the subject requires. `['TSV Translation Questions']` on Translation Notes (`['TSV OBS Translation Questions']` on OBS Translation Notes) fetches the package's questions, which the notes then show under each verse or frame (`includeQuestions`). A subject the blueprint lacks is ignored. |

### `getResourceDataFromDirectory(catalogEntries, dirPath, options?)`

The same ResourceData, read from repositories checked out on disk instead of DCS
(Node only). Takes `getResourceData`'s options.

| Argument | Type | Status | Description |
|---|---|---|---|
| `catalogEntries` | object[] \| CatalogSet | ✅ | Full catalog entries, main resource first (or a CatalogSet from `getAllCatalogEntries()`, whose `source.books` it uses). They name each repository and its ingredient paths; no manifest is read. |
| `dirPath` | string | ✅ | A folder holding one folder per repository, named as its entry names it (`en_tn`, `en_ult`, `el-x-koine_ugnt`, …), checked out at the entry's version. A supporting resource that is not there is skipped, as an unreachable one is online. |

---

### Catalog selection helpers

The rules `getResourceData()` applies to a book package before fetching extras are exported as pure functions, so a caller can compute the same set from a `CatalogSet` (door43-preview-app derives its cache identity from it):

| Function | Description |
|---|---|
| `filterCatalogEntries(catalogEntries, { subject?, books?, extraSubjects? })` | Keeps the main entry (`[0]`) plus the entries whose subject `requiredSubjectsMap[subject]` or `extraSubjects` lists, at most two Aligned Bibles (via `selectAlignedBibles`), and — when `books` is given — only the original-language Bible of a testament the books belong to. Returns `[main, ...alignedBibles, ...others]`: the Aligned Bible pair in preference order (literal first, then simplified), the remaining entries in blueprint order. |
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
| TSV Translation Notes, TSV OBS Translation Notes | `includeQuestions` | boolean | Show each verse's (or frame's) Translation Questions after its notes and words, answers behind a toggle on screen and printed in full. Needs the questions in the data: `getResourceData(…, { extraSubjects: ['TSV Translation Questions'] })`, or the OBS subject. **Default: on when the data carries them**, so `false` is only needed to leave fetched questions out. A question on a verse range goes after the verse that ends it, labelled with its range; a question on a verse without notes gets a verse block of its own; a chapter-level one goes after the chapter's last verse. |
| OBS-based TSV subjects (`obs-tn`, `obs-tq`, `obs-sn`, `obs-sq`) | `resolution` | `'none'` \| `'360px'` \| `'2160px'` | Whether to include the story-frame **pictures**, and at what size. Default `'none'`. The frame **text** is always rendered — the notes and questions are about it — so only the pictures are optional. Set it when producing `HtmlData`; both the HTML and the PDF built from that package then include them. Note the pictures are remote CDN URLs, so rendering with them on needs network access. |
| TSV Translation Words Links, TSV OBS Translation Words Links | `layout` | `'verse'` \| `'glossary'` | `'verse'` (default) reads the book in order: each verse with its scripture columns and the table of words in it, the cited Translation Words articles collected as the `tw` appendix with back-references. `'glossary'` is the book's vocabulary: one entry per article cited, grouped Key Terms / Names / Other and sorted by title, with the article body inline and the verses (with the literal Bible's quote) where it occurs; no appendix. |
| | `includeScripture` | boolean | Verse layout: show the verse as parallel scripture columns (ULT \| UST) above its word table. Default `true`. |
| | `includeArticles` | boolean | Include the Translation Words article bodies — as the `tw` appendix (verse layout) or inline (glossary). `false` gives a plain word list / concordance. Default `true`. |
| | `dedupe` | `'none'` \| `'chapter'` \| `'book'` | Verse layout: list a word only the first time it occurs in the chapter / in the book. A verse whose every word was already listed is omitted. Default `'none'`. |
| All book-scoped subjects (Aligned Bible, TSV Translation Notes, TSV Questions/Study Notes, TSV Translation Words Links) | `showChaptersInToc` | boolean | Force chapter entries in the TOC on or off. **Default: on for a single-book document, off once it covers more than one book** — the TOC then lists book names only, each linking to the start of that book. Chapter `id` anchors are always emitted either way, so deep links keep working; only the `data-toc-title` marker is withheld. The Translation Words Links glossary has no chapters: it lists each book's categories either way. |

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
| `show.appendices` | boolean \| `['ta','tw']` | `true` | ✅ | Include the TA/TW appendices (a keyed `{ ta, tw }` section): all of them (`true`), none (`false` or `[]`), or only the kinds listed (`['tw']`). The TOC lists only the appendices included. |
| `columns` | number | `1` | ✅ | Body column count, in print and on screen, and only for **continuous-flow bodies**: an Aligned Bible book, or the story frames of an OBS-based TSV resource (`obs-tn`, `obs-tq`, …) — the rule targets `.section.bible-book` and `.obs-frames-body`. Bible-versed Notes and Questions are laid out per verse or per chapter, not as running text, so it does nothing there. Use `supportsBodyColumns(subject)` to test whether it applies. |
| `language` | string | from `htmlData.language`, else `'en'` | ✅ | Language code written as `<html lang>`. |
| `direction` | `'ltr'` \| `'rtl'` | from `htmlData.direction` | ✅ | Text direction, written as `<html dir>` (anything but `'rtl'` is `'ltr'`). In print, `rtl` also starts the book on a left-hand page (WeasyPrint takes the page progression from the root element) and mirrors the running headers: the title on the right-hand page, a range's first reference in the right corner. Every quote that has a letter (a GL quote, an original-language fallback, a Translation Words entry) is isolated in `<bdi dir>` in its own direction; one with no letter has no direction and is left as it is when the sections are rendered, so overriding `direction` here cannot leave a quote reordering the text around it. |
| `engine` | `'weasyprint'` \| `'pagedjs'` | `'weasyprint'` | ✅ | Print engine. `pagedjs` injects the PagedJS polyfill `<script>` for in-browser preview. |
| `print.pageSize` | string \| `{width,height}` | `'A4_PORTRAIT'` | ✅ | Page size (see [Page sizes](#page-sizes)). `media:'print'` only. |
| `print.footerHtml` | string | `''` | ✅ | Extra footer HTML on the copyright page (e.g. app version). |
| `print.margins` | `{top,right,bottom,left}` | theme default | ✅ | Page margins, as CSS lengths (`'15mm'`, `'0.75in'`; a bare number is mm). `left` and `right` are a right-hand page's; a left-hand page mirrors them, so the binding margin stays on the spine. A side left out keeps the theme's: `1cm` top and bottom, `30mm` on the spine side, `20mm` outside. A value that is not a plain length is ignored. |
| `print.runningHeader` | boolean | `true` | ✅ | Running header in the page margin. `false` turns it off; otherwise the layout is chosen by subject — scripture shows the **first and last reference on each page** ("Ruth 1:1 … Ruth 1:18") and no resource name, Open Bible Stories shows **none**, and everything else pairs the **resource or manual name on the verso** with the **reference or article title on the recto**. Renderers mark the tracked points with hidden `.running-title` / `.running-ref` spans. **WeasyPrint only** — PagedJS resolves `string()` to empty, so the browser preview shows no running header. |
| `print.pageNumber.position` | `'top'` \| `'bottom'` | `'bottom'` | ✅ | Where the page number prints (the counter moves to `@top-center`/`@bottom-center`). |
| `print.pageNumber.show` | `{ cover, copyright, toc, body, appendices }` | cover and copyright `false`, the rest `true` | ✅ | Which sections get a page number. Every page is still counted. A section set to `false` gets a named page with an empty number box; the cover and the copyright page are unnumbered by default. |

> **About running headers:** the header text (`{book} {chapter}:{verse}`) comes
> from the renderer and only appears in print/PDF (and the PagedJS preview) — never
> in the continuous web view. It's CSS Paged Media, not a configurable template.

---

## `renderPdf(input, options?)`

Composes the print document with `renderHTML(htmlData, { media: 'print' })` and
runs WeasyPrint. `input` is the `htmlData` from `renderHtmlData()`. Requires the
`weasyprint` binary on `PATH` (or pass `weasyprintPath`).

It takes **`renderHTML`'s composition options** (`show`, `columns`, `language`,
`direction`, `print.*`; `media` is always `'print'`), so a PDF and the print HTML
come out the same, running headers included. `pageSize` and `footerHtml` are still
accepted at the top level as aliases of `print.pageSize` and `print.footerHtml`;
the nested names win when both are given.

| Option | Type | Default | Status | Description |
|---|---|---|---|---|
| `show`, `columns`, `language`, `direction`, `print.*` | | as `renderHTML` with `media: 'print'` | ✅ | See [`renderHTML`](#renderhtmlhtmldata-options). |
| `pageSize` | string \| `{width,height}` | `'A4_PORTRAIT'` | ✅ | Alias of `print.pageSize` (see below). |
| `footerHtml` | string | — | ✅ | Alias of `print.footerHtml`. |
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

## `renderPreview(request)`

The whole pipeline in one call. `request` names the resource as `getAllCatalogEntries`
takes it (`owner`, `repo`, `ref`, `books`, or `lang`, `subject`, `stage`; an owner/repo
without a `ref` means the latest release) and carries the options of every stage
above in the same object, each read by its stage.

| Option | Type | Default | Status | Description |
|---|---|---|---|---|
| `output` | `'html'` \| `'pdf'` | `'html'` | ✅ | `'html'` returns `renderHTML`'s document (`media` picks screen or print); `'pdf'` returns `renderPdf`'s bytes, or its `outputPath`. |

See [Full Pipeline](./pipeline.md#one-call-renderpreviewrequest).

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
