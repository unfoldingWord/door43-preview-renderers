import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Option names in 1.x (#34, part C): `dcsApiUrl`, with the deprecated
 * `dcs_api_url` still read (one warning per process); getResourceData's
 * internal plumbing in a private argument, still honored on `options` with one
 * warning; and the caller's options never written to.
 *
 * Each test imports a fresh copy of the module, so "once per process" starts
 * over.
 */
const fresh = async () => {
  jest.resetModules();
  return import('../options.js');
};
const spyLogger = () => ({ info: jest.fn(), warn: jest.fn() });

describe('dcsApiUrlOf / dcsApiUrlFrom', () => {
  test('dcsApiUrl wins, then the old spelling, then the default', async () => {
    const { dcsApiUrlOf, DEFAULT_DCS_API_URL } = await fresh();
    const logger = spyLogger();
    expect(
      dcsApiUrlOf({
        dcsApiUrl: 'https://a.test/api/v1',
        dcs_api_url: 'https://b.test/api/v1',
        logger,
      })
    ).toBe('https://a.test/api/v1');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(dcsApiUrlOf({ logger })).toBe(DEFAULT_DCS_API_URL);
    expect(dcsApiUrlOf({ dcs_api_url: 'https://b.test/api/v1', logger })).toBe(
      'https://b.test/api/v1'
    );
  });

  test('the old spelling is reported once per process', async () => {
    const { dcsApiUrlOf } = await fresh();
    const logger = spyLogger();
    dcsApiUrlOf({ dcs_api_url: 'https://b.test/api/v1', logger });
    dcsApiUrlOf({ dcs_api_url: 'https://c.test/api/v1', logger });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/`dcs_api_url` is deprecated; pass `dcsApiUrl`/);
  });

  test('dcsApiUrlFrom takes the first object that names a URL', async () => {
    const { dcsApiUrlFrom, DEFAULT_DCS_API_URL } = await fresh();
    expect(dcsApiUrlFrom({}, { dcsApiUrl: 'https://src.test/api/v1' })).toBe(
      'https://src.test/api/v1'
    );
    expect(
      dcsApiUrlFrom(
        { dcsApiUrl: 'https://opt.test/api/v1' },
        { dcsApiUrl: 'https://src.test/api/v1' }
      )
    ).toBe('https://opt.test/api/v1');
    expect(dcsApiUrlFrom(undefined, {})).toBe(DEFAULT_DCS_API_URL);
  });

  test("an empty URL is the caller's, not the public default", async () => {
    const { dcsApiUrlOf, dcsApiUrlFrom } = await fresh();
    const logger = spyLogger();
    expect(dcsApiUrlOf({ dcsApiUrl: '' })).toBe('');
    expect(dcsApiUrlOf({ dcs_api_url: '', logger })).toBe('');
    expect(dcsApiUrlOf({ dcsApiUrl: '', dcs_api_url: 'https://b.test/api/v1' })).toBe('');
    expect(dcsApiUrlFrom({ dcsApiUrl: '' }, { dcsApiUrl: 'https://src.test/api/v1' })).toBe('');
  });

  test("the old spelling on a descriptor warns through the options' logger", async () => {
    const { dcsApiUrlFrom } = await fresh();
    const logger = spyLogger();
    expect(dcsApiUrlFrom({ logger }, { dcs_api_url: 'https://src.test/api/v1' })).toBe(
      'https://src.test/api/v1'
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('splitInternalOptions', () => {
  test('internal keys leave the public options, with one warning; the private argument wins', async () => {
    const { splitInternalOptions } = await fresh();
    const logger = spyLogger();
    const caller = { quiet: true, logger, isExtra: true, catalogEntry: { name: 'legacy' } };
    const { options, context } = splitInternalOptions(caller, {
      catalogEntry: { name: 'private' },
    });
    expect(options).toEqual({ quiet: true, logger });
    expect(context).toMatchObject({
      quiet: true,
      isExtra: true,
      catalogEntry: { name: 'private' },
    });
    expect(caller.isExtra).toBe(true); // the caller's object is untouched
    splitInternalOptions({ glBibleEntries: [], logger });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(
      /`isExtra`, `catalogEntry` are internal and deprecated/
    );
  });

  test('no internal keys, no warning', async () => {
    const { splitInternalOptions } = await fresh();
    const logger = spyLogger();
    expect(splitInternalOptions({ quiet: true, logger }, {}).context).toEqual({
      quiet: true,
      logger,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("getResourceData never writes to the caller's options", () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-opt-'));
    fs.mkdirSync(path.join(dir, 'en_tn'));
    fs.writeFileSync(
      path.join(dir, 'en_tn', 'tn_TIT.tsv'),
      'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n1:1\ta\t\t\t\t0\tA note.\n'
    );
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('a frozen options object is fine (it used to receive preEntries)', async () => {
    jest.resetModules();
    const { getResourceData } = await import('../getResourceData.js');
    const { directoryContentSource } = await import('../contentSource.js');
    const options = Object.freeze({ quiet: true, logger: spyLogger() });
    const set = {
      catalogEntries: [
        {
          name: 'en_tn',
          owner: 'o',
          branch_or_tag_name: 'v1',
          subject: 'TSV Translation Notes',
          metadata_type: 'rc',
          ingredients: [{ identifier: 'tit', path: './tn_TIT.tsv' }],
          repo: { name: 'en_tn', owner: { username: 'o' } },
        },
      ],
      source: { books: ['tit'] },
    };
    const data = await getResourceData(set, options, {
      contentSource: directoryContentSource(dir),
    });
    expect(data.books.tit.chapters['1'].verses['1'][0].Note).toBe('A note.');
    expect(Object.keys(options)).toEqual(['quiet', 'logger']);
  });
});
