import { jest } from '@jest/globals';

const axiosGetMock = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get: axiosGetMock } }));

const { findResources, resolveRef, resolveResource, listLanguages } = await import(
  '../findResources.js'
);
const { getAllCatalogEntries } = await import('../getAllCatalogEntries.js');
const { fetchJson, clearFetchCache } = await import('../dcsApi.js');

const API = 'https://git.door43.org/api/v1';

/** A catalog entry as /catalog/search returns it (the fields the code reads). */
function entry(owner, name, ref, subject, extra = {}) {
  return {
    owner,
    name,
    full_name: `${owner}/${name}`,
    branch_or_tag_name: ref,
    subject,
    language: 'es-419',
    language_is_gl: true,
    language_direction: 'ltr',
    released: '2024-07-17T20:13:08Z',
    title: name,
    ...extra,
  };
}

const TN_GL = entry('es-419_gl', 'es-419_tn', 'v66', 'TSV Translation Notes');
const TN_OBT = entry('es-419_obt', 'es-419_tn', 'v0.0.5', 'TSV Translation Notes', {
  released: '2025-01-01T00:00:00Z',
});
const TN_NEW_NON_GL = entry('someone', 'es-419_tn', 'v99', 'TSV Translation Notes', {
  released: '2026-01-01T00:00:00Z',
  language_is_gl: false,
});

/** A complete blueprint for a TN entry (what /catalog/bp/ returns). */
function blueprint(main, { withOT = true, withNT = true } = {}) {
  const bp = [
    main,
    entry(main.owner, 'es-419_glt', 'v66', 'Aligned Bible', { abbreviation: 'glt' }),
    entry(main.owner, 'es-419_gst', 'v66', 'Aligned Bible', { abbreviation: 'gst' }),
    entry(main.owner, 'es-419_ta', 'v66', 'Translation Academy'),
    entry(main.owner, 'es-419_tw', 'v66', 'Translation Words'),
    entry(main.owner, 'es-419_twl', 'v66', 'TSV Translation Words Links'),
  ];
  if (withOT) bp.push(entry('unfoldingWord', 'hbo_uhb', 'v3.0.0', 'Hebrew Old Testament'));
  if (withNT) bp.push(entry('unfoldingWord', 'el-x-koine_ugnt', 'v0.34', 'Greek New Testament'));
  return bp;
}

const urlOf = (call) => call[0];
const searchUrl = (page, extra = '') =>
  `${API}/catalog/search?lang=es-419&stage=prod&limit=100${extra}&page=${page}`;

beforeEach(() => {
  jest.clearAllMocks();
  clearFetchCache();
});

describe('fetchJson', () => {
  test('returns the parsed body and shares it across calls for the same URL', async () => {
    axiosGetMock.mockResolvedValue({ data: { ok: true, data: [1] } });
    const a = await fetchJson(`${API}/x`);
    const b = await fetchJson(`${API}/x`);
    expect(a).toEqual({ ok: true, data: [1] });
    expect(b).toBe(a);
    expect(axiosGetMock).toHaveBeenCalledTimes(1);
  });

  test('a non-object body is rejected and not cached', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: '<html>' });
    await expect(fetchJson(`${API}/y`)).rejects.toThrow('Unexpected response');
    axiosGetMock.mockResolvedValueOnce({ data: { fine: true } });
    await expect(fetchJson(`${API}/y`)).resolves.toEqual({ fine: true });
  });
});

