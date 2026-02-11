import { jest } from '@jest/globals';

const axiosGetMock = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: axiosGetMock,
  },
}));

const { fetchContent } = await import('../dcsApi.js');

describe('dcsApi.fetchContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches and decodes base64 content', async () => {
    const text = 'Hello Door43';
    const base64 = Buffer.from(text, 'utf8').toString('base64');
    axiosGetMock.mockResolvedValueOnce({ data: { content: base64 } });

    const result = await fetchContent(
      'unfoldingWord',
      'en_ult',
      'v88',
      'content/tit.usfm',
      'https://git.door43.org/api/v1'
    );

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/repos/unfoldingWord/en_ult/contents/content/tit.usfm?ref=v88'
    );
    expect(result).toBe(text);
  });
});
