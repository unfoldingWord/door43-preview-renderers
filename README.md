# Door43 Preview Renderers

A JavaScript library for gathering content from various repositories and rendering HTML snippets for web previews and PDFs of translation resources.

## Features

- 🔌 API client for fetching content from Door43 repositories
- 🎨 Multiple converters for different content formats
- 📝 HTML snippet generation for web previews
- 🧱 Subject-aware HTML packaging via `renderHtmlData()`
- 📄 PDF-ready rendering
- ⚡ Modular and extensible architecture
- 🖥️ Command-line interface (CLI) for easy data retrieval
- 🔍 Smart dependency resolution for translation resources

## Installation

### As a Library

```bash
# Using pnpm (recommended)
pnpm add door43-preview-renderers

# Using npm
npm install door43-preview-renderers

# Using yarn
yarn add door43-preview-renderers
```

### CLI Tool

The package includes a CLI tool that can be used directly:

```bash
# Install globally
npm install -g door43-preview-renderers

# Or use via npx (no installation required)
npx door43-preview-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen
```

## Usage

### Library Usage

```javascript
import {
  getAllCatalogEntriesForRendering,
  getResourceData,
  renderHtmlData,
} from 'door43-preview-renderers';

// Get catalog entries with all dependencies
const result = await getAllCatalogEntriesForRendering('unfoldingWord', 'en_tn', 'v80', ['tit'], {
  dcs_api_url: 'https://git.door43.org/api/v1',
});

console.log(result.version); // Package version
console.log(result.catalogEntries); // Array of catalog entries

// Get resource data for a specific repository
const data = await getResourceData('unfoldingWord', 'en_ult', 'master', ['gen'], {
  dcs_api_url: 'https://git.door43.org/api/v1',
});

// Render HTML sections + full HTML for supported subjects (currently Bible subjects)
const rendered = await renderHtmlData('unfoldingWord', 'en_ult', 'v88', ['tit'], {
  dcs_api_url: 'https://git.door43.org/api/v1',
  renderOptions: { includeRawUsfmView: false, editorMode: false },
});

console.log(rendered.sections.body); // HTML body string
console.log(rendered.fullHtml); // Full HTML document
```

### CLI Usage

The CLI provides two main commands: `getAllCatalogEntries` and `getResourceData`.

#### Get All Catalog Entries

Retrieve a catalog entry along with all its required dependencies:

```bash
# Basic usage
node src/cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Quiet mode (no logging, just JSON output) - perfect for piping to jq
node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --quiet

# Pipe to jq for filtering
node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --quiet | jq '.catalogEntries[] | {owner, repo: .name, subject}'

# Save to file
node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen --output result.json

# Use custom DCS API URL
node src/cli.js getAllCatalogEntries --owner myorg --repo myrepo --ref main --dcs-api-url https://custom-dcs.example.com/api/v1
```

#### Get Resource Data

Retrieve just the resource data for a specific repository:

```bash
node src/cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen
```

#### CLI Options

