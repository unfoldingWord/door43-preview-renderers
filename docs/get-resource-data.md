# Get Resource Data

`getResourceData()` is **stage 2** of the pipeline. It fetches one resource from the
Door43 Content Service (DCS), parses it (USFM, TSV, Markdown, or OBS), pulls in the
supporting resources that subject needs for rendering (aligned Bibles, Translation
Academy, Translation Words, Translation Words Links, the original-language Bibles),
and returns a normalized **ResourceData** object.

Every resource is read as the **Scripture Burrito** DCS converts it to: rc, ts and
tc repositories alike (see [How resources are read](#how-resources-are-read)).

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
  - **archiveMaxBytes** / **archiveTimeoutMs** (numbers): limits for the burrito
    archives that Translation Academy, Translation Words and Open Bible Stories
    are read from (default 100 MB and 120 s). The archive URL is built from
    `dcsApiUrl`; redirects are not followed
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

## From burritos on disk: `getResourceDataFromDirectory`

`getResourceDataFromDirectory(catalogEntries, dirPath, options?)` returns the same
ResourceData from burritos unpacked on disk (Node only). `dirPath` holds one folder
per repository, named as its catalog entry names it, each laid out as the DCS SB
archive of the entry's version (`GET /repos/{owner}/{repo}/sb/{ref}.zip`, which
holds a `<repo>/` folder, so unzipping the archives into one folder gives this
layout):

```
burritos/
  en_tn/            metadata.json, ingredients/TIT.tsv, ingredients/LICENSE.md, …
  en_ult/  en_ust/  el-x-koine_ugnt/  en_ta/  en_tw/  en_twl/
```

The catalog entries say which repositories make up the package; pass the CatalogSet
from `getAllCatalogEntries()` (save it with the CLI's `--output` to work offline
later). The blueprint rules apply as online: only the supporting resources the
subject needs are read, plus any `extraSubjects`.

```js static
const set = await getAllCatalogEntries({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['tit'] });
const resourceData = await getResourceDataFromDirectory(set, '/path/to/burritos');
```

Checked on en_tn v86 Titus: read from the package's SB archives unpacked this way,
with DCS unreachable, the ResourceData is byte-identical to the one from DCS. That
covers the TSV, the aligned Bibles and Greek New Testament (GL quotes included),
TA, TW and TWL. A plain rc checkout (no `metadata.json`) is not read.

## Errors

`getResourceData`, `getResourceDataFromDirectory`, `getAllCatalogEntries` and the
stage 0 lookups (`findResources`, `resolveResource`, `resolveRef`, `resolveTarget`,
`listLanguages`) throw a **`ResourceError`** (exported) for every failure, a
failed DCS request included, so a caller can tell the cases apart without reading
messages:

| `code` | When |
|---|---|
| `NOT_FOUND` | DCS answered 404, nothing is published (stage 0), or a file is missing from a burrito on disk |
| `HTTP` | DCS answered another error status, or a response this library can't use (no data, a search that never ends) |
| `NETWORK` | no answer: unreachable or timed out |
| `INVALID_INPUT` | the arguments, a catalog entry, or a resource's content can't be used (e.g. USFM that can't be processed) |
| `UNSUPPORTED` | a subject or flavor that isn't handled |
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

## How resources are read

DCS serves every repository as a Scripture Burrito: an rc, ts or tc repository is
converted on the fly, and an sb one is served as it is. So every resource is read
the same way, from DCS's SB endpoints:

| Request | What it reads |
|---|---|
| `GET /repos/{owner}/{repo}/sb/raw/metadata.json?ref={ref}` | the burrito's metadata: its flavor, ingredients (with each book's `scope`), language and direction |
| `GET /repos/{owner}/{repo}/sb/raw/{path}?ref={revision}` | one file, e.g. `ingredients/TIT.tsv`: the books a render needs |
| `GET /repos/{owner}/{repo}/sb/{revision}.zip` | the whole burrito: Translation Academy, Translation Words, Open Bible Stories |

`metadata.json` is read at the catalog entry's ref, and every later read is pinned
to the commit it names, so a branch that moves during a render cannot mix two
commits. A book's file is the ingredient whose `scope` names it. The subject still
routes the resource (Translation Words and Translation Words Links share a flavor);
a burrito whose subject isn't one of these is routed by its flavor when it is a
Bible (`textTranslation`) or stories (`textStories`).

| Flavor | Subjects | Files |
|---|---|---|
| `textTranslation` | Aligned Bible, Bible, Greek New Testament, Hebrew Old Testament (also ts and tc Bibles) | `ingredients/<BOOK>.usfm` |
| `x-bcvnotes`, `x-bcvquestions` | TSV Translation Notes / Questions (TSV Study Notes / Questions are read the same way; no release was available to check their flavor) | `ingredients/<BOOK>.tsv` |
| `x-bcvarticles` | Translation Words, TSV Translation Words Links, TSV OBS Translation Words Links | the TSVs, and the articles under `ingredients/payload/<category>/` |
| `x-obsnotes`, `x-obsquestions` | TSV OBS Translation Notes / Study Notes, TSV OBS Translation Questions / Study Questions | `ingredients/OBS.tsv` |
| `x-peripheralArticles` | Translation Academy | `ingredients/<manual>/<article>/01.md`, with each manual's `toc.yaml` and `config.yaml` |
| `textStories` | Open Bible Stories (also ts OBS) | `ingredients/content/<NN>.md`, `front.md` |

DCS's conversion points a Translation Words Links row at its article in the payload
(`./payload/names/paul.md`); it reads back as the rc link the renderers resolve
(`rc://*/tw/dict/bible/names/paul`). Titles come from the catalog where it gives
them (the resource, an OBS TSV's one book), else from the burrito
(`localizedNames` for a Bible book, `identification.name`).

## Interactive Demo

Fetch real data from the DCS API with the default parameters, or pick one of the
examples:

```jsx
import GetResourceDataDemo from '../src/GetResourceDataDemo';

<GetResourceDataDemo />
```
