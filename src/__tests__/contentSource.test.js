import { jest } from '@jest/globals';
import JSZip from 'jszip';

const axiosGetMock = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get: axiosGetMock } }));

const { dcsContentSource, contentSourceFor, ARCHIVE_LIMITS } = await import('../contentSource.js');

/**
 * The DCS archive read (#71): the URL comes from the catalog entry, so it is
 * held to the configured DCS host, redirects are refused, and the download is
 * limited in time and size.
 */
const zipBytes = async () => {
  const zip = new JSZip();
  zip.file('en_tw/bible/kt/god.md', '# God');
  return zip.generateAsync({ type: 'uint8array' });
};
const entry = (zipball_url) => ({ name: 'en_tw', zipball_url });

beforeEach(() => axiosGetMock.mockReset());

describe('dcsContentSource.readArchive', () => {
  test('downloads an archive on the DCS host, with the default limits', async () => {
    axiosGetMock.mockResolvedValue({ data: await zipBytes() });
    const zip = await dcsContentSource().readArchive(
      entry('https://git.door43.org/unfoldingWord/en_tw/archive/v91.zip')
    );
    expect(await zip.file('en_tw/bible/kt/god.md').async('string')).toBe('# God');
    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://git.door43.org/unfoldingWord/en_tw/archive/v91.zip',
      {
        responseType: 'arraybuffer',
        timeout: ARCHIVE_LIMITS.timeoutMs,
        maxContentLength: ARCHIVE_LIMITS.maxBytes,
        maxRedirects: 0,
        signal: expect.any(AbortSignal),
        onDownloadProgress: expect.any(Function),
      }
    );
    expect(ARCHIVE_LIMITS).toEqual({ maxBytes: 100 * 1024 * 1024, timeoutMs: 120000 });
  });

  test('refuses an archive URL on another host, or one that is not a URL', async () => {
    const source = dcsContentSource('https://git.door43.org/api/v1');
    await expect(source.readArchive(entry('https://evil.example/x.zip'))).rejects.toThrow(
      'not on the DCS host https://git.door43.org'
    );
    // Same host name, other scheme or port: another origin.
    await expect(
      source.readArchive(entry('http://git.door43.org/unfoldingWord/en_tw/archive/v91.zip'))
    ).rejects.toThrow('not on the DCS host');
    await expect(
      source.readArchive(entry('https://git.door43.org:8443/unfoldingWord/en_tw/archive/v91.zip'))
    ).rejects.toThrow('not on the DCS host');
    await expect(source.readArchive(entry('not a url'))).rejects.toThrow('is not a URL');
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  test('the host is the configured DCS, e.g. QA', async () => {
    axiosGetMock.mockResolvedValue({ data: await zipBytes() });
    const qa = dcsContentSource('https://qa.door43.org/api/v1');
    await qa.readArchive(entry('https://qa.door43.org/unfoldingWord/en_tw/archive/v91.zip'));
    await expect(
      qa.readArchive(entry('https://git.door43.org/unfoldingWord/en_tw/archive/v91.zip'))
    ).rejects.toThrow('not on the DCS host https://qa.door43.org');
  });

  test('an archive larger than the cap is refused even when the transport does not enforce it', async () => {
    axiosGetMock.mockResolvedValue({ data: new Uint8Array(2048) });
    const source = dcsContentSource('https://git.door43.org/api/v1', { maxBytes: 1024 });
    await expect(
      source.readArchive(entry('https://git.door43.org/unfoldingWord/en_tw/archive/v91.zip'))
    ).rejects.toThrow('larger than 1024 bytes');
  });

  test('the download is aborted once its progress passes the cap', async () => {
    axiosGetMock.mockImplementation(async (url, config) => {
      config.onDownloadProgress({ loaded: 2048 });
      if (config.signal.aborted) throw new Error('canceled');
      return { data: new Uint8Array(10) };
    });
    const source = dcsContentSource('https://git.door43.org/api/v1', { maxBytes: 1024 });
    await expect(
      source.readArchive(entry('https://git.door43.org/unfoldingWord/en_tw/archive/v91.zip'))
    ).rejects.toThrow('larger than 1024 bytes');
  });

  test('getResourceData options set the limits (archiveMaxBytes, archiveTimeoutMs)', async () => {
    axiosGetMock.mockResolvedValue({ data: await zipBytes() });
    await contentSourceFor({ archiveMaxBytes: 5000000, archiveTimeoutMs: 30000 }).readArchive(
      entry('https://git.door43.org/unfoldingWord/en_tw/archive/v91.zip')
    );
    expect(axiosGetMock.mock.calls[0][1]).toMatchObject({
      timeout: 30000,
      maxContentLength: 5000000,
    });
  });
});
