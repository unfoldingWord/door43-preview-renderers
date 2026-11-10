import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const axiosGetMock = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get: axiosGetMock } }));

const { ResourceError } = await import('../errors.js');
const { getCatalogEntry, getResourceData, getResourceDataFromDirectory } =
  await import('../getResourceData.js');
const { getAllCatalogEntries } = await import('../getAllCatalogEntries.js');
const { renderHtmlData } = await import('../renderHtmlData.js');
const { extractRcAlignedBibleData } = await import('../rcAlignedBibleHelpers.js');
const { extractRcTsvData } = await import('../tsvHelpers.js');
const { resolveRef, findResources } = await import('../findResources.js');
const lib = await import('../index.js');
const { burritoMetadata, writeBurrito } = await import('../testing/burrito.js');

/**
 * The error contract (#34, part B): the stages throw a ResourceError with a
 * `code`, and the HTTP `status` and `url` when there was a request. In 1.x
 * getResourceData still returns `{ error }` for a failed catalog lookup unless
 * `throwOnError` is set.
 */
const quiet = { quiet: true, logger: { info() {}, warn() {} } };
const httpError = (status) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, statusText: 'Not Found' },
  });

beforeEach(() => axiosGetMock.mockReset());

describe('ResourceError', () => {
  test('is exported, and derives its code from the status', () => {
    expect(lib.ResourceError).toBe(ResourceError);
    expect(new ResourceError('x', { status: 404 }).code).toBe('NOT_FOUND');
    expect(new ResourceError('x', { status: 500 }).code).toBe('HTTP');
    expect(new ResourceError('x', { code: 'NO_CONTENT' })).toMatchObject({
      name: 'ResourceError',
      code: 'NO_CONTENT',
    });
    const network = ResourceError.fromRequest('Failed', new Error('socket hang up'), 'https://x/y');
    expect(network).toMatchObject({
      code: 'NETWORK',
      url: 'https://x/y',
      message: 'Failed: socket hang up',
    });
    expect(network).toBeInstanceOf(Error);
  });
});

