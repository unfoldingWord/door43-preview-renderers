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
  resourceVersion: string,   // the resource's version (tag/branch), e.g. "v89"
  libraryVersion: string,    // this renderer library's npm version
  catalogEntries: [          // main entry first, then dependencies
    {...},                   // [0] the requested resource
    {...},                   // [1..n] dependencies (Aligned Bible, TA, TW, original languages, …)
  ],
  source: { owner, repo, ref, books, dcsApiUrl }
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
import { getAllCatalogEntries } from 'door43-preview-renderers';

// From a descriptor
const set = await getAllCatalogEntries(
  { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v89', books: ['1th'] }
);
console.log(set.resourceVersion, set.catalogEntries.length);

// Reuse it downstream — no second /catalog/bp/ call
import { getResourceData } from 'door43-preview-renderers';
const data = await getResourceData(set);
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
