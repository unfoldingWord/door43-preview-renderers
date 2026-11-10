import http from 'http';
import { getResourceData } from '../getResourceData.js';
import { generateCopyrightAndLicenseHtml } from '../renderers/copyrightAndLicenseRenderer.js';
import { clearFetchCache } from '../dcsApi.js';
import { burritoMetadata } from '../testing/burrito.js';

/**
 * A branch that moves after stage 2. A real HTTP server stands in for DCS:
 * `master` names commit A for the first metadata.json read and commit B after
 * that, and each commit has its own notes and license. The data is read at A,
 * records A as its `revision`, and the copyright page asked for that revision
 * reads A's license although `master` is B by then (#87 review).
 */

const TSV = (note) =>
  `Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n1:1\ta1\t\t\t\t0\t${note}`;
const COMMITS = {
  revA: { 'ingredients/TIT.tsv': TSV('Nota A.'), 'ingredients/LICENSE.md': 'License A' },
  revB: { 'ingredients/TIT.tsv': TSV('Nota B.'), 'ingredients/LICENSE.md': 'License B' },
};
const metadataAt = (revision) =>
  burritoMetadata('en_sn', { owner: 'Worldview', files: COMMITS[revision], revision });

let server;
let api;
let masterReads = 0;
const requests = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    requests.push(req.url);
    const u = new URL(req.url, 'http://localhost');
    const m = u.pathname.match(/^\/api\/v1\/repos\/Worldview\/en_sn\/sb\/raw\/(.+)$/);
    const ref = u.searchParams.get('ref');
    if (m && m[1] === 'metadata.json') {
      // The branch moves after its first read.
      const revision = ref === 'master' ? (masterReads++ === 0 ? 'revA' : 'revB') : ref;
      if (COMMITS[revision]) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(metadataAt(revision)));
      }
    }
    if (m && COMMITS[ref]?.[m[1]] !== undefined) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(COMMITS[ref][m[1]]);
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  api = `http://127.0.0.1:${server.address().port}/api/v1`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const entry = {
  owner: 'Worldview',
  name: 'en_sn',
  branch_or_tag_name: 'master',
  subject: 'TSV Study Notes',
  title: 'Study Notes',
  repo: { name: 'en_sn', owner: { username: 'Worldview' } },
};

test('the data records the commit it was read at, and the copyright page reads that commit', async () => {
  const data = await getResourceData(
    { catalogEntries: [entry], source: { books: ['tit'] } },
    { dcsApiUrl: api, quiet: true }
  );
  expect(data.revision).toBe('revA');
  expect(data.license).toBe('License A');
  expect(data.books.tit.chapters['1'].verses['1'][0].Note).toBe('Nota A.');
  // One metadata.json read for the whole of stage 2.
  expect(requests.filter((u) => u.includes('metadata.json'))).toHaveLength(1);

  // Later, with the request cache gone, `master` is commit B.
  clearFetchCache();
  requests.length = 0;
  const pinned = await generateCopyrightAndLicenseHtml(entry, [], {
    dcsApiUrl: api,
    revision: data.revision,
  });
  expect(pinned).toContain('License A');
  expect(requests.some((u) => u.includes('ref=revB'))).toBe(false);

  // Without it, the branch is resolved again and has moved.
  expect(await generateCopyrightAndLicenseHtml(entry, [], { dcsApiUrl: api })).toContain(
    'License B'
  );
});
