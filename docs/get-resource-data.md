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
  - **dcsApiUrl** (string): DCS API base URL (default `https://git.door43.org/api/v1`)
  - **quiet** (boolean): suppress progress logging (default `false`); warnings are still reported
  - **logger** (object): `{ info, warn }` to receive progress and warnings instead of the console
  - **books** (array): book ids, when `input` does not carry them
  - **archiveMaxBytes** / **archiveTimeoutMs** (numbers): limits for the repository
    archives that Translation Academy, Translation Words, Open Bible Stories and tS
    are read from (default 100 MB and 120 s). The archive must be on the
    `dcsApiUrl` host; redirects are not followed
  - **extraSubjects** (array): blueprint subjects to fetch as extras beyond the ones
    the subject requires, e.g. `['TSV Translation Questions']` so Translation Notes
    can show each verse's questions (see `includeQuestions` in the
    [options reference](./options.md))

`books` selects which books to fetch (e.g. `['tit']`); what an empty list means, and
which subjects ignore it, is [the `books` rule](https://github.com/unfoldingWord/door43-preview-renderers/blob/main/skills/door43-renderers-maintainer/references/contracts.md#books-at-stage-2). Book-scoped supporting resources are fetched for the same
books, and a testament mismatch (a New Testament book requested from the Hebrew Old
Testament, or the reverse) is skipped rather than treated as an error. The list
is not recorded on the result: the renderers work from whatever `books` the data
holds (see `renderHtmlData()` for ordering).

## Catalog selection helpers

The pure filtering `getResourceData()` applies to a blueprint is exported, so a
caller can compute the same set (for a cache key, for instance) without fetching:
`filterCatalogEntries(catalogEntries, { subject?, books?, extraSubjects? })`,
`selectAlignedBibles(entries)` and `testamentOf(bookId)`. Their rules are in the
[options reference](./options.md#catalog-selection-helpers).

## From a local checkout: `getResourceDataFromDirectory`

`getResourceDataFromDirectory(catalogEntries, dirPath, options?)` returns the same
ResourceData from repositories checked out on disk (Node only). `dirPath` holds one
folder per repository, named as its catalog entry names it, checked out at the
entry's version:

```
checkouts/
  en_tn/            tn_TIT.tsv, LICENSE.md, …
  en_ult/  en_ust/  el-x-koine_ugnt/  en_ta/  en_tw/  en_twl/
```

The catalog entries say what each repository is and where its files are; pass the
CatalogSet from `getAllCatalogEntries()` (save it with the CLI's `--output` to work
offline later). The blueprint rules apply as online: only the supporting resources
the subject needs are read, plus any `extraSubjects`.

```js static
const set = await getAllCatalogEntries({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['tit'] });
const resourceData = await getResourceDataFromDirectory(set, '/path/to/checkouts');
```

Checked on en_tn v91 Titus: read from the v91 archives unpacked this way, with the
network blocked, the ResourceData is byte-identical to the one from DCS. That
covers the TSV, the aligned Bibles and Greek New Testament (GL quotes included),
TA, TW and TWL. A Scripture Burrito, tC or tS repository is read the same way (a file by its
ingredient path, or the whole tree), but has not been compared with DCS.

## Errors

`getResourceData`, `getResourceDataFromDirectory`, `getAllCatalogEntries` and the
stage 0 lookups (`findResources`, `resolveResource`, `resolveRef`, `resolveTarget`,
`listLanguages`) throw a **`ResourceError`** (exported) for every failure, a
failed DCS request included, so a caller can tell the cases apart without reading
messages:

| `code` | When |
|---|---|
| `NOT_FOUND` | DCS answered 404, nothing is published (stage 0), or a file is missing from a local checkout |
| `HTTP` | DCS answered another error status, or a response this library can't use (no data, a search that never ends) |
| `NETWORK` | no answer: unreachable or timed out |
| `INVALID_INPUT` | the arguments, a catalog entry, or a resource's content can't be used (e.g. USFM that can't be processed) |
| `UNSUPPORTED` | a subject, metadata type or flavor that isn't handled |
| `NO_CONTENT` | the resource has none of the requested books |

It also carries `status` and `url` when there was a request, and `cause` when it
wraps another error.

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
quote instead. Such quotes are listed on the book as
`glQuoteMisses: [{ reference, quote, repo }]` (only when there are any), so an app
can say why a quote fell back; without the original-language Bible no `GLQuotes` are added. A row
that already has a GL quote for a Bible keeps it. If the lookup itself fails (a
Bible can't be fetched or indexed), a warning is logged and the book gets no
`glQuoteMisses`: no `glQuoteMisses` doesn't by itself mean
every quote matched.

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
