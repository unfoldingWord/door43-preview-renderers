import { jest } from '@jest/globals';

// --- mocks -----------------------------------------------------------------
// axios: every DCS request goes through here. Responses are served by URL and
// can be gated (held until flushed) to observe concurrency.
const axiosGetMock = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get: axiosGetMock } }));

// tsv-quote-converters: never run Proskomma here; just echo the TSV back and
// record what it was called with.
const addGLQuoteColsMock = jest.fn(async ({ tsvContent }) => ({ output: tsvContent, errors: [] }));
jest.unstable_mockModule('tsv-quote-converters', () => ({ addGLQuoteCols: addGLQuoteColsMock }));

// TWL trimming needs the full tree and is tested on its own.
jest.unstable_mockModule('../twlQuoteTrimming.js', () => ({ applyTwlQuoteTrimming: jest.fn() }));

const { extractRcTsvData } = await import('../tsvHelpers.js');
const { fetchContent, clearFetchCache, setFetchCacheTtl } = await import('../dcsApi.js');

// --- fixtures --------------------------------------------------------------
const API = 'https://git.door43.org/api/v1';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const TN_TSV = [
  'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote',
  '1:1\tabc1\t\trc://*/ta/man/translate/figs-explicit\tΠαῦλος\t1\tA note.',
  '1:2\tabc2\t\t\tΘεοῦ\t1\tAnother note.',
].join('\n');

const TQ_TSV = [
  'Reference\tID\tTags\tQuote\tOccurrence\tQuestion\tResponse',
  '1:1\tq1\t\t\t0\tWho wrote this?\tPaul.',
  '1:2\tq2\t\t\t0\tTo whom?\tTitus.',
].join('\n');

const ULT_USFM =
  '\\id TIT\n\\c 1\n\\p\n\\v 1 \\zaln-s |x-strong="G39720" x-lemma="Παῦλος" x-morph="Gr,N,,,,,NMS," x-occurrence="1" x-occurrences="1" x-content="Παῦλος"\\*\\w Paul|x-occurrence="1" x-occurrences="1"\\w*\\zaln-e\\*\n';
const UGNT_USFM = '\\id TIT\n\\c 1\n\\p\n\\v 1 \\w Παῦλος|lemma="Παῦλος" strong="G39720"\\w*\n';
const LICENSE = 'Creative Commons Attribution-ShareAlike 4.0';

function entry(subject, name, ref, ingredients, extra = {}) {
  return {
    subject,
    name,
    owner: 'unfoldingWord',
    language: 'en',
    branch_or_tag_name: ref,
    metadata_type: 'rc',
    title: name,
    abbreviation: name.replace('en_', ''),
    ingredients,
    repo: { name, owner: { username: 'unfoldingWord' }, abbreviation: name.replace('en_', '') },
    ...extra,
  };
}
const titIngredient = (path) => [{ identifier: 'tit', path, title: 'Titus', sort: 57 }];

const tnEntry = entry('TSV Translation Notes', 'en_tn', 'v91', titIngredient('./tn_TIT.tsv'));
const tqEntry = entry('TSV Translation Questions', 'en_tq', 'v91', titIngredient('./tq_TIT.tsv'));
const ultEntry = entry('Aligned Bible', 'en_ult', 'v91', titIngredient('./57-TIT.usfm'));
const ugntEntry = entry(
  'Greek New Testament',
  'el-x-koine_ugnt',
  'v0.34',
  titIngredient('./57-TIT.usfm'),
  {
    language: 'el-x-koine',
  }
);

const URLS = {
  tn: `${API}/repos/unfoldingWord/en_tn/contents/tn_TIT.tsv?ref=v91`,
  tq: `${API}/repos/unfoldingWord/en_tq/contents/tq_TIT.tsv?ref=v91`,
  ult: `${API}/repos/unfoldingWord/en_ult/contents/57-TIT.usfm?ref=v91`,
  ugnt: `${API}/repos/unfoldingWord/el-x-koine_ugnt/contents/57-TIT.usfm?ref=v0.34`,
};

function respond(url) {
  if (url === URLS.tn) return { data: { content: b64(TN_TSV) } };
  if (url === URLS.tq) return { data: { content: b64(TQ_TSV) } };
  if (url === URLS.ult) return { data: { content: b64(ULT_USFM) } };
  if (url === URLS.ugnt) return { data: { content: b64(UGNT_USFM) } };
  if (url.includes('/contents/LICENSE.md?')) return { data: { content: b64(LICENSE) } };
  const err = new Error(`404 ${url}`);
  err.response = { status: 404 };
  throw err;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearFetchCache();
  setFetchCacheTtl(60 * 1000);
  axiosGetMock.mockImplementation(async (url) => respond(url));
});

const countByUrl = () =>
  axiosGetMock.mock.calls.reduce((acc, [url]) => ({ ...acc, [url]: (acc[url] || 0) + 1 }), {});

