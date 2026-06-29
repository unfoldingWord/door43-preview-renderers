import { renderHTML } from '../renderHTML.js';

function sampleHtmlData() {
  return {
    subject: 'TSV Translation Notes',
    title: 'My Notes',
    abbreviation: 'tn',
    version: 'v1',
    direction: 'ltr',
    sections: {
      cover: '<h1 class="cover-header">My Notes</h1>',
      copyright: '<p>CC BY-SA</p>',
      body: '<section id="nav-tit"><p>SENTINEL_BODY</p></section>',
      toc: [{ id: 'nav-tit', title: 'Notes - Titus' }],
      css: { web: '.web{color:red}', print: '.print{color:blue}' },
    },
  };
}

describe('renderHTML', () => {
  test('throws without a sections property', () => {
    expect(() => renderHTML({})).toThrow('expected the result of renderHtmlData()');
  });

  test('screen: body only by default (no cover/copyright)', () => {
    const html = renderHTML(sampleHtmlData());
    expect(html).toContain('SENTINEL_BODY');
    expect(html).toContain('.web{color:red}');
    expect(html).not.toContain('cover-header');
    expect(html).not.toContain('CC BY-SA');
    expect(html).toContain('<html lang="en" dir="ltr">');
  });

  test('screen: includes cover + copyright when shown', () => {
    const html = renderHTML(sampleHtmlData(), { show: { cover: true, copyright: true } });
    expect(html).toContain('cover-header');
    expect(html).toContain('CC BY-SA');
  });

  test('screen: renders a static TOC block when show.toc', () => {
    const html = renderHTML(sampleHtmlData(), { show: { toc: true } });
    expect(html).toContain('id="toc"');
    expect(html).toContain('Notes - Titus');
  });

  test('print: delegates to the print assembler (cover + body + page size)', () => {
    const html = renderHTML(sampleHtmlData(), {
      media: 'print',
      print: { pageSize: 'US_LETTER_PORTRAIT' },
    });
    expect(html).toContain('SENTINEL_BODY');
    expect(html).toContain('cover-page');
    // Page size flows into the @page rule.
    expect(html).toContain('8.5in');
    expect(html).toContain('11in');
  });

  test('print: show + page-number + running-header toggles flow to the assembler', () => {
    const html = renderHTML(sampleHtmlData(), {
      media: 'print',
      show: { cover: false },
      print: { pageNumber: { position: 'top' }, runningHeader: false },
    });
    // The cover *div* is gone (note: ".cover-page"/"@page cover-page" still appear in CSS).
    expect(html).not.toContain('<div class="section cover-page">');
    expect(html).toContain('@top-center {\n    content: counter(page);');
    expect(html).not.toContain('content: string(doctitle)');
    // body still renders
    expect(html).toContain('SENTINEL_BODY');
  });
});
