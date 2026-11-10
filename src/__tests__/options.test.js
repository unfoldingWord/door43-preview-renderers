import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  dcsApiUrlOf,
  dcsApiUrlFrom,
  splitInternalOptions,
  DEFAULT_DCS_API_URL,
} from '../options.js';
import { writeBurrito } from '../testing/burrito.js';

/**
 * Option names (#34, part C): `dcsApiUrl` is the one name for the DCS API;
 * getResourceData's internal plumbing travels only in its private third
 * argument; and the caller's options are never written to.
 */
const spyLogger = () => ({ info: jest.fn(), warn: jest.fn() });

describe('dcsApiUrlOf / dcsApiUrlFrom', () => {
  test('dcsApiUrl, else the default; the old snake_case name is not read', () => {
    expect(dcsApiUrlOf({ dcsApiUrl: 'https://a.test/api/v1' })).toBe('https://a.test/api/v1');
    expect(dcsApiUrlOf({})).toBe(DEFAULT_DCS_API_URL);
    expect(dcsApiUrlOf(undefined)).toBe(DEFAULT_DCS_API_URL);
    expect(dcsApiUrlOf({ dcs_api_url: 'https://b.test/api/v1' })).toBe(DEFAULT_DCS_API_URL);
  });

  test('dcsApiUrlFrom takes the first object that names a URL', () => {
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

  test("an empty URL is the caller's, not the public default", () => {
    expect(dcsApiUrlOf({ dcsApiUrl: '' })).toBe('');
    expect(dcsApiUrlFrom({ dcsApiUrl: '' }, { dcsApiUrl: 'https://src.test/api/v1' })).toBe('');
  });
});

describe('splitInternalOptions', () => {
  test('internal keys on options are dropped; only the private argument reaches the context', () => {
    const logger = spyLogger();
    const caller = { quiet: true, logger, isExtra: true, catalogEntry: { name: 'from-options' } };
    const { options, context } = splitInternalOptions(caller, {
      catalogEntry: { name: 'private' },
    });
    expect(options).toEqual({ quiet: true, logger });
    expect(context).toEqual({ quiet: true, logger, catalogEntry: { name: 'private' } });
    expect(caller.isExtra).toBe(true); // the caller's object is untouched
    expect(splitInternalOptions({ contentSource: {} }).context).toEqual({});
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("getResourceData never writes to the caller's options", () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-opt-'));
    writeBurrito(dir, 'en_tn', {
      files: {
        'ingredients/TIT.tsv':
          'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n1:1\ta\t\t\t\t0\tA note.\n',
      },
    });
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
