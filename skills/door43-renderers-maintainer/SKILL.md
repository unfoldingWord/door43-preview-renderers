---
name: door43-renderers-maintainer
description: Use when adding or updating subject-specific renderers in door43-preview-renderers, including renderHtmlData dispatch, styleguide demos, and tests.
---

# Door43 Renderers Maintainer

Use this skill when implementing or extending rendering logic for subjects (Aligned Bible, the TSV resources, Translation Academy, Translation Words, Open Bible Stories).

## The pipeline

```
getAllCatalogEntries(source, opts)   → CatalogSet      (network)
getResourceData(input, opts)         → ResourceData    (network; or a cached ResourceData passed through)
renderHtmlData(resourceData, opts)   → HtmlData        (pure, no I/O)
renderHTML(htmlData, opts)           → HTML string     (media: 'screen' | 'print')
renderPdf(htmlData, opts)            → PDF             (WeasyPrint)
```

A renderer is stage 3. It never fetches; it takes the ResourceData that stage 2 produced (including the supporting resources in `extras`) and returns sections. Stage 4 composes the document.

## Workflow

1. Inspect the data contract

- Read `src/getResourceData.js` and the extractor that produces the subject's ResourceData (`src/tsvHelpers.js`, `src/rcAlignedBibleHelpers.js`, `src/obsHelpers.js`, …).
- Capture the exact shape, including `extras` keys (`ult`, `ust`, `ta`, `tw`, `twl`, `ugnt`/`uhb`, `obs`). The shapes are in `references/contracts.md`.

2. Implement or extend the renderer

- Put subject renderers in `src/renderers/`. Keep React out.
- Reuse the shared helpers: `scriptureColumns.js` (ULT | UST columns, GL-quote headers), `rcAppendices.js` (rc:// link resolution, TA/TW appendices with back-references), `twlTable.js` (per-verse Translation Words table), `obsFrames.js` (OBS frame panels), `printDocumentAssembler.js` (`buildCoverPage`, `coverCss`, `runningMarkerWebCss`).
- Emit `nav-` anchors (`nav-<book>`, `nav-<book>-<ch>`, `nav-<book>-<ch>-<v>`, `nav-<book>-<ch>-<v>-<id>`, articles `nav-<book>--tw-<cat>-<slug>`); `renderHtmlData` rewrites the prefix to the resource abbreviation.
- Mark running-header points with hidden `.running-title` / `.running-ref` spans; keep print rules (`break-before`, `break-inside: avoid`) in `css.print`.
- Keep the DOM shallow: section > heading / article > div. Deep nesting breaks WeasyPrint.

3. Wire the dispatcher

- Add the subject names to a subject set and a dispatch case in `src/renderHtmlData.js`.
- Unsupported subjects keep throwing `HTML rendering is not implemented yet for subject …`.

4. Wire the public API and docs

- Export the renderer from `src/index.js` and add its name to the export guard list in `.github/workflows/ci.yml`.
- Document the subject in `docs/renderers.md` and its `renderOptions` in `docs/options.md`; add it to the README subject list.

5. Verify

- Tests in `src/__tests__/`: a synthetic ResourceData fixture shaped exactly as stage 2 produces, assertions on anchors, headings, GL quotes, appendices, and each option; a dispatch test in `renderHtmlData.test.js`.
- A live audit on a real resource (`renderHTML(htmlData, { media: 'print' })`): zero dangling `href="#…"` targets, zero raw `rc://`.
- A styleguide example, and a fixture under `src/fixtures/` (generated with `node src/cli.js renderHtml … --output`) when the demos should show the subject offline.

## Render contract

`renderHtmlData()` returns HtmlData:

- `subject`, `title`, `abbreviation`, `version`, `direction`
- `sections`: `cover`, `copyright`, `body`, `toc` (array of `{ id, title, book?, sections? }`), `css: { web, print }`, optional `appendices` (`{ ta: { [path]: { id, title, html } }, tw: {…} }`), `appendixTitles`, `webView`

No document string: `renderHTML(htmlData, { media })` builds it.

## Reviews

Pull requests target `main`; request `uwreview`. Frank and George review every push; the fix lane handles blocking findings on the branch (pull before pushing, never force-push); Low notes are the author's follow-up after the round, in one push or an issue.

## References

- Data and render contracts: `references/contracts.md`
- Options by stage and subject: `docs/options.md`