- `--owner <owner>` - Repository owner (required)
- `--repo <repo>` - Repository name (required)
- `--ref <ref>` - Git reference (branch, tag, or commit)
- `--book <bookId>` - Book ID (e.g., gen, exo, mat, 1ti, 1jn)
- `--dcs-api-url <url>` - Custom DCS API URL (optional, defaults to https://git.door43.org/api/v1)
- `--output <file>` - Output file path (optional, defaults to stdout)
- `--quiet, -q` - Suppress logging output (perfect for piping to jq or other tools)

## API Reference

### `getAllCatalogEntriesForRendering()`

Fetches a catalog entry and automatically resolves all required dependencies based on the resource type.

#### Parameters

**Signature 1: Fetch by owner/repo/ref**

```javascript
getAllCatalogEntriesForRendering(owner, repo, ref, books?, options?)
```

- `owner` (string): Repository owner
- `repo` (string): Repository name
- `ref` (string): Git reference (branch, tag, or commit)
- `books` (array, optional): Array of book identifiers (e.g., `['gen', 'exo']`)
- `options` (object, optional):
  - `dcs_api_url` (string): DCS API base URL (default: `https://git.door43.org/api/v1`)
  - `quiet` (boolean): Suppress logging output (default: `false`)

**Signature 2: Use existing catalog entry**

```javascript
getAllCatalogEntriesForRendering(catalogEntry, books?, options?)
```

- `catalogEntry` (object): An existing catalog entry object
- `books` (array, optional): Array of book identifiers
- `options` (object, optional): Same as signature 1

#### Returns

Returns a Promise that resolves to an object with:

```javascript
{
  version: "1.4.0",           // Package version
  catalogEntries: [           // Array of catalog entries
    { /* main catalog entry */ },
    { /* dependency 1 */ },
    { /* dependency 2 */ },
    ...
  ]
}
```

#### Logic and Dependency Resolution

The function intelligently resolves dependencies based on the resource subject:

1. **Translation Notes/Words** (`TSV Translation Notes`, `TSV Translation Words Links`):
   - Finds the associated Translation Academy (TA)
   - Finds the associated Translation Words (TW)
   - Finds the Aligned Bible for the language
   - Finds the Original Language texts (Hebrew OT and/or Greek NT)

2. **Translation Questions** (`TSV Translation Questions`):
   - Finds the associated Bible translation
   - Finds the Original Language texts

3. **OBS (Open Bible Stories)**:
   - Finds the associated OBS Translation Notes
   - Finds the associated OBS Translation Questions
   - Finds the associated Translation Words

4. **Testament Filtering**: When specific books are requested, it only fetches:
   - Hebrew Old Testament if OT books are requested
   - Greek New Testament if NT books are requested

5. **Book Validation**: For Bible-related resources, it validates that the dependency contains all requested books before including it

6. **Date-Based Matching**: When searching for dependencies, it looks for entries with release dates within 5 days of the main entry's release date

7. **Fallback Search**: For Aligned Bibles, if standard naming (`*_ult`, `*_ust`) doesn't find a match, it searches by subject and language to find alternative Aligned Bible resources

8. **Stage Matching**: Attempts to match the same stage (e.g., `prod`, `preprod`, `latest`) as the main entry

#### Example

```javascript
const result = await getAllCatalogEntriesForRendering('unfoldingWord', 'en_tn', 'v80', ['tit'], {
  quiet: true,
});

// Result contains:
// - en_tn (Translation Notes)
// - en_ult (Aligned Bible)
// - en_ta (Translation Academy)
// - en_tw (Translation Words)
// - el-x-koine_ugnt (Greek New Testament)
```

### `getResourceData()`

Fetches the catalog entry for a specific resource without resolving dependencies.

#### Parameters

```javascript
getResourceData(owner, repo, ref, books?, options?, is_extra?)
```

- `owner` (string): Repository owner
- `repo` (string): Repository name
- `ref` (string): Git reference (branch, tag, or commit)
- `books` (array, optional): Array of book identifiers to filter (default: `[]`)
- `options` (object, optional):
  - `dcs_api_url` (string): DCS API base URL (default: `https://git.door43.org/api/v1`)
  - `quiet` (boolean): Suppress logging output (default: `false`)
- `is_extra` (boolean, optional): Whether to include extra data (default: `false`)

#### Returns

Returns a Promise that resolves to a catalog entry object with detailed information about the resource.

#### Example

```javascript
const catalogEntry = await getResourceData('unfoldingWord', 'en_ult', 'master', ['gen', 'exo'], {
  quiet: true,
  dcs_api_url: 'https://git.door43.org/api/v1',
});

console.log(catalogEntry.subject); // "Aligned Bible"
console.log(catalogEntry.language); // "en"
console.log(catalogEntry.ingredients); // Array of books/chapters
```

### `renderHtmlData()`

Fetches resource data and renders subject-specific HTML sections.

#### Parameters

```javascript
renderHtmlData(owner, repo, ref, books?, options?)
```

- `owner` (string): Repository owner
- `repo` (string): Repository name
- `ref` (string): Git reference (branch, tag, or commit)
- `books` (array, optional): Array of book identifiers to filter (default: `[]`)
- `options` (object, optional):
  - `dcs_api_url` (string): DCS API base URL (default: `https://git.door43.org/api/v1`)
  - `quiet` (boolean): Suppress logging output (default: `false`)
  - `renderOptions` (object): Renderer-specific options (e.g. `includeRawUsfmView`, `editorMode`)

#### Current subject support

- `Aligned Bible`
- `Bible`
- `Greek New Testament`
- `Hebrew Old Testament`

#### Returns

Returns a Promise that resolves to a rendering package:

```javascript
{
  subject: "Aligned Bible",
  title: "unfoldingWord® Literal Text",
  sections: {
    cover: "<h3 ...",
    body: "<div class=\"section bible-book\" ...",
    toc: [{ id: "nav-tit", title: "Titus", book: "tit" }],
    css: { web: "..." },
    webView: null
  },
  fullHtml: "<!DOCTYPE html>...",
  resourceData: { ... } // original getResourceData output
}
```

## Development

### Prerequisites

- Node.js >= 16.0.0
- pnpm >= 8.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/unfoldingWord/door43-preview-renderers.git
cd door43-preview-renderers

# Install dependencies
pnpm install
```

### Running in Development

#### Style Guide (Component Documentation)

The style guide provides interactive documentation and examples of all components:

```bash
# Start the style guide development server
pnpm run styleguide

# Or use the dev alias
pnpm run styleguide:dev

# The style guide will be available at http://localhost:6060
```

#### CLI Development

```bash
# Run the CLI directly from source
node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Or use the npm script
pnpm run cli getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

# Run with quiet mode for clean JSON output
node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --quiet | jq
```

#### Development Build

```bash
# Start the development build watcher
pnpm run dev

# This will watch for changes and rebuild automatically
```

### Building

```bash
# Build the library for production
pnpm run build

# Build the style guide for deployment
pnpm run styleguide:build

# The built files will be in:
# - dist/ (library)
# - styleguide/ (documentation)
```

### Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage

# Run linting
pnpm run lint

# Format code
pnpm run format
```

## Production Usage

### Using the Library

After installing the package, import the functions you need:

```javascript
import { getAllCatalogEntriesForRendering, getResourceData } from 'door43-preview-renderers';

// Your code here
```

### Using the CLI

#### Global Installation

```bash
# Install globally
npm install -g door43-preview-renderers

# Use the CLI command
door43-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen
```

#### Using npx (No Installation)

```bash
# Run directly with npx
npx door43-preview-renderers getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen
```

#### In CI/CD Pipelines

```bash
# Install as a dev dependency
npm install --save-dev door43-preview-renderers

# Use in package.json scripts
{
  "scripts": {
    "fetch-data": "door43-renderers getAllCatalogEntries --owner myorg --repo myrepo --ref main --quiet"
  }
}

# Or use directly in CI
node_modules/.bin/door43-renderers getAllCatalogEntries --owner myorg --repo myrepo --ref main --output data.json
```

## Project Structure

```
door43-preview-renderers/
├── src/
│   ├── index.js                              # Main entry point
│   ├── cli.js                                # Command-line interface
│   ├── constants.js                          # Bible books and resource constants
│   ├── getResourceData.js                    # Core resource data fetching
│   ├── getAllCatalogEntriesForRendering.js   # Catalog entries with dependencies
│   ├── api/                                  # API client modules
│   ├── renderers/                            # HTML rendering components
│   └── converters/                           # Content format converters
├── docs/                                     # Documentation markdown files
│   ├── introduction.md
│   ├── constants.md                          # Constants documentation
│   ├── get-resource-data.md
│   ├── get-all-catalog-entries-for-rendering.md
│   └── ...
├── dist/                                     # Built library files (generated)
├── styleguide/                               # Built style guide (generated)
└── package.json
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [unfoldingWord](https://github.com/unfoldingWord)

## Links

- [GitHub Repository](https://github.com/unfoldingWord/door43-preview-renderers)
- [Documentation](https://door43-preview-renderers.netlify.app)
- [Issue Tracker](https://github.com/unfoldingWord/door43-preview-renderers/issues)
