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
const lib = await import('../index.js');

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

describe('getResourceData: 1.x { error } and throwOnError', () => {
  test('by default a failed catalog lookup returns { error, code, status, url }', async () => {
    axiosGetMock.mockRejectedValue(httpError(404));
    const result = await getResourceData({ owner: 'o', repo: 'r', ref: 'v1' }, quiet);
    expect(result).toEqual({
      error: 'Failed to get catalog entry: Request failed with status code 404',
      code: 'NOT_FOUND',
      status: 404,
      url: 'https://git.door43.org/api/v1/catalog/entry/o/r/v1',
    });
    // renderHtmlData turns it back into the ResourceError it was.
    expect(() => renderHtmlData(result)).toThrow(ResourceError);
    try {
      renderHtmlData(result);
    } catch (e) {
      expect(e).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    }
  });

  test('throwOnError: true throws the ResourceError instead', async () => {
    axiosGetMock.mockRejectedValue(httpError(404));
    await expect(
      getResourceData({ owner: 'o', repo: 'r', ref: 'v1' }, { ...quiet, throwOnError: true })
    ).rejects.toMatchObject({ name: 'ResourceError', code: 'NOT_FOUND', status: 404 });
  });

  test('bad input and an unsupported type have their codes', async () => {
    await expect(getResourceData({ nonsense: true })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    await expect(
      getResourceData(
        { name: 'x', subject: 'Bible', metadata_type: 'zz', ingredients: [{}] },
        quiet
      )
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
    const w = (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), text);
    };
    w(
      'en_tn/tn_TIT.tsv',
      'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n' +
        '1:1\ta1\t\t\tΠαῦλος\t1\tFound.\n' +
        '1:1\ta2\t\t\tζζζζ\t1\tNot in the Greek.\n'
    );
    w('en_ult/57-TIT.usfm', usfm('tit.ult.usfm'));
    w('el-x-koine_ugnt/57-TIT.usfm', usfm('tit.ugnt.usfm'));
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
