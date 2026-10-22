import { renderHtmlData } from '../renderHtmlData.js';
import { renderHTML } from '../renderHTML.js';
import { getPrintCss } from '../renderers/printDocumentAssembler.js';
import { renderTranslationNotesHtml } from '../renderers/translationNotesRenderer.js';
import {
  textDirection,
  isolatedQuoteHtml,
  htmlRootAttributes,
  renderQuoteHeader,
} from '../renderers/scriptureColumns.js';

/**
 * An Arabic Translation Notes resource as getResourceData() returns it: the
 * catalog's language and direction on the data (BSOJ/ar_tn is `rtl`), and a note
 * whose only quote is the Greek original (no aligned Bible to convert it).
 */
function arabicNotes() {
  return {
    type: 'tsv',
    subject: 'TSV Translation Notes',
    title: 'ملاحظات الترجمة',
    abbreviation: 'tn',
    version: 'v6.1',
    language: 'ar',
    languageTitle: 'العربية',
    direction: 'rtl',
    isGatewayLanguage: true,
    books: {
      tit: {
        title: 'تيطس',
        chapters: {
          1: {
            verses: {
              1: [
                { ID: 'a1', Reference: '1:1', Quote: 'Παῦλος', Occurrence: '1', Note: 'ملاحظة.' },
              ],
            },
          },
        },
      },
    },
    extras: {},
  };
}

describe('an RTL resource through renderHtmlData and renderHTML', () => {
  const htmlData = renderHtmlData(arabicNotes());

  test('renderHtmlData carries the language and direction onto HtmlData', () => {
    expect(htmlData.language).toBe('ar');
    expect(htmlData.direction).toBe('rtl');
  });

  test('the screen and print documents say lang="ar" dir="rtl" on <html>', () => {
    expect(renderHTML(htmlData)).toContain('<html lang="ar" dir="rtl">');
    // On the root element, dir is what makes WeasyPrint start the book on a
    // left-hand page (verified with WeasyPrint 70: dir on an inner div does not).
    expect(renderHTML(htmlData, { media: 'print' })).toContain('<html lang="ar" dir="rtl">');
  });

  test('a caller can still override the language and direction', () => {
    expect(renderHTML(htmlData, { language: 'ar-EG', direction: 'ltr' })).toContain(
      '<html lang="ar-EG" dir="ltr">'
    );
  });

  test('the Greek quote in Arabic notes is isolated as left-to-right', () => {
    expect(htmlData.sections.body).toContain('<bdi dir="ltr">Παῦλος</bdi>');
  });

  test("the renderer's own full document carries the same attributes", () => {
    expect(renderTranslationNotesHtml(arabicNotes()).fullHtml).toContain(
      '<html lang="ar" dir="rtl">'
    );
  });

  test('a direction option other than ltr/rtl cannot reach the dir attribute', () => {
    const html = renderHTML(htmlData, { direction: 'rtl" onload="x' });
    expect(html).toContain('<html lang="ar" dir="ltr">');
    expect(html).not.toContain('onload');
  });

  test('a resource with no language keeps lang="en" dir="ltr"', () => {
    const { language, direction, ...unknown } = arabicNotes();
    void language;
    void direction;
    expect(renderHTML(renderHtmlData(unknown))).toContain('<html lang="en" dir="ltr">');
  });
});

describe('RTL running headers', () => {
  test('title-ref: the title goes on the right-hand page, the reference on the left', () => {
    const css = getPrintCss({ direction: 'rtl' });
    expect(css).toMatch(/@page :right\s*{[^@]*@top-right\s*{[^}]*content: string\(runningtitle\)/);
    expect(css).toMatch(
      /@page :left\s*{[^@]*@top-left\s*{[^}]*content: string\(runningref, first\)/
    );
  });

  test('title-ref LTR is unchanged: title on the left-hand page', () => {
    const css = getPrintCss({ direction: 'ltr' });
    expect(css).toMatch(/@page :left\s*{[^@]*@top-left\s*{[^}]*content: string\(runningtitle\)/);
    expect(css).toMatch(
      /@page :right\s*{[^@]*@top-right\s*{[^}]*content: string\(runningref, first\)/
    );
  });

  test('range: the first reference reads from the right corner', () => {
    const css = getPrintCss({ direction: 'rtl', runningHeader: 'range' });
    expect(css).toMatch(/@top-right\s*{[^}]*content: string\(runningref, first\)/);
    expect(css).toMatch(/@top-left\s*{[^}]*content: string\(runningref, last\)/);
  });
});

describe('mixed-direction quotes', () => {
  test('textDirection reads the first letter', () => {
    expect(textDirection('בְּרֵאשִׁית')).toBe('rtl');
    expect(textDirection('ملاحظة')).toBe('rtl');
    expect(textDirection('Παῦλος')).toBe('ltr');
    expect(textDirection('… Paul')).toBe('ltr');
    expect(textDirection('1:1 — ')).toBe('');
    // U+FEFF (a byte-order mark) is not a letter of a right-to-left script.
    expect(textDirection('\uFEFFParis')).toBe('ltr');
    // Arabic punctuation and digits are not letters: the Greek decides.
    expect(textDirection('\u060C \u03A0\u03B1\u1FE6\u03BB\u03BF\u03C2')).toBe('ltr');
    expect(textDirection('\u0661\u0662 \u03A0\u03B1\u1FE6\u03BB\u03BF\u03C2')).toBe('ltr');
    expect(textDirection('\u0661\u0662\u060C')).toBe('');
    expect(isolatedQuoteHtml('\u060C \u03A0\u03B1\u1FE6\u03BB\u03BF\u03C2', 'rtl')).toBe('<bdi dir="ltr">\u060C \u03A0\u03B1\u1FE6\u03BB\u03BF\u03C2</bdi>');
  });

  test('a language code cannot break out of the lang attribute', () => {
    expect(htmlRootAttributes({ language: 'ar" onload="x' })).toBe(
      'lang="ar&quot; onload=&quot;x" dir="ltr"'
    );
  });

  test('isolatedQuoteHtml wraps only a quote that runs the other way', () => {
    expect(isolatedQuoteHtml('בְּרֵאשִׁית', 'ltr')).toBe('<bdi dir="rtl">בְּרֵאשִׁית</bdi>');
    expect(isolatedQuoteHtml('Paul', 'ltr')).toBe('Paul');
    expect(isolatedQuoteHtml('ملاحظة', 'rtl')).toBe('ملاحظة');
    expect(isolatedQuoteHtml('a <b> & c', 'rtl')).toBe('<bdi dir="ltr">a &lt;b&gt; &amp; c</bdi>');
  });

  test('a Hebrew fallback quote in English notes is isolated as right-to-left', () => {
    const header = renderQuoteHeader({ Quote: 'בְּרֵאשִׁית' }, [], {}, 'ltr');
    expect(header).toContain('<strong><bdi dir="rtl">בְּרֵאשִׁית</bdi></strong>');
  });

  test('English quotes in English notes are unchanged', () => {
    const header = renderQuoteHeader(
      { GLQuotes: { en_ult: { Quote: 'Paul' } } },
      [{ id: 'ult', abbr: 'ULT' }],
      {},
      'ltr'
    );
    expect(header).toContain('<strong>Paul</strong>');
    expect(header).not.toContain('<bdi');
  });

  test('htmlRootAttributes defaults to English, left to right', () => {
    expect(htmlRootAttributes()).toBe('lang="en" dir="ltr"');
    expect(htmlRootAttributes({ language: 'hbo', direction: 'rtl' })).toBe('lang="hbo" dir="rtl"');
  });
});
