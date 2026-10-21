import { renderTranslationWordsLinksHtml } from '../renderers/translationWordsLinksRenderer.js';
import { renderHtmlData } from '../renderHtmlData.js';

/**
 * Locks the data-layer <-> renderer contract for Translation Words Links, using
 * a synthetic resourceData shaped exactly as getResourceData() produces for
 * `TSV Translation Words Links`:
 *  - rows carry the original word in `Quote` (normalised from OrigWords), the
 *    article in `TWLink`, and GL quotes in `GLQuotes` keyed by Bible repo
 *  - aligned-Bible extras carry alignment-stripped USFM strings in `books`
 *  - the TW extra carries articles[category][slug] = { title, text }
 */
function buildResourceData() {
  const row = (ID, Quote, link, ult, ust) => ({
    ID,
    Reference: '',
    Tags: '',
    Quote,
    Occurrence: '1',
    TWLink: `rc://*/tw/dict/bible/${link}`,
    GLQuotes: {
      en_ult: { Quote: ult, Occurrence: 1 },
      en_ust: { Quote: ust, Occurrence: 1 },
    },
  });
  return {
    type: 'tsv',
    subject: 'TSV Translation Words Links',
    title: 'unfoldingWord® Translation Words Links',
    abbreviation: 'twl',
    version: 'v91',
    license: '# License\n\nCC BY-SA 4.0',
    books: {
      tit: {
        title: 'Titus',
        identifier: 'tit',
        sort: 57,
        chapters: {
          '1': {
            verses: {
              '1': [
                row('trr8', 'Παῦλος', 'names/paul', 'Paul', 'I, Paul'),
                row('pmq8', 'Θεοῦ', 'kt/god', 'God', 'God'),
                row('zfgc', 'δοῦλος', 'other/servant', 'servant', 'serve'),
              ],
              '3': [row('x1', 'Θεοῦ', 'kt/god', 'God', 'God')],
            },
          },
          '2': {
            verses: {
              '1': [row('y1', 'Θεοῦ', 'kt/god', 'God', 'God')],
            },
          },
        },
      },
    },
    extras: {
      ult: {
        type: 'usfm',
        subject: 'Aligned Bible',
        books: {
          tit: '\\id TIT\n\\c 1\n\\v 1 Paul, a servant of God\n\\v 3 the word of God\n\\c 2\n\\v 1 But you, speak of God\n',
        },
      },
      ust: {
        type: 'usfm',
        subject: 'Aligned Bible',
        books: {
          tit: '\\id TIT\n\\c 1\n\\v 1 I, Paul, serve God\n\\v 3 God spoke\n\\c 2\n\\v 1 Speak of God\n',
        },
      },
      ugnt: {
        type: 'usfm',
        subject: 'Greek New Testament',
        books: { tit: '\\id TIT\n\\c 1\n\\v 1 Παῦλος δοῦλος Θεοῦ\n' },
      },
      tw: {
        type: 'tw',
        subject: 'Translation Words',
        title: 'unfoldingWord® Translation Words',
        articles: {
          kt: {
            title: 'Key Terms',
            god: { title: 'God', text: '# God\n\n## Definition:\n\nThe one true God. See [servant](../other/servant.md).' },
          },
          names: {
            title: 'Names',
            paul: { title: 'Paul, Saul', text: '# Paul, Saul\n\n## Facts:\n\nPaul was an apostle.' },
          },
          other: {
            title: 'Other',
            servant: { title: 'servant, slave', text: '# servant\n\n## Definition:\n\nOne who serves.' },
          },
        },
      },
    },
  };
}