describe('findResources', () => {
  test('searches by language, subject and owner, and pages until a short page', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => entry('o', `r${i}`, 'v1', 'Bible'));
    const page2 = [entry('o', 'r100', 'v1', 'Bible')];
    axiosGetMock
      .mockResolvedValueOnce({ data: { ok: true, data: page1 } })
      .mockResolvedValueOnce({ data: { ok: true, data: page2 } });

    const result = await findResources(
      { lang: 'es-419', subject: 'TSV Translation Notes', owner: 'es-419_gl' },
      { dcs_api_url: API }
    );

    expect(result).toHaveLength(101);
    expect(axiosGetMock.mock.calls.map(urlOf)).toEqual([
      searchUrl(1, '&subject=TSV%20Translation%20Notes&owner=es-419_gl'),
      searchUrl(2, '&subject=TSV%20Translation%20Notes&owner=es-419_gl'),
    ]);
  });

  test('a single short page is one request; other stages are passed through', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { ok: true, data: [TN_GL] } });
    const result = await findResources({ lang: 'es-419', stage: 'latest' }, { dcs_api_url: API });
    expect(result).toEqual([TN_GL]);
    expect(urlOf(axiosGetMock.mock.calls[0])).toBe(
      `${API}/catalog/search?lang=es-419&stage=latest&limit=100&page=1`
    );
  });

  test('requires lang', async () => {
    await expect(findResources({})).rejects.toThrow('lang is required');
  });
});

describe('resolveRef', () => {
  test('a given ref is returned as-is, tagged as a release when it looks like one', async () => {
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: 'v91' })).toEqual({ ref: 'v91', isRelease: true });
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: '3.0.0' })).toEqual({ ref: '3.0.0', isRelease: true });
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: 'master' })).toEqual({ ref: 'master', isRelease: false });
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  test('an empty ref means the latest release', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { tag_name: 'v91', draft: false } });
    expect(await resolveRef({ owner: 'unfoldingWord', repo: 'en_tn' }, { dcs_api_url: API })).toEqual({
      ref: 'v91',
      isRelease: true,
    });
    expect(urlOf(axiosGetMock.mock.calls[0])).toBe(`${API}/repos/unfoldingWord/en_tn/releases/latest`);
  });

  test('no release: the default branch; no repo info: master', async () => {
    const notFound = Object.assign(new Error('404'), { response: { status: 404 } });
    axiosGetMock
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({ data: { default_branch: 'main' } });
    expect(await resolveRef({ owner: 'x', repo: 'y' }, { dcs_api_url: API })).toEqual({
      ref: 'main',
      isRelease: false,
    });

    axiosGetMock.mockRejectedValueOnce(notFound).mockRejectedValueOnce(notFound);
    expect(await resolveRef({ owner: 'x', repo: 'z' }, { dcs_api_url: API })).toEqual({
      ref: 'master',
      isRelease: false,
    });
  });
});

