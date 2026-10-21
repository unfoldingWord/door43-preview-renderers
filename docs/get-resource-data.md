# Get Resource Data

`getResourceData()` is **stage 2** of the pipeline. It fetches one resource from the
Door43 Content Service (DCS), parses it (USFM, TSV, Markdown, or OBS), pulls in the
supporting resources that subject needs for rendering (aligned Bibles, Translation
Academy, Translation Words, Translation Words Links, the original-language Bibles),
and returns a normalized **ResourceData** object.

**Source:** `src/getResourceData.js`

## Signature

```js static
getResourceData(input, options?)
```

- **input** (object): one of
  - a **descriptor** `{ owner, repo, ref, books? }`
  - a **CatalogSet** from [`getAllCatalogEntries()`](./get-all-catalog-entries.md)
    (reused as-is — no second `/catalog/bp/` call)
  - a **catalog entry** object from the DCS API
  - an existing **ResourceData** object (returned unchanged — passthrough)
- **options** (object, optional):
  - **dcs_api_url** (string): DCS API base URL (default `https://git.door43.org/api/v1`)
  - **quiet** (boolean): suppress progress logging (default `false`)
  - **books** (array): book ids, when `input` does not carry them

`books` selects which books to fetch (e.g. `['tit']`); an empty list means every
book the resource has. Book-scoped supporting resources are fetched for the same
books, and a testament mismatch (a New Testament book requested from the Hebrew Old
Testament, or the reverse) is skipped rather than treated as an error.

## Returns

A Promise resolving to a **ResourceData** object. Every shape carries `type`,
`subject`, `title`, `abbreviation`, `version`, and `license`; the content differs
by `type`:

| `type` | Subjects | Content |
|---|---|---|
| `usfm` | Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament | `books: { [bookId]: usfmString }` (alignment markers removed) |
| `tsv` | TSV Translation Notes / Questions / Study Notes / Study Questions / Translation Words Links, and their OBS variants | `books: { [bookId]: { title, chapters: { [ch]: { verses: { [v]: [row, …] } } } } }` plus `extras` (the supporting resources, keyed by short identifier such as `ult`, `ust`, `ta`, `tw`, `twl`, `ugnt`) |
| `obs` | Open Bible Stories | `stories: { [num]: { title, reference, frames: { [n]: { text, img } } } }`, `front`, `back` |
| `ta` | Translation Academy | `manuals: { [manualId]: { title, toc, articles: { [articleId]: { title, text } } } }` |
| `tw` | Translation Words | `articles: { kt: {…}, names: {…}, other: {…} }` |

TSV rows with an original-language `Quote` also carry `GLQuotes`, keyed by the
aligned Bible repository (e.g. `en_ult`), with the Gateway Language quote and
occurrence for that Bible.

## Usage

```js static
import { getResourceData } from '@unfoldingword/door43-preview-renderers';

const resourceData = await getResourceData(
  { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['tit'] },
  { quiet: true }
);

console.log(resourceData.type); // 'tsv'
console.log(Object.keys(resourceData.extras)); // ['ult', 'ust', 'ta', 'tw', 'twl', 'ugnt']
```

Reusing a CatalogSet you already fetched:

```js static
import { getAllCatalogEntries, getResourceData } from '@unfoldingword/door43-preview-renderers';

const set = await getAllCatalogEntries({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['tit'] });
const resourceData = await getResourceData(set);
```

## Supported metadata types

| Metadata type | Description |
|---|---|
| `rc` | Resource Container (the unfoldingWord standard) |
| `sb` | Scripture Burrito (OBS; the scripture flavor is not implemented yet) |
| `ts` | translationStudio projects (single-book Bibles, OBS) |
| `tc` | translationCore projects (aligned Bibles with an exported USFM) |

## Interactive Demo

Fetch real data from the DCS API with the default parameters, or pick one of the
examples:

```jsx
import GetResourceDataDemo from '../src/GetResourceDataDemo';

<GetResourceDataDemo />
```
