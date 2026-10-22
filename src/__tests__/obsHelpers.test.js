import fs from 'fs';
import os from 'os';
import path from 'path';
import { getObsContentPath, formatObsData } from '../obsHelpers.js';
import { getResourceDataFromDirectory } from '../getResourceData.js';

const entry = (type, ingredients) => ({
  metadata_type: type,
  ingredients: ingredients.map(([identifier, path]) => ({ identifier, path })),
});

describe('getObsContentPath', () => {
  test.each([
    ['rc', [['obs', './content']], './content'],
    [
      'rc',
      [
        ['obs', './content'],
        ['01', './content/01.md'],
      ],
      './content',
    ],
    [
      'sb',
      [
        ['obs', './ingredients'],
        ['01', './ingredients/content/01.md'],
      ],
      './ingredients',
    ],
    ['ts', [['obs', '.']], '.'],
  ])('uses the obs folder DCS lists (%s %j)', (type, ingredients, path) => {
    expect(getObsContentPath(entry(type, ingredients))).toBe(path);
  });

  // rc2sb keeps its stories in ingredients/content, Scribe in ingredients, tS in the repo root
  test.each([
    ['sb', [['front', './ingredients/content/front']], './ingredients/content'],
    ['sb', [['01', './ingredients/content/01.md']], './ingredients/content'],
    [
      'sb',
      [
        ['front', './ingredients/front.md'],
        ['01', './ingredients/01.md'],
      ],
      './ingredients',
    ],
    [
      'ts',
      [
        ['front', './front'],
        ['01', './01'],
      ],
      '.',
    ],
  ])('uses the folder of the listed stories (%s %j)', (type, ingredients, path) => {
    expect(getObsContentPath(entry(type, ingredients))).toBe(path);
  });

  test.each([
    ['sb', './ingredients'],
    ['ts', '.'],
    ['rc', './content'],
  ])('falls back to where %s keeps its stories', (type, path) => {
    expect(getObsContentPath(entry(type, []))).toBe(path);
    expect(getObsContentPath({ metadata_type: type })).toBe(path);
  });
});

/**
 * OBS extraction end to end (#30): small RC, Scripture Burrito and tS
 * repositories written to a temp folder and read through
 * getResourceDataFromDirectory, so the real archive walk and story parsing run.
 */
