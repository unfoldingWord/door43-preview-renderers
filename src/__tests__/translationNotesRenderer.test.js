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
          1: {
            verses: {
              1: [
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
              'figs-abstractnouns': {
                title: 'Abstract Nouns',
                text: '## Abstract Nouns\n\nUse a verb.',
              },
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
              1: {
                verses: {
                  1: [
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

  test('renders BOTH ULT and UST GL quotes per note, tagged, without the original', () => {
    // ULT quote bold, UST quote present, both tagged
    expect(body).toContain('<strong><bdi dir="ltr">Paul</bdi></strong>');
    expect(body).toContain('I, Paul');
    expect(body).toContain('class="tn-bible-tag">ULT<');
    expect(body).toContain('class="tn-bible-tag">UST<');
    // The Greek original is a conversion source, not something a translator reads.
    expect(body).not.toContain('Παῦλος');
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

  test('a TW article keeps its link to a cited verse with notes, and drops one without', () => {
    const data = buildResourceData();
    data.extras.tw.articles.names.paul.text =
      '## Paul\n\n* [Titus 1:1](rc://*/tn/help/tit/01/01)\n* [Titus 3:1](rc://*/tn/help/tit/03/01)';
    const article = renderTranslationNotesHtml(data).sections.appendices.tw['names/paul'].html;
    // Each assertion is tied to the link's own text, in any attribute order.
    expect(article).toMatch(
      /<a (?=[^>]*href="#nav-tit-1-1")(?=[^>]*class="internal-link")[^>]*>Titus 1:1<\/a>/
    );
    expect(article).not.toContain('nav-tit-3-1');
    expect(article).toMatch(
      /<a (?=[^>]*href="#")(?=[^>]*class="external-ref")[^>]*>Titus 3:1<\/a>/
    );
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
    expect(body).toContain('><bdi dir="ltr">Paul</bdi></a>'); // ULT
    expect(body).toContain('><bdi dir="ltr">I, Paul</bdi></a>'); // UST
  });

  test('leaves no raw rc:// links anywhere in the output', () => {
    expect(body).not.toContain('rc://');
  });

  test('exposes web and print CSS and a TOC entry', () => {
    expect(sections.css.web).toBeTruthy();
    expect(sections.css.web).toContain('.running-title, .running-ref { display: none; }');
    expect(sections.css.print).toBeTruthy();
    expect(sections.toc.length).toBeGreaterThan(0);
  });

  test('marks the resource title and each reference for the running header', () => {
    expect(sections.body).toContain(
      '<span class="running-title">unfoldingWord® Translation Notes</span>'
    );
    expect(sections.body).toContain('<span class="running-ref">Titus 1:1</span>');
  });

  test('names the single book on the cover, after the resource title and version', () => {
    expect(sections.cover).toContain('<h3 class="cover-book-title">Titus</h3>');
  });

  test('nests the TOC as resource (1) > book (2) > chapter (3)', () => {
    expect(sections.toc).toHaveLength(1);
    const [resource] = sections.toc;
    expect(resource).toMatchObject({
      id: 'nav-resource',
      title: 'unfoldingWord® Translation Notes',
    });
    const [book] = resource.sections;
    expect(book).toMatchObject({ id: 'nav-tit', title: 'Titus' });
    expect(book.sections).toEqual([{ id: 'nav-tit-1', title: 'Titus 1' }]);
  });

  test('gives the resource an H1, the book an H2, chapters H3 and verses H4', () => {
    expect(sections.body).toContain('<h1 class="tn-resource-header" id="nav-resource"');
    expect(sections.body).toContain('<h2 class="tn-book-header">');
    expect(sections.body).toContain('<h3 class="tn-chapter-header"');
    expect(sections.body).toContain('<h4 class="tn-verse-header"');
    // The book heading is the book name alone — the resource title is the H1.
    expect(sections.body).not.toContain('Translation Notes - Titus');
  });

  test('records the anchor id on each appendix article so the TOC can link to it', () => {
    expect(sections.appendices.ta['translate/figs-abstractnouns'].id).toBe(
      'nav-tit--ta-translate-figs-abstractnouns'
    );
    expect(sections.appendices.tw['names/paul'].id).toBe('nav-tit--tw-names-paul');
  });

  test('each appendix article starts a new page', () => {
    // So an article is always found at the top of a page. The article itself
    // still flows, so a long one is not pushed whole and left short.
    expect(sections.css.print).toMatch(/\.appendix-article\s*{[^}]*break-after:\s*page/);
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
      /\.tn-book-header \+ \.tn-chapter-header,[\s\S]*?{[^}]*break-before:\s*avoid/
    );
    // A chapter that opens its section (no book heading, e.g. OBS) counts too.
    expect(sections.css.print).toMatch(/section > \.tn-chapter-header:first-child/);
  });

  test('never splits a note or the Translation Words list across pages', () => {
    expect(sections.css.print).toMatch(
      /article\.tn-note,\s*\.tn-verse-twls\s*{[^}]*break-inside:\s*avoid/
    );
  });

  test('never splits the ULT/UST verse block across pages', () => {
    // The rule used to name .tn-scripture-block, which the renderer never emits,
    // so it styled nothing. It must target the class the body actually carries.
    expect(sections.css.print).toMatch(
      /table\.tn-scripture-cols,[\s\S]*?{[^}]*break-inside:\s*avoid/
    );
    expect(sections.css.print).not.toMatch(/\.tn-scripture-block\s*{/);
    expect(sections.body).toContain('tn-scripture-cols');
  });

  test('lets introduction notes flow so they cannot strand the headings', () => {
    // Notes are unbreakable, but an intro note runs for pages: unbreakable and
    // taller than the page means it is pushed whole to the next page, leaving
    // its heading behind. Verified: without this exemption, Titus page 5 holds
    // the book and chapter headings and nothing else.
    expect(sections.css.print).toMatch(/article\.tn-note-intro\s*{[^}]*break-inside:\s*auto/);
    expect(sections.css.print).toMatch(/\.tn-note-header\s*{[^}]*break-inside:\s*avoid/);
  });
});

describe('renderTranslationNotesHtml book introduction', () => {
  function withFrontMatter() {
    const data = buildResourceData();
    data.books.tit.chapters.front = {
      verses: {
        intro: [{ ID: 'in01', Reference: 'front:intro', Note: '# Introduction to Titus' }],
      },
    };
    return data;
  }

  const { sections } = renderTranslationNotesHtml(withFrontMatter());

  test('labels the front chapter with the book name, not a bare "Introduction"', () => {
    expect(sections.body).toContain('data-toc-title="Titus Introduction"');
    expect(sections.toc[0].sections[0].sections[0]).toEqual({
      id: 'nav-tit-front',
      title: 'Titus Introduction',
    });
  });

  test('the book intro heads with the book, the chapter intro with the chapter', () => {
    // A running header reading "Titus Introduction Introduction" helps nobody.
    expect(sections.body).toContain('<span class="running-ref">Titus</span>');
  });

  test('marks introduction notes so print CSS can let them flow', () => {
    expect(sections.body).toContain('class="tn-note tn-note-intro"');
  });

  test('does not repeat the heading as "Introduction Introduction"', () => {
    expect(sections.body).not.toContain('Introduction Introduction');
    // The intro notes hang off the chapter header; no duplicate verse header.
    expect(sections.body).not.toContain('id="nav-tit-front-intro"');
  });
});

describe('renderTranslationNotesHtml chapter listing in the TOC', () => {
  function twoBooks() {
    const data = buildResourceData();
    data.books.phm = JSON.parse(JSON.stringify(data.books.tit));
    data.books.phm.title = 'Philemon';
    data.books.phm.identifier = 'phm';
    data.books.phm.sort = 58;
    return data;
  }

  test('lists chapters under the book for a single-book document', () => {
    const { sections } = renderTranslationNotesHtml(buildResourceData());
    expect(sections.toc[0].sections[0].sections).toEqual([{ id: 'nav-tit-1', title: 'Titus 1' }]);
    expect(sections.body).toContain('data-toc-title="Titus 1"');
  });

  test('lists only book names once a document covers more than one book', () => {
    const { sections } = renderTranslationNotesHtml(twoBooks());
    const books = sections.toc[0].sections;
    expect(books).toHaveLength(2);
    for (const entry of books) expect(entry.sections).toEqual([]);
    // The chapter anchor survives for deep links; only the TOC marker goes.
    expect(sections.body).toContain('id="nav-tit-1"');
    expect(sections.body).not.toContain('data-toc-title="Titus 1"');
  });

  test('showChaptersInToc forces chapters back on', () => {
    const { sections } = renderTranslationNotesHtml(twoBooks(), { showChaptersInToc: true });
    expect(sections.toc[0].sections[0].sections.length).toBeGreaterThan(0);
  });
});

describe('renderTranslationNotesHtml — OBS', () => {
  function buildObsData() {
    return {
      type: 'tsv',
      subject: 'TSV OBS Translation Notes',
      title: 'unfoldingWord® OBS Translation Notes',
      books: {
        obs: {
          title: 'unfoldingWord® OBS Translation Notes',
          chapters: {
            1: {
              verses: {
                1: [{ ID: 'o1', Reference: '1:1', Quote: 'God made', Note: 'A note about it.' }],
              },
            },
          },
        },
      },
      extras: {
        obs: {
          type: 'obs',
          subject: 'Open Bible Stories',
          stories: {
            1: {
              title: '1. The Creation',
              frames: {
                1: {
                  text: 'This is how God made everything in the beginning.',
                  img: 'https://cdn.door43.org/obs/jpg/360px/obs-en-01-01.jpg',
                },
              },
            },
          },
        },
      },
    };
  }

  test("shows a frame's OBS Translation Questions after its notes; Bible questions are ignored", () => {
    const data = buildObsData();
    const tq = (subject, Question) => ({
      type: 'tsv',
      subject,
      books: {
        obs: { chapters: { 1: { verses: { 1: [{ ID: 'x', Question, Response: 'Yes.' }] } } } },
      },
    });
    data.extras['obs-tq'] = tq('TSV OBS Translation Questions', 'Who made everything?');
    data.extras.tq = tq('TSV Translation Questions', 'A Bible question?');
    const { body } = renderTranslationNotesHtml(data).sections;
    expect(body.indexOf('Who made everything?')).toBeGreaterThan(body.indexOf('A note about it.'));
    expect(body).toContain('id="nav-obs-1-1-tq-x"');
    expect(body).not.toContain('A Bible question?');
  });

  test('shows the frame text the notes are about', () => {
    const { sections } = renderTranslationNotesHtml(buildObsData());
    expect(sections.body).toContain('tn-frame-text');
    expect(sections.body).toContain('This is how God made everything in the beginning.');
  });

  test('labels stories and frames instead of repeating the resource title', () => {
    const { sections } = renderTranslationNotesHtml(buildObsData());
    expect(sections.body).toContain('>1. The Creation<');
    expect(sections.body).toContain('>1:1<');
    expect(sections.body).not.toContain('OBS Translation Notes 1:1');
  });

  test('uses the TSV quote directly — no Bible tag, no scripture columns', () => {
    const { sections } = renderTranslationNotesHtml(buildObsData());
    expect(sections.body).toContain('<strong><bdi dir="ltr">God made</bdi></strong>');
    expect(sections.body).not.toContain('tn-bible-tag');
    expect(sections.body).not.toContain('tn-scripture-cols');
  });

  test("heads the running header with the story's title and the frame reference", () => {
    const { sections } = renderTranslationNotesHtml(buildObsData());
    // The story number is already the first half of the reference, so the
    // numbered title "1. The Creation" is not printed twice.
    expect(sections.body).toContain('<span class="running-ref">The Creation 1:1</span>');
    expect(sections.body).not.toContain('running-ref">1. The Creation 1:1');
  });

  test('flows frames and breaks on the story instead of on every frame', () => {
    const { sections } = renderTranslationNotesHtml(buildObsData());
    // A frame is a picture, a few lines and a note or two — nowhere near a page.
    expect(sections.css.print).toMatch(/\.tn-verse-header\s*{[^}]*break-before:\s*auto/);
    // The story still takes the page break.
    expect(sections.css.print).toMatch(/\.tn-chapter-header\s*{[^}]*break-before:\s*page/);
    // The picture and its story text are one unbreakable unit.
    expect(sections.css.print).toMatch(/\.tn-frame-text\s*{[^}]*break-inside:\s*avoid/);
  });

  test('does not span the story title across columns (WeasyPrint drops content)', () => {
    const { sections } = renderTranslationNotesHtml(buildObsData());
    // A declaration, not the words — the rule's comment explains the omission.
    expect(sections.css.print).not.toMatch(/column-span:\s*all\s*;/);
  });

  test('marks the frames body so the columns option can target it', () => {
    const { sections } = renderTranslationNotesHtml(buildObsData());
    expect(sections.body).toContain('class="obs-frames-body"');
  });

  test("lists the frame's Translation Words from the OBS TWL extra, linking to the TW appendix", () => {
    const data = buildObsData();
    data.extras.tw = {
      type: 'tw',
      subject: 'Translation Words',
      articles: {
        kt: { title: 'Key Terms', god: { title: 'God', text: '## God\n\nThe one true God.' } },
      },
    };
    // Found by subject, whatever its key: getResourceData keys it `obs-twl`
    // (the repo identifier), so a different key here pins the subject lookup.
    data.extras['some-other-key'] = {
      type: 'tsv',
      subject: 'TSV OBS Translation Words Links',
      books: {
        obs: {
          chapters: {
            1: {
              verses: {
                1: [
                  {
                    Reference: '1:1',
                    ID: 'aoaa',
                    Quote: 'God',
                    Occurrence: '1',
                    TWLink: 'rc://*/tw/dict/bible/kt/god',
                  },
                ],
              },
            },
          },
        },
      },
    };
    const { sections } = renderTranslationNotesHtml(data);
    expect(sections.body).toContain('tn-verse-twl-table');
    // No aligned Bibles for OBS: one column with the GL words the TSV already has.
    expect(sections.body).toContain('>Quote</th>');
    expect(sections.body).toContain(
      'href="#nav-obs--tw-kt-god" class="internal-link"><bdi dir="ltr">God</bdi></a>'
    );
    expect(sections.appendices.tw['kt/god'].title).toBe('God');
  });

  test('a TW article citing a frame without notes does not link to a missing anchor', () => {
    // en_tw articles list "Examples from the Bible stories" as rc://*/tn/help/obs/…
    // links; frame 18:11 has no notes here, so it has no anchor to point at.
    const data = buildObsData();
    data.extras.tw = {
      type: 'tw',
      subject: 'Translation Words',
      articles: {
        kt: {
          god: {
            title: 'God',
            text: '## God\n\n* [01:01](rc://*/tn/help/obs/01/01)\n* [18:11](rc://*/tn/help/obs/18/11)',
          },
        },
      },
    };
    data.extras['obs-twl'] = {
      type: 'tsv',
      subject: 'TSV OBS Translation Words Links',
      books: {
        obs: {
          chapters: {
            1: {
              verses: {
                1: [{ Reference: '1:1', Quote: 'God', TWLink: 'rc://*/tw/dict/bible/kt/god' }],
              },
            },
          },
        },
      },
    };
    const { sections } = renderTranslationNotesHtml(data);
    const article = sections.appendices.tw['kt/god'].html;
    expect(article).toContain('href="#nav-obs-1-1" class="internal-link"');
    expect(article).not.toContain('nav-obs-18-11');
    expect(article).toContain('href="#" class="external-ref"');
  });

  test('does not link a Translation Words row whose article the TW resource lacks', () => {
    // en_obs-twl v3 still links other/peoplegroup, which en_tw v87 no longer has.
    const data = buildObsData();
    data.extras.tw = { type: 'tw', subject: 'Translation Words', articles: { kt: {} } };
    data.extras['obs-twl'] = {
      type: 'tsv',
      subject: 'TSV OBS Translation Words Links',
      books: {
        obs: {
          chapters: {
            1: {
              verses: {
                1: [
                  {
                    Reference: '1:1',
                    Quote: 'people',
                    TWLink: 'rc://*/tw/dict/bible/other/peoplegroup',
                  },
                ],
              },
            },
          },
        },
      },
    };
    const { sections } = renderTranslationNotesHtml(data);
    expect(sections.body).toContain(
      '<span class="unresolved-link"><bdi dir="ltr">people</bdi></span>'
    );
    expect(sections.body).not.toContain('--tw-other-peoplegroup');
    expect(sections.appendices?.tw?.['other/peoplegroup']).toBeUndefined();
  });

  test('keeps the per-verse page break for Bible-versed notes', () => {
    const { sections } = renderTranslationNotesHtml(buildResourceData());
    expect(sections.css.print).not.toMatch(/\.tn-verse-header\s*{[^}]*break-before:\s*auto/);
  });

  test('omits the picture by default and includes it when a resolution is asked for', () => {
    const off = renderTranslationNotesHtml(buildObsData());
    expect(off.sections.body).not.toContain('tn-frame-image');
    // ...but the text is there either way — the notes are about it.
    expect(off.sections.body).toContain('This is how God made everything');

    const on = renderTranslationNotesHtml(buildObsData(), { resolution: '360px' });
    expect(on.sections.body).toContain('tn-frame-image');
    expect(on.sections.body).toContain('obs-en-01-01.jpg');
  });
});

describe('renderTranslationNotesHtml — Translation Questions (#23)', () => {
  // Notes on 1:1 only; questions on 1:1, on 1:1-2 (ends on a verse without
  // notes), and on 1:3 (no notes at all).
  function withQuestions() {
    const data = buildResourceData();
    data.extras.tq = {
      type: 'tsv',
      subject: 'TSV Translation Questions',
      books: {
        tit: {
          chapters: {
            1: {
              verses: {
                1: [{ ID: 'q1', Question: 'Who wrote this letter?', Response: 'Paul.' }],
                '1-2': [{ ID: 'q2', Question: 'What did God promise?', Response: 'Life.' }],
                3: [{ ID: 'q3', Question: 'How was the word revealed?', Response: 'Preaching.' }],
              },
            },
          },
        },
      },
    };
    return data;
  }

  test("shows a verse's questions after its notes and words, by default", () => {
    const { body } = renderTranslationNotesHtml(withQuestions()).sections;
    const note = body.indexOf('id="nav-tit-1-1-abc1"');
    const words = body.indexOf('tn-verse-twls');
    const questions = body.indexOf('<div class="tn-verse-questions">');
    expect(note).toBeGreaterThan(-1);
    expect(questions).toBeGreaterThan(words);
    expect(words).toBeGreaterThan(note);
    expect(body).toContain('<h4 class="tn-verse-questions-header">Translation Questions</h4>');
    expect(body).toContain(
      '<h5 class="tq-entry-question"><a href="#nav-tit-1-1-tq-q1" class="header-link">Who wrote this letter?</a></h5>'
    );
    expect(body).toContain('<div class="tq-entry-response"><p>Paul.</p>');
  });

  test('a question on verses without notes gets its own verse block, labelled', () => {
    const { body } = renderTranslationNotesHtml(withQuestions()).sections;
    // 1:1-2 ends on a verse without notes: its own block after 1:1.
    expect(body).toContain('<h4 class="tn-verse-header" id="nav-tit-1-1-2">');
    expect(body).toContain('<h4 class="tn-verse-header" id="nav-tit-1-3">');
    const order = ['id="nav-tit-1-1"', 'id="nav-tit-1-1-2"', 'id="nav-tit-1-3"'].map((s) =>
      body.indexOf(s)
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const id of ['nav-tit-1-1-tq-q1', 'nav-tit-1-1-2-tq-q2', 'nav-tit-1-3-tq-q3']) {
      expect(body.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    }
  });

  test('a range placed under a verse with notes says which verses it asks about', () => {
    const data = withQuestions();
    // Notes on 1:2 as well: the 1:1-2 question now goes under them, labelled.
    data.books.tit.chapters[1].verses[2] = [{ ID: 'n2', Reference: '1:2', Note: 'A note.' }];
    const { body } = renderTranslationNotesHtml(data).sections;
    expect(body).not.toContain('id="nav-tit-1-1-2"');
    const block2 = body.slice(body.indexOf('id="nav-tit-1-2"'));
    expect(block2).toMatch(
      /^[^]*?<div class="tn-verse-questions-ref">Titus 1:1-2<\/div>\n<article class="tq-question" id="nav-tit-1-1-2-tq-q2">/
    );
  });

  test('includeQuestions: false renders exactly what a render without the extra does', () => {
    const plain = renderTranslationNotesHtml(buildResourceData()).sections;
    const off = renderTranslationNotesHtml(withQuestions(), { includeQuestions: false }).sections;
    expect(off.body).toBe(plain.body);
    expect(off.css).toEqual(plain.css);
    expect(off.toc).toEqual(plain.toc);
  });

  test('the question CSS is added only with questions: toggle on screen, answers in print', () => {
    const plain = renderTranslationNotesHtml(buildResourceData()).sections.css;
    const { css } = renderTranslationNotesHtml(withQuestions()).sections;
    expect(plain.web).not.toContain('response-show-checkbox');
    expect(css.web).toContain('.response-show-checkbox:checked ~ .tq-entry-response');
    expect(css.print).toMatch(/\.tq-entry-response \{\s*display: block !important;/);
    expect(css.print).toContain('.tn-verse-questions-header');
  });

  test('renderHtmlData passes includeQuestions through renderOptions', async () => {
    const { renderHtmlData } = await import('../renderHtmlData.js');
    const data = { ...withQuestions(), abbreviation: 'tn' };
    expect(renderHtmlData(data).sections.body).toContain('id="tn-tit-1-1-tq-q1"');
    expect(
      renderHtmlData(data, { renderOptions: { includeQuestions: false } }).sections.body
    ).not.toContain('tq-question');
  });
});
