# Get All Catalog Entries For Rendering

The `getAllCatalogEntriesForRendering()` function fetches all catalog entries needed to render a resource, including the main entry and all required dependency entries.

**Source:** `src/getAllCatalogEntriesForRendering.js`

## Function Signature

```js static
async function getAllCatalogEntriesForRendering(
  ownerOrCatalogEntry,
  repoOrBooks,
  refOrOptions,
  booksOrUndefined,
  optionsOrUndefined
)
```

## Overloaded Signatures

This function supports two different calling patterns:

### Pattern 1: Using owner/repo/ref

```js static
getAllCatalogEntriesForRendering(owner, repo, ref, books?, options?)
```

**Parameters:**
- **owner** (string): Repository owner (e.g., 'unfoldingWord')
- **repo** (string): Repository name (e.g., 'en_tn')
- **ref** (string): Git reference - branch, tag, or commit (e.g., 'v87')
- **books** (Array, optional): List of book identifiers (e.g., ['1th', 'mat'])
- **options** (Object, optional): Configuration options
  - **dcs_api_url** (string): DCS API base URL (default: 'https://git.door43.org/api/v1')

### Pattern 2: Using catalog entry object

```js static
getAllCatalogEntriesForRendering(catalogEntry, books?, options?)
```

**Parameters:**
- **catalogEntry** (Object): Existing catalog entry object
- **books** (Array, optional): List of book identifiers
- **options** (Object, optional): Configuration options
  - **dcs_api_url** (string): DCS API base URL (extracted from catalogEntry.url if not provided)

## Returns

Returns a Promise that resolves to an object with the following structure:

```js static
{
  version: string,        // The package version (e.g., "1.4.0")
  catalogEntries: [       // Array of catalog entry objects
    {...},                // [0]: The main catalog entry (the one requested)
    {...},                // [1..n]: Required catalog entries in the order needed
  ]
}
```

**Properties:**
- **version** (string): The version of the door43-preview-renderers package
- **catalogEntries** (Array): Array of catalog entry objects
  - **catalogEntries[0]**: The main catalog entry (the one requested)
  - **catalogEntries[1..n]**: Required catalog entries in the order they are needed

## How It Works

1. Determines required subjects based on the main entry's subject type
2. Analyzes the books array to determine which testaments are needed
3. **First processes the main catalog entry's `relations` field** to find versioned dependencies
4. For each relation, intelligently searches based on:
   - **Version specified**: Searches by tag (e.g., `v81`)
   - **No version, branch ref**: Searches for latest stage
   - **No version, tag ref**: Searches with history and finds best match by release date
5. Fills in any missing required subjects by searching the catalog
6. Validates that all required books are available (only for TSV Bible-related and Bible subjects)
7. Returns all entries in the correct order for rendering

### Relations-Based Discovery

The function intelligently uses the `relations` field from the main catalog entry to find the exact versions of dependencies that were used when the resource was created. This ensures compatibility and consistency.

**Relation Identifier Mapping:**
- `ta` → Translation Academy
- `tw` → Translation Words
- `twl` → TSV Translation Words Links
- `uhb` → Hebrew Old Testament
- `ugnt` → Greek New Testament
- `tn` → TSV Translation Notes
- `tq` → TSV Translation Questions
- `ult`, `ust`, `glt`, `gst` → Aligned Bible
- `obs` → Open Bible Stories
- `obs-tn`, `obs-tq`, etc. → OBS-specific resources

### Date-Based Matching

When a relation doesn't specify a version and the main entry is a tag (not a branch), the function finds the best matching catalog entry by release date:

1. **Prefers same-day releases** (uses latest if multiple on same day)
2. **Falls back to closest earlier release** (within 5 days)
3. **Uses closest later release** (within 5 days) if no earlier found
4. **Uses any later release** if none within 5 days

### Required Subjects Map

Different subjects have different requirements:

- **TSV Translation Notes**: Aligned Bible, Translation Academy, Translation Words, TSV Translation Words Links, Hebrew OT, Greek NT
- **TSV Study Notes**: Aligned Bible, Hebrew OT, Greek NT
- **TSV Study Questions**: Aligned Bible, Hebrew OT, Greek NT
- **TSV Translation Questions**: Aligned Bible, Hebrew OT, Greek NT
- **TSV Translation Words Links**: Aligned Bible, Hebrew OT, Greek NT, Translation Words
- **TSV OBS Study Notes**: Open Bible Stories
- **TSV OBS Study Questions**: Open Bible Stories
- **TSV OBS Translation Notes**: Open Bible Stories, TSV OBS Translation Words Links, Translation Academy, Translation Words
- **TSV OBS Translation Questions**: Open Bible Stories

