/**
 * Print Document Assembler
 *
 * Assembles rendered HTML sections (cover, copyright, TOC, body) into a single
 * print-ready HTML document with CSS Paged Media rules compatible with PagedJS.
 *
 * The TOC uses `target-counter(attr(href), page)` to display page numbers,
 * which PagedJS polyfills at render time.
 */

import { LOGO_DATA_URIS } from '../assets/logos.generated.js';

const LOGO_CDN_BASE = 'https://cdn.door43.org/assets/uw-icons';

/**
 * Resolve a logo filename to an inline data URI bundled in the package, falling
 * back to the CDN URL if it isn't bundled. Inlining keeps PDF/HTML rendering
 * fully offline (no network fetch for the cover logo at render time).
 */
function resolveLogoSrc(logoFile) {
  return LOGO_DATA_URIS[logoFile] || `${LOGO_CDN_BASE}/${logoFile}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ─── Page Size Constants ────────────────────────────────────────────────────

export const PAGE_SIZES = {
  A4_PORTRAIT: { label: 'A4', orientation: 'portrait', width: '210mm', height: '297mm' },
  A4_LANDSCAPE: { label: 'A4', orientation: 'landscape', width: '297mm', height: '210mm' },
  A5_PORTRAIT: { label: 'A5', orientation: 'portrait', width: '148.5mm', height: '210mm' },
  US_LETTER_PORTRAIT: { label: 'US Letter', orientation: 'portrait', width: '8.5in', height: '11in' },
  US_LETTER_LANDSCAPE: { label: 'US Letter', orientation: 'landscape', width: '11in', height: '8.5in' },
  TRADE: { label: 'Trade', orientation: 'portrait', width: '6in', height: '9in' },
  CROWN_QUARTO: { label: 'Crown Quarto', orientation: 'portrait', width: '189mm', height: '246mm' },
};

/**
 * Resolve a page-size option into { width, height }.
 *
 * Accepts:
 *  - a PAGE_SIZES key, e.g. 'A4_PORTRAIT', 'US_LETTER_LANDSCAPE'
 *  - a friendly label, e.g. 'A4', 'US Letter', 'Trade' (portrait assumed)
 *  - an explicit { width, height } object (CSS lengths, e.g. '6in', '210mm')
 * Falls back to A4 portrait.
 */
export function resolvePageSize(pageSize) {
  if (pageSize && typeof pageSize === 'object' && pageSize.width && pageSize.height) {
    return { width: pageSize.width, height: pageSize.height };
  }
  if (typeof pageSize === 'string') {
    if (PAGE_SIZES[pageSize]) return PAGE_SIZES[pageSize];
    const byLabel = Object.values(PAGE_SIZES).find(
      (s) => s.label.toLowerCase() === pageSize.toLowerCase() && s.orientation === 'portrait'
    );
    if (byLabel) return byLabel;
  }
  return PAGE_SIZES.A4_PORTRAIT;
}

// ─── Logo mapping ───────────────────────────────────────────────────────────

const ABBREVIATION_TO_LOGO = {
  ta: 'uta',
  tn: 'utn',
  tq: 'utq',
  tw: 'utw',
  ult: 'ult',
  ust: 'ust',
  glt: 'ult',
  gst: 'ust',
  obs: 'obs',
  'obs-sn': 'obs',
  'obs-sq': 'obs',
  'obs-tn': 'obs',
  'obs-tq': 'obs',
};

// ─── TOC Generation ─────────────────────────────────────────────────────────

/**
 * Build TOC HTML from the structured toc array returned by renderers.
 *
 * Supports flat arrays `[{ id, title }]` and nested arrays with `sections`.
 *
 * @param {Array<Object>} tocData - TOC data from renderer sections.toc
 * @returns {string} HTML for the TOC page
 */
export function generateTocHtml(tocData) {
  if (!Array.isArray(tocData) || tocData.length === 0) {
    return '';
  }

  const listItems = tocData.map((entry) => buildTocEntry(entry)).join('\n');

  return `
<h1 class="header toc-header">Table of Contents</h1>
<div id="toc-contents">
  <ul class="toc-section top-toc-section">
    ${listItems}
  </ul>
</div>`;
}

/**
 * Build a single TOC entry (recursive for nested sections).
 *
 * @param {Object} entry - TOC entry { id, title, sections? }
 * @returns {string} HTML <li> element
 */
function buildTocEntry(entry) {
  if (!entry || !entry.id) return '';

  let html = `<li class="toc-entry">
  <a class="toc-element" href="#${entry.id}"><span class="toc-element-title">${escapeHtml(entry.title || '')}</span></a>
</li>`;

  // Recurse into nested sections (TA/TW manuals)
  if (Array.isArray(entry.sections) && entry.sections.length > 0) {
    const childItems = entry.sections.map((child) => buildTocEntry(child)).join('\n');
    html += `\n<ul class="toc-section">
  ${childItems}
</ul>`;
  }

  return html;
}

/**
 * Fallback: extract TOC entries from HTML body by scanning for elements
 * with both `data-toc-title` and `id` attributes.
 *
 * This is a regex-based approach for headless Node.js (no DOM).
 * It handles the flat `data-toc-title` pattern used by all renderers.
 *
 * @param {string} bodyHtml - The body HTML string
 * @returns {string} HTML for the TOC page
 */
export function generateTocFromHtml(bodyHtml) {
  if (!bodyHtml) return '';

  // Match elements with both id and data-toc-title (in either order)
  const pattern = /<[^>]+?\bid="([^"]+)"[^>]*?\bdata-toc-title="([^"]+)"[^>]*?>|<[^>]+?\bdata-toc-title="([^"]+)"[^>]*?\bid="([^"]+)"[^>]*?>/g;

  const entries = [];
  let match;
  while ((match = pattern.exec(bodyHtml)) !== null) {
    const id = match[1] || match[4];
    const title = match[2] || match[3];
    if (id && title) {
      entries.push({ id, title });
    }
  }

  if (entries.length === 0) return '';

  return generateTocHtml(entries);
}

// ─── Appendices ──────────────────────────────────────────────────────────────

const APPENDIX_LABELS = { ta: 'Translation Academy', tw: 'Translation Words' };

/**
 * Render the keyed appendices object ({ ta: { id: { title, html } }, tw: {…} })
 * into HTML: one `<section class="appendix <kind>">` per kind, with a heading and
 * the collected article HTML. Returns '' when there are no appendices.
 *
 * @param {Object} appendices - sections.appendices from a renderer
 * @returns {string}
 */
export function renderAppendicesHtml(appendices) {
  if (!appendices || typeof appendices !== 'object') return '';

  let html = '';
  for (const kind of Object.keys(appendices)) {
    const articles = appendices[kind] || {};
    const ids = Object.keys(articles);
    if (!ids.length) continue;

    const label = APPENDIX_LABELS[kind] || kind.toUpperCase();
    html += `<section class="appendix ${kind}" id="appendix-${kind}" data-toc-title="${escapeHtml(label)}">\n`;
    html += `  <h2 class="appendix-header">${escapeHtml(label)}</h2>\n`;
    for (const id of ids) {
      html += articles[id]?.html || '';
    }
    html += `</section>\n`;
  }
  return html;
}

// ─── Cover Generation ───────────────────────────────────────────────────────

/**
 * Build a cover page with logo, title, version, and optional extra content.
 *
 * @param {Object} options
 * @param {string} options.title - Resource title
 * @param {string} [options.version] - Version/tag string
 * @param {string} [options.abbreviation] - Resource abbreviation for logo
 * @param {string} [options.extraCoverHtml] - Extra HTML for the cover (from renderer)
 * @returns {string} Cover page HTML
 */
export function buildCoverPage({ title, version, abbreviation, extraCoverHtml }) {
  let logoFile = 'uW-app-256.png';
  if (abbreviation && abbreviation in ABBREVIATION_TO_LOGO) {
    logoFile = `logo-${ABBREVIATION_TO_LOGO[abbreviation]}-256.png`;
  }

  return `
<span class="header-title"></span>
<img class="title-logo" src="${resolveLogoSrc(logoFile)}" alt="Logo">
<h1 class="header cover-header section-header">${escapeHtml(title || '')}</h1>
${version ? `<h3 class="cover-version">${escapeHtml(version)}</h3>` : ''}
${extraCoverHtml || ''}`;
}

/**
 * Centering CSS for the cover when rendered as a standalone web document
 * (the renderers' `fullHtml`). Print uses its own cover-page rules in
 * getPrintCss(); these rules are scoped to `.cover-page` so they only affect
 * the cover block, not the rest of the page.
 */
export const coverCss = `
.cover-page {
  text-align: center;
  padding-top: 2rem;
}

.cover-page .header-title {
  display: none;
}

.cover-page .title-logo {
  display: block;
  margin: 0 auto 1rem auto;
  width: 180px;
  max-width: 60%;
  height: auto;
}

.cover-page .cover-header,
.cover-page .cover-version,
.cover-page .cover-book-title,
.cover-page .cover-resource-title {
  text-align: center;
  margin-left: auto;
  margin-right: auto;
}

.cover-page .cover-version {
  color: #666;
  font-weight: normal;
}
`;

// ─── Print CSS ──────────────────────────────────────────────────────────────

/**
 * Generate CSS for PagedJS print rendering.
 *
 * @param {Object} [options]
 * @param {string} [options.pageWidth] - Page width (e.g. '210mm', '8.5in')
 * @param {string} [options.pageHeight] - Page height (e.g. '297mm', '11in')
 * @param {number} [options.columns] - Number of text columns for body content
 * @param {string} [options.direction] - Text direction: 'ltr' or 'rtl'
 * @param {string} [options.extraCss] - Additional CSS to append
 * @returns {string} Complete print CSS string
 */
export function getPrintCss(options = {}) {
  const {
    pageWidth = '210mm',
    pageHeight = '297mm',
    columns = 1,
    direction = 'ltr',
    extraCss = '',
  } = options;

  const isRtl = direction === 'rtl';

  return `
/* ─── Page Setup ─────────────────────────────────────────── */

@page {
  size: ${pageWidth} ${pageHeight};
  margin: 1cm;

  @footnote {
    float: bottom;
    border-top: black 1px solid;
    padding-top: 2mm;
    font-size: 8pt;
  }

  @bottom-center {
    content: counter(page);
  }
}

@page :first {
  @bottom-center { content: none; }
}

@page :blank {
  @bottom-center { content: none; }
  @top-center { content: none; }
  @top-left { content: none; }
  @top-right { content: none; }
}

/* Named page (assigned via the page property). Note: no colon — a colon would
   make it a pseudo-class selector, which WeasyPrint/Prince ignore, leaving the
   cover with running headers/footers. */
@page cover-page {
  @bottom-center { content: none; }
  @top-center { content: none; }
  @top-left { content: none; }
  @top-right { content: none; }
}

@page :left {
  margin-right: 30mm;
  margin-left: 20mm;

  @top-left {
    font-size: 10px;
    content: string(doctitle);
    text-align: left;
  }
}

@page :right {
  margin-left: 30mm;
  margin-right: 20mm;

  @top-right {
    font-size: 10px;
    content: string(doctitle);
    text-align: right;
  }
}

/* ─── Running Header ─────────────────────────────────────── */
/* The running title is captured from the cover header via string-set and
   echoed into the page margin boxes with string(). This works natively in
   WeasyPrint/Prince and in the PagedJS browser preview — no JS reflow needed
   for the header, and no positioned running element. */

.cover-header {
  string-set: doctitle content(text);
}

/* ─── Footnotes (USFM) ──────────────────────────────────── */

span.paras_usfm_f {
  float: footnote;
}

::footnote-call {
  font-weight: 700;
  font-size: 1em;
  line-height: 0;
}

::footnote-marker {
  font-weight: 700;
  line-height: 0;
  font-style: italic !important;
}

.pagedjs_footnote_area * {
  background-color: white !important;
}

a.footnote {
  font-style: italic !important;
}

/* ─── Columns ────────────────────────────────────────────── */
/* Target the section directly (no .pagedjs_pages wrapper) so columns apply
   under WeasyPrint/Prince as well as in the PagedJS preview. */

.section.bible-book {
  columns: ${columns};
}

/* ─── Page Breaks ────────────────────────────────────────── */

h1 {
  break-before: avoid;
}

h1, h2, h3, h4, h5, h6 {
  break-after: avoid;
  page-break-after: avoid;
}

.section,
.article {
  break-after: page !important;
}

.section {
  break-before: page !important;
}

.section > .section:first-child {
  break-before: auto !important;
}

.header + * {
  break-before: auto !important;
}

.section.toc-page,
.section.copyright-page {
  break-before: page;
}

/* ─── Cover Page ─────────────────────────────────────────── */

.cover-page,
.title-page {
  page: cover-page;
  padding-top: 100px;
}

.cover-page {
  text-align: center;
}

.header-title {
  display: none;
}

/* ─── Table of Contents ──────────────────────────────────── */

#toc {
  font-size: 12px;
}

