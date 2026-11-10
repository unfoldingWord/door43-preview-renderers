import { jest } from '@jest/globals';

const axiosGetMock = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get: axiosGetMock } }));

const { findResources, resolveRef, resolveResource, resolveTarget, listLanguages } =
  await import('../findResources.js');
const { getAllCatalogEntries } = await import('../getAllCatalogEntries.js');
const { getResourceData } = await import('../getResourceData.js');
const { fetchJson, clearFetchCache } = await import('../dcsApi.js');
const { burritoMetadata } = await import('../testing/burrito.js');

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
      { dcsApiUrl: API }
    );

    expect(result).toHaveLength(101);
    expect(axiosGetMock.mock.calls.map(urlOf)).toEqual([
      searchUrl(1, '&subject=TSV%20Translation%20Notes&owner=es-419_gl'),
      searchUrl(2, '&subject=TSV%20Translation%20Notes&owner=es-419_gl'),
    ]);
  });

  test('a single short page is one request; other stages are passed through', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { ok: true, data: [TN_GL] } });
    const result = await findResources({ lang: 'es-419', stage: 'latest' }, { dcsApiUrl: API });
    expect(result).toEqual([TN_GL]);
    expect(urlOf(axiosGetMock.mock.calls[0])).toBe(
      `${API}/catalog/search?lang=es-419&stage=latest&limit=100&page=1`
    );
  });

  test('an endpoint that never returns a short page is an error, not an endless loop', async () => {
    const full = Array.from({ length: 100 }, (_, i) => entry('o', `r${i}`, 'v1', 'Bible'));
    axiosGetMock.mockResolvedValue({ data: { ok: true, data: full } });
    await expect(findResources({ lang: 'es-419' }, { dcsApiUrl: API })).rejects.toThrow(
      'after 50 pages'
    );
    expect(axiosGetMock).toHaveBeenCalledTimes(50);
  });

  test('requires lang', async () => {
    await expect(findResources({})).rejects.toThrow('lang is required');
  });
});

