import { jest } from '@jest/globals';

const axiosGetMock = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: axiosGetMock,
  },
}));

const { getAllCatalogEntries } = await import('../getAllCatalogEntries.js');

describe('getAllCatalogEntries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches a CatalogSet from an { owner, repo, ref } descriptor', async () => {
    const entries = [{ owner: 'unfoldingWord', name: 'en_tn', branch_or_tag_name: 'v80' }];
    axiosGetMock.mockResolvedValueOnce({ data: { data: entries } });

    const result = await getAllCatalogEntries(
      { owner: 'unfoldingWord', repo: 'en_tn', ref: 'v80', books: ['tit'] },
      { dcs_api_url: 'https://git.door43.org/api/v1', quiet: true }
    );

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/catalog/bp/unfoldingWord/en_tn/v80'
    );
    expect(result.catalogEntries).toEqual(entries);
    expect(result.resourceVersion).toBe('v80');
    expect(result.libraryVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.source).toMatchObject({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v80' });
  });

  test('fetches from a catalog-entry source and infers dcs_api_url from its url', async () => {
    const entries = [{ owner: 'unfoldingWord', name: 'en_tw' }];
    axiosGetMock.mockResolvedValueOnce({ data: { data: entries } });

    const result = await getAllCatalogEntries(
      {
        owner: 'unfoldingWord',
        name: 'en_tw',
        branch_or_tag_name: 'v89',
        url: 'https://git.door43.org/api/v1/catalog/entry/unfoldingWord/en_tw/v89',
      },
      { quiet: true }
    );

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/catalog/bp/unfoldingWord/en_tw/v89'
    );
    expect(result.catalogEntries).toEqual(entries);
  });

  test('returns a CatalogSet source unchanged (passthrough)', async () => {
    const catalogSet = {
      resourceVersion: 'v1',
      libraryVersion: '1.0.0',
      catalogEntries: [{ name: 'x' }],
    };
    const result = await getAllCatalogEntries(catalogSet, { quiet: true });
    expect(result).toBe(catalogSet);
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  test('throws when required owner/repo/ref values are missing', async () => {
    await expect(
      getAllCatalogEntries({ owner: 'unfoldingWord', name: 'en_tw' })
    ).rejects.toThrow('Owner, repo, and ref are required.');
  });

  test('throws when /catalog/bp returns invalid payload', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: {} });
    await expect(
      getAllCatalogEntries({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v80' }, { quiet: true })
    ).rejects.toThrow('Invalid response from /catalog/bp endpoint');
  });

  test('throws when /catalog/bp returns an empty entry list', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { data: [] } });
    await expect(
      getAllCatalogEntries({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v80' }, { quiet: true })
    ).rejects.toThrow('No catalog entries returned from /catalog/bp endpoint');
  });

  test('formats axios status errors', async () => {
    axiosGetMock.mockRejectedValueOnce({ response: { status: 404, statusText: 'Not Found' } });
    await expect(
      getAllCatalogEntries({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v80' }, { quiet: true })
    ).rejects.toThrow('Failed to fetch catalog entries: 404 Not Found');
  });
});
