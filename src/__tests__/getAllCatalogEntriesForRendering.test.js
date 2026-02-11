import { jest } from '@jest/globals';

const axiosGetMock = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: axiosGetMock,
  },
}));

const { getAllCatalogEntriesForRendering } = await import('../getAllCatalogEntriesForRendering.js');

describe('getAllCatalogEntriesForRendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches catalog entries using owner/repo/ref signature', async () => {
    const entries = [{ owner: 'unfoldingWord', name: 'en_tn' }];
    axiosGetMock.mockResolvedValueOnce({ data: { data: entries } });

    const result = await getAllCatalogEntriesForRendering(
      'unfoldingWord',
      'en_tn',
      'v80',
      ['tit'],
      { dcs_api_url: 'https://git.door43.org/api/v1', quiet: true }
    );

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/catalog/bp/unfoldingWord/en_tn/v80'
    );
    expect(result.catalogEntries).toEqual(entries);
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('fetches catalog entries using catalogEntry signature and infers dcs_api_url', async () => {
    const entries = [{ owner: 'unfoldingWord', name: 'en_tw' }];
    axiosGetMock.mockResolvedValueOnce({ data: { data: entries } });

    const result = await getAllCatalogEntriesForRendering(
      {
        owner: 'unfoldingWord',
        name: 'en_tw',
        branch_or_tag_name: 'v87',
        url: 'https://git.door43.org/api/v1/catalog/entry/unfoldingWord/en_tw/v87',
      },
      [],
      { quiet: true }
    );

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/catalog/bp/unfoldingWord/en_tw/v87'
    );
    expect(result.catalogEntries).toEqual(entries);
  });

  test('throws when required owner/repo/ref values are missing', async () => {
    await expect(
      getAllCatalogEntriesForRendering({
        owner: 'unfoldingWord',
        name: 'en_tw',
      })
    ).rejects.toThrow('Owner, repo, and ref are required.');
  });

  test('throws when /catalog/bp returns invalid payload', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: {} });

    await expect(
      getAllCatalogEntriesForRendering('unfoldingWord', 'en_tn', 'v80', [], { quiet: true })
    ).rejects.toThrow('Invalid response from /catalog/bp endpoint');
  });

  test('throws when /catalog/bp returns an empty entry list', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { data: [] } });

    await expect(
      getAllCatalogEntriesForRendering('unfoldingWord', 'en_tn', 'v80', [], { quiet: true })
    ).rejects.toThrow('No catalog entries returned from /catalog/bp endpoint');
  });

  test('formats axios status errors', async () => {
    axiosGetMock.mockRejectedValueOnce({
      response: {
        status: 404,
        statusText: 'Not Found',
      },
    });

    await expect(
      getAllCatalogEntriesForRendering('unfoldingWord', 'en_tn', 'v80', [], { quiet: true })
    ).rejects.toThrow('Failed to fetch catalog entries: 404 Not Found');
  });
});
