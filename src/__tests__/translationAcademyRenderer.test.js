import { renderTranslationAcademyHtml } from '../renderers/translationAcademyRenderer.js';

describe('renderTranslationAcademyHtml', () => {
  test('renders Translation Academy manuals with toc-driven articles', () => {
    const result = renderTranslationAcademyHtml({
      type: 'ta',
      subject: 'Translation Academy',
      title: 'Translation Academy Demo',
      manuals: {
        translate: {
          title: 'Translate',
          toc: {
            sections: [
              {
                title: 'Metaphor',
                link: 'figs-metaphor',
                sections: [{ title: 'Simile', link: 'figs-simile' }],
              },
            ],
          },
          articles: {
            'figs-metaphor': {
              title: 'Metaphor',
              text: '# Metaphor\n\nSee [Simile](rc://*/ta/man/translate/figs-simile).',
            },
            'figs-simile': {
              title: 'Simile',
              text: '# Simile\n\nRead more at https://example.org.',
            },
          },
        },
      },
    });

    expect(result.subject).toBe('Translation Academy');
    expect(result.sections.body).toContain('id="nav-translate--figs-metaphor"');
    expect(result.sections.body).toContain('id="nav-translate--figs-simile"');
    expect(result.sections.body).toContain('href="#nav-translate--figs-simile"');
    expect(result.sections.toc).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'nav-translate--translate',
          manual: 'translate',
        }),
      ])
    );
    // Running-header markers ride hidden in the web CSS.
    expect(result.sections.css.web).toContain('.running-title, .running-ref { display: none; }');
    expect(result).not.toHaveProperty('fullHtml'); // renderHTML composes the document
  });

  test('throws for invalid resource data', () => {
    expect(() => renderTranslationAcademyHtml({ type: 'usfm' })).toThrow(
      'Translation Academy renderer expects TA resource data from getResourceData().'
    );
  });
});
