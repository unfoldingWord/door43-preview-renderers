---
name: door43-renderers-maintainer
description: Use when adding or updating subject-specific renderers in door43-preview-renderers, including renderHtmlData dispatch, styleguide demos, and tests.
---

# Door43 Renderers Maintainer

Use this skill when implementing or extending rendering logic for subjects (Aligned Bible, TSV resources, TA, TW, OBS).

## Workflow

1. Inspect data contract

- Open `src/getResourceData.js` and the subject helper that produces the resource data.
- Capture the exact shape returned for that subject.

2. Implement or extend renderer

- Put subject renderers in `src/renderers/`.
- Keep React out of library renderer functions.
- Return packaged sections plus full HTML document.

3. Wire dispatcher

- Update `src/renderHtmlData.js` to route by subject.
- Keep unsupported subjects explicit with actionable errors.

4. Wire public API and docs

- Export new API from `src/index.js`.
- Update `docs/renderers.md` and `README.md` with supported subjects and examples.

5. Add verification

- Add or update tests in `src/__tests__/`.
- Verify styleguide demo can show both packaged JSON and full rendered preview.

## Render Contract

`renderHtmlData()` should return:

- `subject`
- `title`
- `sections` (`cover`, `body`, `toc`, `css`, optional `webView`, optional `copyright`)
- `fullHtml`
- `resourceData` (original source payload)

## Styleguide Requirement

For every new subject renderer, update or add a demo component in `src/` that allows:

- entering owner/repo/ref/books/options,
- viewing packaged section JSON,
- viewing full rendered output in an `iframe` `srcDoc`.

## References

- Data/render contracts and project conventions: `references/contracts.md`
