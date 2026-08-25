import {
  quoteForDisplay,
  renderQuoteHeader,
} from '../renderers/scriptureColumns.js';
import { renderTranslationNotesHtml } from '../renderers/translationNotesRenderer.js';

/**
 * A discontiguous quote is stored with its spans joined by `&` (what
 * tsv-quote-converters emits and what twQuoteTrim.js splits on) but is shown
 * with an ellipsis. These tests lock that the storage form never reaches HTML.
 */
describe('quoteForDisplay', () => {
  test('turns the span separator into a spaced ellipsis', () => {
    expect(quoteForDisplay('God & the people whom he has chosen as his own')).toBe(
      'God … the people whom he has chosen as his own'
    );
  });

  test('converts every separator in a quote with three spans', () => {
    expect(quoteForDisplay('a & b & c')).toBe('a … b … c');
  });

  test('normalizes spacing around the separator', () => {
    expect(quoteForDisplay('Do &commit adultery')).toBe('Do … commit adultery');
    expect(quoteForDisplay('Do& commit adultery')).toBe('Do … commit adultery');
    expect(quoteForDisplay('Do  &  commit adultery')).toBe('Do … commit adultery');
  });

  test('leaves an ampersand inside a word alone', () => {
    expect(quoteForDisplay('AT&T')).toBe('AT&T');
  });

  test('passes through empty and missing quotes', () => {
    expect(quoteForDisplay('')).toBe('');
    expect(quoteForDisplay(undefined)).toBe('');
    expect(quoteForDisplay(null)).toBe('');
  });
});

describe('renderQuoteHeader with discontiguous quotes', () => {
  const bibles = [
    { id: 'ult', abbr: 'ULT' },
    { id: 'ust', abbr: 'UST' },
  ];

  test('shows every GL quote with an ellipsis, never an escaped ampersand', () => {
    const html = renderQuoteHeader(
      {
        Quote: 'ὁ Θεὸς & ἐκλεκτῶν',
        GLQuotes: {
          en_ult: { Quote: 'God & the people whom he has chosen as his own', Occurrence: 1 },
          en_ust: { Quote: 'God & his chosen people', Occurrence: 1 },
        },
      },
      bibles
    );
    expect(html).toContain('<strong>God … the people whom he has chosen as his own</strong>');
    expect(html).toContain('God … his chosen people');
    expect(html).not.toContain('&amp;');
    // The original-language quote is not part of the box.
    expect(html).not.toContain('ὁ Θεὸς');
  });

  test('applies to the original quote in the no-GL-quote fallback', () => {
    const html = renderQuoteHeader({ Quote: 'ὁ Θεὸς & ἐκλεκτῶν' }, bibles);
    expect(html).toContain('<strong>ὁ Θεὸς … ἐκλεκτῶν</strong>');
    expect(html).not.toContain('&amp;');
  });
});

describe('Translation Words Links quotes in the notes renderer', () => {
  const resourceData = {
    type: 'tsv',
    subject: 'TSV Translation Notes',
    title: 'unfoldingWord® Translation Notes',
    books: {
      mat: {
        title: 'Matthew',
        identifier: 'mat',
        sort: 40,
        chapters: {
          '5': {
            verses: {
              '27': [
                {
                  ID: 'q1',
                  Reference: '5:27',
                  Quote: 'οὐ & μοιχεύσεις',
                  Note: 'A note.',
                  GLQuotes: {
                    en_ult: { Quote: 'Do & commit adultery', Occurrence: 1 },
                  },
                },
              ],
            },
          },
        },
      },
    },
    extras: {
      ult: {
        type: 'usfm',
        subject: 'Aligned Bible',
        books: { mat: '\\id MAT\n\\c 5\n\\v 27 Do not commit adultery\n' },
      },
      tw: {
        type: 'tw',
        subject: 'Translation Words',
        articles: {
          kt: {
            title: 'Key Terms',
            adultery: { title: 'adultery, adulterous', text: '## adultery\n\nBreaking a vow.' },
          },
        },
      },
      twl: {
        type: 'tsv',
        subject: 'TSV Translation Words Links',
        books: {
          mat: {
            chapters: {
              '5': {
                verses: {
                  '27': [
                    {
                      Quote: 'μοιχεύσεις',
                      GLQuotes: {
                        en_ult: { Quote: 'Do & commit adultery', Occurrence: 1 },
                      },
                      TWLink: 'rc://*/tw/dict/bible/kt/adultery',
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  };

  const { sections } = renderTranslationNotesHtml(resourceData);

  test('renders the TWL cell quote with an ellipsis', () => {
    expect(sections.body).toContain('Do … commit adultery');
    expect(sections.body).not.toContain('Do &amp; commit adultery');
  });

  test('renders the note quote header with an ellipsis and no original quote', () => {
    expect(sections.body).toContain('<strong>Do … commit adultery</strong>');
    expect(sections.body).not.toContain('μοιχεύσεις');
  });
});