describe('resolveResource', () => {
  function serve(map) {
    axiosGetMock.mockImplementation(async (url) => {
      for (const [prefix, body] of Object.entries(map)) {
        if (url.startsWith(prefix)) {
          if (body instanceof Error) throw body;
          return { data: body };
        }
      }
      throw Object.assign(new Error(`404 ${url}`), { response: { status: 404 } });
    });
  }

  test('prefers a gateway-language publisher over a newer non-GL one, then checks the blueprint once', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_NEW_NON_GL, TN_OBT, TN_GL] },
      [`${API}/catalog/bp/es-419_obt/es-419_tn/v0.0.5`]: { ok: true, data: blueprint(TN_OBT) },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] },
      { dcs_api_url: API }
    );
    // Both GL publishers beat the non-GL one; the newer GL release wins.
    expect(found).toMatchObject({ owner: 'es-419_obt', repo: 'es-419_tn', ref: 'v0.0.5' });
    expect(found.catalogEntries[0]).toBe(found.entry);
    const urls = axiosGetMock.mock.calls.map(urlOf);
    expect(urls.filter((u) => u.includes('/catalog/bp/'))).toEqual([
      `${API}/catalog/bp/es-419_obt/es-419_tn/v0.0.5?book=tit`,
    ]);
  });

  test('a requested owner is tried first', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_OBT, TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: { ok: true, data: blueprint(TN_GL) },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'TSV Translation Notes', owner: 'es-419_gl' },
      { dcs_api_url: API }
    );
    expect(found).toMatchObject({ owner: 'es-419_gl', ref: 'v66' });
  });

  test('a candidate whose blueprint lacks a required subject is skipped for the next', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_OBT, TN_GL] },
      // The newer publisher has no Greek NT, so a NT book cannot be rendered from it.
      [`${API}/catalog/bp/es-419_obt/es-419_tn/v0.0.5`]: {
        ok: true,
        data: blueprint(TN_OBT, { withNT: false }),
      },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: { ok: true, data: blueprint(TN_GL) },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] },
      { dcs_api_url: API }
    );
    expect(found).toMatchObject({ owner: 'es-419_gl', ref: 'v66' });
  });

  test('a missing original-language Bible for the other testament does not disqualify', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: blueprint(TN_GL, { withOT: false }),
      },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] },
      { dcs_api_url: API }
    );
    expect(found.owner).toBe('es-419_gl');
  });

  test('nothing published, or no complete package, is an error that says why', async () => {
    serve({ [`${API}/catalog/search?`]: { ok: true, data: [] } });
    await expect(
      resolveResource({ lang: 'zz', subject: 'TSV Translation Notes' }, { dcs_api_url: API })
    ).rejects.toThrow('No TSV Translation Notes published for language "zz"');

    clearFetchCache();
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: blueprint(TN_GL, { withNT: false }),
      },
    });
    await expect(
      resolveResource({ lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] }, { dcs_api_url: API })
    ).rejects.toThrow('blueprint lacks Greek New Testament');
  });
});

describe('listLanguages', () => {
  test('maps the catalog language records', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        ok: true,
        data: [
          { lc: 'am', ang: 'Amharic', ln: 'አማርኛ', ld: 'ltr', gw: true },
          { lc: 'ar', ang: 'Arabic', ln: 'العربية', ld: 'rtl', gw: false },
          { lc: 'xx', ln: 'Only native' },
        ],
      },
    });
    const langs = await listLanguages({}, { dcs_api_url: API });
    expect(langs).toEqual([
      { code: 'am', name: 'Amharic', native: 'አማርኛ', direction: 'ltr', gateway: true },
      { code: 'ar', name: 'Arabic', native: 'العربية', direction: 'rtl', gateway: false },
      { code: 'xx', name: 'Only native', native: 'Only native', direction: 'ltr', gateway: false },
    ]);
    expect(urlOf(axiosGetMock.mock.calls[0])).toBe(`${API}/catalog/list/languages?stage=prod`);
  });
});

describe('getAllCatalogEntries with { lang, subject }', () => {
  test('resolves the publisher and release and reuses that blueprint as the CatalogSet', async () => {
    axiosGetMock.mockImplementation(async (url) => {
      if (url.startsWith(`${API}/catalog/search?`)) return { data: { ok: true, data: [TN_GL] } };
      if (url === `${API}/catalog/bp/es-419_gl/es-419_tn/v66?book=tit`) {
        return { data: { ok: true, data: blueprint(TN_GL) } };
      }
      throw new Error(`unexpected ${url}`);
    });

    const set = await getAllCatalogEntries(
      { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] },
      { dcs_api_url: API, quiet: true }
    );

    expect(set.source).toMatchObject({
      owner: 'es-419_gl',
      repo: 'es-419_tn',
      ref: 'v66',
      books: ['tit'],
      lang: 'es-419',
      subject: 'TSV Translation Notes',
    });
    expect(set.resourceVersion).toBe('v66');
    expect(set.catalogEntries[0]).toMatchObject({ owner: 'es-419_gl', name: 'es-419_tn' });
    // One search, one blueprint — no second /catalog/bp/ call.
    const urls = axiosGetMock.mock.calls.map(urlOf);
    expect(urls.filter((u) => u.includes('/catalog/bp/'))).toHaveLength(1);
  });
});