describe('resolveRef', () => {
  test('a given ref is returned as-is, tagged as a release when it looks like one', async () => {
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: 'v91' })).toEqual({
      ref: 'v91',
      isRelease: true,
    });
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: '3.0.0' })).toEqual({
      ref: '3.0.0',
      isRelease: true,
    });
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: 'master' })).toEqual({
      ref: 'master',
      isRelease: false,
    });
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: 'v1.2' })).toEqual({
      ref: 'v1.2',
      isRelease: true,
    });
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: '2-experimental' })).toEqual({
      ref: '2-experimental',
      isRelease: false,
    });
    expect(await resolveRef({ owner: 'o', repo: 'r', ref: '0a1b2c3' })).toEqual({
      ref: '0a1b2c3',
      isRelease: false,
    });
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  test('an empty ref means the latest release', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { tag_name: 'v91', draft: false } });
    expect(await resolveRef({ owner: 'unfoldingWord', repo: 'en_tn' }, { dcsApiUrl: API })).toEqual(
      {
        ref: 'v91',
        isRelease: true,
      }
    );
    expect(urlOf(axiosGetMock.mock.calls[0])).toBe(
      `${API}/repos/unfoldingWord/en_tn/releases/latest`
    );
  });

  test('no release: the default branch; no repo info: master', async () => {
    const notFound = Object.assign(new Error('404'), { response: { status: 404 } });
    axiosGetMock
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({ data: { default_branch: 'main' } });
    expect(await resolveRef({ owner: 'x', repo: 'y' }, { dcsApiUrl: API })).toEqual({
      ref: 'main',
      isRelease: false,
    });

    axiosGetMock.mockRejectedValueOnce(notFound).mockRejectedValueOnce(notFound);
    expect(await resolveRef({ owner: 'x', repo: 'z' }, { dcsApiUrl: API })).toEqual({
      ref: 'master',
      isRelease: false,
    });
  });

  test('an outage on the release lookup is an error, not the default branch', async () => {
    const outage = Object.assign(new Error('503'), { response: { status: 503 } });
    axiosGetMock.mockRejectedValueOnce(outage);
    await expect(resolveRef({ owner: 'x', repo: 'w' }, { dcsApiUrl: API })).rejects.toThrow('503');
    expect(axiosGetMock).toHaveBeenCalledTimes(1); // never reached the default-branch lookup

    const notFound = Object.assign(new Error('404'), { response: { status: 404 } });
    axiosGetMock.mockRejectedValueOnce(notFound).mockRejectedValueOnce(outage);
    await expect(resolveRef({ owner: 'x', repo: 'v' }, { dcsApiUrl: API })).rejects.toThrow('503');
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
      { dcsApiUrl: API }
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
      { dcsApiUrl: API }
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
      { dcsApiUrl: API }
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
      { dcsApiUrl: API }
    );
    expect(found.owner).toBe('es-419_gl');
  });

  test('an outage on a blueprint aborts instead of serving the next publisher', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_OBT, TN_GL] },
      [`${API}/catalog/bp/es-419_obt/es-419_tn/v0.0.5`]: Object.assign(new Error('500'), {
        response: { status: 500 },
      }),
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: { ok: true, data: blueprint(TN_GL) },
    });
    await expect(
      resolveResource(
        { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] },
        { dcsApiUrl: API }
      )
    ).rejects.toThrow('500');
  });

  test('books from both testaments are checked against the unscoped package', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66?book=`]: {
        ok: true,
        data: blueprint(TN_GL, { withNT: false }),
      },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: { ok: true, data: blueprint(TN_GL) },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'TSV Translation Notes', books: ['gen', 'tit'] },
      { dcsApiUrl: API }
    );
    expect(found.owner).toBe('es-419_gl');
    const urls = axiosGetMock.mock.calls.map(urlOf).filter((u) => u.includes('/catalog/bp/'));
    expect(urls).toEqual([`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]);
  });

  test('nothing published, or no complete package, is an error that says why', async () => {
    serve({ [`${API}/catalog/search?`]: { ok: true, data: [] } });
    await expect(
      resolveResource({ lang: 'zz', subject: 'TSV Translation Notes' }, { dcsApiUrl: API })
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
      resolveResource(
        { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] },
        { dcsApiUrl: API }
      )
    ).rejects.toThrow('blueprint lacks Greek New Testament');
  });
});