describe('catalog requests', () => {
  test('getCatalogEntry: a 404 is NOT_FOUND, with its status and URL', async () => {
    axiosGetMock.mockRejectedValue(httpError(404));
    const error = await getCatalogEntry('o', 'r', 'v1', 'https://dcs.test/api/v1', true).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(ResourceError);
    expect(error).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      url: 'https://dcs.test/api/v1/catalog/entry/o/r/v1',
    });
    expect(error.message).toMatch(/^Failed to get catalog entry: /);
  });

  test('getAllCatalogEntries: an HTTP error, a network error, an empty blueprint', async () => {
    const source = { owner: 'o', repo: 'r', ref: 'v1' };
    axiosGetMock.mockRejectedValueOnce(httpError(503));
    await expect(getAllCatalogEntries(source, quiet)).rejects.toMatchObject({
      name: 'ResourceError',
      code: 'HTTP',
      status: 503,
      url: 'https://git.door43.org/api/v1/catalog/bp/o/r/v1',
    });
    axiosGetMock.mockRejectedValueOnce(new Error('timeout of 30000ms exceeded'));
    await expect(getAllCatalogEntries(source, quiet)).rejects.toMatchObject({ code: 'NETWORK' });
    axiosGetMock.mockResolvedValueOnce({ data: { data: [] } });
    await expect(getAllCatalogEntries(source, quiet)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('USFM book failures', () => {
  const url = 'https://dcs.test/api/v1/repos/o/en_ult/sb/raw/ingredients/TIT.usfm?ref=v1';
  const entry = {
    owner: 'o',
    name: 'en_ult',
    branch_or_tag_name: 'v1',
    subject: 'Aligned Bible',
    ingredients: [{ identifier: 'tit', path: './57-TIT.usfm' }],
  };
  const failWith = (error) =>
    extractRcAlignedBibleData(entry, ['tit'], {
      ...quiet,
      contentSource: {
        readMetadata: async () =>
          burritoMetadata('en_ult', { files: { 'ingredients/TIT.usfm': '' } }),
        readFile: () => Promise.reject(error),
      },
    }).catch((e) => e);

  test('a timeout is NETWORK and an HTTP failure keeps its status, both with the URL', async () => {
    const timeout = Object.assign(new Error('timeout of 30000ms exceeded'), {
      isAxiosError: true,
      code: 'ECONNABORTED',
      config: { url },
      request: {},
    });
    expect(await failWith(timeout)).toMatchObject({ name: 'ResourceError', code: 'NETWORK', url });
    const notFound = Object.assign(httpError(404), { isAxiosError: true, config: { url } });
    expect(await failWith(notFound)).toMatchObject({ code: 'NOT_FOUND', status: 404, url });
  });

  test("an inner ResourceError keeps its code and URL; a processing error isn't NETWORK", async () => {
    const inner = new ResourceError('x', { code: 'NETWORK', url });
    expect(await failWith(inner)).toMatchObject({ code: 'NETWORK', url });
    const parse = await failWith(new TypeError('bad usfm'));
    expect(parse).toBeInstanceOf(ResourceError);
    expect(parse.code).toBe('INVALID_INPUT');
    expect(parse.cause).toBeInstanceOf(TypeError);
  });

  test('a file missing from a local checkout is NOT_FOUND', async () => {
    const missing = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    expect(await failWith(missing)).toMatchObject({ name: 'ResourceError', code: 'NOT_FOUND' });
  });
});

describe('TSV book failures', () => {
  const entry = {
    owner: 'o',
    name: 'en_tn',
    branch_or_tag_name: 'v1',
    subject: 'TSV Translation Notes',
    ingredients: [{ identifier: 'tit', path: './tn_TIT.tsv' }],
  };
  const failWith = (error) =>
    extractRcTsvData(entry, ['tit'], {
      ...quiet,
      contentSource: {
        readMetadata: async () =>
          burritoMetadata('en_tn', { files: { 'ingredients/TIT.tsv': '' } }),
        readFile: () => Promise.reject(error),
      },
    }).catch((e) => e);

  test('a read failure is a ResourceError with a documented code', async () => {
    const url = 'https://dcs.test/api/v1/repos/o/en_tn/sb/raw/ingredients/TIT.tsv?ref=v1';
    const notFound = Object.assign(httpError(404), { isAxiosError: true, config: { url } });
    expect(await failWith(notFound)).toMatchObject({ code: 'NOT_FOUND', status: 404, url });
    const missing = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    expect(await failWith(missing)).toMatchObject({ name: 'ResourceError', code: 'NOT_FOUND' });
    expect(await failWith(new Error('refused'))).toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('arguments and stage 0', () => {
  test('getAllCatalogEntries: a bad source or a missing ref is INVALID_INPUT', async () => {
    await expect(getAllCatalogEntries(null, quiet)).rejects.toMatchObject({
      name: 'ResourceError',
      code: 'INVALID_INPUT',
    });
    await expect(getAllCatalogEntries({ owner: 'o', repo: 'r' }, quiet)).rejects.toMatchObject({
      name: 'ResourceError',
      code: 'INVALID_INPUT',
    });
  });

  test('stage 0: a failed DCS request is a ResourceError with its status or NETWORK', async () => {
    const api = { dcsApiUrl: 'https://stage0.test/api/v1' };
    axiosGetMock.mockRejectedValueOnce(httpError(503));
    await expect(resolveRef({ owner: 'o', repo: 'r' }, api)).rejects.toMatchObject({
      name: 'ResourceError',
      code: 'HTTP',
      status: 503,
    });
    axiosGetMock.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'));
    await expect(findResources({ lang: 'xx' }, api)).rejects.toMatchObject({
      name: 'ResourceError',
      code: 'NETWORK',
    });
  });
});

describe('getResourceData throws', () => {
  test('a failed catalog lookup is the ResourceError, with its status and URL', async () => {
    axiosGetMock.mockRejectedValue(httpError(404));
    await expect(
      getResourceData({ owner: 'o', repo: 'r', ref: 'v1' }, quiet)
    ).rejects.toMatchObject({
      name: 'ResourceError',
      code: 'NOT_FOUND',
      status: 404,
      url: 'https://git.door43.org/api/v1/catalog/entry/o/r/v1',
    });
  });

  test('bad input and an unsupported type have their codes', async () => {
    await expect(getResourceData({ nonsense: true })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    await expect(
      getResourceData({ name: 'x', subject: 'Nothing Known', flavor: 'x-unknown' }, quiet)
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(() => renderHtmlData({ type: 'tsv', subject: 'Nothing Known' })).toThrow(
      expect.objectContaining({ code: 'UNSUPPORTED' })
    );
  });
});

describe('local data: NO_CONTENT and GL-quote misses', () => {
  let dir;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const usfm = (n) =>
    fs.readFileSync(path.join(here, '..', 'fixtures', 'glquotes', 'usfm', n), 'utf8');
  const entry = (name, subject, file, extra = {}) => ({
    name,
    owner: 'unfoldingWord',
    branch_or_tag_name: 'v91',
    subject,
    language: 'en',
    metadata_type: 'rc',
    ingredients: [{ identifier: 'tit', path: file }],
    repo: { name, owner: { username: 'unfoldingWord' } },
    ...extra,
  });
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-err-'));
    writeBurrito(dir, 'en_tn', {
      files: {
        'ingredients/TIT.tsv':
          'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n' +
          '1:1\ta1\t\t\tΠαῦλος\t1\tFound.\n' +
          '1:1\ta2\t\t\tζζζζ\t1\tNot in the Greek.\n',
      },
    });
    const bible = { flavorType: 'scripture', flavor: 'textTranslation' };
    writeBurrito(dir, 'en_ult', {
      ...bible,
      files: { 'ingredients/TIT.usfm': usfm('tit.ult.usfm') },
    });
    writeBurrito(dir, 'el-x-koine_ugnt', {
      ...bible,
      language: 'el-x-koine',
      files: { 'ingredients/TIT.usfm': usfm('tit.ugnt.usfm') },
    });
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  const entries = () => [
    entry('en_tn', 'TSV Translation Notes', './tn_TIT.tsv'),
    entry('en_ult', 'Aligned Bible', './57-TIT.usfm', { abbreviation: 'ult' }),
    entry('el-x-koine_ugnt', 'Greek New Testament', './57-TIT.usfm', { language: 'el-x-koine' }),
  ];

  test('a quote with no aligned words is listed on the book', async () => {
    const data = await getResourceDataFromDirectory(entries(), dir, { ...quiet, books: ['tit'] });
    expect(data.books.tit.glQuoteMisses).toEqual([
      { reference: '1:1', quote: 'ζζζζ', repo: 'en_ult' },
    ]);
    expect(data.books.tit.chapters['1'].verses['1'][0].GLQuotes.en_ult.Quote).toBe('Paul');
  });

  test('a TSV resource with none of the requested books is NO_CONTENT', async () => {
    await expect(
      getResourceDataFromDirectory(entries(), dir, { ...quiet, books: ['phm'], throwOnError: true })
    ).rejects.toMatchObject({ name: 'ResourceError', code: 'NO_CONTENT' });
  });
});
