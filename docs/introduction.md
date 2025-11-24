# Introduction

Welcome to **Door43 Preview Renderers** documentation!

This library provides a comprehensive solution for fetching, converting, and rendering content from Door43 repositories into HTML snippets suitable for web previews and PDF generation.

## What is Door43?

Door43 is a platform for Bible translation and related resources. This library helps developers integrate Door43 content into their applications.

## Key Concepts

### API Client
The API client module handles all communication with repository sources, fetching content from various locations.

### Renderers
Renderers transform processed content into HTML snippets that can be displayed in web applications or converted to PDFs.

### Converters
Converters handle format-specific transformations, such as Markdown to HTML or USFM parsing.

## Getting Started

```javascript
import { fetchResource, renderHTML } from 'door43-preview-renderers';

// Fetch content from a Door43 repository
const content = await fetchResource({
  owner: 'unfoldingWord',
  repo: 'en_ult',
  ref: 'master',
});

// Render the content as HTML
const html = renderHTML(content);
```

## Architecture

The library is designed with modularity in mind:

- **src/api/** - API communication layer
- **src/renderers/** - HTML rendering logic
- **src/converters/** - Format conversion utilities

This separation allows you to use only the parts you need and extend functionality easily.
