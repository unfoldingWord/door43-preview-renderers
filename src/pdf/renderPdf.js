import { assemblePrintDocument, resolvePageSize } from '../renderers/printDocumentAssembler.js';
import { generatePdf } from './generatePdf.js';

// resolvePageSize now lives with PAGE_SIZES in printDocumentAssembler.js so the
// browser-safe renderHTML composer can use it without importing this Node module.
export { resolvePageSize };

/**
 * Render a print-ready PDF from a renderHtmlData() result.
 *
 * Pipeline: assemblePrintDocument(sections) → WeasyPrint (generatePdf). The
 * assembler builds the cover, copyright, TOC and @page CSS; WeasyPrint renders
 * the paged document natively (no browser, no PagedJS reflow).
 *
 * Requires the `weasyprint` binary on PATH (or pass `options.weasyprintPath`).
 *
 * @param {Object} renderResult - The object returned by renderHtmlData()
 *   (uses `renderResult.sections`; `title`/`abbreviation`/`version` seed cover fallbacks)
 * @param {Object} [options]
 * @param {string|{width:string,height:string}} [options.pageSize='A4_PORTRAIT'] - PDF page size
 * @param {number} [options.columns] - Number of body columns
 * @param {'ltr'|'rtl'} [options.direction] - Text direction
 * @param {string} [options.footerHtml] - Optional footer HTML (e.g. app version)
 * @param {string} [options.title] - Cover title override (defaults to renderResult.title)
 * @param {string} [options.version] - Cover version override
 * @param {string} [options.abbreviation] - Cover abbreviation override (logo selection)
 * @param {string} [options.outputPath] - Write the PDF here instead of returning bytes
 * @param {string} [options.weasyprintPath] - Path/name of the weasyprint binary
 * @param {string} [options.baseUrl] - Base URL for resolving relative resources
 * @param {number} [options.timeoutMs] - Kill WeasyPrint after this many ms
 * @param {boolean} [options.quiet] - Suppress WeasyPrint stderr in the error message
 * @returns {Promise<Buffer|string>} PDF bytes, or the outputPath when `outputPath` is given
 */
export async function renderPdf(renderResult, options = {}) {
  if (!renderResult || typeof renderResult !== 'object' || !renderResult.sections) {
    throw new Error('renderPdf: expected the result of renderHtmlData() with a `sections` property.');
  }

  const {
    pageSize = 'A4_PORTRAIT',
    columns,
    direction,
    footerHtml,
    title,
    version,
    abbreviation,
    // generatePdf passthrough
    outputPath,
    weasyprintPath,
    baseUrl,
    timeoutMs,
    quiet,
  } = options;

  const size = resolvePageSize(pageSize);

  const assembled = assemblePrintDocument(renderResult.sections, {
    title: title ?? renderResult.title,
    version: version ?? renderResult.version,
    abbreviation: abbreviation ?? renderResult.abbreviation,
    pageWidth: size.width,
    pageHeight: size.height,
    engine: 'weasyprint',
    ...(columns != null ? { columns } : {}),
    ...(direction != null ? { direction } : {}),
    ...(footerHtml != null ? { footerHtml } : {}),
  });

  return generatePdf(assembled.html, { outputPath, weasyprintPath, baseUrl, timeoutMs, quiet });
}
