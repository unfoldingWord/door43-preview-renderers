# Finding resources (stage 0)

The pipeline starts from a descriptor, `{ owner, repo, ref }`. These helpers
find it from what a person actually knows: a language, and what they want to
read. Every call is a read-only lookup against the DCS catalog, deduplicated
through the same request cache the rest of the library uses.

```js static
import {
  findResources,
  resolveResource,
  resolveRef,
  listLanguages,
  getAllCatalogEntries,
} from '@unfoldingword/door43-preview-renderers';
```

## `findResources({ lang, subject?, owner?, stage? }, options?)`

Every published catalog entry for a language, optionally narrowed to one
subject or owner. Pages through `/catalog/search` for you.

```js static
const entries = await findResources({ lang: 'es-419', subject: 'TSV Translation Notes' });
entries.map((e) => `${e.owner}/${e.name}@${e.branch_or_tag_name}`);
// → ['es-419_gl/es-419_tn@v66', 'es-419_obt/es-419_tn@v0.0.5']
```

| Field | Default | Meaning |
|---|---|---|
| `lang` | required | Language code (`en`, `es-419`, `hi`) |
| `subject` | all | Catalog subject (`Aligned Bible`, `TSV Translation Notes`, …) |
| `owner` | all | Restrict to one user or organisation |
| `stage` | `prod` | `prod` (released), `preprod`, `latest`, or `branch` |

## `resolveResource({ lang, subject, books?, owner?, stage?, ref? }, options?)`

The best entry point for a language and subject: `{ owner, repo, ref, entry, catalogEntries }`.
Several owners can publish the same subject, so candidates are tried in order
of: the owner you asked for, gateway-language publishers, newest release.
The first whose book package (`/catalog/bp/`) carries every requested book
and supplies every subject the main subject needs for them wins; the others
are skipped with the reason kept for the error message if none fit. The
chosen resource is always the first of the returned `catalogEntries`.

Books asked for must come from the dependencies too: a Bible or Words Links
entry that lacks one is left out of `catalogEntries`, as DCS does for a
one-book blueprint, so the Bibles chosen for the render are ones that carry
every book. An original-language Bible is held only to the books of its own
testament, and Translation Academy and Translation Words are not
book-based. A book-based entry whose ingredient list is empty carries no
books. With no `books`, the package is judged as a whole: it needs the
original-language Bible of each testament its own ingredients span, and its
dependencies are not checked book by book.

With a `ref`, every candidate is judged by its blueprint at that ref rather
than its current release, and a candidate that has no such ref is skipped.

```js static
const { owner, repo, ref } = await resolveResource({
  lang: 'es-419',
  subject: 'TSV Translation Notes',
  books: ['tit'],
});
// → { owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v66', … }
```

## `resolveRef({ owner, repo, ref? }, options?)`

Which ref to render: a ref you give is returned as-is; an empty one means
the repository's latest published release, or its default branch when it
has no release.

```js static
await resolveRef({ owner: 'unfoldingWord', repo: 'en_tn' });
// → { ref: 'v91', isRelease: true }
await resolveRef({ owner: 'someone', repo: 'xx_ult_work' });
// → { ref: 'master', isRelease: false }
```

## `resolveTarget({ owner?, repo?, ref?, lang?, subject?, books?, stage? }, options?)`

What the CLI does with its flags, for callers that take the same mix: a
language and subject name the publisher (a `ref` you give is kept and the
package is judged at it, else the found release); an owner and repo without
a `ref` take the latest release.

```js static
await resolveTarget({ lang: 'es-419', subject: 'TSV Translation Notes', ref: 'v60' });
// → { owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v60', resolved: { … } }
```

## `listLanguages({ stage? }, options?)`

Languages that have published content, for a picker.

```js static
await listLanguages();
// → [{ code: 'am', name: 'Amharic', native: 'አማርኛ', direction: 'ltr', gateway: true }, …]
```

## In the pipeline

`getAllCatalogEntries()` accepts the language form directly and uses the
blueprint fetched while choosing as the CatalogSet, so nothing is requested twice:

```js static
const set = await getAllCatalogEntries({ lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] });
const data = await getResourceData(set);
```

On the command line, `--lang` with `--subject` replaces `--owner`/`--repo`,
and an omitted `--ref` means the latest release:

```bash
door43-renderers findResources --lang es-419 --quiet
door43-renderers renderHtml --lang es-419 --subject "TSV Translation Notes" --book tit --quiet
door43-renderers getResourceData --owner unfoldingWord --repo en_tn --book tit --quiet   # ref = latest release
```

`options.dcs_api_url` (default `https://git.door43.org/api/v1`) and `options.quiet`
work as everywhere else in the library.
