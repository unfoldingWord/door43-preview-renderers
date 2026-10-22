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

`books` selects which books to fetch (e.g. `['tit']`); what an empty list means, and
which subjects ignore it, is [the `books` rule](https://github.com/unfoldingWord/door43-preview-renderers/blob/main/skills/door43-renderers-maintainer/references/contracts.md#books-at-stage-2). Book-scoped supporting resources are fetched for the same
books, and a testament mismatch (a New Testament book requested from the Hebrew Old
Testament, or the reverse) is skipped rather than treated as an error. The list
is not recorded on the result: the renderers work from whatever `books` the data
holds (see `renderHtmlData()` for ordering).

## Catalog selection helpers

The pure filtering `getResourceData()` applies to a blueprint is exported, so a
caller can compute the same set (for a cache key, for instance) without fetching:
`filterCatalogEntries(catalogEntries, { subject?, books? })`,
`selectAlignedBibles(entries)` and `testamentOf(bookId)`. Their rules are in the
[options reference](./options.md#catalog-selection-helpers).

## Returns

A Promise resolving to a **ResourceData** object. Every shape carries `type`,
`subject`, `title`, `abbreviation`, `version`, and `license`, and, when the catalog
entry gives them, `language` (e.g. `ar`), `languageTitle`, `direction` (`'ltr'` or
`'rtl'`) and `isGatewayLanguage`. Each extra carries its own (an English Bible
`ltr`, the Hebrew Old Testament `rtl`). The content differs by `type`:

| `type` | Subjects | Content |
|---|---|---|
| `usfm` | Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament | `books: { [bookId]: usfmString }` (alignment markers removed) |
| `tsv` | TSV Translation Notes / Questions / Study Notes / Study Questions / Translation Words Links, and their OBS variants (one `obs` book; stories as chapters, frames as verses) | `books: { [bookId]: { title, chapters: { [ch]: { verses: { [v]: [row, …] } } } } }` plus `extras` (the supporting resources, keyed by repo identifier such as `ult`, `ust`, `ta`, `tw`, `twl`, `ugnt`, or `obs`, `obs-twl` for the OBS resources; find one by its `subject`, not its key) |
| `obs` | Open Bible Stories | `stories: { [num]: { title, reference, frames: { [n]: { text, img } } } }`, `front`, `back` |
| `ta` | Translation Academy | `manuals: { [manualId]: { title, toc, articles: { [articleId]: { title, text } } } }` |
| `tw` | Translation Words | `articles: { kt: {…}, names: {…}, other: {…} }` |

TSV rows with an original-language `Quote` also carry `GLQuotes`, keyed by the
aligned Bible repository (e.g. `en_ult`), with the Gateway Language quote and
occurrence for that Bible. They are computed locally (`src/quotes/`): for each book,
the aligned Bibles and the original-language Bible of that book's testament are
fetched once through the request cache, indexed, and each quote is matched to the
Gateway Language words aligned to it. A quote that cannot be matched leaves that
Bible out of the row's `GLQuotes`, and the renderers show the original-language
quote instead; without the original-language Bible no `GLQuotes` are added. A row
that already has a GL quote for a Bible keeps it.

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
| `sb` | Scripture Burrito: Bibles of the `textTranslation` flavor (one USFM file per book, read like an RC Bible) and OBS (`textStories`) |
| `ts` | translationStudio projects (single-book Bibles, OBS) |
| `tc` | translationCore projects (aligned Bibles with an exported USFM) |

## Interactive Demo

Fetch real data from the DCS API with the default parameters, or pick one of the
examples:

```jsx
import GetResourceDataDemo from '../src/GetResourceDataDemo';

<GetResourceDataDemo />
```
