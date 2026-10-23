import http from 'http';
import {
  dcsContentSource,
  contentSourceFor,
  readLicense,
  ARCHIVE_LIMITS,
} from '../contentSource.js';
import { clearFetchCache } from '../dcsApi.js';
import { burritoMetadata, burritoZip } from '../testing/burrito.js';

/**
 * Reading a resource from DCS as its Scripture Burrito, over real HTTP:
 * metadata.json at the entry's ref, then every file and the archive at the
 * commit it names (`/sb/raw/{path}?ref=`, `/sb/{revision}.zip`). The archive
 * download follows no redirect and is limited in time and size (#71). The
 * servers count what they are asked for, so "the other host received no
 * request" and "the read stopped early" are measured, not inferred.
 */

const FILES = {
  'ingredients/LICENSE.md': '  CC BY-SA 4.0\n',
  'ingredients/payload/kt/god.md': '# God',
};
const revisionOf = (repo) => `rev-${repo}`;
const metadataOf = (repo) =>
  burritoMetadata(repo, {
    files: FILES,
    flavor: 'x-bcvarticles',
    revision: revisionOf(repo),
  });

const listen = (handler) =>
  new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })
    );
  });

let dcs; // the configured DCS host
let other; // somewhere else
const requests = [];
const otherRequests = [];
let bigWritten = 0;
let bigClosedEarly = false;

beforeAll(async () => {
  const zip = await burritoZip('en_tw', { files: FILES, revision: revisionOf('en_tw') });
  other = await listen((req, res) => {
    otherRequests.push(req.url);
    res.writeHead(200, { 'Content-Type': 'application/zip' });
    res.end(zip);
  });
  dcs = await listen((req, res) => {
    requests.push(req.url);
    const u = new URL(req.url, 'http://x');
    const m = u.pathname.match(/^\/api\/v1\/repos\/o\/([^/]+)\/sb\/(.+)$/);
    if (!m || m[1] === 'missing') {
      res.writeHead(404);
      return res.end();
    }
    const [, repo, rest] = m;
    const pinned = u.searchParams.get('ref') === revisionOf(repo);
    if (rest === 'raw/metadata.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(metadataOf(repo)));
    }
    if (rest.startsWith('raw/') && pinned && FILES[rest.slice(4)] !== undefined) {
      res.writeHead(200, { 'Content-Type': 'text/markdown' });
      return res.end(FILES[rest.slice(4)]);
    }
    if (rest !== `${revisionOf(repo)}.zip`) {
      res.writeHead(404);
      return res.end();
    }
    if (repo === 'en_tw') {
      res.writeHead(200, { 'Content-Type': 'application/zip' });
      return res.end(zip);
    }
    if (repo === 'redirect') {
      res.writeHead(302, { Location: `${other.origin}/x.zip` });
      return res.end();
    }
    if (repo === 'declared') {
      res.writeHead(200, { 'Content-Length': String(10 * 1024 * 1024) });
      return res.end(); // the header alone must be enough to refuse it
    }
    if (repo === 'stream') {
      // 64 KB chunks, no Content-Length, up to 20 MB unless the client hangs up.
      res.writeHead(200, { 'Content-Type': 'application/zip' });
      const chunk = Buffer.alloc(64 * 1024, 1);
      res.on('close', () => {
        if (bigWritten < 20 * 1024 * 1024) bigClosedEarly = true;
      });
      const pump = () => {
        while (bigWritten < 20 * 1024 * 1024) {
          bigWritten += chunk.length;
          if (!res.write(chunk)) return res.once('drain', pump);
        }
        res.end();
      };
      return pump();
    }
    if (repo === 'slow') return; // never answers
    res.writeHead(500);
    res.end();
  });
});

beforeEach(() => clearFetchCache());

