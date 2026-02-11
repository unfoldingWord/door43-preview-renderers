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
  });
});
