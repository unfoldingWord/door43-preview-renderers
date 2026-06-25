import * as lib from '../index.js';

describe('index exports', () => {
  test('exports public API functions', () => {
    expect(typeof lib.getResourceData).toBe('function');
    expect(typeof lib.getAllCatalogEntriesForRendering).toBe('function');
    expect(typeof lib.renderHtmlData).toBe('function');
    expect(typeof lib.renderAlignedBibleHtml).toBe('function');
    expect(typeof lib.renderTranslationAcademyHtml).toBe('function');
    expect(typeof lib.renderTranslationWordsHtml).toBe('function');
    expect(typeof lib.renderHTML).toBe('function');
    expect(typeof lib.fetchResource).toBe('function');
    expect(typeof lib.convertMarkdown).toBe('function');
    expect(typeof lib.renderObsHtml).toBe('function');
    expect(typeof lib.generateCopyrightAndLicenseHtml).toBe('function');
    expect(typeof lib.convertNoteFromMD2HTML).toBe('function');
    expect(typeof lib.assemblePrintDocument).toBe('function');
    expect(typeof lib.generateTocHtml).toBe('function');
    expect(typeof lib.generateTocFromHtml).toBe('function');
    expect(typeof lib.buildCoverPage).toBe('function');
    expect(typeof lib.getPrintCss).toBe('function');
    expect(lib.PAGE_SIZES).toBeDefined();
    expect(lib.PAGE_SIZES.A4_PORTRAIT).toBeDefined();
  });
});
