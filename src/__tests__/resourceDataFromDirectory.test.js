import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { directoryContentSource, contentSourceFor, entryCoords } from '../contentSource.js';
import { getResourceDataFromDirectory } from '../getResourceData.js';

/**
 * Stage 2′ from repositories checked out on disk. A small Titus Translation
 * Notes package is written to a temp folder, one folder per repository; the
 * aligned Bibles and the Greek New Testament are the GL-quote parity fixtures.
 * Nothing is fetched: the DCS address is unreachable and no entry has a
 * zipball_url, so a read that went online would fail.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const usfm = (name) =>
  fs.readFileSync(path.join(here, '..', 'fixtures', 'glquotes', 'usfm', name), 'utf8');

let dir;
const write = (rel, text) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

const entry = (name, subject, ingredients, extra = {}) => ({
  name,
  owner: 'unfoldingWord',
  branch_or_tag_name: 'v91',
  subject,
  title: name,
  language: 'en',
  metadata_type: 'rc',
  ingredients,
  repo: { name, owner: { username: 'unfoldingWord' } },
  ...extra,
});
const catalogEntries = () => [
  entry('en_tn', 'TSV Translation Notes', [{ identifier: 'tit', path: './tn_TIT.tsv' }], {
    abbreviation: 'tn',
    language_direction: 'ltr',
  }),
  entry('en_ult', 'Aligned Bible', [{ identifier: 'tit', path: './57-TIT.usfm' }], {
    abbreviation: 'ult',
  }),
  entry('en_ust', 'Aligned Bible', [{ identifier: 'tit', path: './57-TIT.usfm' }], {
    abbreviation: 'ust',
  }),
  entry('el-x-koine_ugnt', 'Greek New Testament', [{ identifier: 'tit', path: './57-TIT.usfm' }], {
    language: 'el-x-koine',
  }),
  entry('en_ta', 'Translation Academy', [
    { identifier: 'translate', path: './translate', title: 'Translate' },
  ]),
  entry('en_tw', 'Translation Words', [{ identifier: 'bible', path: './bible' }]),
  entry('en_twl', 'TSV Translation Words Links', [{ identifier: 'tit', path: './twl_TIT.tsv' }]),
];

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-checkouts-'));
  write(
    'en_tn/tn_TIT.tsv',
    'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n' +
      '1:1\tabc1\t\trc://*/ta/man/translate/figs-abstractnouns\tΠαῦλος\t1\tPaul wrote this. (See: [[rc://*/ta/man/translate/figs-abstractnouns]])\n'
  );
  write('en_tn/LICENSE.md', '# License\n\nCC BY-SA 4.0\n');
  write('en_tn/.git/HEAD', 'ref: refs/heads/master\n'); // ignored
  write('en_ult/57-TIT.usfm', usfm('tit.ult.usfm'));
  write('en_ust/57-TIT.usfm', usfm('tit.ust.usfm'));
  write('el-x-koine_ugnt/57-TIT.usfm', usfm('tit.ugnt.usfm'));
  write(
    'en_ta/translate/toc.yaml',
    'title: Translate\nsections:\n  - title: Abstract Nouns\n    link: figs-abstractnouns\n'
  );
  write(
    'en_ta/translate/config.yaml',
    'figs-abstractnouns:\n  recommended: []\n  dependencies: []\n'
  );
  write('en_ta/translate/figs-abstractnouns/title.md', 'Abstract Nouns');
  write('en_ta/translate/figs-abstractnouns/sub-title.md', 'What are abstract nouns?');
  write('en_ta/translate/figs-abstractnouns/01.md', 'An abstract noun names an idea.');
  write('en_tw/bible/names/paul.md', '# Paul, Saul\n\n## Facts:\n\nPaul was an apostle.\n');
  write('en_tw/bible/kt/god.md', '# God\n\n## Definition:\n\nThe one true God.\n');
  write(
    'en_twl/twl_TIT.tsv',
    'Reference\tID\tTags\tOrigWords\tOccurrence\tTWLink\n1:1\ttw1\tname\tΠαῦλος\t1\trc://*/tw/dict/bible/names/paul\n'
  );
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const offline = { dcs_api_url: 'http://127.0.0.1:9/api/v1', quiet: true };

describe('getResourceDataFromDirectory', () => {
  test('reads the resource and every supporting resource from the checkouts', async () => {
    const data = await getResourceDataFromDirectory(catalogEntries(), dir, {
      ...offline,
      books: ['tit'],
    });
    expect(data.subject).toBe('TSV Translation Notes');
    expect(data.license).toBe('# License\n\nCC BY-SA 4.0');
    expect(data.language).toBe('en');
    const row = data.books.tit.chapters['1'].verses['1'][0];
    expect(row.Note).toContain('Paul wrote this.');
    // GL quotes worked out from the local aligned Bibles and Greek New Testament.
    expect(row.GLQuotes.en_ult.Quote).toBe('Paul');
    expect(Object.keys(data.extras).sort()).toEqual(['ta', 'tw', 'twl', 'ugnt', 'ult', 'ust']);
    expect(data.extras.ta.manuals.translate.articles['figs-abstractnouns'].title).toBe(
      'Abstract Nouns'
    );
    expect(data.extras.tw.articles.names.paul.title).toBe('Paul, Saul');
    expect(data.extras.twl.books.tit.chapters['1'].verses['1'][0].TWLink).toBe(
      'rc://*/tw/dict/bible/names/paul'
    );
    expect(data.extras.ult.books.tit).toContain('\\v 1 Paul');
  });

  test('takes a CatalogSet too, with its books', async () => {
    const data = await getResourceDataFromDirectory(
      { catalogEntries: catalogEntries(), source: { books: ['tit'] } },
      dir,
      offline
    );
    expect(Object.keys(data.books)).toEqual(['tit']);
  });

  test('a supporting resource that is not checked out is skipped, as online', async () => {
    const entries = catalogEntries().map((e) =>
      e.name === 'en_tw' ? { ...e, name: 'en_tw_missing', repo: { name: 'en_tw_missing' } } : e
    );
    const data = await getResourceDataFromDirectory(entries, dir, { ...offline, books: ['tit'] });
    expect(data.extras.tw).toBeUndefined();
    expect(data.extras.ta).toBeDefined();
  });

  test('refuses arguments that name no entries or no directory', async () => {
    await expect(getResourceDataFromDirectory([], dir)).rejects.toThrow('catalog entries');
    await expect(getResourceDataFromDirectory({}, dir)).rejects.toThrow('catalog entries');
    await expect(getResourceDataFromDirectory(catalogEntries(), '')).rejects.toThrow('dirPath');
  });
});

describe('directoryContentSource', () => {
  const source = () => directoryContentSource(dir);
  const ta = { name: 'en_ta' };

  test('readFile reads by ingredient path, with or without ./', async () => {
    expect(await source().readFile({ name: 'en_tn' }, './tn_TIT.tsv')).toContain('abc1');
    expect(await source().readFile({ repo: { name: 'en_tn' } }, 'LICENSE.md')).toContain('CC BY');
    await expect(source().readFile({ name: 'en_tn' }, 'nope.tsv')).rejects.toThrow();
  });

  test("readLicense: the first license file, trimmed; '' when there is none", async () => {
    expect(await source().readLicense({ name: 'en_tn' })).toBe('# License\n\nCC BY-SA 4.0');
    expect(await source().readLicense(ta)).toBe('');
  });

  test("readArchive lists the tree as the DCS archive does, in git's order", async () => {
    write('en_ta/translate/a/01.md', 'a');
    write('en_ta/translate/a-b/01.md', 'a-b');
    const zip = await source().readArchive(ta);
    const names = Object.keys(zip.files);
    expect(names[0]).toBe('en_ta/');
    expect(names).toContain('en_ta/translate/figs-abstractnouns/01.md');
    // Git compares a folder as its name plus '/', so `a-b/` comes before `a/`.
    expect(names.indexOf('en_ta/translate/a-b/')).toBeLessThan(names.indexOf('en_ta/translate/a/'));
    expect(await zip.file('en_ta/translate/figs-abstractnouns/01.md').async('string')).toBe(
      'An abstract noun names an idea.'
    );
    expect(zip.file('en_ta/translate/')).toBeNull();
    expect(zip.file('en_ta/missing.md')).toBeNull();
  });

  test('readArchive skips dot folders such as .git', async () => {
    const zip = await source().readArchive({ name: 'en_tn' });
    expect(Object.keys(zip.files).some((n) => n.includes('.git'))).toBe(false);
  });
});

describe('content source helpers', () => {
  test('entryCoords reads a blueprint row or a full entry', () => {
    expect(entryCoords({ owner: 'o', name: 'r', branch_or_tag_name: 'v1' })).toEqual({
      owner: 'o',
      repo: 'r',
      ref: 'v1',
    });
    expect(entryCoords({ repo: { name: 'r', owner: { login: 'o' } }, ref: 'main' })).toEqual({
      owner: 'o',
      repo: 'r',
      ref: 'main',
    });
  });

  test('contentSourceFor: the one in the options, else DCS', () => {
    const given = { readFile() {} };
    expect(contentSourceFor({ contentSource: given })).toBe(given);
    expect(typeof contentSourceFor({}).readArchive).toBe('function');
  });

  test('the DCS source refuses an archive read without a zipball_url', async () => {
    await expect(contentSourceFor({}).readArchive({ name: 'x' })).rejects.toThrow('zipball_url');
  });
});
