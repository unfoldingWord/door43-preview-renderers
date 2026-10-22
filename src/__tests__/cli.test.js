import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

/**
 * The CLI end to end: a real child process, a real HTTP server standing in
 * for DCS (`--dcs-api-url`), no mocks inside the library. These lock the
 * stage-0 hand-off: the CatalogSet the CLI resolves from a language is the one
 * it renders from, with the selected resource first and the resolved version,
 * whatever order the blueprint listed its rows in.
 */

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli.js');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const tn = {
  owner: 'es-419_gl',
  name: 'es-419_tn',
  full_name: 'es-419_gl/es-419_tn',
  branch_or_tag_name: 'v66',
  subject: 'TSV Translation Notes',
  title: 'Notas de traducción',
  language: 'es-419',
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
// The package's Translation Questions: not required, fetched only on request.
const tq = {
  ...dep('es-419_gl', 'es-419_tq', 'v20', 'TSV Translation Questions'),
  title: 'Preguntas de traducción',
  language: 'es-419',
  metadata_type: 'rc',
  ingredients: [{ identifier: 'tit', path: './tq_TIT.tsv', title: 'Tito', sort: 57 }],
};
// A complete package for Titus, with a dependency listed before the resource.
const dependencyFirst = (mainRef) => [
  dep('unfoldingWord', 'el-x-koine_ugnt', 'v0.34', 'Greek New Testament'),
  { ...tn, branch_or_tag_name: mainRef },
  dep('es-419_gl', 'es-419_glt', 'v41', 'Aligned Bible'),
  dep('es-419_gl', 'es-419_ta', 'v4', 'Translation Academy'),
  dep('es-419_gl', 'es-419_tw', 'v37', 'Translation Words'),
  dep('es-419_gl', 'es-419_twl', 'v18', 'TSV Translation Words Links'),
  tq,
];
const TSV =
  'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n1:1\ta1\t\t\t\t0\tUna nota.';
const TQ_TSV =
  'Reference\tID\tTags\tQuote\tOccurrence\tQuestion\tResponse\n1:1\tq1\t\t\t0\t¿Quién escribió?\tPablo.';

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
    if (bp) return send(200, { ok: true, data: dependencyFirst(bp[1]) });
    if (u.pathname === '/api/v1/repos/es-419_gl/es-419_tn/releases/latest') {
      return send(200, { tag_name: 'v66' });
    }
    if (u.pathname === '/api/v1/repos/es-419_gl/es-419_tn/contents/tn_TIT.tsv') {
      return send(200, { content: b64(TSV) });
    }
    if (u.pathname === '/api/v1/repos/es-419_gl/es-419_tq/contents/tq_TIT.tsv') {
      return send(200, { content: b64(TQ_TSV) });
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

function run(args) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI, ...args, '--dcs-api-url', api, '--quiet'],
      { timeout: 60000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })
    );
  });
}

