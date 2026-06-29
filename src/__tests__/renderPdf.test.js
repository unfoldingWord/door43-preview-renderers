import { renderPdf, resolvePageSize } from '../pdf/renderPdf.js';
import { PAGE_SIZES } from '../renderers/printDocumentAssembler.js';

/**
 * renderPdf() = assemblePrintDocument() + WeasyPrint. To test the assembly +
 * page-size wiring offline (no real WeasyPrint), we substitute the `weasyprint`
 * binary with `cat`, which pipes stdin → stdout. The returned Buffer is therefore
 * the exact print HTML that WOULD be handed to WeasyPrint, so we can assert the
 * page size, cover and body all made it through.
 */
function sampleRenderResult() {
  return {
    subject: 'TSV Translation Notes',
    title: 'My Notes',
    abbreviation: 'tn',
    version: 'v1',
    sections: {
      cover: '<h1 class="cover-header">My Notes</h1>',
      copyright: '<p>CC BY-SA</p>',
      body: '<section id="nav-tit"><h1>Notes - Titus</h1><p>SENTINEL_BODY_TEXT</p></section>',
      toc: [{ id: 'nav-tit', title: 'Notes - Titus' }],
      css: { web: '.x{color:red}', print: '.y{color:blue}' },
    },
  };
}

describe('resolvePageSize', () => {
  test('resolves PAGE_SIZES keys', () => {
    expect(resolvePageSize('US_LETTER_PORTRAIT')).toEqual(PAGE_SIZES.US_LETTER_PORTRAIT);
  });
  test('resolves friendly labels (portrait)', () => {
    expect(resolvePageSize('A4')).toEqual(PAGE_SIZES.A4_PORTRAIT);
  });
  test('passes through explicit { width, height }', () => {
    expect(resolvePageSize({ width: '6in', height: '9in' })).toEqual({ width: '6in', height: '9in' });
  });
  test('falls back to A4 portrait for unknown input', () => {
    expect(resolvePageSize('nonsense')).toEqual(PAGE_SIZES.A4_PORTRAIT);
    expect(resolvePageSize(undefined)).toEqual(PAGE_SIZES.A4_PORTRAIT);
  });
});

describe('renderPdf', () => {
  test('rejects when not given a renderHtmlData() result with sections', async () => {
    await expect(renderPdf(null)).rejects.toThrow(/sections/);
    await expect(renderPdf({})).rejects.toThrow(/sections/);
  });

  test('assembles the print HTML and pipes it to the PDF engine (page size + content)', async () => {
    // weasyprintPath: 'cat' echoes the assembled HTML back as the "PDF" bytes.
    const out = await renderPdf(sampleRenderResult(), {
      pageSize: 'US_LETTER_PORTRAIT',
      weasyprintPath: 'cat',
    });
    const html = out.toString('utf8');
    expect(html).toContain('SENTINEL_BODY_TEXT'); // body carried through
    expect(html).toContain('My Notes'); // cover/title carried through
    expect(html).toContain('size: 8.5in 11in'); // US Letter page size applied to @page
  });

  test('honours an explicit { width, height } page size', async () => {
    const out = await renderPdf(sampleRenderResult(), {
      pageSize: { width: '6in', height: '9in' },
      weasyprintPath: 'cat',
    });
    expect(out.toString('utf8')).toContain('size: 6in 9in');
  });

  test('defaults to A4 portrait', async () => {
    const out = await renderPdf(sampleRenderResult(), { weasyprintPath: 'cat' });
    expect(out.toString('utf8')).toContain('size: 210mm 297mm');
  });
});
