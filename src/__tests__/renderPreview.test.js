import http from 'http';
import { renderPreview } from '../renderPreview.js';

/**
 * renderPreview end to end, in process: a real HTTP server stands in for DCS
 * (`dcsApiUrl`), nothing inside the library is mocked. For a PDF the
 * `weasyprint` binary is replaced by `cat`, so the "PDF" is the print document
 * WeasyPrint would have been given.
 */

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const tn = {
  owner: 'es-419_gl',
  name: 'es-419_tn',
  full_name: 'es-419_gl/es-419_tn',
  branch_or_tag_name: 'v66',
  subject: 'TSV Translation Notes',
  title: 'Notas de traducción',
  language: 'es-419',
  language_direction: 'ltr',
  language_is_gl: true,
  released: '2024-07-17T20:13:08Z',
  metadata_type: 'rc',
  abbreviation: 'tn',
  ingredients: [{ identifier: 'tit', path: './tn_TIT.tsv', title: 'Tito', sort: 57 }],
  repo: { name: 'es-419_tn', owner: { username: 'es-419_gl' }, abbreviation: 'tn' },
};
const dep = (owner, name, ref, subject) => ({
  owner,
  name,
  full_name: `${owner}/${name}`,
  branch_or_tag_name: ref,
  subject,
  ingredients: [{ identifier: 'tit', path: './57-TIT.usfm' }],
  repo: { name, owner: { username: owner } },
});
const blueprint = (ref) => [
  { ...tn, branch_or_tag_name: ref },
  dep('unfoldingWord', 'el-x-koine_ugnt', 'v0.34', 'Greek New Testament'),
  dep('es-419_gl', 'es-419_glt', 'v41', 'Aligned Bible'),
  dep('es-419_gl', 'es-419_ta', 'v4', 'Translation Academy'),
  dep('es-419_gl', 'es-419_tw', 'v37', 'Translation Words'),
  dep('es-419_gl', 'es-419_twl', 'v18', 'TSV Translation Words Links'),
];
const TSV =
  'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n1:1\ta1\t\t\t\t0\tUNA_NOTA.';

let server;
let api;
const requests = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    requests.push(req.url);
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/api/v1/catalog/search') return send(200, { ok: true, data: [tn] });
    const bp = u.pathname.match(/^\/api\/v1\/catalog\/bp\/es-419_gl\/es-419_tn\/([^/]+)$/);
    if (bp) return send(200, { ok: true, data: blueprint(bp[1]) });
    if (u.pathname === '/api/v1/repos/es-419_gl/es-419_tn/releases/latest') {
      return send(200, { tag_name: 'v66' });
    }
    if (u.pathname === '/api/v1/repos/es-419_gl/es-419_tn/contents/tn_TIT.tsv') {
      return send(200, { content: b64(TSV) });
    }
    return send(404, { message: 'not found' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  api = `http://127.0.0.1:${server.address().port}/api/v1`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  requests.length = 0;
});

const base = () => ({ dcsApiUrl: api, quiet: true });
const blueprintCalls = () => requests.filter((u) => u.includes('/catalog/bp/')).length;

describe('renderPreview', () => {
  test('owner/repo/ref → the screen HTML document, from one blueprint call', async () => {
    const html = await renderPreview({
      ...base(),
      owner: 'es-419_gl',
      repo: 'es-419_tn',
      ref: 'v66',
      books: ['tit'],
    });
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="es-419" dir="ltr">');
    expect(html).toContain('UNA_NOTA.');
    expect(html).not.toContain('class="section cover-page"'); // screen: no cover
    expect(blueprintCalls()).toBe(1);
  });

  test('an owner/repo without a ref renders the latest release', async () => {
    await renderPreview({ ...base(), owner: 'es-419_gl', repo: 'es-419_tn', books: ['tit'] });
    expect(requests).toContain('/api/v1/repos/es-419_gl/es-419_tn/releases/latest');
    expect(requests.some((u) => u.startsWith('/api/v1/catalog/bp/es-419_gl/es-419_tn/v66'))).toBe(
      true
    );
  });

  test('lang + subject finds the publisher, and that blueprint is not fetched again', async () => {
    const html = await renderPreview({
      ...base(),
      lang: 'es-419',
      subject: 'TSV Translation Notes',
      books: ['tit'],
    });
    expect(html).toContain('UNA_NOTA.');
    expect(blueprintCalls()).toBe(1);
  });

  test("each stage's options reach it: media and show for the document", async () => {
    const html = await renderPreview({
      ...base(),
      owner: 'es-419_gl',
      repo: 'es-419_tn',
      ref: 'v66',
      books: ['tit'],
      media: 'print',
      show: { toc: false },
    });
    expect(html).toContain('@page {');
    expect(html).toContain('class="section cover-page"');
    expect(html).not.toContain('class="section toc-page"');
  });

  test("output: 'pdf' hands the print document to WeasyPrint", async () => {
    const pdf = await renderPreview({
      ...base(),
      owner: 'es-419_gl',
      repo: 'es-419_tn',
      ref: 'v66',
      books: ['tit'],
      output: 'pdf',
      weasyprintPath: 'cat',
      print: { pageSize: 'A5_PORTRAIT' },
    });
    const html = pdf.toString('utf8');
    expect(html).toContain('size: 148.5mm 210mm');
    expect(html).toContain('UNA_NOTA.');
  });

  test('a request that names no resource, or an unknown output, is refused', async () => {
    await expect(renderPreview({ ...base(), repo: 'es-419_tn' })).rejects.toThrow(
      'owner and repo, or lang and subject'
    );
    await expect(
      renderPreview({ ...base(), owner: 'o', repo: 'r', ref: 'v1', output: 'docx' })
    ).rejects.toThrow("output must be 'html' or 'pdf'");
    await expect(renderPreview(null)).rejects.toThrow('expected a request object');
    expect(requests).toEqual([]);
  });
});
