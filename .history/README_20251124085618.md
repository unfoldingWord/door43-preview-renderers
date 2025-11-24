# Door43 Preview Renderers

A JavaScript library for gathering content from various repositories and rendering HTML snippets for web previews and PDFs of translation resources.

## Features

- 🔌 API client for fetching content from Door43 repositories
- 🎨 Multiple converters for different content formats
- 📝 HTML snippet generation for web previews
- 📄 PDF-ready rendering
- ⚡ Modular and extensible architecture

## Installation

```bash
# Using pnpm (recommended)
pnpm add door43-preview-renderers

# Using npm
npm install door43-preview-renderers

# Using yarn
yarn add door43-preview-renderers
```

## Usage

```javascript
import { fetchResource, renderHTML } from 'door43-preview-renderers';

// Fetch content from a repository
const content = await fetchResource({
  owner: 'unfoldingWord',
  repo: 'en_ult',
  ref: 'master',
});

// Render HTML snippet
const html = renderHTML(content);
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

# Start the development server
pnpm run dev

# Run the style guide locally
pnpm run styleguide
```

### Building

```bash
# Build the library
pnpm run build

# Build the style guide for deployment
pnpm run styleguide:build
```

### Testing

```bash
# Run tests
pnpm test

# Run linting
pnpm run lint

# Format code
pnpm run format
```

## Documentation

Visit the [live documentation](https://door43-preview-renderers.netlify.app) to see examples and API references.

## Project Structure

```
door43-preview-renderers/
├── src/
│   ├── index.js              # Main entry point
│   ├── api/                  # API client modules
│   ├── renderers/            # HTML rendering components
│   └── converters/           # Content format converters
├── docs/                     # Documentation markdown files
├── dist/                     # Built library files (generated)
├── styleguide/              # Built style guide (generated)
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
