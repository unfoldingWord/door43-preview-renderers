import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  directoryContentSource,
  contentSourceFor,
  entryCoords,
  readLicense,
} from '../contentSource.js';
import { getResourceDataFromDirectory } from '../getResourceData.js';
import { writeBurrito } from '../testing/burrito.js';

/**
 * Stage 2′ from burritos unpacked on disk. A small Titus Translation Notes
 * package is written to a temp folder, one folder per repository, each laid out
 * as DCS's SB archive (metadata.json and ingredients/); the aligned Bibles and
 * the Greek New Testament are the GL-quote parity fixtures. Nothing is fetched:
 * the DCS address is unreachable, so a read that went online would fail.
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

const entry = (name, subject, extra = {}) => ({
  name,
  owner: 'unfoldingWord',
  branch_or_tag_name: 'v91',
  subject,
  title: name,
  language: 'en',
  metadata_type: 'rc',
  repo: { name, owner: { username: 'unfoldingWord' } },
  ...extra,
});
const catalogEntries = () => [
  entry('en_tn', 'TSV Translation Notes', { abbreviation: 'tn', language_direction: 'ltr' }),
  entry('en_ult', 'Aligned Bible', { abbreviation: 'ult' }),
  entry('en_ust', 'Aligned Bible', { abbreviation: 'ust' }),
  entry('el-x-koine_ugnt', 'Greek New Testament', { language: 'el-x-koine' }),
  // The catalog names and orders a Translation Academy's manuals.
  entry('en_ta', 'Translation Academy', {
    ingredients: [{ identifier: 'translate', path: './translate', title: 'Translate' }],
  }),
  entry('en_tw', 'Translation Words'),
  entry('en_twl', 'TSV Translation Words Links'),
];

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-burritos-'));
  writeBurrito(dir, 'en_tn', {
    files: {
      'ingredients/TIT.tsv':
        'Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote\n' +
        '1:1\tabc1\t\trc://*/ta/man/translate/figs-abstractnouns\tΠαῦλος\t1\tPaul wrote this. (See: [[rc://*/ta/man/translate/figs-abstractnouns]])\n',
      'ingredients/LICENSE.md': '# License\n\nCC BY-SA 4.0\n',
    },
  });
  write('en_tn/.git/HEAD', 'ref: refs/heads/master\n'); // ignored
  const bible = (file) => ({
    flavorType: 'scripture',
    flavor: 'textTranslation',
    files: { 'ingredients/TIT.usfm': usfm(file) },
  });
  writeBurrito(dir, 'en_ult', bible('tit.ult.usfm'));
  writeBurrito(dir, 'en_ust', bible('tit.ust.usfm'));
  writeBurrito(dir, 'el-x-koine_ugnt', { ...bible('tit.ugnt.usfm'), language: 'el-x-koine' });
  writeBurrito(dir, 'en_ta', {
    flavorType: 'peripheral',
    flavor: 'x-peripheralArticles',
    files: {
      'ingredients/translate/toc.yaml':
        'title: Translate\nsections:\n  - title: Abstract Nouns\n    link: figs-abstractnouns\n',
      'ingredients/translate/config.yaml':
        'figs-abstractnouns:\n  recommended: []\n  dependencies: []\n',
      'ingredients/translate/figs-abstractnouns/title.md': 'Abstract Nouns',
      'ingredients/translate/figs-abstractnouns/sub-title.md': 'What are abstract nouns?',
      'ingredients/translate/figs-abstractnouns/01.md': 'An abstract noun names an idea.',
    },
  });
  // Translation Words and Translation Words Links share one burrito layout:
  // the TSVs, and the articles under ingredients/payload/. DCS's conversion
  // points each link at its payload article; it reads back as the rc link.
  const twl =
    'Reference\tID\tTags\tOrigWords\tOccurrence\tTWLink\n1:1\ttw1\tname\tΠαῦλος\t1\t./payload/names/paul.md\n';
  const articles = {
    flavor: 'x-bcvarticles',
    files: {
      'ingredients/TIT.tsv': twl,
      'ingredients/payload/names/paul.md': '# Paul, Saul\n\n## Facts:\n\nPaul was an apostle.\n',
      'ingredients/payload/kt/god.md': '# God\n\n## Definition:\n\nThe one true God.\n',
    },
  };
  writeBurrito(dir, 'en_tw', articles);
  writeBurrito(dir, 'en_twl', articles);
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const offline = { dcsApiUrl: 'http://127.0.0.1:9/api/v1', quiet: true };

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
    expect(await source().readFile({ name: 'en_tn' }, './ingredients/TIT.tsv')).toContain('abc1');
    expect(
      await source().readFile({ repo: { name: 'en_tn' } }, 'ingredients/LICENSE.md')
    ).toContain('CC BY');
    await expect(source().readFile({ name: 'en_tn' }, 'nope.tsv')).rejects.toThrow();
  });

  test('readMetadata parses metadata.json; a missing burrito is NOT_FOUND', async () => {
    expect((await source().readMetadata({ name: 'en_tn' })).ingredients).toHaveProperty([
      'ingredients/TIT.tsv',
    ]);
    await expect(source().readMetadata({ name: 'en_none' })).rejects.toMatchObject({
      name: 'ResourceError',
      code: 'NOT_FOUND',
    });
  });

  test("the license is the burrito's license ingredient, trimmed; '' when it lists none", async () => {
    expect(await readLicense(source(), { name: 'en_tn' })).toBe('# License\n\nCC BY-SA 4.0');
    expect(await readLicense(source(), ta)).toBe('');
  });

  test('readArchive lists the tree as the DCS SB archive does, by name per folder', async () => {
    write('en_ta/ingredients/translate/a/01.md', 'a');
    write('en_ta/ingredients/translate/a-b/01.md', 'a-b');
    const zip = await source().readArchive(ta);
    const names = Object.keys(zip.files);
    expect(names[0]).toBe('en_ta/');
    expect(names).toContain('en_ta/metadata.json');
    expect(names).toContain('en_ta/ingredients/translate/figs-abstractnouns/01.md');
    // Each folder's entries by name, depth first: `a/` and its files before `a-b/`.
    expect(names.indexOf('en_ta/ingredients/translate/a/01.md')).toBeLessThan(
      names.indexOf('en_ta/ingredients/translate/a-b/')
    );
    expect(
      await zip.file('en_ta/ingredients/translate/figs-abstractnouns/01.md').async('string')
    ).toBe('An abstract noun names an idea.');
    expect(zip.file('en_ta/ingredients/translate/')).toBeNull();
    expect(zip.file('en_ta/missing.md')).toBeNull();
  });

  test('readArchive skips dot folders such as .git', async () => {
    const zip = await source().readArchive({ name: 'en_tn' });
    expect(Object.keys(zip.files).some((n) => n.includes('.git'))).toBe(false);
  });

  test('archive files read as text only', async () => {
    const zip = await source().readArchive(ta);
    const file = zip.file('en_ta/ingredients/translate/figs-abstractnouns/01.md');
    await expect(file.async('uint8array')).rejects.toThrow('Unsupported read type');
  });

  test('a read never leaves the repository folder', async () => {
    write('outside.txt', 'secret');
    fs.symlinkSync(path.join(dir, 'outside.txt'), path.join(dir, 'en_tn', 'link.tsv'));
    write('en_tn/inner.tsv', 'inner');
    fs.symlinkSync(path.join(dir, 'en_tn', 'inner.tsv'), path.join(dir, 'en_tn', 'alias.tsv'));
    const tn = { name: 'en_tn' };
    await expect(source().readFile(tn, './../outside.txt')).rejects.toThrow('outside');
    await expect(source().readFile(tn, 'a/../../outside.txt')).rejects.toThrow('outside');
    await expect(source().readFile({ name: '../en_tn' }, 'ingredients/TIT.tsv')).rejects.toThrow(
      'single, visible folder name'
    );
    await expect(source().readArchive({ name: 'x/..' })).rejects.toThrow(
      'single, visible folder name'
    );
    await expect(source().readFile(tn, 'link.tsv')).rejects.toThrow('leads outside');
    await expect(source().readFile(tn, '.git/HEAD')).rejects.toThrow('hidden');
    // A clean name that resolves into .git is refused too, and so is a license
    // that does (#70 review).
    fs.symlinkSync(path.join(dir, 'en_tn', '.git', 'HEAD'), path.join(dir, 'en_tn', 'head.tsv'));
    await expect(source().readFile(tn, 'head.tsv')).rejects.toThrow('hidden file');
    const gitlic = writeBurrito(dir, 'en_gitlic', { files: { 'ingredients/LICENSE.md': 'x' } });
    write('en_gitlic/.git/config', '[remote] url = https://token@example.com');
    fs.rmSync(path.join(gitlic, 'ingredients', 'LICENSE.md'));
    fs.symlinkSync(
      path.join(gitlic, '.git', 'config'),
      path.join(gitlic, 'ingredients', 'LICENSE.md')
    );
    const lic = { name: 'en_gitlic' };
    await expect(source().readFile(lic, 'ingredients/LICENSE.md')).rejects.toThrow('hidden file');
    expect(await readLicense(source(), lic)).toBe(''); // nothing from .git leaks into a render
    // A symlink that stays inside the repository is still read.
    expect(await source().readFile(tn, 'alias.tsv')).toBe('inner');
  });

  test('a hidden folder cannot be the repository, by name or by symlink (#70 review)', async () => {
    write('.git/config', '[remote] url = https://token@example.com');
    write('.ssh/id_rsa', 'PRIVATE KEY');
    fs.symlinkSync(path.join(dir, '.git'), path.join(dir, 'en_link'));
    const refused = 'single, visible folder name';
    await expect(source().readFile({ name: '.git' }, 'config')).rejects.toThrow(refused);
    await expect(source().readArchive({ name: '.git' })).rejects.toThrow(refused);
    await expect(source().readMetadata({ name: '.git' })).rejects.toThrow(refused);
    await expect(source().readFile({ name: '.ssh' }, 'id_rsa')).rejects.toThrow(refused);
    // A visible name that is a symlink to a hidden folder in the checkout.
    await expect(source().readFile({ name: 'en_link' }, 'config')).rejects.toThrow(
      'resolves to a hidden folder'
    );
    await expect(source().readArchive({ name: 'en_link' })).rejects.toThrow(
      'resolves to a hidden folder'
    );
    // And through stage 2: a Bible entry named .git yields no book from it.
    await expect(
      getResourceDataFromDirectory(
        [
          {
            name: '.git',
            owner: 'x',
            branch_or_tag_name: 'v1',
            subject: 'Bible',
            metadata_type: 'rc',
          },
        ],
        dir,
        { ...offline, books: ['tit'] }
      )
    ).rejects.toThrow(refused);
  });

  test('a repository folder may be a symlink to a clone outside the checkout', async () => {
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-clone-'));
    try {
      fs.writeFileSync(path.join(elsewhere, 'tn_TIT.tsv'), 'from the clone');
      fs.symlinkSync(elsewhere, path.join(dir, 'en_farm'));
      expect(await source().readFile({ name: 'en_farm' }, 'tn_TIT.tsv')).toBe('from the clone');
      const zip = await source().readArchive({ name: 'en_farm' });
      expect(await zip.file('en_farm/tn_TIT.tsv').async('string')).toBe('from the clone');
    } finally {
      fs.rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  test('the archive lists a symlinked file readFile would read, and not one it would refuse', async () => {
    write('en_arch/real.md', 'real');
    write('en_arch/.git/HEAD', 'ref');
    fs.symlinkSync(path.join(dir, 'en_arch', 'real.md'), path.join(dir, 'en_arch', 'alias.md'));
    fs.symlinkSync(path.join(dir, 'en_arch', '.git', 'HEAD'), path.join(dir, 'en_arch', 'head.md'));
    fs.symlinkSync(path.join(dir, 'en_arch', 'gone.md'), path.join(dir, 'en_arch', 'dangling.md'));
    const zip = await source().readArchive({ name: 'en_arch' });
    expect(await zip.file('en_arch/alias.md').async('string')).toBe('real');
    expect(zip.file('en_arch/head.md')).toBeNull();
    expect(zip.file('en_arch/dangling.md')).toBeNull();
  });

  test('the Node modules are loaded outside browser bundles (webpackIgnore)', () => {
    const text = fs.readFileSync(path.join(here, '..', 'contentSource.js'), 'utf8');
    const imports = text.match(/import\([^)]*'node:[^']+'\)/g);
    expect(imports).toHaveLength(2);
    for (const call of imports) expect(call).toContain('webpackIgnore: true');
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
});