describe('renderTranslationWordsLinksHtml — verse layout (default)', () => {
  const result = renderTranslationWordsLinksHtml(buildResourceData());
  const { sections } = result;
  const body = sections.body;

  test('returns the standard package', () => {
    expect(result.subject).toBe('TSV Translation Words Links');
    expect(result.title).toBe('unfoldingWord® Translation Words Links');
    expect(sections.cover).toContain('Titus');
    expect(sections.copyright).toContain('CC BY-SA 4.0');
    expect(sections.css.web).toContain('twl-verse-table');
    expect(sections.css.print).toContain('twl-chapter-header');
  });

  test('renders resource, book, chapter and verse headings with nav- anchors', () => {
    expect(body).toContain('id="nav-resource"');
    expect(body).toContain('<section id="nav-tit" data-toc-title="Titus">');
    expect(body).toContain('id="nav-tit-1"');
    expect(body).toContain('id="nav-tit-1-1"');
    expect(body).toContain('id="nav-tit-2-1"');
    expect(body).toContain('Titus 1:1</a></h4>');
  });

  test('shows the verse as ULT | UST scripture columns, not the Greek source', () => {
    expect(body).toContain('twl-scripture-cols');
    expect(body).toContain('Paul, a servant of God');
    expect(body).toContain('I, Paul, serve God');
    expect(body).not.toContain('δοῦλος Θεοῦ');
  });

  test('lists each word with a GL quote per Bible linked to its article', () => {
    expect(body).toContain('class="twl-col-label">ULT<');
    expect(body).toContain('class="twl-col-label">UST<');
    expect(body).toContain('<a href="#nav-tit--tw-names-paul" class="internal-link">Paul</a>');
    expect(body).toContain('<a href="#nav-tit--tw-names-paul" class="internal-link">I, Paul</a>');
    expect(body).toContain('<a href="#nav-tit--tw-other-servant" class="internal-link">servant</a>');
    // No table heading inside a verse — the verse header already says what it is.
    expect(body).not.toContain('>Translation Words</h4>');
  });

  test('collects the cited articles into the tw appendix with back-references', () => {
    expect(sections.appendices.ta).toBeUndefined();
    const tw = sections.appendices.tw;
    expect(Object.keys(tw).sort()).toEqual(['kt/god', 'names/paul', 'other/servant']);
    expect(tw['names/paul'].id).toBe('nav-tit--tw-names-paul');
    expect(tw['names/paul'].html).toContain('Paul was an apostle.');
    // God occurs in 1:1, 1:3 and 2:1 — three back-references.
    expect(tw['kt/god'].html).toContain('Titus References:');
    expect(tw['kt/god'].html).toContain('href="#nav-tit-1-1"');
    expect(tw['kt/god'].html).toContain('href="#nav-tit-1-3"');
    expect(tw['kt/god'].html).toContain('href="#nav-tit-2-1"');
    expect(sections.appendixTitles.tw).toBe('unfoldingWord® Translation Words');
  });

  test('resolves rc:// and relative links inside articles to internal anchors', () => {
    const god = sections.appendices.tw['kt/god'].html;
    expect(god).not.toContain('rc://');
    expect(god).toContain('href="#nav-tit--tw-other-servant"');
  });

  test('TOC lists the resource, the book and (single book) its chapters', () => {
    expect(sections.toc).toHaveLength(1);
    const book = sections.toc[0].sections[0];
    expect(book.book).toBe('tit');
    expect(book.sections.map((s) => s.title)).toEqual(['Titus 1', 'Titus 2']);
  });
});