// --- tests -----------------------------------------------------------------
describe('extractRcTsvData download accounting', () => {
  test('a Translation Notes book requests each distinct URL exactly once', async () => {
    const result = await extractRcTsvData(tnEntry, ['tit'], { dcs_api_url: API, quiet: true }, [
      tnEntry,
      ultEntry,
      ugntEntry,
    ]);

    const counts = countByUrl();
    // The ULT and UGNT USFM are needed for GL quotes and again for display:
    // one download each.
    expect(counts[URLS.ult]).toBe(1);
    expect(counts[URLS.ugnt]).toBe(1);
    expect(counts[URLS.tn]).toBe(1);
    // Licenses: one lookup per repo, shared by the resource and its extras.
    for (const [url, n] of Object.entries(counts)) {
      expect({ url, n }).toEqual({ url, n: 1 });
    }

    // The converter got the preloaded USFM and the blueprint's pinned OL Bible.
    expect(addGLQuoteColsMock).toHaveBeenCalledTimes(1);
    const args = addGLQuoteColsMock.mock.calls[0][0];
    expect(args.bibleLinks).toEqual(['unfoldingWord/en_ult/v91']);
    expect(args.bibleContents).toEqual({ 'unfoldingWord/en_ult/v91': ULT_USFM });
    expect(args.olBibleLink).toBe('unfoldingWord/el-x-koine_ugnt/v0.34');
    expect(args.olBibleContent).toBe(UGNT_USFM);

    // Display copies came through, alignment stripped.
    expect(Object.keys(result.extras)).toEqual(['ult', 'ugnt']);
    expect(result.extras.ult.books.tit).not.toContain('zaln-s');
    expect(result.license).toBe(LICENSE);
    expect(result.extras.ult.license).toBe(LICENSE);
  });

  test('Translation Questions with no Quote never call the quote converter', async () => {
    const result = await extractRcTsvData(tqEntry, ['tit'], { dcs_api_url: API, quiet: true }, [
      tqEntry,
      ultEntry,
      ugntEntry,
    ]);
    expect(addGLQuoteColsMock).not.toHaveBeenCalled();
    expect(result.books.tit.chapters['1'].verses['1'][0].Question).toBe('Who wrote this?');
    // Bibles are still fetched once each, for the scripture columns.
    const counts = countByUrl();
    expect(counts[URLS.ult]).toBe(1);
    expect(counts[URLS.ugnt]).toBe(1);
  });

  test('extras are fetched concurrently and kept in entry order', async () => {
    // Gate every request: resolve only when flushed, and record which URLs were
    // in flight together.
    let pending = [];
    const concurrentSets = [];
    axiosGetMock.mockImplementation(
      (url) =>
        new Promise((resolve, reject) => {
          pending.push({
            url,
            settle: () => {
              try {
                resolve(respond(url));
              } catch (e) {
                reject(e);
              }
            },
          });
        })
    );

    const run = extractRcTsvData(tnEntry, ['tit'], { dcs_api_url: API, quiet: true }, [
      tnEntry,
      ugntEntry,
      ultEntry,
    ]);

    let done = false;
    run.finally(() => {
      done = true;
    });
    while (!done) {
      await new Promise((r) => setImmediate(r));
      if (pending.length) {
        concurrentSets.push(pending.map((p) => p.url));
        const batch = pending;
        pending = [];
        batch.forEach((p) => p.settle());
      }
    }
    const result = await run;

    // Some round had requests for both extras in flight at the same time.
    const together = concurrentSets.some(
      (urls) =>
        urls.some((u) => u.includes('/en_ult/')) &&
        urls.some((u) => u.includes('/el-x-koine_ugnt/'))
    );
    expect(together).toBe(true);
    expect(Object.keys(result.extras)).toEqual(['ugnt', 'ult']);
  });
});

describe('dcsApi fetch cache', () => {
  test('shares one request per URL until cleared or expired', async () => {
    const a = fetchContent('unfoldingWord', 'en_ult', 'v91', '57-TIT.usfm', API);
    const b = fetchContent('unfoldingWord', 'en_ult', 'v91', '57-TIT.usfm', API);
    expect(await a).toBe(ULT_USFM);
    expect(await b).toBe(ULT_USFM);
    expect(axiosGetMock).toHaveBeenCalledTimes(1);

    clearFetchCache();
    await fetchContent('unfoldingWord', 'en_ult', 'v91', '57-TIT.usfm', API);
    expect(axiosGetMock).toHaveBeenCalledTimes(2);

    // A shorter TTL applies to entries made after it is set.
    setFetchCacheTtl(1);
    clearFetchCache();
    await fetchContent('unfoldingWord', 'en_ult', 'v91', '57-TIT.usfm', API);
    expect(axiosGetMock).toHaveBeenCalledTimes(3);
    await new Promise((r) => setTimeout(r, 5));
    await fetchContent('unfoldingWord', 'en_ult', 'v91', '57-TIT.usfm', API);
    expect(axiosGetMock).toHaveBeenCalledTimes(4);
  });

  test('does not cache failures', async () => {
    await expect(
      fetchContent('unfoldingWord', 'en_ult', 'v91', 'missing.usfm', API)
    ).rejects.toThrow('404');
    await expect(
      fetchContent('unfoldingWord', 'en_ult', 'v91', 'missing.usfm', API)
    ).rejects.toThrow('404');
    expect(axiosGetMock).toHaveBeenCalledTimes(2);
  });
});
