import { getAllCatalogEntries } from './getAllCatalogEntries.js';
import { resolveRef } from './findResources.js';
import { getResourceData } from './getResourceData.js';
import { renderHtmlData } from './renderHtmlData.js';
import { renderHTML } from './renderHTML.js';
import { renderPdf } from './pdf/renderPdf.js';

// The request keys that name the resource; everything else is a stage's option.
const SOURCE_KEYS = ['owner', 'repo', 'ref', 'books', 'lang', 'subject', 'stage'];

/**
 * Render a resource in one call: the whole pipeline, from a repository or a
 * language to an HTML document or a PDF.
 *
 *   getAllCatalogEntries → getResourceData → renderHtmlData → renderHTML | renderPdf
 *
 * The request names the resource the way getAllCatalogEntries() does — `{ owner,
 * repo, ref?, books? }`, or `{ lang, subject, books?, owner?, stage?, ref? }` to
 * find the publisher — and carries every stage's options in the same object;
 * each stage reads its own (`dcsApiUrl`, `quiet`, `extraSubjects`,
 * `renderOptions`, `media`, `show`, `print`, `outputPath`, …). An owner/repo
 * without a ref renders the latest release. The blueprint is fetched once.
 *
 * @param {Object} request
 * @param {'html'|'pdf'} [request.output='html'] - An HTML document (`media`
 *   'screen' or 'print', as renderHTML) or a PDF (renderPdf: WeasyPrint, or the
 *   service at `pdfServiceUrl`)
 * @returns {Promise<string|Buffer>} The HTML string; for a PDF, its bytes, or
 *   `outputPath` when one is given
 *
 * @example
 * const html = await renderPreview({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91', books: ['tit'] });
 * const pdf = await renderPreview({ lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'], output: 'pdf', outputPath: 'tit.pdf' });
 */
export async function renderPreview(request = {}) {
  if (!request || typeof request !== 'object') {
    throw new Error('renderPreview: expected a request object.');
  }
  const output = request.output || 'html';
  if (output !== 'html' && output !== 'pdf') {
    throw new Error(
      `renderPreview: output must be 'html' or 'pdf', not ${JSON.stringify(output)}.`
    );
  }
  const source = {};
  const options = {};
  for (const [key, value] of Object.entries(request)) {
    if (key === 'output') continue;
    if (SOURCE_KEYS.includes(key)) source[key] = value;
    else options[key] = value;
  }
  const byLanguage = Boolean(source.lang && source.subject);
  if (!byLanguage && !(source.owner && source.repo)) {
    throw new Error('renderPreview: name the resource with owner and repo, or lang and subject.');
  }
  if (!byLanguage && !source.ref) {
    source.ref = (await resolveRef(source, options)).ref;
  }

  const set = await getAllCatalogEntries(source, options);
  // A copy: getResourceData notes the set's entries on the options it is given.
  const resourceData = await getResourceData(set, { ...options });
  if (resourceData?.error) throw new Error(`renderPreview: ${resourceData.error}`);
  const htmlData = renderHtmlData(resourceData, { ...options, books: set.source?.books });

  return output === 'pdf' ? renderPdf(htmlData, options) : renderHTML(htmlData, options);
}
