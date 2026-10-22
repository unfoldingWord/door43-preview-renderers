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
    expect(html).not.toContain('content: string(runningtitle)');
    // body still renders
    expect(html).toContain('SENTINEL_BODY');
  });
});

describe('renderHTML composition options (#33)', () => {
  const withAppendices = () => ({
    ...sampleHtmlData(),
    sections: {
      ...sampleHtmlData().sections,
      appendices: {
        ta: { 'translate/a': { id: 'tn-tit--ta-a', title: 'TA ARTICLE', html: '<p>TA_BODY</p>' } },
        tw: { 'kt/god': { id: 'tn-tit--tw-god', title: 'TW ARTICLE', html: '<p>TW_BODY</p>' } },
      },
      appendixTitles: { ta: 'Translation Academy', tw: 'Translation Words' },
    },
  });

  test('show.appendices lists the kinds to include, in print and on screen', () => {
    for (const media of ['print', 'screen']) {
      const html = renderHTML(withAppendices(), {
        media,
        show: { appendices: ['tw'], toc: true },
      });
      expect(html).toContain('TW_BODY');
      expect(html).toContain('id="appendix-tw"');
      expect(html).not.toContain('TA_BODY');
      expect(html).not.toContain('appendix-ta');
      expect(html).toContain('>Translation Words<'); // the TOC lists the kept kind
      expect(html).not.toContain('>Translation Academy<');
    }
    const none = renderHTML(withAppendices(), { media: 'print', show: { appendices: [] } });
    expect(none).not.toMatch(/TA_BODY|TW_BODY/);
    expect(none).not.toMatch(/>Translation (Academy|Words)</); // nor in the TOC
  });

  test('print.margins are a right-hand page, mirrored on a left-hand page', () => {
    const html = renderHTML(sampleHtmlData(), {
      media: 'print',
      print: { margins: { top: '12mm', right: '15mm', bottom: '14mm', left: '25mm' } },
    });
    expect(html).toContain('margin: 12mm 15mm 14mm 25mm;');
    expect(html).toMatch(/@page :right \{\s*margin-left: 25mm;\s*margin-right: 15mm;/);
    expect(html).toMatch(/@page :left \{\s*margin-right: 25mm;\s*margin-left: 15mm;/);
    // Unset, the theme's margins.
    expect(renderHTML(sampleHtmlData(), { media: 'print' })).toMatch(
      /@page :right \{\s*margin-left: 30mm;\s*margin-right: 20mm;/
    );
  });

  test('by default the copyright page is not numbered; the TOC, body and appendices are', () => {
    const html = renderHTML(withAppendices(), { media: 'print' });
    expect(html).toMatch(/\.section\.copyright-page \{\s*page: copyright-page;/);
    expect(html).toMatch(/@page copyright-page \{\s*@bottom-center \{ content: none; \}/);
    expect(html).not.toContain('page: toc-page');
    expect(html).not.toContain('page: body-page');
    expect(html).not.toContain('page: appendix-page');
    // The other pages keep the counter.
    expect(html).toMatch(/@bottom-center \{\s*content: counter\(page\);/);
  });

  test('a partial pageNumber.show merges with the defaults', () => {
    const html = renderHTML(withAppendices(), {
      media: 'print',
      print: { pageNumber: { show: { body: false } } },
    });
    // copyright was not given: still unnumbered by default.
    expect(html).toMatch(/@page copyright-page \{\s*@bottom-center \{ content: none; \}/);
  });

  test('margins passed straight to the assembler are checked where they are written', async () => {
    const { getPrintCss } = await import('../renderers/printDocumentAssembler.js');
    const css = getPrintCss({ margins: { top: '1cm; } body { color: #f00', left: '25mm' } });
    expect(css).not.toContain('color: #f00');
    expect(css).toContain('margin: 1cm 20mm 1cm 25mm;');
  });

  test('print.pageNumber.show: an unnumbered body names the container, and every other section', () => {
    const html = renderHTML(withAppendices(), {
      media: 'print',
      print: { pageNumber: { show: { body: false, copyright: true } } },
    });
    expect(html).toMatch(/#pagedjs-print \{\s*page: body-page;/);
    expect(html).toMatch(/@page body-page \{\s*@bottom-center \{ content: none; \}/);
    // Named so they do not take the body's page, but still numbered.
    for (const [selector, name] of [
      ['.section.copyright-page', 'copyright-page'],
      ['.section.toc-page', 'toc-page'],
      ['.appendix', 'appendix-page'],
    ]) {
      expect(html).toContain(`${selector} {\n  page: ${name};\n}`);
      expect(html).not.toContain(`@page ${name} {`);
    }
  });

  test('print.pageNumber.show.cover numbers the cover, in the box the position names', () => {
    const html = renderHTML(sampleHtmlData(), {
      media: 'print',
      print: { pageNumber: { position: 'top', show: { cover: true } } },
    });
    expect(html).not.toMatch(/@page :first \{/);
    expect(html).toMatch(/@page cover-page \{\s*@bottom-center \{ content: none; \}\s*@top-left/);
  });

  test('columns apply on screen too, to the continuous-flow bodies only', () => {
    expect(renderHTML(sampleHtmlData(), { columns: 2 })).toMatch(
      /\.section\.bible-book,\s*\.obs-frames-body \{\s*columns: 2;\s*\}/
    );
    expect(renderHTML(sampleHtmlData())).not.toContain('.obs-frames-body {');
  });
});

describe('renderHTML: a document without a cover, or without a body (#68 review)', () => {
  test('without a cover, the first page is numbered as its own section says', () => {
    const noCover = renderHTML(sampleHtmlData(), {
      media: 'print',
      show: { cover: false, copyright: false, toc: false },
    });
    expect(noCover).not.toMatch(/@page :first \{/);
    // With a cover, its page stays unnumbered.
    expect(renderHTML(sampleHtmlData(), { media: 'print' })).toMatch(
      /@page :first \{\s*@bottom-center \{ content: none; \}/
    );
  });

  test('show.body: false leaves the body and its TOC entries out, in print and on screen', () => {
    for (const media of ['print', 'screen']) {
      const html = renderHTML(sampleHtmlData(), {
        media,
        show: { body: false, toc: true },
      });
      expect(html).not.toContain('SENTINEL_BODY');
      expect(html).not.toContain('Notes - Titus'); // the body's TOC entry
      expect(html).toContain('id="toc"');
    }
  });
});
