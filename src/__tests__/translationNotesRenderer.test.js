import { renderTranslationNotesHtml } from '../renderers/translationNotesRenderer.js';

/**
 * These tests lock the data-layer <-> renderer contract for Translation Notes.
 * They use a synthetic resourceData shaped exactly as getResourceData() produces:
 *  - notes carry GL quotes in a `GLQuotes` object keyed by Bible repo
 *  - aligned-Bible extras carry raw (alignment-stripped) USFM strings in `books`
 *  - TA extras: manuals[manual].articles[article] = { title, text(markdown) }
 *  - TW extras: articles[category][slug] = { title, text(markdown) }
 *  - TWL extras: tsv books with notes carrying GLQuotes + TWLink
 */
function buildResourceData() {
  return {
    type: 'tsv',
    subject: 'TSV Translation Notes',
    title: 'unfoldingWord® Translation Notes',
    books: {
      tit: {
        title: 'Titus',
        identifier: 'tit',
        sort: 57,
        chapters: {
          '1': {
            verses: {
              '1': [
                {
                  ID: 'abc1',
                  Reference: '1:1',
                  Quote: 'Παῦλος',
                  Note: 'Paul is the author. (See: [[rc://*/ta/man/translate/figs-abstractnouns]])',
                  SupportReference: 'rc://*/ta/man/translate/figs-abstractnouns',
                  GLQuotes: {
                    en_ult: { Quote: 'Paul', Occurrence: 1 },
                    en_ust: { Quote: 'I, Paul', Occurrence: 1 },
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
        books: { tit: '\\id TIT\n\\c 1\n\\v 1 Paul, a servant of God\n' },
      },
      ust: {
        type: 'usfm',
        subject: 'Aligned Bible',
        books: { tit: '\\id TIT\n\\c 1\n\\v 1 I, Paul, serve God\n' },
      },
      ugnt: {
        // Greek source must NOT appear as a scripture block
        type: 'usfm',
        subject: 'Greek New Testament',
        books: { tit: '\\id TIT\n\\c 1\n\\v 1 Παῦλος δοῦλος Θεοῦ\n' },
      },
      ta: {
        type: 'ta',
        subject: 'Translation Academy',
        manuals: {
          translate: {
            title: 'Translate',
            articles: {
              'figs-abstractnouns': { title: 'Abstract Nouns', text: '## Abstract Nouns\n\nUse a verb.' },
            },
          },
        },
      },
      tw: {
        type: 'tw',
        subject: 'Translation Words',
        articles: {
          names: {
            title: 'Names',
            paul: { title: 'Paul, Saul', text: '## Paul\n\nPaul was an apostle.' },
          },
        },
      },
      twl: {
        type: 'tsv',
        subject: 'TSV Translation Words Links',
        books: {
          tit: {
            chapters: {
              '1': {
                verses: {
                  '1': [
                    {
                      Quote: 'Παῦλος',
                      GLQuotes: {
                        en_ult: { Quote: 'Paul', Occurrence: 1 },
                        en_ust: { Quote: 'I, Paul', Occurrence: 1 },
                      },
                      TWLink: 'rc://*/tw/dict/bible/names/paul',
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
}

describe('renderTranslationNotesHtml', () => {
  const { sections } = renderTranslationNotesHtml(buildResourceData());
  const body = sections.body;

  test('renders BOTH ULT and UST GL quotes per note, tagged, with the original in parentheses', () => {
    // ULT quote bold, UST quote present, both tagged, Greek original once
    expect(body).toContain('<strong>Paul</strong>');
    expect(body).toContain('I, Paul');
    expect(body).toContain('class="tn-bible-tag">ULT<');
    expect(body).toContain('class="tn-bible-tag">UST<');
    expect(body).toContain('(Παῦλος)');
  });

  test('renders ULT and UST scripture as parallel columns from aligned-Bible USFM extras', () => {
    expect(body).toContain('tn-scripture-cols');
    expect(body).toContain('Paul, a servant of God');
    expect(body).toContain('I, Paul, serve God');
    // Column labels for both Bibles
    expect(body).toContain('tn-col-label');
  });

  test('does NOT render the Greek source text as a scripture block', () => {
    expect(body).not.toContain('δοῦλος');
  });

  test('builds a TA appendix with the referenced article body', () => {
    expect(body).toContain('id="appendix-ta"');
    expect(body).toContain('Abstract Nouns');
    expect(body).toContain('Use a verb.');
  });

  test('builds a TW appendix from TWL references', () => {
    expect(body).toContain('id="appendix-tw"');
    expect(body).toContain('Paul, Saul');
    expect(body).toContain('Paul was an apostle.');
  });

  test('resolves TA links (note body + SupportReference) to titled internal anchors', () => {
    expect(body).toContain('href="#nav-tit--ta-translate-figs-abstractnouns"');
    // The [[rc://...]] form becomes a titled link, not literal brackets
    expect(body).not.toContain('[[rc://');
  });

  test('renders the per-verse TWL as parallel ULT/UST columns linking to the TW appendix', () => {
    expect(body).toContain('tn-verse-twl-table');
    // Both Bibles' GL quotes appear as links to the same TW article
    const links = body.match(/href="#nav-tit--tw-names-paul"/g) || [];
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(body).toContain('>Paul</a>'); // ULT
    expect(body).toContain('>I, Paul</a>'); // UST
  });

  test('leaves no raw rc:// links anywhere in the output', () => {
    expect(body).not.toContain('rc://');
  });

  test('exposes web and print CSS and a TOC entry', () => {
    expect(sections.css.web).toBeTruthy();
    expect(sections.css.print).toBeTruthy();
    expect(sections.toc.length).toBeGreaterThan(0);
  });
});
