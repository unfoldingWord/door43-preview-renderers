import {
  assemblePrintDocument,
  resolvePageSize,
  generateTocHtml,
} from './renderers/printDocumentAssembler.js';
import { resolveComposeOptions } from './renderOptions.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Compose an HtmlData package (from renderHtmlData) into a single self-contained
 * HTML document for the chosen media target.
 *
 * Pure, synchronous, no I/O — runs identically in the browser and Node. The
 * options decide which sections appear and how (see docs/rendering-pipeline.md
 * §4.4 / §6). `media: 'screen'` (default) yields a continuous-flow document and
 * omits cover/copyright/toc by default; `media: 'print'` yields a paged,
 * PagedJS/WeasyPrint-ready document with cover/copyright/toc.
 *
 * @param {Object} htmlData - Output of renderHtmlData(): { title, version, abbreviation, direction, sections }
 * @param {Object} [options] - Composition options (docs §6)
 * @returns {string} A complete HTML document string
 */
export function renderHTML(htmlData, options = {}) {
  if (!htmlData || !htmlData.sections) {
    throw new Error('renderHTML: expected the result of renderHtmlData() with a `sections` property.');
  }

  const opts = resolveComposeOptions(options, htmlData);

  if (opts.media === 'print') {
    const size = resolvePageSize(opts.print.pageSize);
    const assembled = assemblePrintDocument(htmlData.sections, {
      title: htmlData.title,
      version: htmlData.version,
      abbreviation: htmlData.abbreviation,
      pageWidth: size.width,
      pageHeight: size.height,
      columns: opts.columns,
      direction: opts.direction,
      engine: options.engine || 'weasyprint',
      footerHtml: opts.print.footerHtml,
    });
    return assembled.html;
  }

  return buildScreenDocument(htmlData, opts);
}

/**
 * Build a continuous-flow (screen) document from the selected sections.
 * The TOC *data* is always available on htmlData.sections.toc for an app's
 * interactive selector; a static TOC block is only emitted when `show.toc`.
 */
function buildScreenDocument(htmlData, opts) {
  const { sections } = htmlData;
  const css = sections.css?.web || '';
  const dir = opts.direction;
  // Resource-level anchor (e.g. `#tn`) so the app can scroll to the whole resource.
  const resourceId = htmlData.abbreviation ? ` id="${escapeHtml(htmlData.abbreviation)}"` : '';
  const parts = [];

  if (opts.show.cover && sections.cover) {
    parts.push(`<div class="section cover-page">${sections.cover}</div>`);
  }
  if (opts.show.copyright && sections.copyright) {
    parts.push(`<div class="section copyright-page">${sections.copyright}</div>`);
  }
  if (opts.show.toc && Array.isArray(sections.toc) && sections.toc.length) {
    parts.push(`<div class="section toc-page" id="toc">${generateTocHtml(sections.toc)}</div>`);
  }
  if (opts.show.body && sections.body) {
    parts.push(sections.body);
  }
  // Appendices keyed by kind (Phase 1b). Until renderers populate
  // sections.appendices, the body already carries them inline.
  if (opts.show.appendices && sections.appendices && typeof sections.appendices === 'object') {
    for (const kind of Object.keys(sections.appendices)) {
      const articles = sections.appendices[kind] || {};
      for (const id of Object.keys(articles)) {
        const article = articles[id] || {};
        parts.push(`<section class="appendix ${escapeHtml(kind)}" id="${escapeHtml(id)}">${article.html || ''}</section>`);
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="en" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(htmlData.title || 'Document')}</title>
  <style>${css}</style>
</head>
<body>
  <div class="door43-preview"${resourceId} dir="${dir}" data-direction="${dir}">
${parts.join('\n')}
  </div>
</body>
</html>`;
}
