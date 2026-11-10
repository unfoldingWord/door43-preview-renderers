import fs from 'fs';
import os from 'os';
import path from 'path';
import { formatObsData } from '../obsHelpers.js';
import { getResourceDataFromDirectory } from '../getResourceData.js';
import { writeBurrito } from '../testing/burrito.js';

describe('OBS extraction from its burrito (textStories)', () => {
  let dir;
  const story = (title, frames, reference) =>
    `# ${title}\n\n` +
    frames.map(([img, text]) => `![OBS Image](${img})\n\n${text}\n\n`).join('') +
    `_${reference}_\n`;
  const read = (catalogEntry) =>
    getResourceDataFromDirectory([catalogEntry], dir, {
      dcsApiUrl: 'http://127.0.0.1:9/api/v1',
      quiet: true,
    });
  const obsEntry = (name, extra = {}) => ({
    name,
    owner: 'unfoldingWord',
    branch_or_tag_name: 'v9',
    subject: 'Open Bible Stories',
    title: 'Catalog title',
    abbreviation: 'obs',
    metadata_type: 'rc',
    flavor_type: 'gloss',
    flavor: 'textStories',
    ...extra,
  });

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd43-obs-'));
    // As DCS converts it: ingredients/content/<NN>.md, front.md, the license.
    const files = {
      'ingredients/LICENSE.md': '# License\n\nCC BY-SA 4.0\n',
      'ingredients/content/front.md': '# Front\n\nAbout these stories.\n',
      'ingredients/content/back.md': '# Back\n',
      'ingredients/content/01.md': story(
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
      ),
      'ingredients/content/10.md': story(
        '10. The Ten Plagues',
        [['https://x.test/obs-en-10-01.jpg', 'Moses and Aaron went.']],
        'Exodus 5-10'
      ),
      'ingredients/content/02.md': story(
        '2. Sin Enters the World',
        [['https://x.test/obs-en-02-01.jpg', 'Adam and his wife.']],
        'Genesis 3'
      ),
    };
    const sb = { flavorType: 'gloss', flavor: 'textStories', files };
    writeBurrito(dir, 'en_obs', { ...sb, name: 'Open Bible Stories' });
    // A ts repository, as DCS converts it: the same layout; no name of its own.
    writeBurrito(dir, 'sw_obs', sb);
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('stories in numeric order, frames with their pictures, the front matter and license', async () => {
    const data = await read(obsEntry('en_obs'));
    expect(data).toMatchObject({
      type: 'obs',
      subject: 'Open Bible Stories',
      title: 'Catalog title', // the catalog's title wins over the burrito's name
      abbreviation: 'obs',
      version: 'v9',
      front: '# Front\n\nAbout these stories.',
      license: '# License\n\nCC BY-SA 4.0',
    });
    expect(Object.keys(data.stories)).toEqual(['1', '2', '10']); // front.md and back.md are not stories
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

  test('a ts repository reads the same way, titled by the catalog when the burrito has no name', async () => {
    const data = await read(
      obsEntry('sw_obs', { metadata_type: 'ts', title: 'Hadithi za Biblia' })
    );
    expect(data.title).toBe('Hadithi za Biblia');
    expect(data.metadataType).toBe('ts');
    expect(Object.keys(data.stories)).toEqual(['1', '2', '10']);
  });

  test('a burrito made in SB keeps its stories in ingredients/, as its ingredients list (#87 review)', async () => {
    writeBurrito(dir, 'xx_obs', {
      flavorType: 'gloss',
      flavor: 'textStories',
      files: {
        'ingredients/front.md': '# Front\n',
        'ingredients/01.md': story(
          '1. Creation',
          [['https://x.test/a.jpg', 'In the beginning.']],
          'Gen 1'
        ),
      },
    });
    const data = await read(obsEntry('xx_obs', { metadata_type: 'sb' }));
    expect(data.front).toBe('# Front');
    expect(Object.keys(data.stories)).toEqual(['1']);
    expect(data.stories[1].frames[1].text).toBe('In the beginning.');
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
