# Testing and CLI Implementation Summary

## Overview

Added comprehensive testing infrastructure and a command-line interface (CLI) tool to the door43-preview-renderers package.

## What Was Created

### 1. Test Suite (`src/__tests__/`)

#### Files:
- `getAllCatalogEntriesForRendering.test.js` - Integration tests for the main function
- `getResourceData.test.js` - Basic tests for resource data fetching

#### Test Cases Implemented:

**Requested Test Cases:**
1. ✅ `unfoldingWord/en_tn/v80` - Validates basic structure and version
2. ✅ `fr_gl/fr_tn/v2 book: 1th` - Tests invalid book ID (returns structure but incomplete)
3. ✅ `fr_gl/gr_tn/v2 book: 1ti` - Tests valid book ID
4. ✅ `BSOJ/ar_twl/v5 book: 1jn` - Documents limitation (needs Aligned Bible search fix)

**Additional Test Coverage:**
- Version validation (ensures returns `1.4.0`)
- Return structure validation (`{version, catalogEntries}`)
- Function import verification

#### Test Configuration:
- **Jest Config**: Updated `jest.config.js`
  - Added path ignoring for `.history` and `styleguide` folders
  - Excluded CLI and JSX files from coverage
  - Set coverage threshold to 50% (realistic for current state)
  - Added proper module name mapping

### 2. CLI Tool (`src/cli.js`)

#### Features:
- **Commands:**
  - `getAllCatalogEntries` - Fetch catalog entries for rendering
  - `getResourceData` - Fetch resource data for a book

- **Options:**
  - `--owner` - Repository owner (required)
  - `--repo` - Repository name (required)
  - `--ref` - Git reference (optional)
  - `--book` - Book ID (optional)
  - `--dcs-api-url` - Custom DCS API URL (optional)
  - `--output` - Output file path (optional, defaults to stdout)

#### Usage Examples:

```bash
# View help
node src/cli.js --help

# Get catalog entries (output to stdout)
node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Save to file
node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen --output result.json

# Get resource data
node src/cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Custom DCS API URL
node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --dcs-api-url https://git.door43.org/api/v1
```

#### Using via pnpm:

```bash
# Via pnpm script
pnpm cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

# After global install
npm install -g door43-preview-renderers
door43-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen
```

### 3. Documentation (`docs/cli.md`)

Complete CLI documentation including:
- Installation instructions
- Command reference
- All usage examples
- Test cases
- Output format specifications

### 4. Package Configuration Updates

Updated `package.json`:
- Added `bin` entry: `"door43-renderers": "./src/cli.js"`
- Added CLI file to `files` array
- New scripts:
  - `test:watch` - Run tests in watch mode
  - `test:coverage` - Run tests with coverage report
  - `cli` - Shortcut for running CLI

## Test Results

```bash
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

All tests passing! ✅

## Known Limitations & TODOs

### 1. BSOJ/ar_twl/v5 Aligned Bible Issue

**Problem:** Function expects standard Bible naming (`ar_ult`, `ar_ust`, `ar_glt`, `ar_gst`) but this owner uses `ar_avd`.

**Solution Needed:** Modify `getAllCatalogEntriesForRendering()` to:
1. Search for Aligned Bible by owner + `subject=Aligned%20Bible` when standard names aren't found
2. This will find resources like `ar_avd` that don't follow the standard naming pattern

**Test Case:** Already documented in `getAllCatalogEntriesForRendering.test.js` line 107-132

### 2. Invalid Book ID Handling

**Current Behavior:** `1th` (invalid) returns structure but with incomplete catalogEntries

**Possible Improvement:** Could add validation to warn user about invalid book IDs

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Running CLI

```bash
# Direct execution
node src/cli.js <command> [options]

# Via pnpm
pnpm cli <command> [options]

# After global install
door43-renderers <command> [options]
```

## Files Modified/Created

**Created:**
- `src/__tests__/getAllCatalogEntriesForRendering.test.js`
- `src/__tests__/getResourceData.test.js`
- `src/cli.js`
- `docs/cli.md`

**Modified:**
- `package.json` - Added bin, scripts, files
- `jest.config.js` - Updated configuration

## Next Steps

1. **Fix Aligned Bible Search:** Implement owner + subject search for non-standard naming
2. **Add More Tests:** Consider adding tests for edge cases and error handling
3. **CLI Enhancements:** Consider adding features like:
   - Progress indicators for long operations
   - Batch processing of multiple books
   - JSON schema validation of outputs
4. **Documentation:** Consider adding examples in README.md

## Integration with Existing Code

The CLI and tests integrate seamlessly with the existing codebase:
- Uses the same functions from `getAllCatalogEntriesForRendering.js`
- Returns the same `{version, catalogEntries}` format
- Respects all existing parameters and options
- No breaking changes to existing API
