/**
 * weasyprint-pdf — a tiny "HTML → PDF" HTTP service.
 *
 * Contract:
 *   POST /            Content-Type: text/html, body = a complete HTML document
 *                     → 200 application/pdf (the rendered PDF bytes)
 *   GET  /health      → 200 "ok"
 *   OPTIONS *         → 204 (CORS preflight)
 *
 * It pipes the request body to `weasyprint - -` (stdin → stdout) and streams the
 * PDF back. Stateless and dumb on purpose: all rendering/assembly is done by the
 * door43-preview-renderers library; this only runs WeasyPrint where the binary
 * can be installed (e.g. a container).
 *
 * Env: PORT (8080), ALLOW_ORIGIN ('*'), MAX_BODY_BYTES (32MB), TIMEOUT_MS (120000).
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8080);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 32 * 1024 * 1024);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 120000);
const WEASYPRINT_BIN = process.env.WEASYPRINT_BIN || 'weasyprint';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function renderPdf(html, res) {
  const wp = spawn(WEASYPRINT_BIN, ['-', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const out = [];
  const err = [];
  const timer = setTimeout(() => wp.kill('SIGKILL'), TIMEOUT_MS);

  wp.stdout.on('data', (c) => out.push(c));
  wp.stderr.on('data', (c) => err.push(c));

  wp.on('error', (e) => {
    clearTimeout(timer);
    res.statusCode = 500;
    res.end(`weasyprint failed to start: ${e.message}`);
  });

  wp.on('close', (code) => {
    clearTimeout(timer);
    if (code !== 0) {
      res.statusCode = 500;
      res.end(`weasyprint exited ${code}: ${Buffer.concat(err).toString('utf8').slice(0, 1000)}`);
      return;
    }
    const pdf = Buffer.concat(out);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdf.length));
    res.end(pdf);
  });

  wp.stdin.on('error', () => {}); // ignore EPIPE if weasyprint exits early
  wp.stdin.end(html);
}

const server = createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    res.statusCode = 200;
    return res.end('ok');
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on('data', (c) => {
    if (aborted) return;
    size += c.length;
    if (size > MAX_BODY_BYTES) {
      aborted = true;
      res.statusCode = 413;
      res.end('Payload Too Large');
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    if (aborted) return;
    const html = Buffer.concat(chunks).toString('utf8');
    if (!html.trim()) {
      res.statusCode = 400;
      return res.end('Empty body — POST a complete HTML document.');
    }
    renderPdf(html, res);
  });
});

server.listen(PORT, () => {
  console.log(`weasyprint-pdf service listening on :${PORT} (allow-origin: ${ALLOW_ORIGIN})`);
});
