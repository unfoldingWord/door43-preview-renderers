# Quick Reference - Tests & CLI

## Run Tests

```bash
pnpm test                  # Run all tests
pnpm test:watch           # Watch mode
pnpm test:coverage        # With coverage report
```

## CLI Commands

### Get Catalog Entries

```bash
# Basic usage
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Save to file
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen --output results.json

# Custom API URL
pnpm cli getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --dcs-api-url https://git.door43.org/api/v1
```

### Get Resource Data

```bash
# Basic usage
pnpm cli getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Save to file
pnpm cli getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen --output data.json
```

## Test Cases (from requirements)

```bash
# Test 1: Valid case
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Test 2: Invalid book ID (1th doesn't exist)
pnpm cli getAllCatalogEntries --owner fr_gl --repo fr_tn --ref v2 --book 1th

# Test 3: Valid case
pnpm cli getAllCatalogEntries --owner fr_gl --repo gr_tn --ref v2 --book 1ti

# Test 4: Aligned Bible issue (needs fix)
pnpm cli getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn
```

## Output Format

### getAllCatalogEntries
```json
{
  "version": "1.4.0",
  "catalogEntries": [
    {
      "owner": "unfoldingWord",
      "repo": "en_tn",
      "ref": "v80",
      "bookId": "gen",
      ...
    }
  ]
}
```

## Help

```bash
pnpm cli --help
node src/cli.js --help
```
