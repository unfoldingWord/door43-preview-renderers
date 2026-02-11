# Renderers

Renderers are responsible for converting processed content into HTML format suitable for display or PDF generation.

## Subject Renderer Pipeline

Use `renderHtmlData()` when you want a subject-aware rendering pipeline:

```js static
import { renderHtmlData } from 'door43-preview-renderers';

const rendered = await renderHtmlData('unfoldingWord', 'en_ult', 'v88', ['tit'], {
  dcs_api_url: 'https://git.door43.org/api/v1',
  renderOptions: {
    includeRawUsfmView: false,
    editorMode: false,
  },
});
```

`renderHtmlData()` currently supports these subjects:

- `Aligned Bible`
- `Bible`
- `Greek New Testament`
- `Hebrew Old Testament`
- `Translation Academy`
- `Translation Words`

It returns:

- `sections`: packaged HTML parts (`cover`, `body`, `toc`, `css`, optional `webView`)
- `fullHtml`: complete HTML document suitable for iframe/browser preview
- `resourceData`: original output from `getResourceData()`

## HTML Renderer

The HTML renderer provides flexible options for generating generic HTML snippets.

### Basic Usage

```js static
import { renderHTML } from 'door43-preview-renderers';

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

## Interactive Demo

Use the interactive component on this page to fetch and render a live Bible resource and inspect both:

- packaged HTML/CSS JSON values
- full rendered output in an iframe