describe('resolveResource: the selected resource and its books', () => {
  const serve = (map) =>
    axiosGetMock.mockImplementation(async (url) => {
      for (const [prefix, body] of Object.entries(map)) {
        if (url.startsWith(prefix)) return { data: body };
      }
      throw Object.assign(new Error(`404 ${url}`), { response: { status: 404 } });
    });
  const bible = (owner, books) =>
    entry(owner, 'es-419_glt', 'v41', 'Aligned Bible', {
      abbreviation: 'glt',
      ingredients: books.map((b) => ({ identifier: b, path: `./${b}.usfm` })),
    });

  test('the selected resource is moved to the front of a blueprint that lists it later', async () => {
    const uhb = entry('unfoldingWord', 'hbo_uhb', 'v3.0.0', 'Hebrew Old Testament');
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: [uhb, ...blueprint(TN_GL).filter((e) => e.name !== 'hbo_uhb')],
      },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'TSV Translation Notes', books: ['rut'] },
      { dcsApiUrl: API }
    );
    expect(found.catalogEntries[0]).toBe(found.entry);
    expect(found.catalogEntries[0].name).toBe('es-419_tn');
    expect(found.catalogEntries).toHaveLength(blueprint(TN_GL).length);
    expect(found.catalogEntries.filter((e) => e.name === 'hbo_uhb')).toHaveLength(1);
  });

  test('a blueprint that does not list the resource itself is skipped', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_OBT, TN_GL] },
      [`${API}/catalog/bp/es-419_obt/es-419_tn/v0.0.5`]: {
        ok: true,
        data: blueprint(TN_OBT).slice(1),
      },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: { ok: true, data: blueprint(TN_GL) },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'TSV Translation Notes' },
      { dcsApiUrl: API }
    );
    expect(found.owner).toBe('es-419_gl');
  });

  test('a candidate missing a requested book is skipped for one that has them all', async () => {
    const partial = bible('es-419_obt', ['gen']);
    const complete = bible('es-419_gl', ['gen', 'tit']);
    serve({
      [`${API}/catalog/search?`]: {
        ok: true,
        data: [{ ...partial, released: '2026-01-01T00:00:00Z' }, complete],
      },
      [`${API}/catalog/bp/es-419_obt/es-419_glt/v41`]: { ok: true, data: [partial] },
      [`${API}/catalog/bp/es-419_gl/es-419_glt/v41`]: { ok: true, data: [complete] },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'Aligned Bible', books: ['gen', 'tit'] },
      { dcsApiUrl: API }
    );
    expect(found.owner).toBe('es-419_gl');
    const urls = axiosGetMock.mock.calls.map(urlOf).filter((u) => u.includes('/catalog/bp/'));
    // Two books: the unscoped package, first the newer partial one, then the complete one.
    expect(urls).toEqual([
      `${API}/catalog/bp/es-419_obt/es-419_glt/v41`,
      `${API}/catalog/bp/es-419_gl/es-419_glt/v41`,
    ]);
  });

  test('no candidate with every requested book is an error naming the missing book', async () => {
    const partial = bible('es-419_gl', ['gen']);
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [partial] },
      [`${API}/catalog/bp/es-419_gl/es-419_glt/v41`]: { ok: true, data: [partial] },
    });
    await expect(
      resolveResource(
        { lang: 'es-419', subject: 'Aligned Bible', books: ['gen', 'tit'] },
        { dcsApiUrl: API }
      )
    ).rejects.toThrow('lacks book tit');
  });

  test('a catalog row without an ingredient list rules nothing out', async () => {
    const noIngredients = entry('es-419_gl', 'es-419_glt', 'v41', 'Aligned Bible');
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [noIngredients] },
      [`${API}/catalog/bp/es-419_gl/es-419_glt/v41`]: { ok: true, data: [noIngredients] },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: 'Aligned Bible', books: ['tit'] },
      { dcsApiUrl: API }
    );
    expect(found.owner).toBe('es-419_gl');
  });
});

