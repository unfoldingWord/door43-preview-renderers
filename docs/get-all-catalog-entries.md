# Get All Catalog Entries

`getAllCatalogEntries()` is **stage 1** of the pipeline. It fetches the full
**book package** (blueprint) for a resource in a single call to the DCS
`/catalog/bp/` endpoint — the main entry plus every related dependency — and
returns a **CatalogSet**.

**Source:** `src/getAllCatalogEntries.js`

## Signature

```js static
getAllCatalogEntries(source, options?)
```

- **source** (object): one of
  - a **descriptor** `{ owner, repo, ref, books? }`
  - a **language form** `{ lang, subject, books?, owner?, stage?, ref? }`: the
    publisher and release are chosen first ([stage 0](./find-resources.md)), and the
    blueprint of the chosen package is returned, so it is not fetched a second time
    (a candidate that does not fit costs one `/catalog/bp/` call of its own).
    `owner` is a preference, `stage` defaults to `prod`, and `ref` pins a release
    (each publisher's package is checked at that ref)
  - an existing **catalog entry** (its `url` is used to infer the DCS API base)
  - an existing **CatalogSet** (returned unchanged — passthrough)
- **options** (object, optional):
  - **dcs_api_url** (string): DCS API base URL (default `https://git.door43.org/api/v1`)
  - **quiet** (boolean): suppress logging
  - **books** (array): books, when using the catalog-entry source form

## Returns

A Promise resolving to a **CatalogSet**:

```js static
{
  resourceVersion: string,   // the resource's version (tag/branch), e.g. "v91"
  libraryVersion: string,    // this renderer library's npm version
  catalogEntries: [          // main entry first, then dependencies
    {...},                   // [0] the requested resource
    {...},                   // [1..n] dependencies (Aligned Bible, TA, TW, original languages, …)
  ],
  source: { owner, repo, ref, books, dcsApiUrl }   // + lang, subject for the language form
}
```

## How dependency resolution works

The `/catalog/bp/` blueprint is the **single source of truth** for which
resources (and which exact versions) belong to a book package — it resolves
dependencies server-side, so this function makes **one** call and does no
client-side relation/date matching.

Filtering to just what a resource *needs* for rendering (per `requiredSubjectsMap`,
with at most two Aligned Bibles preferring `ult`/`glt` + `ust`/`gst`, and
testament-aware original-language selection) happens downstream in
[`getResourceData()`](./get-resource-data.md), which can also **reuse** a
CatalogSet you pass it — avoiding a second blueprint call.

## Usage

```js static
import { getAllCatalogEntries } from '@unfoldingword/door43-preview-renderers';

// From a descriptor
const set = await getAllCatalogEntries(
  { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['1th'] }
);
console.log(set.resourceVersion, set.catalogEntries.length);

// Reuse it downstream — no second /catalog/bp/ call
import { getResourceData } from '@unfoldingword/door43-preview-renderers';
const data = await getResourceData(set);

// From a language: the publisher and its latest release are found for you
const es = await getAllCatalogEntries({ lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] });
es.source; // → { owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v66', books: ['tit'], lang: 'es-419', … }
```

## Interactive Demo

```jsx
import GetAllCatalogEntriesDemo from '../src/GetAllCatalogEntriesDemo';

<GetAllCatalogEntriesDemo />
```

## Related Constants (`src/constants.js`)

- **`BibleBookData`** — the 66 canonical books with testament classification.
- **`requiredSubjectsMap`** — each subject's required dependency subjects.
- **`subjectIdentifierMap`** — subject name → repository identifier.
