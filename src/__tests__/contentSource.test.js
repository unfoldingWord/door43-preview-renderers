import http from 'http';
import JSZip from 'jszip';
import { dcsContentSource, contentSourceFor, ARCHIVE_LIMITS } from '../contentSource.js';

/**
 * The DCS archive read (#71), over real HTTP: the URL comes from the catalog
 * entry, so it is held to the configured DCS host, no redirect is followed,
 * and the download is limited in time and size. The servers count what they
 * are asked for, so "the other host received no request" and "the read
 * stopped early" are measured, not inferred from a config object.
 */

const zipBytes = async () => {
  const zip = new JSZip();
  zip.file('en_tw/bible/kt/god.md', '# God');
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
};

const listen = (handler) =>
  new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })
    );
  });

let dcs; // the configured DCS host
let other; // somewhere else
const otherRequests = [];
let bigWritten = 0;
let bigClosedEarly = false;

beforeAll(async () => {
  const zip = await zipBytes();
  other = await listen((req, res) => {
    otherRequests.push(req.url);
    res.writeHead(200, { 'Content-Type': 'application/zip' });
    res.end(zip);
  });
  dcs = await listen((req, res) => {
    if (req.url === '/o/en_tw/archive/v91.zip') {
      res.writeHead(200, { 'Content-Type': 'application/zip' });
      return res.end(zip);
    }
    if (req.url === '/o/redirect/archive/v1.zip') {
      res.writeHead(302, { Location: `${other.origin}/o/en_tw/archive/v91.zip` });
      return res.end();
    }
    if (req.url === '/o/declared/archive/v1.zip') {
      res.writeHead(200, { 'Content-Length': String(10 * 1024 * 1024) });
      return res.end(); // the header alone must be enough to refuse it
    }
    if (req.url === '/o/stream/archive/v1.zip') {
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
    if (req.url === '/o/slow/archive/v1.zip') return; // never answers
    res.writeHead(404);
    res.end();
  });
});

afterAll(async () => {
  for (const { server } of [dcs, other]) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

const source = (limits) => dcsContentSource(`${dcs.origin}/api/v1`, limits);
const entry = (path) => ({ name: 'en_tw', zipball_url: `${dcs.origin}${path}` });

describe('dcsContentSource.readArchive', () => {
  test('downloads an archive on the DCS host', async () => {
    const zip = await source().readArchive(entry('/o/en_tw/archive/v91.zip'));
    expect(await zip.file('en_tw/bible/kt/god.md').async('string')).toBe('# God');
    expect(ARCHIVE_LIMITS).toEqual({ maxBytes: 100 * 1024 * 1024, timeoutMs: 120000 });
  });

  test('a redirect fails the read, and the other host receives no request', async () => {
    await expect(source().readArchive(entry('/o/redirect/archive/v1.zip'))).rejects.toThrow(
      'Could not download'
    );
    expect(otherRequests).toEqual([]);
  });

  test('refuses an archive URL on another origin, or one that is not a URL, before any request', async () => {
    const s = dcsContentSource('https://git.door43.org/api/v1');
    const refused = 'not on the DCS host https://git.door43.org';
    await expect(s.readArchive({ zipball_url: `${other.origin}/x.zip` })).rejects.toThrow(refused);
    await expect(
      s.readArchive({ zipball_url: 'http://git.door43.org/unfoldingWord/en_tw/archive/v91.zip' })
    ).rejects.toThrow(refused);
    await expect(
      s.readArchive({
        zipball_url: 'https://git.door43.org:8443/unfoldingWord/en_tw/archive/v91.zip',
      })
    ).rejects.toThrow(refused);
    await expect(s.readArchive({ zipball_url: 'not a url' })).rejects.toThrow('is not a URL');
    await expect(s.readArchive({ name: 'x' })).rejects.toThrow('zipball_url');
    expect(otherRequests).toEqual([]);
  });

  test('a declared Content-Length over the cap is refused without reading the body', async () => {
    await expect(
      source({ maxBytes: 1024 * 1024 }).readArchive(entry('/o/declared/archive/v1.zip'))
    ).rejects.toThrow(`is larger than ${1024 * 1024} bytes`);
  });

  test('a streamed body stops being read once it passes the cap', async () => {
    await expect(
      source({ maxBytes: 1024 * 1024 }).readArchive(entry('/o/stream/archive/v1.zip'))
    ).rejects.toThrow(`is larger than ${1024 * 1024} bytes`);
    // The client hung up long before the server's 20 MB were sent.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(bigClosedEarly).toBe(true);
    expect(bigWritten).toBeLessThan(20 * 1024 * 1024);
  });

  test('a download that takes too long is aborted', async () => {
    await expect(
      source({ timeoutMs: 300 }).readArchive(entry('/o/slow/archive/v1.zip'))
    ).rejects.toThrow('Could not download');
  });

  test('an HTTP error is reported with its status', async () => {
    await expect(source().readArchive(entry('/o/missing/archive/v1.zip'))).rejects.toThrow(
      'HTTP 404'
    );
  });

  test('getResourceData options set the limits; a non-finite or non-positive one falls back', async () => {
    const tight = contentSourceFor({
      dcs_api_url: `${dcs.origin}/api/v1`,
      archiveMaxBytes: 100,
      archiveTimeoutMs: 30000,
    });
    await expect(tight.readArchive(entry('/o/en_tw/archive/v91.zip'))).rejects.toThrow(
      'is larger than 100 bytes'
    );
    // Infinity, 0 and NaN keep the default cap (100 MB), so the small archive reads.
    for (const archiveMaxBytes of [Infinity, 0, NaN]) {
      const s = contentSourceFor({ dcs_api_url: `${dcs.origin}/api/v1`, archiveMaxBytes });
      await expect(s.readArchive(entry('/o/en_tw/archive/v91.zip'))).resolves.toBeDefined();
    }
  });
});
