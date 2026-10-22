# Render HTML Data

`renderHtmlData()` is **stage 3** of the pipeline. It takes parsed
**ResourceData** (from [`getResourceData()`](./get-resource-data.md), or any
cached copy of it), routes it to the renderer for its subject, and returns an
**HtmlData** package: reusable HTML sections plus the identity fields the later
stages need. It is pure and synchronous — no network, no disk.

**Source:** `src/renderHtmlData.js`, renderers in `src/renderers/`

## Signature

```js static
renderHtmlData(resourceData, options?)
```

- **resourceData** (object): output of `getResourceData()`
- **options** (object, optional):
  - **renderOptions** (object): subject-specific knobs, passed straight to the renderer
  - **books** (array | object): for the USFM subjects (Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament)
    the listed ids — array entries or object keys — select and order the books
    rendered, and a book in the data but not listed is omitted
    (`resourceData.requestedBooks` takes precedence when a caller sets it); the
    TSV, OBS and manual renderers always render every book in the data, in
    catalog `sort` order. Object-form values add a per-book **reference range**
    (TSV and USFM): `{ tit: '1:1-2:5', phm: '*' }` renders Titus 1:1–2:5 and all
    of Philemon — and, for a USFM resource, nothing else.

See [Rendering options](./options.md) for every option by subject.

```js static
import { getResourceData, renderHtmlData } from '@unfoldingword/door43-preview-renderers';

const resourceData = await getResourceData(
  { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['tit'] }
);

const htmlData = renderHtmlData(resourceData, {
  renderOptions: { showChaptersInToc: true },
});
```

## Supported subjects

| Subject(s) | Renderer |
|---|---|
| Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament | `renderAlignedBibleHtml` (USFM via Proskomma) |
| Translation Academy | `renderTranslationAcademyHtml` |
| Translation Words | `renderTranslationWordsHtml` |
| Open Bible Stories | `renderObsHtml` |
| TSV Translation Notes, TSV OBS Translation Notes | `renderTranslationNotesHtml` |
| TSV Translation Questions, TSV Study Questions, TSV Study Notes, TSV OBS Translation Questions, TSV OBS Study Notes, TSV OBS Study Questions | `renderTsvQuestionsHtml` |
| TSV Translation Words Links, TSV OBS Translation Words Links | `renderTranslationWordsLinksHtml` — the Translation Words for a book, by verse (scripture columns and the words in each verse, articles as an appendix) or as a glossary (`renderOptions.layout: 'glossary'`: one entry per article, grouped Key Terms / Names / Other, article body inline, references listed) (`TSV OBS Translation Words Links` is routed here too, but its data extraction is still a stub — see [#21](https://github.com/unfoldingWord/door43-preview-renderers/issues/21)) |

Any other subject throws `HTML rendering is not implemented yet for subject …`.

## Returns

An **HtmlData** package:

```js static
{
  subject: 'TSV Translation Notes',
  title: 'unfoldingWord® Translation Notes',
  abbreviation: 'tn',
  version: 'v91',
  language: 'en',        // from the resource; renderHTML writes it as <html lang>
  direction: 'ltr',      // 'rtl' for Arabic, Hebrew, Farsi…; renderHTML writes <html dir>
  sections: {
    cover: '…',          // cover page HTML
    copyright: '…',      // license page HTML
    body: '…',           // the content
    toc: [{ id: 'tn-tit', title: 'Titus', book: 'tit', sections: [...] }],
    css: { web: '…', print: '…' },
    appendices: { ta: { [articlePath]: { id, title, html } }, tw: {…} },  // TN and TWL only
    appendixTitles: { ta: '…', tw: '…' },
    webView: null,
  },
}
```

Anchors are rewritten from the renderers' generic `nav-` prefix to the resource
abbreviation (`tn-tit-1-1`), so several resources can share one page; see
[Anchors](./options.md#anchors-deep-linking).

There is no document string here. Stage 4, [`renderHTML()`](./render-html.md),
composes these sections into a web page or a print document, and
[`renderPdf()`](./render-pdf.md) turns that into a PDF.

## Calling a renderer directly

Each renderer is exported and takes the same ResourceData shape:

```js static
import { renderTranslationNotesHtml } from '@unfoldingword/door43-preview-renderers';

const { sections } = renderTranslationNotesHtml(resourceData, { showChaptersInToc: false });
```

Going through `renderHtmlData()` is preferable: it applies the `books` selection
(USFM subjects) and the reference ranges, rewrites the anchor prefix, and promotes
the identity fields.

## Shared renderer helpers (`src/renderers/`)

- `scriptureColumns.js` — parallel ULT | UST scripture columns and GL-quote headers
- `rcAppendices.js` — `rc://` link resolution and the Translation Academy / Translation Words appendices
- `twlTable.js` — the per-verse Translation Words table used by Translation Notes and Translation Words Links
- `obsFrames.js` — Open Bible Stories frame panels for the OBS-based TSV subjects
- `anchors.js` — the `nav-` → `<abbreviation>-` anchor rewrite
- `printDocumentAssembler.js` — cover page, table of contents, appendices, print CSS, `PAGE_SIZES`

## Interactive Demo

Use the component on this page to fetch a resource live from DCS and inspect both
the packaged section JSON and the composed document in an iframe.
