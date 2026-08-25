import { applyTwlQuoteTrimming } from '../twlQuoteTrimming.js';

/**
 * These lock the data-layer contract: after getResourceData() resolves a TWL's
 * extras, each TWL row's GL quote is narrowed to the word naming its TW article,
 * the occurrence is renumbered against the verse, and the untrimmed pair is kept
 * as FullGLQuote/FullGLOccurrence.
 */
const MAT_5_27_ULT =
  '\\id MAT\n\\c 5\n\\p\n\\v 27 You have heard that it was said, ' +
  '"Do not commit adultery." But I say that adultery begins in the heart.\n';

function buildResourceData(overrides = {}) {
  return {
    type: 'tsv',
    subject: 'TSV Translation Words Links',
    title: 'unfoldingWord® Translation Words Links',
    books: {
      mat: {
        title: 'Matthew',
        chapters: {
          5: {
            verses: {
              27: [
                {
                  ID: 'yb95',
                  Reference: '5:27',
                  Quote: 'μοιχεύσεις',
                  TWLink: 'rc://*/tw/dict/bible/kt/adultery',
                  GLQuotes: {
                    en_ult: { Quote: 'Do & commit adultery', Occurrence: 1 },
                    en_ust: {
                      Quote: 'Married people must remain sexually faithful',
                      Occurrence: 1,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
    extras: {
      tw: {
        type: 'tw',
        subject: 'Translation Words',
        articles: {
          kt: {
            title: 'Key Terms',
            adultery: {
              title: 'adultery, adulterous, adulterer, adulteress',
              text: '## Adultery',
            },
          },
        },
      },
      ult: {
        type: 'usfm',
        subject: 'Aligned Bible',
        abbreviation: 'ult',
        books: { mat: MAT_5_27_ULT },
      },
      ...overrides.extras,
    },
    ...overrides.root,
  };
}

describe('applyTwlQuoteTrimming', () => {
  test('trims the quote to the term and keeps the original as FullGLQuote', () => {
    const data = applyTwlQuoteTrimming(buildResourceData());
    const gl = data.books.mat.chapters[5].verses[27][0].GLQuotes.en_ult;
    expect(gl.Quote).toBe('adultery');
    expect(gl.FullGLQuote).toBe('Do & commit adultery');
    expect(gl.FullGLOccurrence).toBe(1);
  });

  test('renumbers the occurrence against the verse text', () => {
    // "Do & commit adultery" is the only such quote, but the trimmed "adultery" is
    // the first of two in the verse — and the row means that first one.
    const data = applyTwlQuoteTrimming(buildResourceData());
    expect(data.books.mat.chapters[5].verses[27][0].GLQuotes.en_ult.Occurrence).toBe(1);
  });

  test('renumbers to a later occurrence when the term repeats before the match', () => {
    const resourceData = buildResourceData();
    const gl = resourceData.books.mat.chapters[5].verses[27][0].GLQuotes;
    // Point the row at the second "adultery" in the verse.
    gl.en_ult = { Quote: 'that adultery', Occurrence: 1 };
    const data = applyTwlQuoteTrimming(resourceData);
    expect(data.books.mat.chapters[5].verses[27][0].GLQuotes.en_ult).toMatchObject({
      Quote: 'adultery',
      Occurrence: 2,
      FullGLQuote: 'that adultery',
      FullGLOccurrence: 1,
    });
  });

  test('leaves a paraphrase that never uses the term completely alone', () => {
    const data = applyTwlQuoteTrimming(buildResourceData());
    const gl = data.books.mat.chapters[5].verses[27][0].GLQuotes.en_ust;
    expect(gl.Quote).toBe('Married people must remain sexually faithful');
    expect(gl.FullGLQuote).toBeUndefined();
    expect(gl.FullGLOccurrence).toBeUndefined();
  });

  test('trims every Bible column, not just the literal one', () => {
    const resourceData = buildResourceData();
    resourceData.books.mat.chapters[5].verses[27][0].GLQuotes.en_ust = {
      Quote: 'they commit adultery',
      Occurrence: 1,
    };
    const data = applyTwlQuoteTrimming(resourceData);
    const quotes = data.books.mat.chapters[5].verses[27][0].GLQuotes;
    expect(quotes.en_ult.Quote).toBe('adultery');
    expect(quotes.en_ust.Quote).toBe('adultery');
  });

  test('trims a TWL carried as an extra of Translation Notes', () => {
    const twl = buildResourceData();
    const tn = {
      type: 'tsv',
      subject: 'TSV Translation Notes',
      books: {},
      extras: { tw: twl.extras.tw, ult: twl.extras.ult, twl: { ...twl, extras: {} } },
    };
    const data = applyTwlQuoteTrimming(tn);
    expect(data.extras.twl.books.mat.chapters[5].verses[27][0].GLQuotes.en_ult.Quote).toBe(
      'adultery'
    );
  });

  test('still trims when the Bible text is unavailable, keeping the occurrence', () => {
    const resourceData = buildResourceData();
    delete resourceData.extras.ult;
    const data = applyTwlQuoteTrimming(resourceData);
    expect(data.books.mat.chapters[5].verses[27][0].GLQuotes.en_ult).toMatchObject({
      Quote: 'adultery',
      Occurrence: 1,
      FullGLQuote: 'Do & commit adultery',
    });
  });

  test('does nothing without TW articles to match against', () => {
    const resourceData = buildResourceData();
    delete resourceData.extras.tw;
    const data = applyTwlQuoteTrimming(resourceData);
    expect(data.books.mat.chapters[5].verses[27][0].GLQuotes.en_ult.Quote).toBe(
      'Do & commit adultery'
    );
  });

  test('is idempotent — a second pass does not re-trim or lose the original', () => {
    const once = applyTwlQuoteTrimming(buildResourceData());
    const twice = applyTwlQuoteTrimming(once);
    expect(twice.books.mat.chapters[5].verses[27][0].GLQuotes.en_ult).toMatchObject({
      Quote: 'adultery',
      FullGLQuote: 'Do & commit adultery',
      FullGLOccurrence: 1,
    });
  });
});
