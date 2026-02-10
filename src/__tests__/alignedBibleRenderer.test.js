import { renderAlignedBibleHtml } from '../renderers/alignedBibleRenderer.js';

const titUsfm = `\\id TIT
\\h Titus
\\toc1 Titus
\\toc2 Titus
\\toc3 Tit
\\mt1 Titus
\\c 1
\\p
\\v 1 Paul, a servant of God and an apostle of Jesus Christ.`;

const phmUsfm = `\\id PHM
\\h Philemon
\\toc1 Philemon
\\toc2 Philemon
\\toc3 Phm
\\mt1 Philemon
\\c 1
\\p
\\v 1 Paul, a prisoner of Christ Jesus.`;

describe('renderAlignedBibleHtml', () => {
  test('renders aligned Bible data into HTML sections', () => {
    const result = renderAlignedBibleHtml({
      type: 'usfm',
      subject: 'Aligned Bible',
      title: 'Test Bible',
      license: 'Test License',
      books: {
        tit: titUsfm,
      },
    });

    expect(result.subject).toBe('Aligned Bible');
    expect(result.sections).toHaveProperty('body');
    expect(result.sections).toHaveProperty('css');
    expect(result.sections.body).toContain('id="nav-tit"');
    expect(result.sections.body).toContain('id="nav-tit-1-1"');
    expect(result.sections.toc).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'nav-tit', book: 'tit' })])
    );
    expect(result.fullHtml).toContain('<style>');
    expect(result.fullHtml).toContain('Test Bible');
  });

  test('supports requestedBooks and raw USFM preview', () => {
    const result = renderAlignedBibleHtml(
      {
        type: 'usfm',
        subject: 'Aligned Bible',
        title: 'Test Bible',
        books: {
          tit: titUsfm,
          phm: phmUsfm,
        },
      },
      {
        requestedBooks: ['phm'],
        includeRawUsfmView: true,
      }
    );

    expect(result.sections.body).toContain('id="nav-phm"');
    expect(result.sections.body).not.toContain('id="nav-tit"');
    expect(result.sections.webView).toContain('id="nav-phm-1"');
  });
});
