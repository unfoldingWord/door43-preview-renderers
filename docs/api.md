# API Client

The library talks to the Door43 Content Service through its own internal module
(`src/dcsApi.js`: catalog entries, file contents, licenses, with request-level
caching). You do not call that directly; `getAllCatalogEntries()` and
`getResourceData()` do.

One small helper for **GitHub** repositories is exported for callers that need
it:

## Fetch Resource

Fetch repository content through the GitHub API (`api.github.com`):

```js static
import { fetchResource } from '@unfoldingword/door43-preview-renderers';

const content = await fetchResource({
  owner: 'unfoldingWord',
  repo: 'door43-preview-renderers',
  ref: 'main',
  path: 'package.json', // optional; a directory lists its entries
});
```

### Parameters

- `owner` (string, required): repository owner
- `repo` (string, required): repository name
- `ref` (string, required): git reference (branch, tag, or commit SHA)
- `path` (string, optional): path to a file or directory

### Returns

The GitHub contents API response (an object for a file, an array for a directory).

## Error Handling

The helper throws a descriptive error:

```js static
try {
  const content = await fetchResource({ owner: 'invalid', repo: 'nonexistent', ref: 'main' });
} catch (error) {
  console.error('Failed to fetch:', error.message);
}
```