afterAll(async () => {
  for (const { server } of [dcs, other]) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

const source = (limits) => dcsContentSource(`${dcs.origin}/api/v1`, limits);
const entry = (name, ref = 'v91') => ({ owner: 'o', name, branch_or_tag_name: ref });

describe('dcsContentSource', () => {
  test('metadata.json at the ref; files and the archive at the commit it names', async () => {
    const s = source();
    requests.length = 0;
    expect((await s.readMetadata(entry('en_tw'))).type.flavorType.flavor.name).toBe(
      'x-bcvarticles'
    );
    expect(await s.readFile(entry('en_tw'), 'ingredients/payload/kt/god.md')).toBe('# God');
    const zip = await s.readArchive(entry('en_tw'));
    expect(await zip.file('en_tw/ingredients/payload/kt/god.md').async('string')).toBe('# God');
    expect(requests).toEqual([
      '/api/v1/repos/o/en_tw/sb/raw/metadata.json?ref=v91',
      '/api/v1/repos/o/en_tw/sb/raw/ingredients/payload/kt/god.md?ref=rev-en_tw',
      '/api/v1/repos/o/en_tw/sb/rev-en_tw.zip',
    ]);
    expect(ARCHIVE_LIMITS).toEqual({ maxBytes: 100 * 1024 * 1024, timeoutMs: 120000 });
  });

  test('the license is the burrito license ingredient, trimmed', async () => {
    expect(await readLicense(source(), entry('en_tw'))).toBe('CC BY-SA 4.0');
  });

  test('a repository DCS has no burrito for is NOT_FOUND, for metadata and archive alike', async () => {
    const missing = { name: 'ResourceError', code: 'NOT_FOUND', status: 404 };
    await expect(source().readMetadata(entry('missing'))).rejects.toMatchObject(missing);
    await expect(source().readArchive(entry('missing'))).rejects.toMatchObject(missing);
    await expect(source().readFile(entry('en_tw'), 'ingredients/nope.md')).rejects.toMatchObject(
      missing
    );
  });

  test('without a ref, the default branch is read', async () => {
    requests.length = 0;
    await source().readMetadata({ owner: 'o', name: 'en_tw' });
    expect(requests).toEqual(['/api/v1/repos/o/en_tw/sb/raw/metadata.json']);
  });
});

describe('dcsContentSource.readArchive limits', () => {
  test('a redirect fails the read, and the other host receives no request', async () => {
    await expect(source().readArchive(entry('redirect'))).rejects.toMatchObject({
      name: 'ResourceError',
      code: 'NETWORK',
    });
    expect(otherRequests).toEqual([]);
  });

  test('a declared Content-Length over the cap is refused without reading the body', async () => {
    await expect(
      source({ maxBytes: 1024 * 1024 }).readArchive(entry('declared'))
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      message: expect.stringContaining(`is larger than ${1024 * 1024} bytes`),
    });
  });

  test('a streamed body stops being read once it passes the cap', async () => {
    await expect(source({ maxBytes: 1024 * 1024 }).readArchive(entry('stream'))).rejects.toThrow(
      `is larger than ${1024 * 1024} bytes`
    );
    // The client hung up long before the server's 20 MB were sent.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(bigClosedEarly).toBe(true);
    expect(bigWritten).toBeLessThan(20 * 1024 * 1024);
  });

  test('a download that takes too long is aborted', async () => {
    await expect(source({ timeoutMs: 300 }).readArchive(entry('slow'))).rejects.toMatchObject({
      code: 'NETWORK',
      message: expect.stringContaining('Could not download'),
    });
  });

  test('an HTTP error keeps its status and URL', async () => {
    await expect(source().readArchive(entry('error'))).rejects.toMatchObject({
      code: 'HTTP',
      status: 500,
      url: `${dcs.origin}/api/v1/repos/o/error/sb/rev-error.zip`,
    });
  });

  test('getResourceData options set the limits; a non-finite or non-positive one falls back', async () => {
    const tight = contentSourceFor({
      dcsApiUrl: `${dcs.origin}/api/v1`,
      archiveMaxBytes: 100,
      archiveTimeoutMs: 30000,
    });
    await expect(tight.readArchive(entry('en_tw'))).rejects.toThrow('is larger than 100 bytes');
    // Infinity, 0 and NaN keep the default cap (100 MB), so the small archive reads.
    for (const archiveMaxBytes of [Infinity, 0, NaN]) {
      const s = contentSourceFor({ dcsApiUrl: `${dcs.origin}/api/v1`, archiveMaxBytes });
      await expect(s.readArchive(entry('en_tw'))).resolves.toBeDefined();
    }
  });
});
