import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

const axiosGetMock = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get: axiosGetMock } }));

const { loggerFor } = await import('../logger.js');
const { getAllCatalogEntries } = await import('../getAllCatalogEntries.js');
const { getResourceDataFromDirectory } = await import('../getResourceData.js');

/**
 * Logging per call (#34): `quiet` silences progress only, warnings always reach
 * the logger, and a `logger` option replaces the console.
 */
const spyLogger = () => ({ info: jest.fn(), warn: jest.fn() });

beforeEach(() => axiosGetMock.mockReset());

describe('loggerFor', () => {
  test('quiet silences info, never warn', () => {
    const sink = spyLogger();
    const quiet = loggerFor({ quiet: true, logger: sink });
    quiet.info('progress');
    quiet.warn('problem');
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledWith('problem');
    loggerFor({ logger: sink }).info('shown');
    expect(sink.info).toHaveBeenCalledWith('shown');
  });

  test('a logger missing a method falls back to the console', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      loggerFor({ logger: {} }).warn('w');
      loggerFor({}).info('i');
      expect(warn).toHaveBeenCalledWith('w');
      expect(info).toHaveBeenCalledWith('i');
    } finally {
      warn.mockRestore();
      info.mockRestore();
    }
  });
});

describe('progress logging is per call', () => {
  test('getAllCatalogEntries reports the blueprint URL to its own logger, unless quiet', async () => {
    axiosGetMock.mockResolvedValue({ data: { data: [{ name: 'en_tn', owner: 'unfoldingWord' }] } });
    const a = spyLogger();
    const b = spyLogger();
    // Two calls in flight together, with different settings.
    await Promise.all([
      getAllCatalogEntries(
        { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v91' },
        { quiet: true, logger: a }
      ),
      getAllCatalogEntries({ owner: 'unfoldingWord', repo: 'en_tw', ref: 'v91' }, { logger: b }),
    ]);
    expect(a.info).not.toHaveBeenCalled();
    expect(b.info).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/catalog/bp/unfoldingWord/en_tw/v91'
    );
    expect(b.info).toHaveBeenCalledTimes(1);
  });
});

describe('warnings are reported even when quiet', () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-log-'));
    fs.mkdirSync(path.join(dir, 'en_tn'));
    fs.writeFileSync(
      path.join(dir, 'en_tn', 'tn_TIT.tsv'),
      'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n1:1\ta1\t\t\tΠαῦλος\t1\tA note.\n'
    );
    // en_ult is checked out without its Titus file; the Greek NT is not checked out.
    fs.mkdirSync(path.join(dir, 'en_ult'));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('a Bible that cannot be read for GL quotes is a warning, not silence', async () => {
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
    const sink = spyLogger();
    const data = await getResourceDataFromDirectory(
      [
        entry('en_tn', 'TSV Translation Notes', './tn_TIT.tsv'),
        entry('en_ult', 'Aligned Bible', './57-TIT.usfm', { abbreviation: 'ult' }),
        entry('el-x-koine_ugnt', 'Greek New Testament', './57-TIT.usfm', {
          language: 'el-x-koine',
        }),
      ],
      dir,
      { quiet: true, logger: sink, books: ['tit'] }
    );
    expect(data.books.tit.chapters['1'].verses['1'][0].Note).toBe('A note.');
    const warnings = sink.warn.mock.calls.map((c) => c[0]);
    expect(warnings.some((w) => /Could not read .*en_ult.* tit for GL quotes/.test(w))).toBe(true);
    expect(warnings.some((w) => /Skipping extra resource/.test(w))).toBe(true);
    expect(sink.info).not.toHaveBeenCalled(); // quiet: no progress
  });
});
