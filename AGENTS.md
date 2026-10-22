# door43-preview-renderers Agent Guide

## Goal

A headless JavaScript library (no React) that fetches unfoldingWord resources from Door43/DCS and renders them to HTML sections, complete HTML documents, and PDF, for door43-preview-app and other tools. Published as `@unfoldingword/door43-preview-renderers`.

## The pipeline (one stage, one file)

```
resolveResource(query, opts)         → owner/repo/ref  src/findResources.js         (stage 0, optional: language + subject → publisher + release)
getAllCatalogEntries(source, opts)   → CatalogSet      src/getAllCatalogEntries.js   (one /catalog/bp/ call)
getResourceData(input, opts)         → ResourceData    src/getResourceData.js        (fetch + parse; extras per requiredSubjectsMap; an existing ResourceData passes through)
renderHtmlData(resourceData, opts)   → HtmlData        src/renderHtmlData.js         (pure; routes by subject)
renderHTML(htmlData, opts)           → HTML string     src/renderHTML.js             (pure; media 'screen' | 'print')
renderPdf(htmlData, opts)            → PDF             src/pdf/renderPdf.js          (WeasyPrint binary or pdfServiceUrl)
```

Rules: every stage is `stage(input, options)` with a discriminated input object (no positional type-sniffing); `renderHtmlData` and `renderHTML` do no I/O; `src/index.js` is the public surface and CI checks its export names. Option names and defaults live in `docs/options.md`.

Stage 0 is reached through `getAllCatalogEntries({ lang, subject, books?, owner?, stage?, ref? })`, which returns the blueprint fetched during selection as the CatalogSet, or directly through `findResources`, `resolveResource`, `resolveRef`, `resolveTarget`, `listLanguages`. `getResourceData` does not take the language form; pass it the CatalogSet. Only a 404 moves on to the next publisher; any other HTTP error aborts. With books requested, a book-based dependency (Bible, Words Links, …) that lacks one of them is dropped before the Aligned Bibles are chosen, as DCS does for a one-book blueprint.

## Where things are

