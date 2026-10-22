import { neutralizeDanglingAnchors } from '../renderers/rcAppendices.js';

describe('neutralizeDanglingAnchors', () => {
  const body =
    '<h3 id="nav-tit-1-1">1:1</h3>' +
    '<a href="#nav-tit-1-1" class="internal-link">kept</a>' +
    '<a href="#nav-tit-3-1" class="internal-link">href first</a>' +
    '<a class="internal-link" href="#nav-tit-3-2">class first</a>' +
    '<a href="#nav-tit-3-3">no class</a>' +
    '<a title="t" class="internal-link" data-x="1" href="#nav-tit-3-4">other attributes</a>';

  test('keeps a link whose target exists', () => {
    const out = neutralizeDanglingAnchors(body, {}).body;
    expect(out).toContain('<a href="#nav-tit-1-1" class="internal-link">kept</a>');
  });

  test('neutralizes a dangling link whichever order its attributes are in', () => {
    const out = neutralizeDanglingAnchors(body, {}).body;
    expect(out).toContain('<a href="#" class="external-ref">href first</a>');
    expect(out).toContain('<a href="#" class="external-ref">class first</a>');
    expect(out).toContain('<a href="#" class="external-ref">no class</a>');
    expect(out).toContain(
      '<a title="t" data-x="1" href="#" class="external-ref">other attributes</a>'
    );
    expect(out).not.toMatch(/nav-tit-3-/);
    // One class attribute per link.
    expect(out).not.toMatch(/<a [^>]*class="[^"]*"[^>]*class=/);
  });

  test('a target inside an appendix counts, and appendix links are checked too', () => {
    const appendices = {
      tw: {
        'kt/god': {
          id: 'nav-tit--tw-kt-god',
          title: 'God',
          html: '<article id="nav-tit--tw-kt-god"><a class="internal-link" href="#nav-tit-9-9">gone</a></article>',
        },
      },
    };
    const out = neutralizeDanglingAnchors(
      '<a class="internal-link" href="#nav-tit--tw-kt-god">God</a>',
      appendices
    );
    expect(out.body).toContain('href="#nav-tit--tw-kt-god"');
    expect(out.appendices.tw['kt/god'].html).toContain('<a href="#" class="external-ref">gone</a>');
  });
});
