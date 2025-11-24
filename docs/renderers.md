# Renderers

Renderers are responsible for converting processed content into HTML format suitable for display or PDF generation.

## HTML Renderer

The HTML renderer provides flexible options for generating HTML snippets.

### Basic Usage

```js static
import { renderHTML } from 'door43-preview-renderers';

// Simple string rendering
const html = renderHTML('Your content here');
```

### With Options

```js static
const html = renderHTML(content, {
  className: 'custom-preview',
  styles: {
    padding: '20px',
    'background-color': '#f5f5f5',
  },
});
```

## Snippet Generator

Create complete HTML documents with metadata:

```js static
import { createHTMLSnippet } from 'door43-preview-renderers';

const snippet = createHTMLSnippet({
  content: '<p>Your content</p>',
  title: 'Document Title',
  metadata: {
    author: 'unfoldingWord',
    language: 'en',
  },
});
```
