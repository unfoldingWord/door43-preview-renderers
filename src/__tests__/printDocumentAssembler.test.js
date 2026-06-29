import {
  generateTocHtml,
  generateTocFromHtml,
  buildCoverPage,
  getPrintCss,
  assemblePrintDocument,
  PAGE_SIZES,
} from '../renderers/printDocumentAssembler.js';

describe('printDocumentAssembler', () => {
  // ─── Print toggles (show / page number / running header) ──

  describe('getPrintCss toggles', () => {
    test('defaults: page number at @bottom-center and running header on', () => {
      const css = getPrintCss();
      expect(css).toContain('@bottom-center {\n    content: counter(page);');
      expect(css).toContain('content: string(doctitle)');
      expect(css).toContain('string-set: doctitle content(text)');
    });

    test("pageNumberPosition 'top' moves the counter to @top-center", () => {
      const css = getPrintCss({ pageNumberPosition: 'top' });
      expect(css).toContain('@top-center {\n    content: counter(page);');
      expect(css).not.toContain('@bottom-center {\n    content: counter(page);');
    });

    test('runningHeader false drops the doctitle header rules', () => {
      const css = getPrintCss({ runningHeader: false });
      expect(css).not.toContain('content: string(doctitle)');
      expect(css).not.toContain('string-set: doctitle content(text)');
    });
  });

  describe('assemblePrintDocument show toggles', () => {
    const sections = {
      cover: '<h1 class="cover-header">COVER_X</h1>',
      copyright: '<p>COPYRIGHT_X</p>',
      body: '<section id="nav-tit">BODY_X</section>',
      toc: [{ id: 'nav-tit', title: 'Titus' }],
      css: { web: '', print: '' },
    };

    test('includes cover/copyright/toc by default', () => {
      const { innerHtml } = assemblePrintDocument(sections, {});
      expect(innerHtml).toContain('cover-page');
      expect(innerHtml).toContain('COPYRIGHT_X');
      expect(innerHtml).toContain('id="toc"');
      expect(innerHtml).toContain('BODY_X');
    });

    test('omits sections turned off via show', () => {
      const { innerHtml } = assemblePrintDocument(sections, {
        show: { cover: false, toc: false },
      });
      expect(innerHtml).not.toContain('cover-page');
      expect(innerHtml).not.toContain('id="toc"');
      // copyright + body remain
      expect(innerHtml).toContain('COPYRIGHT_X');
      expect(innerHtml).toContain('BODY_X');
    });
  });

  // ─── PAGE_SIZES ───────────────────────────────────────────

  describe('PAGE_SIZES', () => {
    test('contains standard page sizes', () => {
      expect(PAGE_SIZES.A4_PORTRAIT.width).toBe('210mm');
      expect(PAGE_SIZES.A4_PORTRAIT.height).toBe('297mm');
      expect(PAGE_SIZES.US_LETTER_PORTRAIT.width).toBe('8.5in');
      expect(PAGE_SIZES.TRADE.width).toBe('6in');
      expect(PAGE_SIZES.CROWN_QUARTO.width).toBe('189mm');
      expect(PAGE_SIZES.A4_LANDSCAPE.width).toBe('297mm');
      expect(PAGE_SIZES.A5_PORTRAIT.width).toBe('148.5mm');
    });
  });

  // ─── generateTocHtml ─────────────────────────────────────

  describe('generateTocHtml', () => {
    test('returns empty string for empty array', () => {
      expect(generateTocHtml([])).toBe('');
    });

    test('returns empty string for null/undefined', () => {
      expect(generateTocHtml(null)).toBe('');
      expect(generateTocHtml(undefined)).toBe('');
    });

    test('generates flat TOC from simple array', () => {
      const toc = [
        { id: 'nav-gen', title: 'Genesis' },
        { id: 'nav-exo', title: 'Exodus' },
      ];
      const html = generateTocHtml(toc);

      expect(html).toContain('Table of Contents');
      expect(html).toContain('toc-section top-toc-section');
      expect(html).toContain('href="#nav-gen"');
      expect(html).toContain('Genesis');
      expect(html).toContain('href="#nav-exo"');
      expect(html).toContain('Exodus');
    });

    test('generates nested TOC for manuals with sections', () => {
      const toc = [
        {
          id: 'nav-translate',
          title: 'Translation Manual',
          sections: [
            { id: 'nav-translate--metaphor', title: 'Metaphor', sections: [] },
            { id: 'nav-translate--simile', title: 'Simile', sections: [] },
          ],
        },
      ];
      const html = generateTocHtml(toc);

      expect(html).toContain('href="#nav-translate"');
      expect(html).toContain('Translation Manual');
      expect(html).toContain('href="#nav-translate--metaphor"');
      expect(html).toContain('Metaphor');
      // Nested sections get their own <ul>
      expect(html).toContain('<ul class="toc-section">');
    });

    test('escapes HTML in titles', () => {
      const toc = [{ id: 'nav-test', title: 'Notes <script>alert(1)</script>' }];
      const html = generateTocHtml(toc);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    test('skips entries without id', () => {
      const toc = [
        { id: 'nav-gen', title: 'Genesis' },
        { title: 'No ID entry' },
        { id: 'nav-exo', title: 'Exodus' },
      ];
      const html = generateTocHtml(toc);

      expect(html).toContain('nav-gen');
      expect(html).toContain('nav-exo');
      expect(html).not.toContain('No ID entry');
    });
  });

  // ─── generateTocFromHtml ──────────────────────────────────

  describe('generateTocFromHtml', () => {
    test('returns empty string for empty/null input', () => {
      expect(generateTocFromHtml('')).toBe('');
      expect(generateTocFromHtml(null)).toBe('');
    });

    test('extracts entries with id before data-toc-title', () => {
      const body = `
        <section id="nav-gen" data-toc-title="Genesis">
          <h1>Genesis</h1>
        </section>
        <section id="nav-exo" data-toc-title="Exodus">
          <h1>Exodus</h1>
        </section>
      `;
      const html = generateTocFromHtml(body);

      expect(html).toContain('Table of Contents');
      expect(html).toContain('href="#nav-gen"');
      expect(html).toContain('Genesis');
      expect(html).toContain('href="#nav-exo"');
    });

    test('extracts entries with data-toc-title before id', () => {
      const body = `<div data-toc-title="My Section" id="sec-1" class="section"><p>Content</p></div>`;
      const html = generateTocFromHtml(body);

      expect(html).toContain('href="#sec-1"');
      expect(html).toContain('My Section');
    });

    test('returns empty string when no data-toc-title found', () => {
      const body = `<div id="content"><h1>No TOC</h1></div>`;
      expect(generateTocFromHtml(body)).toBe('');
    });
  });

  // ─── buildCoverPage ───────────────────────────────────────

  describe('buildCoverPage', () => {
    test('generates cover with title and version', () => {
      const cover = buildCoverPage({
        title: 'Translation Notes',
        version: 'v88',
      });

      expect(cover).toContain('Translation Notes');
      expect(cover).toContain('v88');
      expect(cover).toContain('cover-header');
      expect(cover).toContain('title-logo');
    });

    test('embeds the default logo as an inline data URI (offline)', () => {
      const cover = buildCoverPage({ title: 'Test' });
      expect(cover).toContain('src="data:image/png;base64,');
      expect(cover).not.toContain('cdn.door43.org');
    });

    test('embeds distinct bundled logos per abbreviation', () => {
      const tn = buildCoverPage({ title: 'Test', abbreviation: 'tn' });
      const obs = buildCoverPage({ title: 'Test', abbreviation: 'obs' });
      const dflt = buildCoverPage({ title: 'Test' });
      expect(tn).toContain('src="data:image/png;base64,');
      expect(obs).toContain('src="data:image/png;base64,');
      // Different resources resolve to different (bundled) logo images
      expect(tn).not.toEqual(obs);
      expect(tn).not.toEqual(dflt);
    });

    test('includes extra cover HTML', () => {
      const cover = buildCoverPage({
        title: 'Test',
        extraCoverHtml: '<h3 class="cover-book-title">Titus</h3>',
      });
      expect(cover).toContain('cover-book-title');
      expect(cover).toContain('Titus');
    });

    test('omits version when not provided', () => {
      const cover = buildCoverPage({ title: 'Test' });
      expect(cover).not.toContain('cover-version');
    });
  });

  // ─── getPrintCss ──────────────────────────────────────────

  describe('getPrintCss', () => {
    test('generates CSS with default A4 size', () => {
      const css = getPrintCss();
      expect(css).toContain('size: 210mm 297mm');
      expect(css).toContain('@page');
      expect(css).toContain('target-counter(attr(href), page)');
    });

    test('respects custom page size', () => {
      const css = getPrintCss({ pageWidth: '6in', pageHeight: '9in' });
      expect(css).toContain('size: 6in 9in');
    });

    test('includes column setting', () => {
      const css = getPrintCss({ columns: 2 });
      expect(css).toContain('columns: 2');
    });

    test('handles RTL direction', () => {
      const css = getPrintCss({ direction: 'rtl' });
      expect(css).toContain('padding-right: 10px');
      expect(css).toContain('left: 0');
    });

    test('handles LTR direction', () => {
      const css = getPrintCss({ direction: 'ltr' });
      expect(css).toContain('padding-left: 10px');
      expect(css).toContain('right: 0');
    });

    test('includes extra CSS', () => {
      const css = getPrintCss({ extraCss: '.custom { color: red; }' });
      expect(css).toContain('.custom { color: red; }');
    });
  });

  // ─── assemblePrintDocument ────────────────────────────────

  describe('assemblePrintDocument', () => {
    const minimalSections = {
      cover: '<h3>Titus</h3>',
      copyright: '<p>CC BY-SA 4.0</p>',
      body: '<section id="nav-tit" data-toc-title="Titus"><h1>Titus Notes</h1></section>',
      toc: [{ id: 'nav-tit', title: 'Titus' }],
      css: {
        web: '.tn-note { margin: 4px; }',
        print: '.tn-note { break-inside: avoid; }',
      },
    };

    test('produces complete HTML document', () => {
      const result = assemblePrintDocument(minimalSections, {
        title: 'Translation Notes',
        version: 'v88',
        abbreviation: 'tn',
      });

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<html');
      expect(result.html).toContain('Translation Notes');
      expect(result.html).toContain('v88');
      expect(result.html).toContain('pagedjs-print');
    });

    test('excludes PagedJS polyfill by default (WeasyPrint engine)', () => {
      const result = assemblePrintDocument(minimalSections);
      expect(result.html).not.toContain('paged.polyfill.js');
    });

    test('includes PagedJS polyfill for the pagedjs engine', () => {
      const result = assemblePrintDocument(minimalSections, { engine: 'pagedjs' });
      expect(result.html).toContain('paged.polyfill.js');
    });

    test('includes PagedJS polyfill when explicitly enabled', () => {
      const result = assemblePrintDocument(minimalSections, {
        includePagedJsPolyfill: true,
      });
      expect(result.html).toContain('paged.polyfill.js');
    });

    test('excludes PagedJS polyfill when disabled', () => {
      const result = assemblePrintDocument(minimalSections, {
        includePagedJsPolyfill: false,
      });
      expect(result.html).not.toContain('paged.polyfill.js');
    });

    test('emits WeasyPrint-native paged-media CSS (target-counter + string headers)', () => {
      const result = assemblePrintDocument(minimalSections);
      expect(result.css).toContain('target-counter(attr(href), page)');
      expect(result.css).toContain('string(doctitle)');
      expect(result.css).toContain('string-set: doctitle');
      // No positioned running element or PagedJS-scoped selectors
      expect(result.css).not.toContain('position: running(');
      expect(result.css).not.toContain('.pagedjs_pages .section');
    });

    test('includes cover, copyright, TOC, and body sections', () => {
      const result = assemblePrintDocument(minimalSections, {
        title: 'Test',
      });

      expect(result.html).toContain('cover-page');
      expect(result.html).toContain('copyright-page');
      expect(result.html).toContain('toc-page');
      expect(result.html).toContain('Titus Notes');
    });

    test('generates TOC from structured data', () => {
      const result = assemblePrintDocument(minimalSections);
      expect(result.html).toContain('Table of Contents');
      expect(result.html).toContain('href="#nav-tit"');
      expect(result.html).toContain('Titus');
    });

    test('falls back to HTML-based TOC when no toc data', () => {
      const sectionsNoToc = {
        ...minimalSections,
        toc: [],
      };
      const result = assemblePrintDocument(sectionsNoToc);
      // Should still find TOC entries from body HTML
      expect(result.html).toContain('Table of Contents');
      expect(result.html).toContain('href="#nav-tit"');
    });

    test('includes renderer CSS in output', () => {
      const result = assemblePrintDocument(minimalSections);
      expect(result.css).toContain('.tn-note { margin: 4px; }');
      expect(result.css).toContain('.tn-note { break-inside: avoid; }');
    });

    test('returns innerHtml for preview embedding', () => {
      const result = assemblePrintDocument(minimalSections);
      expect(result.innerHtml).toContain('pagedjs-print');
      expect(result.innerHtml).not.toContain('<!DOCTYPE');
    });

    test('handles RTL direction', () => {
      const result = assemblePrintDocument(minimalSections, {
        direction: 'rtl',
      });
      expect(result.html).toContain('direction: rtl');
      expect(result.html).toContain('data-direction="rtl"');
    });

    test('includes footer HTML', () => {
      const result = assemblePrintDocument(minimalSections, {
        footerHtml: '<p class="app-version">v1.0</p>',
      });
      expect(result.html).toContain('app-version');
    });

    test('handles custom PagedJS URL (pagedjs engine)', () => {
      const result = assemblePrintDocument(minimalSections, {
        engine: 'pagedjs',
        pagedJsUrl: 'https://cdn.example.com/paged.js',
      });
      expect(result.html).toContain('https://cdn.example.com/paged.js');
    });

    test('works with empty sections', () => {
      const result = assemblePrintDocument({
        cover: '',
        copyright: '',
        body: '',
        toc: [],
        css: {},
      });
      expect(result.html).toContain('<!DOCTYPE html');
      expect(result.html).toContain('pagedjs-print');
    });
  });
});
