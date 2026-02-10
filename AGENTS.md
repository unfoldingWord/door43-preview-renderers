# door43-preview-renderers Agent Guide

## Goal

This library fetches resource content from Door43/DCS and packages render-ready data for downstream apps that build HTML/PDF views.

## Core APIs

- `src/getResourceData.js`
  - Fetches and normalizes one resource by `owner/repo/ref`.
- `src/getAllCatalogEntriesForRendering.js`
  - Resolves dependent catalog entries needed for a full rendering stack.
- `src/renderHtmlData.js`
  - New subject-aware HTML dispatcher that calls `getResourceData()` first, then routes to subject renderers.

## Rendering Architecture

- Subject renderer files live in `src/renderers/`.
- First implemented subject renderer:
  - `src/renderers/alignedBibleRenderer.js`
- Subject renderers should return:
  - packaged sections (`cover`, `body`, `toc`, `css`, optional `webView`),
  - `fullHtml` (complete document string),
  - source `resourceData` via `renderHtmlData()`.

## Styleguide/Test App

Use `pnpm run styleguide:dev` and verify demos:

- `src/GetResourceDataDemo.jsx`
- `src/GetAllCatalogEntriesForRenderingDemo.jsx`
- `src/RenderHtmlDataDemo.jsx`

The render demo must show:

- packaged HTML/CSS JSON values,
- full rendered output (`iframe` with `srcDoc`).

## Subject-by-subject extension path

1. Identify target subject and inspect `getResourceData()` output shape.
2. Build pure JS renderer under `src/renderers/`.
3. Add dispatch case in `src/renderHtmlData.js`.
4. Add tests in `src/__tests__/`.
5. Update styleguide demo/docs/README.

## Skill for AI maintainers

Use `skills/door43-renderers-maintainer/SKILL.md` for repeatable renderer-extension workflow.
