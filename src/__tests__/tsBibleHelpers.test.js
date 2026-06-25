import { jest } from '@jest/globals';
import JSZip from 'jszip';

const axiosGetMock = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: axiosGetMock,
  },
}));

const { ts2usfm, extractTsBibleData } = await import('../tsBibleHelpers.js');

/**
 * Build an in-memory ts Bible repo zip. `files` maps paths (relative to the
 * repo root folder) to their string content.
 */
async function buildRepoZip(rootFolder, files) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(`${rootFolder}/${path}`, content);
  }
  return zip;
}

describe('ts2usfm', () => {
  test('concatenates chunk files into USFM with chapter/verse markers', async () => {
    const zip = await buildRepoZip('rut_repo', {
      'front/title.txt': 'Ruth',
      '01/title.txt': 'Chapter 1',
      '01/01.txt': '\\c 1 \\v 1 First chunk verse one. \\v 2 verse two.',
      '01/03.txt': '\\v 3 third chunk.',
      '02/01.txt': '\\c 2 \\v 1 chapter two.',
    });

    const usfm = await ts2usfm(
      { title: 'Regular - Ruth' },
      { identifier: 'rut', title: 'Ruth', path: '.' },
      zip,
      'rut_repo'
    );

    expect(usfm).toContain('\\id RUT Regular - Ruth');
    expect(usfm).toContain('\\h Ruth'); // from front/title.txt, not ingredient
    // Chunks wrapped in their own paragraph and ordered by verse.
    expect(usfm).toContain('\\p\n\\c 1 \\v 1 First chunk verse one.');
    expect(usfm.indexOf('\\v 1 First chunk')).toBeLessThan(usfm.indexOf('\\v 3 third chunk'));
    // Second chapter present.
    expect(usfm).toContain('\\c 2 \\v 1 chapter two.');
  });

  test('inserts a missing \\c marker on the first chunk of a chapter', async () => {
    const zip = await buildRepoZip('repo', {
      '01/01.txt': '\\v 1 no chapter marker here.',
    });

    const usfm = await ts2usfm({ title: 'T' }, { identifier: 'rut' }, zip, 'repo');

    expect(usfm).toContain('\\c 1\n\\v 1 no chapter marker here.');
  });

  test('falls back to the ingredient title when no title file exists', async () => {
    const zip = await buildRepoZip('repo', {
      '01/01.txt': '\\c 1 \\v 1 text.',
    });

    const usfm = await ts2usfm({ title: 'T' }, { identifier: 'rut', title: 'Ruth' }, zip, 'repo');

    expect(usfm).toContain('\\h Ruth');
  });

  test('returns empty string for an unknown book id', async () => {
    const zip = await buildRepoZip('repo', { '01/01.txt': '\\c 1 \\v 1 text.' });
    const usfm = await ts2usfm({ title: 'T' }, { identifier: 'zzz' }, zip, 'repo');
    expect(usfm).toBe('');
  });

  test('returns empty string when no chunk files are present', async () => {
    const zip = await buildRepoZip('repo', { 'front/title.txt': 'Ruth' });
    const usfm = await ts2usfm({ title: 'T' }, { identifier: 'rut' }, zip, 'repo');
    expect(usfm).toBe('');
  });
});

describe('extractTsBibleData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function mockZipResponse(rootFolder, files) {
    const zip = await buildRepoZip(rootFolder, files);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    axiosGetMock.mockResolvedValueOnce({ data: buffer });
  }

  test('reconstructs USFM and resolves a lowercased zip root folder', async () => {
    // Gitea lowercases the repo name in the archive root folder.
    await mockZipResponse('myrepo', {
      'front/title.txt': 'Ruth',
      '01/01.txt': '\\c 1 \\v 1 verse one.',
      'LICENSE.md': 'CC BY-SA 4.0',
    });

    const result = await extractTsBibleData(
      {
        name: 'MyRepo',
        title: 'Regular - Ruth',
        subject: 'Bible',
        metadata_type: 'ts',
        zipball_url: 'https://example.com/MyRepo.zip',
        ingredients: [{ identifier: 'rut', title: 'Ruth', path: '.' }],
      },
      ['rut'],
      {}
    );

    expect(result.type).toBe('usfm');
    expect(result.subject).toBe('Bible');
    expect(result.metadataType).toBe('ts');
    expect(Object.keys(result.books)).toEqual(['rut']);
    expect(result.books.rut).toContain('\\v 1 verse one.');
    expect(result.license).toBe('CC BY-SA 4.0');
  });

  test('defaults to all ingredients when no books are requested', async () => {
    await mockZipResponse('repo', { '01/01.txt': '\\c 1 \\v 1 x.' });

    const result = await extractTsBibleData(
      {
        name: 'repo',
        title: 'T',
        subject: 'Bible',
        metadata_type: 'ts',
        zipball_url: 'https://example.com/repo.zip',
        ingredients: [{ identifier: 'rut', path: '.' }],
      },
      [],
      {}
    );

    expect(Object.keys(result.books)).toEqual(['rut']);
  });

  test('throws when zipball_url is missing', async () => {
    await expect(
      extractTsBibleData({ name: 'repo', ingredients: [] }, ['rut'], {})
    ).rejects.toThrow('zipball_url');
  });

  test('throws when no books could be processed', async () => {
    await mockZipResponse('repo', { 'front/title.txt': 'Ruth' });

    await expect(
      extractTsBibleData(
        {
          name: 'repo',
          title: 'T',
          subject: 'Bible',
          metadata_type: 'ts',
          zipball_url: 'https://example.com/repo.zip',
          ingredients: [{ identifier: 'rut', path: '.' }],
        },
        ['rut'],
        {}
      )
    ).rejects.toThrow('No valid books');
  });
});
