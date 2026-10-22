# door43-preview-renderers Agent Guide

## Goal

A headless JavaScript library (no React) that fetches unfoldingWord resources from Door43/DCS and renders them to HTML sections, complete HTML documents, and PDF, for door43-preview-app and other tools. Published as `@unfoldingword/door43-preview-renderers`.

## The pipeline (one stage, one file)

```
getAllCatalogEntries(source, opts)   → CatalogSet      src/getAllCatalogEntries.js   (one /catalog/bp/ call)
getResourceData(input, opts)         → ResourceData    src/getResourceData.js        (fetch + parse; extras per requiredSubjectsMap; an existing ResourceData passes through)
renderHtmlData(resourceData, opts)   → HtmlData        src/renderHtmlData.js         (pure; routes by subject)
renderHTML(htmlData, opts)           → HTML string     src/renderHTML.js             (pure; media 'screen' | 'print')
renderPdf(htmlData, opts)            → PDF             src/pdf/renderPdf.js          (WeasyPrint binary or pdfServiceUrl)
```

Rules: every stage is `stage(input, options)` with a discriminated input object (no positional type-sniffing); `renderHtmlData` and `renderHTML` do no I/O; `src/index.js` is the public surface and CI checks its export names. Option names and defaults live in `docs/options.md`.

## Where things are

- Extractors behind stage 2: `src/rcAlignedBibleHelpers.js`, `src/tsBibleHelpers.js`, `src/tsvHelpers.js` (TSV + GL quotes + extras), `src/obsHelpers.js`, `src/taHelpers.js`, `src/twHelpers.js`; `src/dcsApi.js` does the DCS fetching with request-level caching.
- Subject renderers in `src/renderers/`: `alignedBibleRenderer.js` (Proskomma/sofria), `obsRenderer.js`, `translationNotesRenderer.js`, `tsvQuestionsRenderer.js`, `translationWordsLinksRenderer.js`, `translationAcademyRenderer.js`, `translationWordsRenderer.js` (both via `manualResourceRenderer.js`).
- Shared renderer helpers: `scriptureColumns.js` (ULT | UST columns, GL-quote headers), `rcAppendices.js` (rc:// resolution, TA/TW appendices), `twlTable.js` (per-verse Translation Words table), `obsFrames.js` (OBS frame panels), `anchors.js` (`nav-` → `<abbr>-` rewrite), `printDocumentAssembler.js` (cover, TOC, appendices, print CSS, `PAGE_SIZES`).
- Constants: `src/constants.js` (`BibleBookData`, `requiredSubjectsMap`, `subjectIdentifierMap`, `alignedBibleSubjects`); the pure blueprint filtering in `src/catalogSelection.js` (`filterCatalogEntries`, `selectAlignedBibles`, `testamentOf`, exported).
- Known stubs: `TSV OBS Translation Words Links` and Scripture Burrito scripture in `getResourceData.js` return metadata only (#21, #22).
- CLI: `src/cli.js` imports from `dist/`, so `pnpm build` first.

## Renderer contract

A subject renderer takes ResourceData and returns `{ subject, title, sections }` where `sections` is `{ cover, copyright, body, toc, css: { web, print }, appendices?, appendixTitles?, webView? }`. Anchors use the `nav-` prefix; `renderHtmlData` rewrites them to the resource abbreviation. There is no `fullHtml` in the contract: `renderHTML()` composes the document. Keep nesting shallow (section > heading / article > div) for WeasyPrint. Details in `skills/door43-renderers-maintainer/references/contracts.md`.

## Adding a subject

1. Check the ResourceData shape `getResourceData()` produces for it.
2. Write the renderer in `src/renderers/`, reusing the shared helpers.
3. Add its subject set and dispatch case in `src/renderHtmlData.js`; export it from `src/index.js` (and add the name to the CI export guard list in `.github/workflows/ci.yml`).
4. Tests in `src/__tests__/` with a synthetic ResourceData fixture; a dispatch test in `renderHtmlData.test.js`.
5. An example in the demos (`src/RenderHtmlDataDemo.jsx` and siblings), a fixture under `src/fixtures/` if the demos should work offline, and docs (`docs/renderers.md`, `docs/options.md`, README subject list).

## Styleguide

`pnpm run styleguide:dev` (http://localhost:6060). Demos, in pipeline order: `src/PipelineDemo.jsx`, `GetAllCatalogEntriesDemo.jsx`, `GetResourceDataDemo.jsx`, `RenderHtmlDataDemo.jsx`, `RenderHTMLDemo.jsx`, `RenderPDFDemo.jsx`. Each render demo shows the packaged section JSON and the composed document in an `iframe srcDoc`. Fixtures in `src/fixtures/` are generated with the CLI (commands in `src/fixtures/index.js`).

## Checks

`pnpm lint`, `pnpm test` (Jest with `--experimental-vm-modules`; `pnpm test:coverage` enforces the global threshold), `pnpm build`. When agent worktrees exist under `.claude/worktrees/`, run Jest with `--testPathIgnorePatterns '/node_modules/' '/.claude/' '/.history/' '/dist/' '/styleguide/'` from the main checkout, and with Jest's default ignores from inside a worktree. CI (`.github/workflows/ci.yml`) runs all of this on every pull request and push to `main`; `main` requires the `test` check.

## Reviews

Pull requests target `main`. Request `uwreview` as reviewer: Frank (Codex) and George (Grok) each review every push a few minutes later; a fix lane commits one repair for a blocking finding on the branch (pull before pushing, never force-push over it); a Low/HYGIENE note is the author's follow-up after the round closes, in one push, or an issue. A person merges.

## Skill for AI maintainers

`skills/door43-renderers-maintainer/SKILL.md` has the renderer-extension workflow; `references/contracts.md` the data and render contracts.