describe('door43-renderers CLI, stage 0 → CatalogSet hand-off', () => {
  test('getAllCatalogEntries --lang --subject: the selected resource first, the resolved version', async () => {
    const { code, stdout, stderr } = await run([
      'getAllCatalogEntries',
      '--lang',
      'es-419',
      '--subject',
      'TSV Translation Notes',
      '--book',
      'tit',
    ]);
    expect(stderr).toBe('');
    expect(code).toBe(0);
    const set = JSON.parse(stdout);
    expect(set.catalogEntries[0].name).toBe('es-419_tn');
    expect(set.catalogEntries.map((e) => e.name)).toContain('el-x-koine_ugnt');
    expect(set.resourceVersion).toBe('v66');
    expect(set.source).toMatchObject({
      owner: 'es-419_gl',
      repo: 'es-419_tn',
      ref: 'v66',
      books: ['tit'],
    });
    // One search, one blueprint — the set is not fetched a second time.
    expect(requests.filter((u) => u.includes('/catalog/bp/'))).toHaveLength(1);
  });

  test('getResourceData --lang --subject renders the selected resource from that same set', async () => {
    const { code, stdout, stderr } = await run([
      'getResourceData',
      '--lang',
      'es-419',
      '--subject',
      'TSV Translation Notes',
      '--book',
      'tit',
    ]);
    // --quiet silences progress, not warnings: the fake blueprint's
    // dependencies are incomplete, so their skips are reported on stderr.
    expect(stderr).not.toMatch(/https?:\/\//);
    expect(stderr).toContain('Skipping extra resource es-419_ta');
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.subject).toBe('TSV Translation Notes');
    expect(data.title).toBe('Notas de traducción');
    expect(data.version).toBe('v66');
    expect(data.books.tit.chapters['1'].verses['1'][0].Note).toBe('Una nota.');
    expect(requests.filter((u) => u.includes('/catalog/bp/'))).toHaveLength(1);
  });

  test('--catalog with --dir renders from a saved CatalogSet and local checkouts, offline', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-cli-'));
    try {
      fs.mkdirSync(path.join(dir, 'es-419_tn'));
      fs.writeFileSync(
        path.join(dir, 'es-419_tn', 'tn_TIT.tsv'),
        TSV.replace('Una nota.', 'Una nota local.')
      );
      const setFile = path.join(dir, 'set.json');
      fs.writeFileSync(
        setFile,
        JSON.stringify({
          resourceVersion: 'v66',
          catalogEntries: dependencyFirst('v66').slice(1, 2), // the resource alone
          source: { owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v66', books: ['tit'] },
        })
      );
      const { code, stdout, stderr } = await run([
        'getResourceData',
        '--catalog',
        setFile,
        '--dir',
        dir,
      ]);
      expect(stderr).toBe('');
      expect(code).toBe(0);
      expect(JSON.parse(stdout).books.tit.chapters['1'].verses['1'][0].Note).toBe(
        'Una nota local.'
      );
      expect(requests).toEqual([]); // nothing asked of DCS
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('--include-questions with --catalog and --dir reads the questions from disk too', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-cli-'));
    try {
      fs.mkdirSync(path.join(dir, 'es-419_tn'));
      fs.writeFileSync(path.join(dir, 'es-419_tn', 'tn_TIT.tsv'), TSV);
      fs.mkdirSync(path.join(dir, 'es-419_tq'));
      fs.writeFileSync(
        path.join(dir, 'es-419_tq', 'tq_TIT.tsv'),
        TQ_TSV.replace('¿Quién escribió?', '¿Quién escribió? (local)')
      );
      const setFile = path.join(dir, 'set.json');
      fs.writeFileSync(
        setFile,
        JSON.stringify({
          resourceVersion: 'v66',
          catalogEntries: [{ ...tn, branch_or_tag_name: 'v66' }, tq],
          source: { owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v66', books: ['tit'] },
        })
      );
      const { code, stdout, stderr } = await run([
        'renderHtml',
        '--catalog',
        setFile,
        '--dir',
        dir,
        '--include-questions',
      ]);
      expect(stderr).toBe('');
      expect(code).toBe(0);
      expect(JSON.parse(stdout).sections.body).toContain('¿Quién escribió? (local)');
      expect(requests).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('renderHtml --include-questions fetches the Translation Questions and shows them (#23)', async () => {
    const args = ['renderHtml', '--lang', 'es-419', '--subject', 'TSV Translation Notes'];
    const without = await run([...args, '--book', 'tit']);
    expect(without.code).toBe(0);
    expect(JSON.parse(without.stdout).sections.body).not.toContain('tq-question');
    expect(requests.some((u) => u.includes('es-419_tq'))).toBe(false);

    const withQuestions = await run([...args, '--include-questions', '--book', 'tit']);
    expect(withQuestions.stderr).not.toMatch(/https?:\/\//); // no progress under --quiet
    expect(withQuestions.code).toBe(0);
    const { body } = JSON.parse(withQuestions.stdout).sections;
    expect(body).toContain('¿Quién escribió?');
    expect(body).toContain('id="tn-tit-1-1-tq-q1"');
    expect(body.indexOf('¿Quién escribió?')).toBeGreaterThan(body.indexOf('Una nota.'));
  });

  test('an explicit --ref with --lang is kept and its own blueprint is fetched', async () => {
    const { code, stdout } = await run([
      'getAllCatalogEntries',
      '--lang',
      'es-419',
      '--subject',
      'TSV Translation Notes',
      '--book',
      'tit',
      '--ref',
      'v60',
    ]);
    expect(code).toBe(0);
    const set = JSON.parse(stdout);
    expect(set.source).toMatchObject({ owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v60' });
    expect(set.resourceVersion).toBe('v60');
    expect(requests.some((u) => u.startsWith('/api/v1/catalog/bp/es-419_gl/es-419_tn/v60'))).toBe(
      true
    );
  });

  test('an omitted --ref on --owner/--repo means the latest release', async () => {
    const { code, stdout } = await run([
      'getAllCatalogEntries',
      '--owner',
      'es-419_gl',
      '--repo',
      'es-419_tn',
      '--book',
      'tit',
    ]);
    expect(code).toBe(0);
    const set = JSON.parse(stdout);
    expect(set.source.ref).toBe('v66');
    expect(requests).toContain('/api/v1/repos/es-419_gl/es-419_tn/releases/latest');
  });

  test('findResources --lang lists what the catalog publishes', async () => {
    const { code, stdout } = await run(['findResources', '--lang', 'es-419']);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual([
      expect.objectContaining({
        owner: 'es-419_gl',
        repo: 'es-419_tn',
        ref: 'v66',
        subject: 'TSV Translation Notes',
      }),
    ]);
  });
});
