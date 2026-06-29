import { jest } from '@jest/globals';

const renderAlignedBibleHtmlMock = jest.fn();
const renderTranslationAcademyHtmlMock = jest.fn();
const renderTranslationWordsHtmlMock = jest.fn();
const renderObsHtmlMock = jest.fn();

jest.unstable_mockModule('../renderers/alignedBibleRenderer.js', () => ({
  renderAlignedBibleHtml: renderAlignedBibleHtmlMock,
}));

jest.unstable_mockModule('../renderers/translationAcademyRenderer.js', () => ({
  renderTranslationAcademyHtml: renderTranslationAcademyHtmlMock,
}));

jest.unstable_mockModule('../renderers/translationWordsRenderer.js', () => ({
  renderTranslationWordsHtml: renderTranslationWordsHtmlMock,
}));

jest.unstable_mockModule('../renderers/obsRenderer.js', () => ({
  renderObsHtml: renderObsHtmlMock,
}));

const { renderHtmlData } = await import('../renderHtmlData.js');

describe('renderHtmlData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // renderHtmlData is now pure + synchronous: it takes ResourceData directly
  // (no fetching) and returns the HtmlData package with cover/identity fields
  // promoted to the top level (no attached resourceData, no fullHtml).

  test('throws when resourceData is missing', () => {
    expect(() => renderHtmlData(null)).toThrow('resourceData is required');
  });

  test('throws when resourceData carries an error payload', () => {
    expect(() => renderHtmlData({ error: 'catalog failed' })).toThrow('catalog failed');
  });

  test('routes aligned Bible subjects and passes requested books/render options', () => {
    const resourceData = {
      subject: 'Aligned Bible',
      type: 'usfm',
      title: 'ULT',
      abbreviation: 'ult',
      version: 'v88',
      books: { tit: '...' },
    };
    const rendered = {
      subject: 'Aligned Bible',
      sections: { body: '<div />', toc: [], css: { web: '' } },
      fullHtml: '<html />',
    };

    renderAlignedBibleHtmlMock.mockReturnValueOnce(rendered);

    const result = renderHtmlData(resourceData, {
      books: ['tit'],
      renderOptions: { includeRawUsfmView: true },
    });

    expect(renderAlignedBibleHtmlMock).toHaveBeenCalledWith(resourceData, {
      requestedBooks: ['tit'],
      includeRawUsfmView: true,
    });
    expect(result).toEqual({
      subject: 'Aligned Bible',
      title: 'ULT',
      abbreviation: 'ult',
      version: 'v88',
      direction: 'ltr',
      sections: rendered.sections,
    });
  });

  test('prefers requestedBooks baked into the resource data', () => {
    const resourceData = {
      subject: 'Aligned Bible',
      type: 'usfm',
      title: 'ULT',
      requestedBooks: ['rom'],
      books: { rom: '...' },
    };
    renderAlignedBibleHtmlMock.mockReturnValueOnce({ subject: 'Aligned Bible', sections: {} });

    renderHtmlData(resourceData, { books: ['tit'] });

    expect(renderAlignedBibleHtmlMock).toHaveBeenCalledWith(resourceData, {
      requestedBooks: ['rom'],
    });
  });

  test('routes Translation Academy subjects', () => {
    const resourceData = { subject: 'Translation Academy', type: 'ta', title: 'TA', manuals: {} };
    const rendered = { subject: 'Translation Academy', sections: { body: '<div />' } };

    renderTranslationAcademyHtmlMock.mockReturnValueOnce(rendered);

    const result = renderHtmlData(resourceData, { renderOptions: { includeAppendix: true } });

    expect(renderTranslationAcademyHtmlMock).toHaveBeenCalledWith(resourceData, {
      includeAppendix: true,
    });
    expect(result.subject).toBe('Translation Academy');
    expect(result.sections).toBe(rendered.sections);
  });

  test('routes Translation Words subjects', () => {
    const resourceData = { subject: 'Translation Words', type: 'tw', title: 'TW', articles: {} };
    const rendered = { subject: 'Translation Words', sections: { body: '<div />' } };

    renderTranslationWordsHtmlMock.mockReturnValueOnce(rendered);

    const result = renderHtmlData(resourceData, { renderOptions: { includeAppendix: true } });

    expect(renderTranslationWordsHtmlMock).toHaveBeenCalledWith(resourceData, {
      includeAppendix: true,
    });
    expect(result.subject).toBe('Translation Words');
  });

  test('routes Open Bible Stories subjects', () => {
    const resourceData = { subject: 'Open Bible Stories', type: 'obs', title: 'OBS', stories: {} };
    const rendered = { subject: 'Open Bible Stories', sections: { body: '<div />', copyright: '' } };

    renderObsHtmlMock.mockReturnValueOnce(rendered);

    const result = renderHtmlData(resourceData, { renderOptions: { resolution: '360px' } });

    expect(renderObsHtmlMock).toHaveBeenCalledWith(resourceData, { resolution: '360px' });
    expect(result.subject).toBe('Open Bible Stories');
  });

  test('throws for unsupported subjects', () => {
    expect(() => renderHtmlData({ subject: 'Training Library' })).toThrow(
      'HTML rendering is not implemented yet for subject `Training Library`.'
    );
  });
});