#toc h1 {
  text-align: center;
  font-size: 1.6em;
}

#toc-contents ul {
  list-style: none;
  padding: 0;
  padding-inline-start: 0;
}

#toc-contents ul ul {
  padding-left: ${isRtl ? '0' : '10px'};
  ${isRtl ? 'padding-right: 10px;' : ''}
}

#toc-contents ul li {
  width: 100%;
  list-style-type: none;
  padding-bottom: 0;
  line-height: 1em;
}

#toc-contents ul a {
  display: inline-block;
  width: 100%;
  border-bottom: 2px dotted #555555;
  text-decoration: none;
  color: #000 !important;
}

#toc-contents > ul > li > a {
  font-weight: bold;
}

#toc-contents ul a span {
  background-color: white;
  margin: ${isRtl ? '0 0 0 25px' : '0 25px 0 0'};
  padding: ${isRtl ? '0 0 3px 2px' : '0 2px 3px 0'};
}

#toc-contents ul a::after {
  position: absolute;
  ${isRtl ? 'left: 0; right: auto;' : 'right: 0;'}
  content: target-counter(attr(href), page);
  background-color: white;
  padding-bottom: 4px;
  ${isRtl ? 'padding-right: 2px; padding-left: 30px;' : 'padding-left: 2px; padding-right: 10px;'}
}

