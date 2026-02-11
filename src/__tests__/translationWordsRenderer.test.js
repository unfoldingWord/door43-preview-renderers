import { renderTranslationWordsHtml } from '../renderers/translationWordsRenderer.js';

describe('renderTranslationWordsHtml', () => {
  test('renders Translation Words categories and converts TW rc links to anchors', () => {
    const result = renderTranslationWordsHtml({
      type: 'tw',
      subject: 'Translation Words',
      title: 'Translation Words Demo',
      articles: {
        names: {
          title: 'Names',
          adam: {
            title: 'Adam',
            text: 'First man.',
          },
        },
        kt: {
          title: 'Key Terms',
          faith: {
            title: 'Faith',
            text: 'See [Adam](rc://*/tw/dict/bible/names/adam).',
          },
        },
      },
    });

    expect(result.subject).toBe('Translation Words');
    expect(result.sections.body).toContain('id="nav-kt--faith"');
    expect(result.sections.body).toContain('id="nav-names--adam"');
    expect(result.sections.body).toContain('href="#nav-names--adam"');
    expect(result.sections.toc).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'nav-kt--kt',
          manual: 'kt',
        }),
      ])
    );
    expect(result.fullHtml).toContain('<style>');
    expect(result.fullHtml).toContain('Translation Words Demo');
  });

  test('throws when no renderable categories are available', () => {
    expect(() =>
      renderTranslationWordsHtml({
        type: 'tw',
        subject: 'Translation Words',
        articles: {},
      })
    ).toThrow('No articles were found to render for this Translation Words resource.');
  });
});
