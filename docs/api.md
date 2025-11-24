# API Client

The API client provides methods for fetching content from remote repositories.

## Fetch Resource

Fetch repository content using the GitHub API:

```js static
import { fetchResource } from 'door43-preview-renderers';

const content = await fetchResource({
  owner: 'unfoldingWord',
  repo: 'en_ult',
  ref: 'master',
  path: 'manifest.yaml', // optional
});
```

### Parameters

- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `ref` (string, required): Git reference (branch, tag, or commit SHA)
- `path` (string, optional): Path to specific file or directory

## Fetch Raw Content

Get raw file content directly:

```js static
import { fetchRawContent } from 'door43-preview-renderers';

const rawContent = await fetchRawContent({
  owner: 'unfoldingWord',
  repo: 'en_ult',
  ref: 'master',
  path: 'README.md',
});
```

## Error Handling

All API methods throw descriptive errors:

```js static
try {
  const content = await fetchResource({
    owner: 'invalid',
    repo: 'nonexistent',
    ref: 'master',
  });
} catch (error) {
  console.error('Failed to fetch:', error.message);
}
```