/* ─── General Typography ─────────────────────────────────── */

h1 {
  font-size: 1.6em;
}

${extraCss}
`;
}

// ─── Document Assembly ──────────────────────────────────────────────────────

/**
 * Assemble rendered HTML sections into a print-ready document.
 *
 * Produces a complete HTML document that can be:
 *  1. Opened in a browser with the PagedJS polyfill for print preview
 *  2. Rendered by Puppeteer + PagedJS for PDF generation
 *
 * @param {Object} sections - Rendered sections from a renderer
 * @param {string} sections.cover - Cover page HTML snippet
 * @param {string} sections.copyright - Copyright page HTML
 * @param {string} sections.body - Main content body HTML
 * @param {Array<Object>} [sections.toc] - Structured TOC data array
 * @param {Object} [sections.css] - CSS strings { web, print }
 * @param {Object} [options]
 * @param {string} [options.title] - Document title
 * @param {string} [options.version] - Version/tag for cover page
 * @param {string} [options.abbreviation] - Abbreviation for logo selection
 * @param {string} [options.pageWidth] - Page width
 * @param {string} [options.pageHeight] - Page height
 * @param {number} [options.columns] - Number of columns
 * @param {string} [options.direction] - 'ltr' or 'rtl'
 * @param {boolean} [options.includePagedJsPolyfill] - Include <script> tag for PagedJS polyfill
 * @param {string} [options.pagedJsUrl] - Custom PagedJS polyfill URL
 * @param {string} [options.footerHtml] - Optional footer HTML (e.g., app version)
 * @returns {Object} { html, css } where html is the complete document and css is the print CSS
 */
export function assemblePrintDocument(sections, options = {}) {
  const {
    title = 'Document',
    version = '',
    abbreviation = '',
    pageWidth = '210mm',
    pageHeight = '297mm',
    columns = 1,
    direction = 'ltr',
    // 'weasyprint' (or 'prince'): native paged-media engine, no JS polyfill.
    // 'pagedjs': inject the PagedJS polyfill for in-browser preview/PDF.
    engine = 'weasyprint',
    // Polyfill is only relevant for the PagedJS engine; default off otherwise.
    includePagedJsPolyfill = engine === 'pagedjs',
    pagedJsUrl = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js',
    footerHtml = '',
  } = options;

  const {
    cover: coverSnippet = '',
    copyright = '',
    body = '',
    toc: tocData = [],
    css = {},
    appendices = null,
  } = sections;

  // Prefer the renderer-provided cover (now a complete logo + title + version
  // cover); fall back to building one from the options for callers that pass
  // only a short snippet or none at all.
  const cover = coverSnippet || buildCoverPage({ title, version, abbreviation });

  // Build TOC
  let tocHtml;
  if (Array.isArray(tocData) && tocData.length > 0) {
    tocHtml = generateTocHtml(tocData);
  } else {
    // Fallback: extract from body HTML
    tocHtml = generateTocFromHtml(body);
  }

  // Build CSS
  const rendererWebCss = css.web || '';
  const rendererPrintCss = css.print || '';
  const printCss = getPrintCss({
    pageWidth,
    pageHeight,
    columns,
    direction,
    extraCss: `${rendererWebCss}\n\n${rendererPrintCss}`,
  });

  // Assemble the document sections
  const htmlStr = `<div id="pagedjs-print" style="direction: ${direction}" data-direction="${direction}">
  <div class="section cover-page">
    ${cover}
  </div>
  <div class="section copyright-page" id="copyright-page">
    ${copyright}
    ${footerHtml}
  </div>
  <div class="section toc-page" id="toc">
    ${tocHtml}
  </div>
  ${body}
  ${renderAppendicesHtml(appendices)}
</div>`;

  // Build complete HTML document
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}${version ? ` - ${escapeHtml(version)}` : ''}</title>
  ${includePagedJsPolyfill ? `<script src="${escapeHtml(pagedJsUrl)}"></script>` : ''}
  <style>
${printCss}
  </style>
</head>
<body>
  ${htmlStr}
</body>
</html>`;

  return {
    html: fullHtml,
    css: printCss,
    innerHtml: htmlStr,
  };
}
