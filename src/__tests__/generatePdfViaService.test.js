import { jest } from '@jest/globals';

const axiosPostMock = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: { post: axiosPostMock },
}));

const { generatePdfViaService } = await import('../pdf/generatePdfViaService.js');

describe('generatePdfViaService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('POSTs the HTML as text/html and returns the PDF bytes', async () => {
    axiosPostMock.mockResolvedValueOnce({ data: Buffer.from('%PDF-1.7 fake') });

    const out = await generatePdfViaService('<html>x</html>', {
      pdfServiceUrl: 'https://svc.example/pdf',
    });

    expect(axiosPostMock).toHaveBeenCalledWith(
      'https://svc.example/pdf',
      '<html>x</html>',
      expect.objectContaining({
        headers: { 'Content-Type': 'text/html' },
        responseType: 'arraybuffer',
      })
    );
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString('utf8')).toContain('%PDF-1.7');
  });

  test('throws on empty html or missing pdfServiceUrl', async () => {
    await expect(generatePdfViaService('', { pdfServiceUrl: 'x' })).rejects.toThrow(/non-empty/);
    await expect(generatePdfViaService('<html/>', {})).rejects.toThrow(/pdfServiceUrl/);
  });

  test('wraps a service error with the status and URL', async () => {
    const err = new Error('boom');
    err.response = { status: 502, data: Buffer.from('bad gateway') };
    axiosPostMock.mockRejectedValueOnce(err);

    await expect(
      generatePdfViaService('<html/>', { pdfServiceUrl: 'https://svc.example/pdf' })
    ).rejects.toThrow(/502.*svc\.example.*bad gateway/s);
  });
});
