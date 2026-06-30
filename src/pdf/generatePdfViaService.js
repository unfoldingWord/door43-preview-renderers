import axios from 'axios';
import { writeFile } from 'node:fs/promises';

/**
 * Generate a PDF by POSTing a complete HTML document to a remote WeasyPrint HTTP
 * service (e.g. the weasyprint-service in door43-preview-app). The service runs
 * WeasyPrint and returns the PDF bytes, so environments without the local
 * `weasyprint` binary (a browser,
 * or a Node host that can't install it — e.g. a serverless deploy) can still get a
 * real, high-fidelity PDF.
 *
 * Contract: `POST <pdfServiceUrl>` with `Content-Type: text/html` and the HTML as
 * the body; the response body is the PDF (`application/pdf`).
 *
 * @param {string} html - Complete HTML document (e.g. assemblePrintDocument().html)
 * @param {Object} options
 * @param {string} options.pdfServiceUrl - URL of the HTML→PDF service
 * @param {string} [options.outputPath] - If set, write the PDF here and resolve with this path
 * @param {number} [options.timeoutMs] - Request timeout (default 120000)
 * @returns {Promise<Buffer|string>} PDF bytes, or the outputPath when `outputPath` is given
 */
export async function generatePdfViaService(html, options = {}) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('generatePdfViaService: `html` must be a non-empty HTML string.');
  }

  const { pdfServiceUrl, outputPath, timeoutMs = 120000 } = options;
  if (!pdfServiceUrl) {
    throw new Error('generatePdfViaService: `pdfServiceUrl` is required.');
  }

  let response;
  try {
    response = await axios.post(pdfServiceUrl, html, {
      headers: { 'Content-Type': 'text/html' },
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (e) {
    const status = e.response?.status;
    // The service returns the error text in the body when it can.
    const detail =
      e.response?.data && Buffer.isBuffer(e.response.data)
        ? Buffer.from(e.response.data).toString('utf8').slice(0, 500)
        : e.message;
    throw new Error(
      `generatePdfViaService: PDF service request failed${status ? ` (${status})` : ''} at ${pdfServiceUrl}: ${detail}`
    );
  }

  const pdf = Buffer.from(response.data);
  if (outputPath) {
    await writeFile(outputPath, pdf);
    return outputPath;
  }
  return pdf;
}
