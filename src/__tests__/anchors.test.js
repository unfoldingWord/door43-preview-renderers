import { applyAnchorPrefix, rewriteSectionAnchors } from '../renderers/anchors.js';

describe('applyAnchorPrefix', () => {
  test('rewrites id and href anchors, leaves other content alone', () => {
    const html =
      '<section id="nav-rut"><h2 id="nav-rut-4"><a href="#nav-rut-4">Ruth 4</a></h2>' +
      '<article id="nav-rut-4-1-e2fa">see <a href="#nav-rut-4-1">v1</a></article>' +
      '<p>navigation nav-bar text</p></section>';
    const out = applyAnchorPrefix(html, 'tn');
    expect(out).toContain('id="tn-rut"');
    expect(out).toContain('id="tn-rut-4-1-e2fa"');
    expect(out).toContain('href="#tn-rut-4"');
    expect(out).toContain('href="#tn-rut-4-1"');
    // plain text "nav-bar" must not be touched
    expect(out).toContain('navigation nav-bar text');
    expect(out).not.toContain('nav-rut');
  });

  test('no-ops without a prefix', () => {
    expect(applyAnchorPrefix('<a href="#nav-x">', '')).toBe('<a href="#nav-x">');
  });
});

describe('rewriteSectionAnchors', () => {
  test('rewrites body, webView, and nested toc ids; preserves css', () => {
    const sections = {
      cover: '<span id="nav-tit-cover"></span>',
      body: '<div id="nav-tit"><a href="#nav-tit-1">c1</a></div>',
      webView: '<span id="nav-tit-1"></span>',
      toc: [{ id: 'nav-tit', title: 'Titus', sections: [{ id: 'nav-tit-1', title: 'ch1' }] }],
      css: { web: '#nav-should-not-change {}' },
    };
    const out = rewriteSectionAnchors(sections, 'ult');

    expect(out.body).toContain('id="ult-tit"');
    expect(out.body).toContain('href="#ult-tit-1"');
    expect(out.cover).toContain('id="ult-tit-cover"');
    expect(out.webView).toContain('id="ult-tit-1"');
    expect(out.toc[0].id).toBe('ult-tit');
    expect(out.toc[0].sections[0].id).toBe('ult-tit-1');
    // CSS is not anchor content — left untouched.
    expect(out.css.web).toBe('#nav-should-not-change {}');
  });

  test('rewrites keyed appendix article html', () => {
    const sections = {
      body: '',
      appendices: {
        ta: { 'translate-figs-metaphor': { title: 'Metaphor', html: '<div id="nav-tit--ta-translate-figs-metaphor">x</div>' } },
      },
    };
    const out = rewriteSectionAnchors(sections, 'tn');
    expect(out.appendices.ta['translate-figs-metaphor'].html).toContain('id="tn-tit--ta-translate-figs-metaphor"');
  });

  test('returns the same object reference when prefix is falsy', () => {
    const sections = { body: '<div id="nav-tit"></div>' };
    expect(rewriteSectionAnchors(sections, '')).toBe(sections);
  });
});
