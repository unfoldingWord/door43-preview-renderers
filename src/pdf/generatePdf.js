import { spawn } from 'node:child_process';
import { once } from 'node:events';

/**
 * Generate a PDF from a complete HTML document using WeasyPrint.
 *
 * WeasyPrint is a native CSS Paged Media engine (no web browser, no JS reflow),
 * so it renders the @page rules, running headers (string()), TOC page numbers
 * (target-counter), footnotes and internal anchor links that this package emits.
 *
 * The HTML is piped to WeasyPrint on stdin. By default the PDF is returned as a
 * Buffer; pass `outputPath` to write it to disk instead.
 *
 * Requires the `weasyprint` binary on PATH (or pass `weasyprintPath`). Install:
 *   pipx install weasyprint   (or)   brew install weasyprint
 *
 * @param {string} html - Complete HTML document (e.g. assemblePrintDocument().html)
 * @param {Object} [options]
 * @param {string} [options.outputPath] - If set, write the PDF here and resolve with this path
 * @param {string} [options.weasyprintPath] - Path/name of the weasyprint binary (default: env WEASYPRINT_BIN or 'weasyprint')
 * @param {string} [options.baseUrl] - Base URL for resolving relative resources in the HTML
 * @param {number} [options.timeoutMs] - Kill the process after this many ms (default: 120000)
 * @param {boolean} [options.quiet] - Suppress WeasyPrint stderr warnings from the rejection message
 * @returns {Promise<Buffer|string>} PDF bytes, or the outputPath when `outputPath` is given
 */
export async function generatePdf(html, options = {}) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('generatePdf: `html` must be a non-empty HTML string.');
  }

  const {
    outputPath,
    weasyprintPath = process.env.WEASYPRINT_BIN || 'weasyprint',
    baseUrl,
    timeoutMs = 120000,
    quiet = false,
  } = options;

  // weasyprint <input> <output>; "-" means stdin/stdout respectively.
  const args = [];
  if (baseUrl) args.push('--base-url', baseUrl);
  args.push('-', outputPath || '-');

  let child;
  try {
    child = spawn(weasyprintPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`generatePdf: failed to start WeasyPrint (${weasyprintPath}): ${e.message}`);
  }

  const stdoutChunks = [];
  const stderrChunks = [];
  child.stdout.on('data', (c) => stdoutChunks.push(c));
  child.stderr.on('data', (c) => stderrChunks.push(c));

  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);

  // Surface spawn errors (e.g. ENOENT) as a clear message.
  const errored = once(child, 'error').then(([err]) => {
    throw new Error(
      `generatePdf: WeasyPrint not found or failed to run (${weasyprintPath}). ` +
        `Install it (pipx install weasyprint / brew install weasyprint) or pass weasyprintPath. ` +
        `Original error: ${err.message}`
    );
  });

  child.stdin.on('error', () => {}); // ignore EPIPE if weasyprint exits early
  child.stdin.end(html);

  const closed = once(child, 'close').then(([code]) => code);

  let code;
  try {
    code = await Promise.race([closed, errored]);
  } finally {
    clearTimeout(timer);
  }

  if (code !== 0) {
    const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
    throw new Error(
      `generatePdf: WeasyPrint exited with code ${code}.` + (quiet || !stderr ? '' : `\n${stderr}`)
    );
  }

  if (outputPath) return outputPath;
  return Buffer.concat(stdoutChunks);
}

/**
 * Convenience: assemble rendered sections into a print document and render a PDF.
 * Avoids a circular import by taking assemblePrintDocument's output directly.
 *
 * @param {{ html: string }} assembled - Result of assemblePrintDocument(sections, ...)
 * @param {Object} [pdfOptions] - Options forwarded to generatePdf()
 * @returns {Promise<Buffer|string>}
 */
export async function generatePdfFromAssembled(assembled, pdfOptions = {}) {
  if (!assembled || typeof assembled.html !== 'string') {
    throw new Error('generatePdfFromAssembled: expected { html } from assemblePrintDocument().');
  }
  return generatePdf(assembled.html, pdfOptions);
}
