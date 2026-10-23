import { jest } from '@jest/globals';

const axiosGetMock = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: axiosGetMock,
  },
}));

const { fetchText, clearFetchCache } = await import('../dcsApi.js');

describe('dcsApi.fetchText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFetchCache();
  });

  test('fetches a file as raw text, JSON included, and shares the response', async () => {
    const url = 'https://git.door43.org/api/v1/repos/o/en_tn/sb/raw/metadata.json?ref=v1';
    axiosGetMock.mockResolvedValueOnce({ data: '{"format":"scripture burrito"}' });

    expect(await fetchText(url)).toBe('{"format":"scripture burrito"}');
    expect(await fetchText(url)).toBe('{"format":"scripture burrito"}');
    expect(axiosGetMock).toHaveBeenCalledTimes(1);
    expect(axiosGetMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ timeout: 30000, responseType: 'text' })
    );
  });

  test('a body that is not text is refused and not cached', async () => {
    const url = 'https://git.door43.org/api/v1/repos/o/r/sb/raw/x?ref=v1';
    axiosGetMock.mockResolvedValueOnce({ data: { not: 'text' } });
    await expect(fetchText(url)).rejects.toMatchObject({ name: 'ResourceError', code: 'HTTP' });
    axiosGetMock.mockResolvedValueOnce({ data: 'ok' });
    expect(await fetchText(url)).toBe('ok');
  });
});