describe('resolveResource: books the dependencies carry', () => {
  const serve = (map) =>
    axiosGetMock.mockImplementation(async (url) => {
      for (const [prefix, body] of Object.entries(map)) {
        if (url.startsWith(prefix)) return { data: body };
      }
      throw Object.assign(new Error(`404 ${url}`), { response: { status: 404 } });
    });
  const ingredients = (books) => books.map((b) => ({ identifier: b, path: `./${b}.tsv` }));
  const withBooks = (row, books) => ({ ...row, ingredients: ingredients(books) });
  /** A TN package whose notes carry `tnBooks` and whose Bibles and Words Links carry `depBooks`. */
  const tnPackage = (main, tnBooks, depBooks, opts) =>
    blueprint(withBooks(main, tnBooks), opts).map((row) =>
      ['Aligned Bible', 'TSV Translation Words Links'].includes(row.subject)
        ? withBooks(row, depBooks)
        : row
    );
  const TN = 'TSV Translation Notes';

  test('a dependency missing a requested book: the next publisher, whose package has them all, wins', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_OBT, TN_GL] },
      [`${API}/catalog/bp/es-419_obt/es-419_tn/v0.0.5`]: {
        ok: true,
        data: tnPackage(TN_OBT, ['tit', '3jn'], ['tit']),
      },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: tnPackage(TN_GL, ['tit', '3jn'], ['tit', '3jn']),
      },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: TN, books: ['tit', '3jn'] },
      { dcsApiUrl: API }
    );
    expect(found.owner).toBe('es-419_gl');
    const glt = found.catalogEntries.find((e) => e.name === 'es-419_glt');
    expect(glt.ingredients.map((i) => i.identifier)).toEqual(['tit', '3jn']);
  });

  test('a Bible without every requested book is left out, so one that has them is chosen', async () => {
    const bp = tnPackage(TN_GL, ['tit', '3jn'], ['tit', '3jn']).map((row) =>
      row.name === 'es-419_glt' ? withBooks(row, ['tit']) : row
    );
    const other = withBooks(entry('es-419_gl', 'es-419_alt', 'v66', 'Aligned Bible'), [
      'tit',
      '3jn',
    ]);
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: { ok: true, data: [...bp, other] },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: TN, books: ['tit', '3jn'] },
      { dcsApiUrl: API }
    );
    const names = found.catalogEntries.map((e) => e.name);
    expect(names).not.toContain('es-419_glt');
    expect(names).toEqual(expect.arrayContaining(['es-419_gst', 'es-419_alt']));
  });

  test('an original-language Bible is held only to the books of its own testament', async () => {
    const bp = tnPackage(TN_GL, ['gen', 'tit'], ['gen', 'tit']).map((row) => {
      if (row.name === 'hbo_uhb') return withBooks(row, ['gen']);
      if (row.name === 'el-x-koine_ugnt') return withBooks(row, ['tit']);
      return row;
    });
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: { ok: true, data: bp },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: TN, books: ['gen', 'tit'] },
      { dcsApiUrl: API }
    );
    expect(found.catalogEntries.map((e) => e.name)).toEqual(
      expect.arrayContaining(['hbo_uhb', 'el-x-koine_ugnt'])
    );
  });

  test('no publisher whose dependencies carry every book is an error naming the gap', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: tnPackage(TN_GL, ['tit', '3jn'], ['tit']),
      },
    });
    await expect(
      resolveResource({ lang: 'es-419', subject: TN, books: ['tit', '3jn'] }, { dcsApiUrl: API })
    ).rejects.toThrow(
      'blueprint lacks Aligned Bible, TSV Translation Words Links for tit, 3jn (es-419_glt lacks 3jn;'
    );
  });

  test('no books asked for: a New Testament package does not need the Hebrew Old Testament', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: tnPackage(TN_GL, ['tit', '3jn'], ['tit'], { withOT: false }),
      },
    });
    // Nor are its dependencies held to every book the notes carry.
    const found = await resolveResource({ lang: 'es-419', subject: TN }, { dcsApiUrl: API });
    expect(found.owner).toBe('es-419_gl');
  });

  test('no books asked for: a package spanning both testaments needs both original-language Bibles', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: tnPackage(TN_GL, ['gen', 'tit'], ['gen', 'tit'], { withOT: false }),
      },
    });
    await expect(
      resolveResource({ lang: 'es-419', subject: TN }, { dcsApiUrl: API })
    ).rejects.toThrow('blueprint lacks Hebrew Old Testament');
  });

  test('books from both testaments still need both original-language Bibles', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: tnPackage(TN_GL, ['gen', 'tit'], ['gen', 'tit'], { withNT: false }),
      },
    });
    await expect(
      resolveResource({ lang: 'es-419', subject: TN, books: ['gen', 'tit'] }, { dcsApiUrl: API })
    ).rejects.toThrow('blueprint lacks Greek New Testament');
  });

  test('a Bible whose ingredient list is empty carries no books, so the next publisher wins', async () => {
    const emptyBible = (row) =>
      row.subject === 'Aligned Bible' ? { ...row, ingredients: [] } : row;
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_OBT, TN_GL] },
      [`${API}/catalog/bp/es-419_obt/es-419_tn/v0.0.5`]: {
        ok: true,
        data: tnPackage(TN_OBT, ['tit'], ['tit']).map(emptyBible),
      },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: tnPackage(TN_GL, ['tit'], ['tit']),
      },
    });
    const found = await resolveResource(
      { lang: 'es-419', subject: TN, books: ['tit'] },
      { dcsApiUrl: API }
    );
    expect(found.owner).toBe('es-419_gl');
  });

  test('no books asked for and no ingredient list: no original-language Bible is required', async () => {
    serve({
      [`${API}/catalog/search?`]: { ok: true, data: [TN_GL] },
      [`${API}/catalog/bp/es-419_gl/es-419_tn/v66`]: {
        ok: true,
        data: blueprint(TN_GL, { withOT: false, withNT: false }),
      },
    });
    const found = await resolveResource({ lang: 'es-419', subject: TN }, { dcsApiUrl: API });
    expect(found.owner).toBe('es-419_gl');
  });
});