describe('renderTranslationWordsLinksHtml — verse layout options', () => {
  test('includeScripture: false drops the scripture columns but keeps the word tables', () => {
    const { sections } = renderTranslationWordsLinksHtml(buildResourceData(), {
      includeScripture: false,
    });
    expect(sections.body).not.toContain('twl-scripture-cols');
    expect(sections.body).toContain('twl-verse-table');
  });

  test('includeArticles: false lists the words without an appendix', () => {
    const { sections } = renderTranslationWordsLinksHtml(buildResourceData(), {
      includeArticles: false,
    });
    expect(sections.appendices).toEqual({});
    expect(sections.body).toContain('twl-verse-table');
  });

  test("dedupe: 'chapter' lists a word once per chapter, dropping verses left empty", () => {
    const { sections } = renderTranslationWordsLinksHtml(buildResourceData(), {
      dedupe: 'chapter',
    });
    const body = sections.body;
    // God: 1:1 keeps it, 1:3 (now empty) is dropped, 2:1 lists it again.
    expect(body).toContain('id="nav-tit-1-1"');
    expect(body).not.toContain('id="nav-tit-1-3"');
    expect(body).toContain('id="nav-tit-2-1"');
    expect(body.match(/nav-tit--tw-kt-god" class="internal-link">God<\/a>/g)).toHaveLength(2 * 2);
  });

  test("dedupe: 'book' lists a word once in the whole book", () => {
    const { sections } = renderTranslationWordsLinksHtml(buildResourceData(), { dedupe: 'book' });
    const body = sections.body;
    expect(body).toContain('id="nav-tit-1-1"');
    expect(body).not.toContain('id="nav-tit-1-3"');
    expect(body).not.toContain('id="nav-tit-2-1"');
    // The chapter heading is still emitted so the outline is complete.
    expect(body).toContain('id="nav-tit-2"');
  });

  test('without aligned Bibles the table falls back to the original word', () => {
    const data = buildResourceData();
    delete data.extras.ult;
    delete data.extras.ust;
    const { sections } = renderTranslationWordsLinksHtml(data);
    expect(sections.body).toContain('class="twl-col-label">Quote<');
    expect(sections.body).toContain('>Παῦλος</a>');
    expect(sections.body).not.toContain('twl-scripture-cols');
  });
});

describe('renderTranslationWordsLinksHtml — glossary layout', () => {
  const { sections } = renderTranslationWordsLinksHtml(buildResourceData(), { layout: 'glossary' });
  const body = sections.body;

  test('groups entries by category in Key Terms / Names / Other order', () => {
    const kt = body.indexOf('>Key Terms</a>');
    const names = body.indexOf('>Names</a>');
    const other = body.indexOf('>Other</a>');
    expect(kt).toBeGreaterThan(-1);
    expect(names).toBeGreaterThan(kt);
    expect(other).toBeGreaterThan(names);
  });

  test('each entry carries the article anchor, title, body and references', () => {
    expect(body).toContain('<article class="twl-term" id="nav-tit--tw-kt-god">');
    expect(body).toContain('>God</a></h4>');
    expect(body).toContain('The one true God.');
    // References: chapter:verse with the literal (ULT) quote, once per verse.
    expect(body).toContain(
      '<span class="twl-ref-label">Titus:</span> <span class="twl-ref">1:1 <span class="twl-ref-quote">(God)</span></span>, <span class="twl-ref">1:3 <span class="twl-ref-quote">(God)</span></span>, <span class="twl-ref">2:1 <span class="twl-ref-quote">(God)</span></span>'
    );
  });

  test('cross-references between entries resolve to the entry anchors; no appendix', () => {
    expect(body).not.toContain('rc://');
    expect(body).toContain('href="#nav-tit--tw-other-servant"');
    expect(sections.appendices).toEqual({});
  });

  test('includeArticles: false gives a concordance (titles + references only)', () => {
    const concordance = renderTranslationWordsLinksHtml(buildResourceData(), {
      layout: 'glossary',
      includeArticles: false,
    }).sections.body;
    expect(concordance).toContain('>Paul, Saul</a></h4>');
    expect(concordance).not.toContain('Paul was an apostle.');
    expect(concordance).toContain('twl-ref-quote">(Paul)');
  });

  test('TOC lists the categories under the book', () => {
    const book = sections.toc[0].sections[0];
    expect(book.sections.map((s) => s.title)).toEqual(['Key Terms', 'Names', 'Other']);
    expect(book.sections[0].id).toBe('nav-tit-kt');
  });
});

describe('renderHtmlData dispatch for Translation Words Links', () => {
  test('applies the resource anchor prefix across body, toc and appendices', () => {
    const htmlData = renderHtmlData(buildResourceData());
    expect(htmlData.subject).toBe('TSV Translation Words Links');
    expect(htmlData.sections.body).toContain('id="twl-tit-1-1"');
    expect(htmlData.sections.body).toContain('href="#twl-tit--tw-names-paul"');
    expect(htmlData.sections.toc[0].id).toBe('twl-resource');
    expect(htmlData.sections.appendices.tw['names/paul'].id).toBe('twl-tit--tw-names-paul');
  });

  test('rejects non-TSV data with a clear error', () => {
    expect(() => renderTranslationWordsLinksHtml({ type: 'usfm', subject: 'x' })).toThrow(
      'Translation Words Links renderer expects TSV resource data'
    );
  });
});