### Book Validation

Book validation only applies to:
- Subjects starting with "TSV" (excluding "TSV OBS" subjects)
- "Bible", "Aligned Bible", "Hebrew Old Testament", "Greek New Testament"

Subjects like "Translation Academy" and "Translation Words" do not require book validation and use the first matching entry.

### Testament-Based Filtering

When books are specified, the function intelligently determines which testaments are needed:
- **Only Old Testament books**: Only fetches Hebrew Old Testament, skips Greek New Testament
- **Only New Testament books**: Only fetches Greek New Testament, skips Hebrew Old Testament  
- **Mixed or no books**: Fetches both Hebrew Old Testament and Greek New Testament

### Special Handling

- **Hebrew Old Testament**: Always uses `unfoldingWord` as owner and `hbo` as language
- **Greek New Testament**: Always uses `unfoldingWord` as owner and `el-x-koine` as language

## Usage Examples

### Example 1: Fetch Translation Notes with a specific book

```js static
import { getAllCatalogEntriesForRendering } from 'door43-preview-renderers';

const result = await getAllCatalogEntriesForRendering(
  'unfoldingWord',
  'en_tn',
  'v87',
  ['1th']
);

console.log(`Package version: ${result.version}`);
console.log(`Found ${result.catalogEntries.length} entries`);
console.log(`Main: ${result.catalogEntries[0].title}`);
result.catalogEntries.slice(1).forEach((entry, i) => {
  console.log(`Required ${i + 1}: ${entry.title}`);
});
```

### Example 2: Using an existing catalog entry

```js static
import { getCatalogEntry, getAllCatalogEntriesForRendering } from 'door43-preview-renderers';

const mainEntry = await getCatalogEntry('BSOJ', 'en_tn', 'master');
const result = await getAllCatalogEntriesForRendering(mainEntry, ['tit']);

console.log(`Version: ${result.version}`);
console.log(`Catalog entries:`, result.catalogEntries);
```

### Example 3: Multiple books

```js static
const result = await getAllCatalogEntriesForRendering(
  'unfoldingWord',
  'en_tn',
  'v66',
  ['mat', 'mrk', 'luk', 'jhn']
);
// Only fetches Greek NT, skips Hebrew OT (all books are NT)
```

### Example 4: Old Testament only

```js static
const result = await getAllCatalogEntriesForRendering(
  'unfoldingWord',
  'en_tn',
  'v87',
  ['gen', 'exo']
);
// Only fetches Hebrew OT, skips Greek NT (all books are OT)
```

### Example 5: Mixed testaments

```js static
const result = await getAllCatalogEntriesForRendering(
  'unfoldingWord',
  'en_tn',
  'v87',
  ['gen', 'mat']
);
// Fetches both Hebrew OT and Greek NT (mixed testaments)
```

### Example 6: OBS Translation Notes

```js static
const result = await getAllCatalogEntriesForRendering(
  'unfoldingWord',
  'en_obs-tn',
  'v11'
);
console.log(result.version); // "1.4.0"
console.log(result.catalogEntries.length); // Number of entries found
```

## Error Handling

The function throws errors in these cases:

- Catalog entry not found
- Required subject catalog entry not found
- No catalog entry found with all requested books (when books are specified)
- No identifier mapping found for a subject

## Interactive Demo

Try the function below with the examples:

```jsx
import GetAllCatalogEntriesForRenderingDemo from '../src/GetAllCatalogEntriesForRenderingDemo';

<GetAllCatalogEntriesForRenderingDemo />
```

## Related Constants

The function uses several constants exported from `src/constants.js`:

### BibleBookData

Contains all 66 canonical Bible books with testament classification:

```js static
import { BibleBookData } from 'door43-preview-renderers';

// Example usage
const bookInfo = BibleBookData['gen'];
// { id: 'gen', title: 'Genesis', usfm: '01-GEN', testament: 'old' }
```

### requiredSubjectsMap

Maps subjects to their required dependencies:

```js static
import { requiredSubjectsMap } from 'door43-preview-renderers';

// Example usage
const requirements = requiredSubjectsMap['TSV Translation Notes'];
// ['Aligned Bible', 'Translation Academy', 'Translation Words', ...]
```

### subjectIdentifierMap

Maps subject names to repository identifiers:

```js static
import { subjectIdentifierMap } from 'door43-preview-renderers';

// Example usage
const identifier = subjectIdentifierMap['Translation Academy'];
// 'ta'
```