describe('resolveTarget', () => {
  test('language + subject: the found publisher, and a given ref is kept', async () => {
    axiosGetMock.mockImplementation(async (url) => {
      if (url.startsWith(`${API}/catalog/search?`)) return { data: { ok: true, data: [TN_GL] } };
      const bp = url.match(/\/catalog\/bp\/es-419_gl\/es-419_tn\/(v66|v60)/);
      if (bp) {
        return { data: { ok: true, data: blueprint({ ...TN_GL, branch_or_tag_name: bp[1] }) } };
      }
      throw new Error(`unexpected ${url}`);
    });
    const pinned = await resolveTarget(
      { lang: 'es-419', subject: 'TSV Translation Notes', ref: 'v60' },
      { dcsApiUrl: API }
    );
    expect(pinned).toMatchObject({ owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v60' });
    // The package returned is the one at the pinned ref.
    expect(pinned.resolved.catalogEntries[0].branch_or_tag_name).toBe('v60');

    const found = await resolveTarget(
      { lang: 'es-419', subject: 'TSV Translation Notes' },
      { dcsApiUrl: API }
    );
    expect(found).toMatchObject({ owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v66' });
    expect(found.resolved.catalogEntries[0].name).toBe('es-419_tn');
  });

  test('owner + repo: a given ref is untouched without a request; none means the latest release', async () => {
    expect(await resolveTarget({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v88' })).toEqual({
      owner: 'unfoldingWord',
      repo: 'en_tn',
      ref: 'v88',
    });
    expect(axiosGetMock).not.toHaveBeenCalled();

    axiosGetMock.mockResolvedValueOnce({ data: { tag_name: 'v91' } });
    expect(
      await resolveTarget({ owner: 'unfoldingWord', repo: 'en_tn' }, { dcsApiUrl: API })
    ).toEqual({
      owner: 'unfoldingWord',
      repo: 'en_tn',
      ref: 'v91',
    });
  });

  test('neither form is an error', async () => {
    await expect(resolveTarget({ lang: 'es-419' })).rejects.toThrow(
      'owner and repo, or lang and subject'
    );
  });
});

describe('hand-off into getResourceData', () => {
  test('a reordered blueprint still renders the selected resource, not its first dependency', async () => {
    const tn = {
      ...TN_GL,
      title: 'Notas de traducción',
      metadata_type: 'rc',
      language: 'es-419',
      ingredients: [{ identifier: 'tit', path: './tn_TIT.tsv', title: 'Tito', sort: 57 }],
      repo: { name: 'es-419_tn', owner: { username: 'es-419_gl' }, abbreviation: 'tn' },
    };
    const uhb = entry('unfoldingWord', 'hbo_uhb', 'v3.0.0', 'Hebrew Old Testament', {
      ingredients: [{ identifier: 'gen', path: './01-GEN.usfm' }],
      repo: { name: 'hbo_uhb', owner: { username: 'unfoldingWord' } },
    });
    const TSV =
      'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n1:1\ta1\t\t\t\t0\tUna nota.';
    axiosGetMock.mockImplementation(async (url) => {
      if (url.startsWith(`${API}/catalog/search?`)) return { data: { ok: true, data: [tn] } };
      if (url.startsWith(`${API}/catalog/bp/es-419_gl/es-419_tn/v66`)) {
        // A complete package, with a dependency listed before the resource itself.
        const rest = blueprint(TN_GL).filter((e) => e.name !== 'hbo_uhb' && e.name !== 'es-419_tn');
        return { data: { ok: true, data: [uhb, tn, ...rest] } };
      }
      // Its burrito, read at the release and then at the commit metadata.json names.
      const burrito = burritoMetadata('es-419_tn', {
        owner: 'es-419_gl',
        files: { 'ingredients/TIT.tsv': TSV },
        revision: 'abc123',
      });
      if (url === `${API}/repos/es-419_gl/es-419_tn/sb/raw/metadata.json?ref=v66`) {
        return { data: burrito };
      }
      if (url === `${API}/repos/es-419_gl/es-419_tn/sb/raw/ingredients/TIT.tsv?ref=abc123`) {
        return { data: TSV };
      }
      throw Object.assign(new Error(`404 ${url}`), { response: { status: 404 } });
    });

    const set = await getAllCatalogEntries(
      { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] },
      { dcsApiUrl: API, quiet: true }
    );
    const data = await getResourceData(set, { dcsApiUrl: API, quiet: true });

    expect(data.subject).toBe('TSV Translation Notes');
    expect(data.title).toBe('Notas de traducción');
    expect(data.books.tit.chapters['1'].verses['1'][0].Note).toBe('Una nota.');
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
    const langs = await listLanguages({}, { dcsApiUrl: API });
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
      { dcsApiUrl: API, quiet: true }
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

  test('resourceVersion is the resolved ref even when the blueprint lists another repo first', async () => {
    const bp = blueprint(TN_GL);
    const uhb = bp.find((e) => e.name === 'hbo_uhb');
    const reordered = [uhb, ...bp.filter((e) => e !== uhb)];
    axiosGetMock.mockImplementation(async (url) => {
      if (url.startsWith(`${API}/catalog/search?`)) return { data: { ok: true, data: [TN_GL] } };
      if (url.startsWith(`${API}/catalog/bp/es-419_gl/es-419_tn/v66`)) {
        return { data: { ok: true, data: reordered } };
      }
      throw new Error(`unexpected ${url}`);
    });
    const set = await getAllCatalogEntries(
      { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'] },
      { dcsApiUrl: API, quiet: true }
    );
    // The selected resource is first whatever order the blueprint listed.
    expect(set.catalogEntries[0].name).toBe('es-419_tn');
    expect(set.catalogEntries.map((e) => e.name)).toContain('hbo_uhb');
    expect(set.resourceVersion).toBe('v66');
  });

  test('an explicit ref is judged by its own blueprint, not by the latest release', async () => {
    const withBooks = (row, books) => ({
      ...row,
      ingredients: books.map((b) => ({ identifier: b, path: `./${b}.tsv` })),
    });
    // The latest release (v66) only has Genesis; the pinned v60 has Titus.
    const atRef = (ref, books) =>
      blueprint(withBooks({ ...TN_GL, branch_or_tag_name: ref }, books));
    axiosGetMock.mockImplementation(async (url) => {
      if (url.startsWith(`${API}/catalog/search?`)) {
        return { data: { ok: true, data: [withBooks(TN_GL, ['gen'])] } };
      }
      if (url.startsWith(`${API}/catalog/bp/es-419_gl/es-419_tn/v66`)) {
        return { data: { ok: true, data: atRef('v66', ['gen']) } };
      }
      if (url.startsWith(`${API}/catalog/bp/es-419_gl/es-419_tn/v60`)) {
        return { data: { ok: true, data: atRef('v60', ['tit']) } };
      }
      throw new Error(`unexpected ${url}`);
    });
    const query = { lang: 'es-419', subject: 'TSV Translation Notes', books: ['tit'], ref: 'v60' };
    const set = await getAllCatalogEntries(query, { dcsApiUrl: API, quiet: true });
    expect(set.source).toMatchObject({ owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v60' });
    expect(set.resourceVersion).toBe('v60');
    expect(set.catalogEntries[0].branch_or_tag_name).toBe('v60');

    const target = await resolveTarget(query, { dcsApiUrl: API });
    expect(target).toMatchObject({ owner: 'es-419_gl', repo: 'es-419_tn', ref: 'v60' });

    const urls = axiosGetMock.mock.calls.map(urlOf);
    expect(urls.some((u) => u.includes('/catalog/bp/es-419_gl/es-419_tn/v66'))).toBe(false);
  });
});
