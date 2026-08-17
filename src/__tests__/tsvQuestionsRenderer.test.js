import { renderTsvQuestionsHtml } from '../renderers/tsvQuestionsRenderer.js';

/**
 * Lock the data-layer <-> renderer contract for TSV Questions/Notes:
 *  - Bible-versed subjects render parallel ULT/UST scripture columns from aligned
 *    USFM extras, a Bible-tag quote header (when the row has a quote), and a
 *    question with a collapsible answer.
 *  - OBS subjects render the story frame text panel (no scripture columns).
 */
function buildBibleVersedData() {
  return {
    type: 'tsv',
    subject: 'TSV Study Questions',
    title: 'unfoldingWord® Study Questions',
    license: '# License\n\nCC BY-SA.',
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
                  ID: 'q1',
                  Reference: '1:1',
                  Quote: 'Παῦλος',
                  Question: 'Who wrote this letter?',
                  Response: 'Paul wrote it.',
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
        type: 'usfm',
        subject: 'Greek New Testament',
        books: { tit: '\\id TIT\n\\c 1\n\\v 1 δοῦλος-source-only\n' },
      },
    },
  };
}

function buildObsData(resolution) {
  const data = {
    type: 'tsv',
    subject: 'TSV OBS Translation Questions',
    title: 'unfoldingWord® OBS Translation Questions',
    books: {
      obs: {
        title: 'Open Bible Stories',
        identifier: 'obs',
        sort: 0,
        chapters: {
          '1': {
            verses: {
              '1': [
                { ID: 'oq1', Reference: '1:1', Question: 'What did God create?', Response: 'The heavens and the earth.' },
              ],
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
            title: 'The Creation',
            reference: 'Genesis 1-2',
            frames: {
              1: {
                slug: '1-01',
                img: 'https://cdn.door43.org/obs/jpg/360px/obs-en-01-01.jpg',
                text: 'In the beginning God created the heavens and the earth.',
              },
            },
          },
        },
      },
    },
  };
  return [data, { resolution }];
}

describe('renderTsvQuestionsHtml — Bible-versed', () => {
  const { sections } = renderTsvQuestionsHtml(buildBibleVersedData());
  const body = sections.body;

  test('renders ULT and UST scripture as parallel columns from aligned-Bible USFM', () => {
    expect(body).toContain('tq-scripture-cols');
    expect(body).toContain('tq-col-label');
    expect(body).toContain('Paul, a servant of God');
    expect(body).toContain('I, Paul, serve God');
  });

  test('does NOT render the Greek source as a scripture column', () => {
    expect(body).not.toContain('source-only');
  });

  test('renders a Bible-tag quote header with both GL quotes and the original', () => {
    expect(body).toContain('<strong>Paul</strong>');
    expect(body).toContain('I, Paul');
    expect(body).toContain('class="tq-bible-tag">ULT<');
    expect(body).toContain('class="tq-bible-tag">UST<');
    expect(body).toContain('(Παῦλος)');
  });

  test('renders the question with a collapsible answer', () => {
    expect(body).toContain('Who wrote this letter?');
    expect(body).toContain('response-show-checkbox');
    expect(body).toContain('class="tq-entry-response"');
    expect(body).toContain('Paul wrote it.');
  });

  test('exposes web and print CSS and a TOC entry', () => {
    expect(sections.css.web).toBeTruthy();
    expect(sections.css.print).toBeTruthy();
    expect(sections.toc.length).toBeGreaterThan(0);
  });

  test('starts each chapter on a new page', () => {
    expect(sections.css.print).toMatch(
      /\.tq-chapter-header\s*{[^}]*break-before:\s*page/
    );
  });

  test('keeps the first chapter on the same page as the book heading', () => {
    expect(sections.css.print).toMatch(
      /\.tq-book-header \+ \.tq-chapter-header,[\s\S]*?{[^}]*break-before:\s*avoid/
    );
  });

  test('never splits the ULT/UST verse block across pages', () => {
    expect(sections.css.print).toMatch(
      /table\.tq-scripture-cols,\s*\.tq-frame-text\s*{[^}]*break-inside:\s*avoid/
    );
  });

  test('wraps each verse so its scripture and questions can be kept on one page', () => {
    // Flat sibling selectors cannot group a verse's scripture with its questions,
    // so this is the one place the markup needs a container.
    expect(body).toContain('<div class="tq-verse-block">');
    expect(sections.css.print).toMatch(/\.tq-verse-block\s*{[^}]*break-inside:\s*avoid/);
  });

  test('keeps an individual question whole even when its verse block cannot fit', () => {
    expect(sections.css.print).toMatch(/article\.tq-question\s*{[^}]*break-inside:\s*avoid/);
  });

  test("keeps a chapter's first verse block on the same page as the chapter heading", () => {
    expect(sections.css.print).toMatch(
      /\.tq-chapter-header \+ \.tq-verse-block,[\s\S]*?{[^}]*break-before:\s*avoid/
    );
  });

  test('lists chapters under the book for a single-book document', () => {
    expect(sections.toc[0].sections[0].sections.length).toBeGreaterThan(0);
  });

  test('gives the resource an H1, the book an H2, chapters H3 and verses H4', () => {
    expect(body).toContain('<h1 class="tq-resource-header" id="nav-resource"');
    expect(body).toContain('<h2 class="tq-book-header">');
    expect(body).toContain('<h3 class="tq-chapter-header"');
    expect(body).toContain('<h4 class="tq-verse-header"');
  });
});

describe('renderTsvQuestionsHtml — OBS', () => {
  const { sections } = renderTsvQuestionsHtml(...buildObsData('none'));
  const body = sections.body;

  test('renders the story title as the chapter header', () => {
    expect(body).toContain('The Creation');
  });

  test('renders the story frame text in a panel, not scripture columns', () => {
    expect(body).toContain('tq-frame-text');
    expect(body).toContain('In the beginning God created the heavens and the earth.');
    expect(body).not.toContain('tq-scripture-cols');
  });

  test('renders the question with a collapsible answer', () => {
    expect(body).toContain('What did God create?');
    expect(body).toContain('response-show-checkbox');
    expect(body).toContain('The heavens and the earth.');
  });

  test('hides frame images by default (resolution none) and shows them when requested', () => {
    expect(body).not.toContain('obs-en-01-01.jpg');
    const { sections: shown } = renderTsvQuestionsHtml(...buildObsData('360px'));
    expect(shown.body).toContain('obs-en-01-01.jpg');
    expect(shown.body).toContain('tq-frame-image');
  });
});

describe('renderTsvQuestionsHtml chapter listing in the TOC', () => {
  function twoBooks() {
    const data = buildBibleVersedData();
    const [firstId] = Object.keys(data.books);
    data.books.phm = JSON.parse(JSON.stringify(data.books[firstId]));
    data.books.phm.title = 'Philemon';
    data.books.phm.sort = 58;
    return data;
  }

  test('lists only book names once a document covers more than one book', () => {
    const { sections } = renderTsvQuestionsHtml(twoBooks());
    const books = sections.toc[0].sections;
    expect(books).toHaveLength(2);
    for (const entry of books) expect(entry.sections).toEqual([]);
  });

  test('showChaptersInToc forces chapters back on', () => {
    const { sections } = renderTsvQuestionsHtml(twoBooks(), { showChaptersInToc: true });
    expect(sections.toc[0].sections[0].sections.length).toBeGreaterThan(0);
  });
});
