# Get Rendered Pages

The `get_rendered_pages()` function fetches catalog entry information from the Door43 Content Service (DCS) API.

## Function Signature

```js static
async function get_rendered_pages(owner, repo, ref, options = {})
```

## Parameters

- **owner** (string): Repository owner (e.g., 'unfoldingWord')
- **repo** (string): Repository name (e.g., 'en_tn')
- **ref** (string): Git reference - branch, tag, or commit (e.g., 'master')
- **options** (object): Configuration options
  - **dcs_api_url** (string): DCS API base URL (default: 'https://git.door43.org/api/v1')

## Returns

Returns a Promise that resolves to a JSON object containing the catalog entry data from the DCS API.

## Usage Example

```js static
import { get_rendered_pages } from 'door43-preview-renderers';

const catalogEntry = await get_rendered_pages(
  'unfoldingWord',
  'en_tn',
  'master',
  { dcs_api_url: 'https://git.door43.org/api/v1' }
);

console.log(catalogEntry);
```

## Interactive Demo

Try the function below with the default parameters:
