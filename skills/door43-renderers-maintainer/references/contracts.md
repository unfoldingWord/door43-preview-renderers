# Contracts

## Data pipeline

0. `resolveResource({ lang, subject, books?, owner?, stage?, ref? }, options)` (`src/findResources.js`, optional) — picks the publisher and release for a language and subject and returns `{ owner, repo, ref, entry, catalogEntries }` with the chosen entry first. `getAllCatalogEntries` accepts the same language form and returns that blueprint as the CatalogSet.
1. `getAllCatalogEntries(source, options)` — one `/catalog/bp/` call; returns a CatalogSet `{ resourceVersion, libraryVersion, catalogEntries, source }` with the requested entry first (`source` also has `lang` and `subject` for the language form).
2. `getResourceData(input, options)` — `input` is a descriptor `{ owner, repo, ref, books? }`, a CatalogSet, a catalog entry, or ResourceData (passthrough). Fetches and normalizes the resource, filters the blueprint by `requiredSubjectsMap` (`filterCatalogEntries` in `src/catalogSelection.js`: at most two Aligned Bibles, testament-aware originals), fetches those as `extras`, and adds `GLQuotes` to TSV rows (computed locally in `src/quotes/` from the aligned Bibles and the original-language Bible; an unmatched quote leaves that Bible out).
3. `renderHtmlData(resourceData, options)` — pure; routes by `subject`; applies `books` (array entries or object keys) as selection/order for the USFM subjects only — unlisted books are omitted there, `resourceData.requestedBooks` taking precedence — and the object form's values as reference ranges for TSV and USFM; rewrites anchors to the abbreviation; returns HtmlData.
4. `renderHTML(htmlData, options)` — pure; composes one document for `media: 'screen' | 'print'`.
5. `renderPdf(htmlData, options)` — WeasyPrint.

## ResourceData shapes (stage 2 output, renderer input)

Common: `type`, `metadataType`, `subject`, `title`, `abbreviation`, `version`, `license`; and, when the catalog entry gives them, `language`, `languageTitle`, `direction` (`'ltr'` | `'rtl'`), `isGatewayLanguage` (copied once in `getResourceData`, for extras too).

- `usfm` (Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament): `books: { [bookId]: usfmString }` — alignment markers removed.
- `tsv` (TN, TQ, SN, SQ, TWL and the OBS variants of TN/TQ/SN/SQ — OBS TWL extraction is still a stub, #21): `books: { [bookId]: { title, identifier, sort, chapters: { [ch]: { verses: { [v]: [row] } } } } }`. A row has the TSV columns normalized to `Reference`, `ID`, `Tags`, `Quote`, `Occurrence`, `Note` / `Question` / `Response`, `SupportReference` / `TWLink`, plus `GLQuotes: { [bibleRepo]: { Quote, Occurrence, FullGLQuote?, FullGLOccurrence? } }` when aligned Bibles were available. `extras: { ult, ust, ta, tw, twl, ugnt | uhb, obs }` (whatever the subject needs), each itself a ResourceData.
- `obs`: `stories: { [num]: { title, reference, frames: { [n]: { text, img } } } }`, `front`, `back`.
- `ta`: `manuals: { [manualId]: { title, toc, articles: { [articleId]: { title, text } } } }`.
- `tw`: `articles: { kt: { [slug]: { title, text } }, names: {…}, other: {…} }` (each category also carries a `title` meta key).

## Renderer output (stage 3)

A subject renderer returns:

- `subject`: string
- `title`: string
- `sections`:
  - `cover`: string (`buildCoverPage`)
  - `copyright`: string (license markdown → HTML)
  - `body`: string
  - `toc`: array of `{ id, title, book?, sections? }`
  - `css`: `{ web: string, print: string }`
  - `appendices`: optional `{ ta: { [articlePath]: { id, title, html } }, tw: {…} }` (Translation Notes, Translation Words Links)
  - `appendixTitles`: optional `{ ta, tw }`
  - `webView`: optional alternate view (raw USFM for Aligned Bible when `includeRawUsfmView`)

`renderHtmlData` promotes `abbreviation`, `version`, `language`, `direction` onto the HtmlData (`renderHTML` and `renderPdf` write them as `<html lang dir>`; a renderer isolates an opposite-direction quote with `isolatedQuoteHtml`) and rewrites `nav-` anchors in every section to `<abbreviation>-`. There is no `fullHtml`; `renderHTML` composes the document.

Keep errors explicit: unsupported subject or invalid input shape throws with context.

## Anchors

`nav-resource`, `nav-<book>`, `nav-<book>-<ch|front>`, `nav-<book>-<ch>-<v|intro>`, `nav-<book>-<ch>-<v>-<rowId>`, articles `nav-<book>--ta-<manual>-<article>` and `nav-<book>--tw-<category>-<slug>`. After the rewrite: `tn-tit-1-1`, `twl-tit--tw-names-paul`, etc.

## Implemented renderers

| Subjects | File |
|---|---|
| Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament | `src/renderers/alignedBibleRenderer.js` |
| Open Bible Stories | `src/renderers/obsRenderer.js` |
| TSV Translation Notes, TSV OBS Translation Notes | `src/renderers/translationNotesRenderer.js` |
| TSV Translation Questions / Study Questions / Study Notes (+ OBS variants) | `src/renderers/tsvQuestionsRenderer.js` |
| TSV Translation Words Links (TSV OBS Translation Words Links is routed, data extraction pending #21) | `src/renderers/translationWordsLinksRenderer.js` |
| Translation Academy | `src/renderers/translationAcademyRenderer.js` |
| Translation Words | `src/renderers/translationWordsRenderer.js` |

## When adding a subject

- Add the renderer under `src/renderers/`, reusing the shared helpers.
- Add a subject set and dispatch case in `src/renderHtmlData.js`.
- Export it from `src/index.js` and add the name to the CI export guard.
- Add a demo example and, if useful, a fixture under `src/fixtures/`.
- Add tests in `src/__tests__/` for the contract, anchors, and each option.
