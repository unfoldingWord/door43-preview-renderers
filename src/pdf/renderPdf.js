import { resolvePageSize } from '../renderers/printDocumentAssembler.js';
import { renderHTML } from '../renderHTML.js';
import { generatePdf } from './generatePdf.js';
import { generatePdfViaService } from './generatePdfViaService.js';

// resolvePageSize now lives with PAGE_SIZES in printDocumentAssembler.js so the
// browser-safe renderHTML composer can use it without importing this Node module.
export { resolvePageSize };

/**
 * Render a print-ready PDF from a renderHtmlData() result.
 *
 * Pipeline: renderHTML(htmlData, { media: 'print' }) → WeasyPrint (generatePdf).
 * The print document is the one renderHTML composes — cover, copyright, TOC,
 * appendices, @page CSS, running headers by subject — so a PDF and the print
 * HTML take the same options and cannot drift apart. WeasyPrint renders the
 * paged document natively (no browser, no PagedJS reflow).
 *
 * Requires the `weasyprint` binary on PATH (or pass `options.weasyprintPath`).
 *
 * @param {Object} renderResult - The object returned by renderHtmlData()
 *   (uses `renderResult.sections`; `title`/`abbreviation`/`version` seed cover fallbacks)
 * @param {Object} [options] - renderHTML's composition options (`show`, `columns`,
 *   `language`, `direction`, `print.*`; `media` is always 'print'), plus:
 * @param {string} [options.title] - Cover title override (defaults to renderResult.title)
 * @param {string} [options.version] - Cover version override
 * @param {string} [options.abbreviation] - Cover abbreviation override (logo selection)
 * @param {string} [options.outputPath] - Write the PDF here instead of returning bytes
 * @param {string} [options.pdfServiceUrl] - If set, POST the assembled HTML to a remote
 *   WeasyPrint HTTP service (HTML in, PDF out) instead of using the local binary —
 *   for hosts/browsers without `weasyprint` installed.
 * @param {string} [options.weasyprintPath] - Path/name of the weasyprint binary (local mode)
 * @param {string} [options.baseUrl] - Base URL for resolving relative resources (local mode)
 * @param {number} [options.timeoutMs] - Kill WeasyPrint / time out the request after this many ms
 * @param {boolean} [options.quiet] - Suppress WeasyPrint stderr in the error message (local mode)
 * @returns {Promise<Buffer|string>} PDF bytes, or the outputPath when `outputPath` is given
 */
export async function renderPdf(renderResult, options = {}) {
  if (!renderResult || typeof renderResult !== 'object' || !renderResult.sections) {
    throw new Error(
      'renderPdf: expected the result of renderHtmlData() with a `sections` property.'
    );
  }

  const {
    title,
    version,
    abbreviation,
    // delivery
    pdfServiceUrl,
    outputPath,
    weasyprintPath,
    baseUrl,
    timeoutMs,
    quiet,
    ...composeOptions
  } = options;

  const html = renderHTML(
    {
      ...renderResult,
      title: title ?? renderResult.title,
      version: version ?? renderResult.version,
      abbreviation: abbreviation ?? renderResult.abbreviation,
    },
    { ...composeOptions, media: 'print', engine: 'weasyprint' }
  );

  // Remote service (no local binary needed) vs the local `weasyprint` binary.
  if (pdfServiceUrl) {
    return generatePdfViaService(html, { pdfServiceUrl, outputPath, timeoutMs });
  }
  return generatePdf(html, { outputPath, weasyprintPath, baseUrl, timeoutMs, quiet });
}
