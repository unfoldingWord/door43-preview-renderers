import { jest } from '@jest/globals';

const axiosGetMock = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: axiosGetMock,
  },
}));

const { fetchResource, fetchRawContent } = await import('../api/client.js');

describe('api/client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchResource requests GitHub contents endpoint', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: [{ name: 'README.md' }] });

    const result = await fetchResource({
      owner: 'unfoldingWord',
      repo: 'en_ta',
      ref: 'v87',
      path: 'translate',
    });

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/unfoldingWord/en_ta/contents/translate',
      {
        params: { ref: 'v87' },
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    expect(result).toEqual([{ name: 'README.md' }]);
  });

  test('fetchResource wraps errors', async () => {
    axiosGetMock.mockRejectedValueOnce(new Error('network'));

    await expect(
      fetchResource({ owner: 'u', repo: 'r', ref: 'main', path: '' })
    ).rejects.toThrow('Failed to fetch resource: network');
  });

  test('fetchRawContent requests raw GitHub URL', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: 'raw text' });

    const result = await fetchRawContent({
      owner: 'u',
      repo: 'r',
      ref: 'v1',
      path: 'README.md',
    });

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/u/r/v1/README.md'
    );
    expect(result).toBe('raw text');
  });

  test('fetchRawContent wraps errors', async () => {
    axiosGetMock.mockRejectedValueOnce(new Error('not found'));

    await expect(
      fetchRawContent({ owner: 'u', repo: 'r', ref: 'v1', path: 'README.md' })
    ).rejects.toThrow('Failed to fetch raw content: not found');
  });
});
