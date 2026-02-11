import { jest } from '@jest/globals';

const getResourceDataMock = jest.fn();
const renderAlignedBibleHtmlMock = jest.fn();
const renderTranslationAcademyHtmlMock = jest.fn();
const renderTranslationWordsHtmlMock = jest.fn();

jest.unstable_mockModule('../getResourceData.js', () => ({
  getResourceData: getResourceDataMock,
}));

jest.unstable_mockModule('../renderers/alignedBibleRenderer.js', () => ({
  renderAlignedBibleHtml: renderAlignedBibleHtmlMock,
}));

jest.unstable_mockModule('../renderers/translationAcademyRenderer.js', () => ({
  renderTranslationAcademyHtml: renderTranslationAcademyHtmlMock,
}));

jest.unstable_mockModule('../renderers/translationWordsRenderer.js', () => ({
  renderTranslationWordsHtml: renderTranslationWordsHtmlMock,
}));

const { renderHtmlData } = await import('../renderHtmlData.js');

describe('renderHtmlData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws when getResourceData returns no data', async () => {
    getResourceDataMock.mockResolvedValueOnce(null);

    await expect(renderHtmlData('unfoldingWord', 'en_ult', 'v88', ['tit'], {})).rejects.toThrow(
      'No resource data was returned from getResourceData().'
    );
  });

  test('throws when getResourceData returns an error payload', async () => {
    getResourceDataMock.mockResolvedValueOnce({ error: 'catalog failed' });

    await expect(renderHtmlData('unfoldingWord', 'en_ult', 'v88', ['tit'], {})).rejects.toThrow(
      'catalog failed'
    );
  });

  test('routes aligned Bible subjects and passes requested books/render options', async () => {
    const resourceData = { subject: 'Aligned Bible', type: 'usfm', books: { tit: '...' } };
    const rendered = { subject: 'Aligned Bible', sections: { body: '<div />' }, fullHtml: '<html />' };

    getResourceDataMock.mockResolvedValueOnce(resourceData);
    renderAlignedBibleHtmlMock.mockReturnValueOnce(rendered);

    const result = await renderHtmlData('unfoldingWord', 'en_ult', 'v88', ['tit'], {
      quiet: true,
      renderOptions: { includeRawUsfmView: true },
    });

    expect(getResourceDataMock).toHaveBeenCalledWith('unfoldingWord', 'en_ult', 'v88', ['tit'], {
      quiet: true,
    });
    expect(renderAlignedBibleHtmlMock).toHaveBeenCalledWith(resourceData, {
      requestedBooks: ['tit'],
      includeRawUsfmView: true,
    });
    expect(result).toEqual({ ...rendered, resourceData });
  });

  test('routes Translation Academy subjects', async () => {
    const resourceData = { subject: 'Translation Academy', type: 'ta', manuals: {} };
    const rendered = { subject: 'Translation Academy', sections: { body: '<div />' }, fullHtml: '<html />' };

    getResourceDataMock.mockResolvedValueOnce(resourceData);
    renderTranslationAcademyHtmlMock.mockReturnValueOnce(rendered);

    const result = await renderHtmlData('unfoldingWord', 'en_ta', 'v87', [], {
      quiet: true,
      renderOptions: { includeAppendix: true },
    });

    expect(renderTranslationAcademyHtmlMock).toHaveBeenCalledWith(resourceData, {
      includeAppendix: true,
    });
    expect(result).toEqual({ ...rendered, resourceData });
  });

  test('routes Translation Words subjects', async () => {
    const resourceData = { subject: 'Translation Words', type: 'tw', articles: {} };
    const rendered = { subject: 'Translation Words', sections: { body: '<div />' }, fullHtml: '<html />' };

    getResourceDataMock.mockResolvedValueOnce(resourceData);
    renderTranslationWordsHtmlMock.mockReturnValueOnce(rendered);

    const result = await renderHtmlData('unfoldingWord', 'en_tw', 'v87', [], {
      quiet: true,
      renderOptions: { includeAppendix: true },
    });

    expect(renderTranslationWordsHtmlMock).toHaveBeenCalledWith(resourceData, {
      includeAppendix: true,
    });
    expect(result).toEqual({ ...rendered, resourceData });
  });

  test('throws for unsupported subjects', async () => {
    getResourceDataMock.mockResolvedValueOnce({ subject: 'Open Bible Stories' });

    await expect(renderHtmlData('unfoldingWord', 'en_obs', 'v1', [], {})).rejects.toThrow(
      'HTML rendering is not implemented yet for subject `Open Bible Stories`.'
    );
  });
});