describe('OBS extraction (RC, SB, tS)', () => {
  let dir;
  const write = (rel, text) => {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const story = (title, frames, reference) =>
    `# ${title}\n\n` +
    frames.map(([img, text]) => `![OBS Image](${img})\n\n${text}\n\n`).join('') +
    `_${reference}_\n`;
  const read = (catalogEntry) =>
    getResourceDataFromDirectory([catalogEntry], dir, {
      dcsApiUrl: 'http://127.0.0.1:9/api/v1',
      quiet: true,
    });

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-obs-'));
    // RC: content/<NN>.md, front/ title and intro, LICENSE.md
    write('en_obs/LICENSE.md', '# License\n\nCC BY-SA 4.0\n');
    write('en_obs/content/front/title.md', 'Open Bible Stories\n');
    write('en_obs/content/front/intro.md', '# Front\n\nAbout these stories.\n');
    write(
      'en_obs/content/01.md',
      story(
        '1. The Creation',
        [
          [
            'https://cdn.door43.org/obs/jpg/360px/obs-en-01-01.jpg?v=2',
            'This is how God made everything.',
          ],
          [
            'https://cdn.door43.org/obs/jpg/360px/obs-en-01-02.jpg',
            'But the earth was empty\nand dark.',
          ],
        ],
        'A Bible story from: Genesis 1-2'
      )
    );
    write(
      'en_obs/content/10.md',
      story(
        '10. The Ten Plagues',
        [['https://x.test/obs-en-10-01.jpg', 'Moses and Aaron went.']],
        'Exodus 5-10'
      )
    );
    write(
      'en_obs/content/02.md',
      story(
        '2. Sin Enters the World',
        [['https://x.test/obs-en-02-01.jpg', 'Adam and his wife.']],
        'Genesis 3'
      )
    );
    // SB: the same Markdown under ingredients/
    write(
      'en_obs_sb/ingredients/01.md',
      story('1. The Creation', [['https://x.test/1.jpg', 'In the beginning.']], 'Genesis 1')
    );
    // tS: <NN>/title.txt, reference.txt and one text file per frame
    write('en_obs_ts/front/title.txt', 'Hadithi za Biblia\n');
    write('en_obs_ts/LICENSE.md', 'CC BY-SA 4.0');
    write('en_obs_ts/01/title.txt', '1. Uumbaji\n');
    write('en_obs_ts/01/reference.txt', '_Mwanzo 1-2_\n');
    write('en_obs_ts/01/02.txt', 'Frame two.\n');
    write('en_obs_ts/01/01.txt', 'Frame one.\n');
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('RC: stories in numeric order, frames with their pictures, the front matter and license', async () => {
    const data = await read({
      name: 'en_obs',
      owner: 'unfoldingWord',
      branch_or_tag_name: 'v9',
      subject: 'Open Bible Stories',
      title: 'Catalog title',
      abbreviation: 'obs',
      metadata_type: 'rc',
      ingredients: [{ identifier: 'obs', path: './content' }],
    });
    expect(data).toMatchObject({
      type: 'obs',
      subject: 'Open Bible Stories',
      title: 'Open Bible Stories', // front/title.md wins over the catalog title
      abbreviation: 'obs',
      version: 'v9',
      front: '# Front\n\nAbout these stories.',
      license: '# License\n\nCC BY-SA 4.0',
    });
    expect(Object.keys(data.stories)).toEqual(['1', '2', '10']);
    const creation = data.stories[1];
    expect(creation.title).toBe('1. The Creation');
    expect(creation.reference).toBe('A Bible story from: Genesis 1-2');
    expect(creation.frames[1]).toEqual({
      slug: '01-01',
      img: 'https://cdn.door43.org/obs/jpg/360px/obs-en-01-01.jpg', // query string dropped
      text: 'This is how God made everything.',
    });
    // A frame's lines are joined into one paragraph.
    expect(creation.frames[2].text).toBe('But the earth was empty and dark.');
  });

  test('SB (gloss / textStories): read from ingredients/', async () => {
    const data = await read({
      name: 'en_obs_sb',
      owner: 'o',
      branch_or_tag_name: 'master',
      subject: 'Open Bible Stories',
      title: 'OBS (SB)',
      metadata_type: 'sb',
      flavor_type: 'gloss',
      flavor: 'textStories',
      ingredients: [{ identifier: '01', path: './ingredients/01.md' }],
    });
    expect(data.metadataType).toBe('sb');
    expect(data.flavor).toBe('textStories');
    expect(data.title).toBe('OBS (SB)'); // no front/title.md: the catalog title
    expect(data.stories[1].frames[1].text).toBe('In the beginning.');
  });

  test('tS: one file per frame, pictures from the CDN by story and frame', async () => {
    const data = await read({
      name: 'en_obs_ts',
      owner: 'o',
      branch_or_tag_name: 'master',
      subject: 'Open Bible Stories',
      title: 'OBS (tS)',
      metadata_type: 'ts',
      ingredients: [{ identifier: 'obs', path: '.' }],
    });
    expect(data.title).toBe('Hadithi za Biblia');
    expect(data.front).toBe('');
    expect(data.license).toBe('CC BY-SA 4.0');
    expect(data.stories[1]).toEqual({
      title: '1. Uumbaji',
      reference: 'Mwanzo 1-2',
      frames: {
        1: {
          slug: '01-01',
          img: 'https://cdn.door43.org/obs/jpg/360px/obs-en-01-01.jpg',
          text: 'Frame one.',
        },
        2: {
          slug: '01-02',
          img: 'https://cdn.door43.org/obs/jpg/360px/obs-en-01-02.jpg',
          text: 'Frame two.',
        },
      },
    });
  });

  test('formatObsData sorts stories and frames numerically', () => {
    const data = formatObsData(
      {
        title: 'T',
        front: '',
        license: '',
        stories: { 10: { frames: { 2: { text: 'b' }, 1: { text: 'a' } } }, 2: { frames: {} } },
      },
      { metadata_type: 'rc', subject: 'Open Bible Stories', repo: { abbreviation: 'obs' } }
    );
    expect(Object.keys(data.stories)).toEqual(['2', '10']);
    expect(Object.values(data.stories[10].frames).map((f) => f.text)).toEqual(['a', 'b']);
    expect(data.abbreviation).toBe('obs');
  });
});
