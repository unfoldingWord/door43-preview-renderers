import { generatePdf, generatePdfFromAssembled } from '../pdf/generatePdf.js';

describe('generatePdf', () => {
  test('rejects when html is empty', async () => {
    await expect(generatePdf('')).rejects.toThrow(/non-empty HTML/);
    await expect(generatePdf(null)).rejects.toThrow(/non-empty HTML/);
  });

  test('rejects with a helpful message when the weasyprint binary is missing', async () => {
    await expect(
      generatePdf('<html><body>hi</body></html>', {
        weasyprintPath: 'weasyprint-does-not-exist-xyz',
      })
    ).rejects.toThrow(/WeasyPrint not found or failed to run/);
  });
});

describe('generatePdfFromAssembled', () => {
  test('rejects when not given an assembled { html } object', async () => {
    await expect(generatePdfFromAssembled({})).rejects.toThrow(/expected \{ html \}/);
    await expect(generatePdfFromAssembled(null)).rejects.toThrow(/expected \{ html \}/);
  });
});
