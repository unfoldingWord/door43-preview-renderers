# CLI Tool

The door43-preview-renderers package includes a command-line interface for fetching catalog entries and resource data.

## Installation

After installing the package globally, you can use the `door43-renderers` command:

```bash
npm install -g door43-preview-renderers
door43-renderers --help
```

Or use it directly with pnpm:

```bash
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen
```

## Commands

### getAllCatalogEntries

Fetches all catalog entries needed for rendering a specific book.

```bash
door43-renderers getAllCatalogEntries --owner <owner> --repo <repo> --ref <ref> --book <bookId>
```

**Options:**
- `--owner` - Repository owner (required)
- `--repo` - Repository name (required)
- `--ref` - Git reference/tag/branch (optional)
- `--book` - Book ID (e.g., gen, exo, mat, 1ti) (optional)
- `--dcs-api-url` - Custom DCS API URL (optional)
- `--output` - Output file path (optional, defaults to stdout)

**Examples:**

```bash
# Output to stdout
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Save to file
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen --output results.json

# Custom DCS API URL
pnpm cli getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --dcs-api-url https://git.door43.org/api/v1
```

### getResourceData

Fetches resource data for a specific repository and book.

```bash
door43-renderers getResourceData --owner <owner> --repo <repo> --ref <ref> --book <bookId>
```

**Options:**
- `--owner` - Repository owner (required)
- `--repo` - Repository name (required)
- `--ref` - Git reference/tag/branch (optional)
- `--book` - Book ID (optional)
- `--dcs-api-url` - Custom DCS API URL (optional)
- `--output` - Output file path (optional, defaults to stdout)

**Examples:**

```bash
# Output to stdout
pnpm cli getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Save to file
pnpm cli getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen --output data.json
```

## Test Cases

The following test cases are documented in the test suite:

### Valid Cases

```bash
# unfoldingWord English Translation Notes
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

# fr_gl Greek Translation Notes with valid book ID
pnpm cli getAllCatalogEntries --owner fr_gl --repo gr_tn --ref v2 --book 1ti
```

### Invalid Cases

```bash
# Invalid book ID (1th doesn't exist)
pnpm cli getAllCatalogEntries --owner fr_gl --repo fr_tn --ref v2 --book 1th

# Aligned Bible issue (currently fails, needs fix to search by owner and subject)
pnpm cli getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn
```

## Output Format

### getAllCatalogEntries

Returns a JSON object with:
- `version` - Package version (e.g., "1.4.0")
- `catalogEntries` - Array of catalog entry objects

```json
{
  "version": "1.4.0",
  "catalogEntries": [
    {
      "subject": "Translation Notes",
      "owner": "unfoldingWord",
      "repo": "en_tn",
      "ref": "v80",
      "language": "en",
      ...
    }
  ]
}
```

### getResourceData

Returns resource-specific data structure (varies by resource type).

## Development

Run tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Run tests with coverage:

```bash
pnpm test:coverage
```