- Extractors behind stage 2: `src/rcAlignedBibleHelpers.js`, `src/tsBibleHelpers.js`, `src/tsvHelpers.js` (TSV + extras + the GL-quote call), `src/obsHelpers.js`, `src/taHelpers.js`, `src/twHelpers.js`; `src/dcsApi.js` does the DCS fetching with request-level caching.
- GL quotes: `src/quotes/` (`usfmBookIndex.js` indexes a USFM book, `glQuote.js` maps one original-language quote to the aligned Gateway Language words, `addGlQuotes.js` fills each row's `GLQuotes`). The parity fixtures in `src/fixtures/glquotes/` come from `scripts/gen-glquote-fixtures.mjs`.
- Subject renderers in `src/renderers/`: `alignedBibleRenderer.js` (Proskomma/sofria), `obsRenderer.js`, `translationNotesRenderer.js`, `tsvQuestionsRenderer.js`, `translationWordsLinksRenderer.js`, `translationAcademyRenderer.js`, `translationWordsRenderer.js` (both via `manualResourceRenderer.js`).
- Shared renderer helpers: `scriptureColumns.js` (ULT | UST columns, GL-quote headers), `rcAppendices.js` (rc:// resolution, TA/TW appendices), `twlTable.js` (per-verse Translation Words table), `obsFrames.js` (OBS frame panels), `anchors.js` (`nav-` → `<abbr>-` rewrite), `printDocumentAssembler.js` (cover, TOC, appendices, print CSS, `PAGE_SIZES`).
- Constants: `src/constants.js` (`BibleBookData`, `requiredSubjectsMap`, `subjectIdentifierMap`, `alignedBibleSubjects`); the pure blueprint filtering in `src/catalogSelection.js` (`filterCatalogEntries`, `selectAlignedBibles`, `testamentOf`, exported).
- Known stub: `TSV OBS Translation Words Links` in `getResourceData.js` returns metadata only (#21).
- CLI: `src/cli.js` uses `dist/` when it exists and `src/` otherwise, so rebuild (or delete `dist/`) after changing `src/` before trying it.

## Renderer contract

A subject renderer takes ResourceData and returns `{ subject, title, sections }` where `sections` is `{ cover, copyright, body, toc, css: { web, print }, appendices?, appendixTitles?, webView? }`. Anchors use the `nav-` prefix; `renderHtmlData` rewrites them to the resource abbreviation. There is no `fullHtml` in the contract: `renderHTML()` composes the document. Keep nesting shallow (section > heading / article > div) for WeasyPrint. Details in `skills/door43-renderers-maintainer/references/contracts.md`.

## Adding a subject

1. Check the ResourceData shape `getResourceData()` produces for it.
2. Write the renderer in `src/renderers/`, reusing the shared helpers.
3. Add its subject set and dispatch case in `src/renderHtmlData.js`; export it from `src/index.js` (and add the name to the CI export guard list in `.github/workflows/ci.yml`).
4. Tests in `src/__tests__/` with a synthetic ResourceData fixture; a dispatch test in `renderHtmlData.test.js`.
5. An example in the demos (`src/RenderHtmlDataDemo.jsx` and siblings), a fixture under `src/fixtures/` if the demos should work offline, and docs (`docs/renderers.md`, `docs/options.md`, README subject list).

## Documentation

Every page in `docs/` is listed in `styleguide.config.cjs` (the style guide's sections) and in the README's Documentation table; a new page goes in both. A change in behavior updates the page for its stage, `docs/options.md` for options, the README, and this file, in the same PR. `docs/rendering-pipeline.md` and `docs/pdf-service-and-app-integration.md` are design records: update their status line, not their history.

## Styleguide

`pnpm run styleguide:dev` (http://localhost:6060). Demos, in pipeline order: `src/PipelineDemo.jsx`, `GetAllCatalogEntriesDemo.jsx`, `GetResourceDataDemo.jsx`, `RenderHtmlDataDemo.jsx`, `RenderHTMLDemo.jsx`, `RenderPDFDemo.jsx`. Each render demo shows the packaged section JSON and the composed document in an `iframe srcDoc`. Fixtures in `src/fixtures/` are generated with the CLI (commands in `src/fixtures/index.js`). In a docs page, a ` ```js ` or ` ```jsx ` block is a live example; mark code that should not run ` ```js static `.

## Checks

`pnpm lint` (ESLint over the whole repo, `--max-warnings 0`), `pnpm format:check` (Prettier; `pnpm format` writes), `pnpm test` (Jest with `--experimental-vm-modules`; `pnpm test:coverage` enforces the global threshold), `pnpm build`. `.prettierignore` is the one ignore list for both (lint passes it as `--ignore-path`): build output, the lockfile, generated fixture JSON and the generated logos; Markdown prose is not reformatted, except the demo pages in `src/`. When agent worktrees exist under `.claude/worktrees/`, run Jest with `--testPathIgnorePatterns '/node_modules/' '/.claude/' '/.history/' '/dist/' '/styleguide/'` from the main checkout, and with Jest's default ignores from inside a worktree. CI (`.github/workflows/ci.yml`) runs all of this, plus the export-name check on the built package, on every pull request and push to `main`; `main` requires the `test` check.

## Building and releasing

`pnpm build` runs Rollup to `dist/index.esm.js` (the published entry) and `dist/index.js`; `prebuild` fetches the cover logos into `src/assets/logos.generated.js` only when that committed file is missing (`pnpm fetch-logos` refreshes it). Only `dist/index.esm.js` and `src/cli.js` are published. To release: bump `version` in `package.json` through a PR, then publish a GitHub release tagged `v<version>`; `npm-publish.yml` tests, checks the tag against `package.json`, and publishes (skipping a version already on npm). A person cuts the release.

## Reviews

Pull requests target `main`. Request `uwreview` as reviewer: Frank (Codex) and George (Grok) each review every push a few minutes later and post a verdict (`clean` or `findings`).

- A blocking finding is fixed on the branch. The bench's fix lane may commit one repair itself: after a `findings` verdict, wait a few minutes and pull before pushing, and never force-push over it.
- Answer every finding in one PR comment per round: fixed (with the commit), deferred (to an issue), or refuted (with evidence).
- A Low/HYGIENE note is the author's follow-up after the round closes, in one push or an issue.
- After 5 rounds with findings, the fix lane gets one grace round and then the PR is escalated to a person, who merges with follow-ups or comments `@uwreview grant a round`.
- George reads at most about 290 KB of diff, in file order; large fixtures crowd out the source. Keep fixtures small (well under 100 KB per PR) or split them into their own PR.
- The bench's approval is advice; `main` requires only the `test` check. A person merges.

## Skill for AI maintainers

`skills/door43-renderers-maintainer/SKILL.md` has the renderer-extension workflow; `references/contracts.md` the data and render contracts.
