# Converters

Converters transform content from one format to another, enabling the library to work with various source formats.

## Markdown Converter

Convert Markdown content to HTML:

```javascript
import { convertMarkdown } from 'door43-preview-renderers';

// Convert markdown to HTML
const markdown = '# Hello World\n\nThis is **bold** text.';
const html = convertMarkdown(markdown);
```

## USFM Parser

Parse USFM (Unified Standard Format Markers) content used in Bible translations:

```javascript
import { parseUSFM } from 'door43-preview-renderers';

const usfm = '\\id GEN\n\\c 1\n\\v 1 In the beginning...';
const parsed = parseUSFM(usfm);
```

## Custom Converters

You can create custom converters by following the same pattern:

```javascript
export function convertCustomFormat(content, options = {}) {
  // Your conversion logic here
  return convertedContent;
}
```
