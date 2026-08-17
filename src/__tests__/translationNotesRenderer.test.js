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

  test('collects a TA appendix (keyed by kind) with the referenced article body', () => {
    // Appendices are now a keyed object on sections, not embedded in body.
    expect(body).not.toContain('id="appendix-ta"');
    const ta = sections.appendices.ta['translate/figs-abstractnouns'];
    expect(ta.title).toBe('Abstract Nouns');
    expect(ta.html).toContain('Abstract Nouns');
    expect(ta.html).toContain('Use a verb.');
  });

  test('collects a TW appendix (keyed by kind) from TWL references', () => {
    const tw = sections.appendices.tw['names/paul'];
    expect(tw.title).toBe('Paul, Saul');
    expect(tw.html).toContain('Paul, Saul');
    expect(tw.html).toContain('Paul was an apostle.');
  });

  test('renderAppendicesHtml wraps the keyed appendices into appendix sections', async () => {
    const { renderAppendicesHtml } = await import('../renderers/printDocumentAssembler.js');
    const html = renderAppendicesHtml(sections.appendices);
    expect(html).toContain('id="appendix-ta"');
    expect(html).toContain('id="appendix-tw"');
    expect(html).toContain('Use a verb.');
    expect(html).not.toContain('rc://');
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

  test('names the single book on the cover, after the resource title and version', () => {
    expect(sections.cover).toContain('<h3 class="cover-book-title">Titus</h3>');
  });

  test('nests chapter entries (level 2) under the book entry (level 1) in the TOC', () => {
    expect(sections.toc).toHaveLength(1);
    const [book] = sections.toc;
    expect(book.id).toBe('nav-tit');
    expect(book.sections).toEqual([{ id: 'nav-tit-1', title: 'Titus 1' }]);
  });

  test('records the anchor id on each appendix article so the TOC can link to it', () => {
    expect(sections.appendices.ta['translate/figs-abstractnouns'].id).toBe(
      'nav-tit--ta-translate-figs-abstractnouns'
    );
    expect(sections.appendices.tw['names/paul'].id).toBe('nav-tit--tw-names-paul');
  });

  test('appendix articles run on instead of taking a page each', () => {
    // Only the TA/TW appendix sections break to a new page (see getPrintCss);
    // the articles inside them flow down the appendix columns.
    expect(sections.css.print).not.toMatch(/\.appendix-article\s*{[^}]*break-after:\s*page/);
    expect(sections.css.print).toMatch(/\.appendix-article\s*{[^}]*break-inside:\s*auto/);
  });

  test('keeps appendix headings attached to the text that follows them', () => {
    expect(sections.css.print).toMatch(
      /\.appendix-article-header,[\s\S]*?{[^}]*break-after:\s*avoid/
    );
    expect(sections.css.print).toMatch(/\.back-refs\s*{[^}]*break-inside:\s*avoid/);
  });

  test('starts each verse on a new page', () => {
    // A verse's scripture, notes and Translation Words are read together, so the
    // break is expressed on the heading that opens each verse (the body markup
    // is flat, with no per-verse wrapper to hang it on).
    expect(sections.css.print).toMatch(
      /\.tn-verse-header,\s*\.tn-chapter-header\s*{[^}]*break-before:\s*page/
    );
  });

  test('keeps a heading on the same page as the section it opens', () => {
    // The first chapter opens under the book heading and a chapter's first verse
    // opens under the chapter heading; neither pair may be split by the rule above.
    expect(sections.css.print).toMatch(
      /\.tn-book-header \+ \.tn-chapter-header,\s*\.tn-chapter-header \+ \.tn-verse-header\s*{[^}]*break-before:\s*avoid/
    );
  });

  test('lets a long note body break across pages so it cannot strand the headings', () => {
    // An unbreakable note taller than the space left pushes the whole
    // book/chapter/verse heading run onto a page of its own.
    expect(sections.css.print).not.toMatch(/article\.tn-note\s*{[^}]*break-inside:\s*avoid/);
    expect(sections.css.print).toMatch(/\.tn-note-header\s*{[^}]*break-inside:\s*avoid/);
  });
});

describe('renderTranslationNotesHtml book introduction', () => {
  function withFrontMatter() {
    const data = buildResourceData();
    data.books.tit.chapters.front = {
      verses: { intro: [{ ID: 'in01', Reference: 'front:intro', Note: '# Introduction to Titus' }] },
    };
    return data;
  }

  const { sections } = renderTranslationNotesHtml(withFrontMatter());

  test('labels the front chapter with the book name, not a bare "Introduction"', () => {
    expect(sections.body).toContain('data-toc-title="Titus Introduction"');
    expect(sections.toc[0].sections[0]).toEqual({ id: 'nav-tit-front', title: 'Titus Introduction' });
  });

  test('does not repeat the heading as "Introduction Introduction"', () => {
    expect(sections.body).not.toContain('Introduction Introduction');
    // The intro notes hang off the chapter header; no duplicate verse header.
    expect(sections.body).not.toContain('id="nav-tit-front-intro"');
  });
});
