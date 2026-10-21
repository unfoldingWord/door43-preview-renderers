# Converters

The renderers turn Markdown resources (Translation Academy and Translation Words
articles, notes, questions, license files) into HTML with two exported helpers.

## `convertMarkdown(markdown, options?)`

Markdown → HTML, as used for article bodies and the license page:

```js static
import { convertMarkdown } from '@unfoldingword/door43-preview-renderers';

const html = convertMarkdown('# Hello World\n\nThis is **bold** text.');
```

## `convertNoteFromMD2HTML(note, bookId, chapter)`

Markdown → HTML for a Translation Notes or Questions row. Besides the Markdown
itself it rewrites the relative links those rows use into the anchors the
renderers emit, so cross-references inside a note resolve within the rendered
document:

- `../../../tit/01/02.md` → the verse anchor for Titus 1:2
- `../../../tit/01.md` → the chapter anchor for Titus 1
- `../02.md`, `02.md`, `./02` → verse 2 of the chapter the note is in (`bookId`, `chapter`)

External `http(s)` links get `target="_blank" rel="noopener noreferrer"`.

```js static
import { convertNoteFromMD2HTML } from '@unfoldingword/door43-preview-renderers';

const html = convertNoteFromMD2HTML('See [verse 2](../02.md).', 'tit', '1');
// <p>See <a href="#nav-tit-1-2" class="internal-link">verse 2</a></p>
```

`rc://` links to Translation Academy and Translation Words articles are resolved
later, by the renderers, against the articles they collect into the appendices.

USFM is not converted here: the Aligned Bible renderer hands USFM to Proskomma, and
the TSV renderers parse the aligned Bibles' USFM with `usfm-js` for their scripture
columns.
