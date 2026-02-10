# Contracts

## Data pipeline

1. `getResourceData(owner, repo, ref, books, options)` fetches and normalizes resource content by subject.
2. `renderHtmlData(owner, repo, ref, books, options)` fetches resource data and dispatches to a subject renderer.
3. Subject renderer returns packaged sections and a full HTML document.

## Subject renderer conventions

- Input: resource data returned from `getResourceData()`.
- Output object:
  - `subject`: string
  - `title`: string
  - `sections`: object
    - `cover`: string
    - `body`: string
    - `toc`: array
    - `css`: `{ web: string }` (can grow to include print)
    - `webView`: optional string for alternate/raw view
    - `copyright`: optional string
  - `fullHtml`: full document string
- Keep errors explicit: unsupported subject or invalid input shape should throw with context.

## Initial implementation status

- `renderHtmlData()` currently supports Bible subjects:
  - `Aligned Bible`
  - `Bible`
  - `Greek New Testament`
  - `Hebrew Old Testament`
- Renderer implementation file:
  - `src/renderers/alignedBibleRenderer.js`

## When adding a subject

- Add subject renderer file under `src/renderers/`.
- Add dispatch case in `src/renderHtmlData.js`.
- Export needed APIs from `src/index.js`.
- Add styleguide demo coverage.
- Add tests in `src/__tests__/` for contract and key HTML IDs.
