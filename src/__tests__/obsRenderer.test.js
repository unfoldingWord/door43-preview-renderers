import { renderObsHtml } from '../renderers/obsRenderer.js';

/**
 * Locks the data-layer <-> renderer contract for Open Bible Stories, using a
 * synthetic resourceData shaped as formatObsData() produces: stories keyed by
 * number, each with a title, a Bible reference and frames keyed by number
 * carrying `text` and an optional `img` URL.
 */
function buildResourceData(overrides = {}) {
  return {
    type: 'obs',
    subject: 'Open Bible Stories',
    title: 'unfoldingWord® Open Bible Stories',
    abbreviation: 'obs',
    version: 'v9',
    front: '# Front matter\n\nAbout these stories.',
    back: '# Back matter\n\nHow to use them.',
    // Keys chosen so that lexical order ("1", "10", "12", "2") differs from
    // numeric order (1, 2, 10, 12): the renderer must sort numerically.
    stories: {
      12: {
        title: '12. The Exodus',
        reference: 'A Bible story from: Exodus 12:33-15:21',
        frames: { 1: { text: 'The Israelites left Egypt.' } },
      },
      2: {
        title: '2. Sin Enters the World',
        reference: 'A Bible story from: Genesis 3',
        frames: {
          1: { text: 'Adam and his wife were very happy.' },
          2: {
            text: 'But there was a crafty snake.',
            img: 'https://example.test/custom-02-02.jpg',
          },
        },
      },
      1: {
        title: '1. The Creation',
        reference: 'A Bible story from: Genesis 1-2',
        frames: {
          1: { text: 'This is how the beginning of everything happened.' },
          2: { text: 'God made the light.' },
          10: { text: 'God saw that it was good.' },
        },
      },
    },
    ...overrides,
  };
}

describe('renderObsHtml', () => {
  const result = renderObsHtml(buildResourceData());
  const { sections } = result;
  const body = sections.body;

  test('returns the standard package', () => {
    expect(result.subject).toBe('Open Bible Stories');
    expect(result.title).toBe('unfoldingWord® Open Bible Stories');
    expect(sections.cover).toContain('unfoldingWord® Open Bible Stories');
    expect(sections.cover).toContain('v9');
    // OBS carries no license text in its copyright section.
    expect(sections.copyright).toBe('');
    expect(sections.webView).toBeNull();
    expect(typeof sections.css.web).toBe('string');
    expect(sections.css.web).toContain('.obs-story-title');
    expect(sections.css.print).toContain('break-after: page');
    expect(result).not.toHaveProperty('fullHtml'); // renderHTML composes the document
  });

  test('wraps the body in a resource section with the TOC title', () => {
    expect(body).toContain(
      '<div class="section" id="obs" data-toc-title="unfoldingWord® Open Bible Stories">'
    );
  });

  test('renders stories in numeric order (2 before 12) with anchors, headings and TOC entries', () => {
    const ids = [...body.matchAll(/<section class="section story" id="nav-obs-(\d+)"/g)].map((m) =>
      Number(m[1])
    );
    expect(ids).toEqual([1, 2, 12]);
    expect(body).toContain(
      '<section class="section story" id="nav-obs-1" data-toc-title="1. The Creation">'
    );
    expect(body).toContain('<a href="#nav-obs-1" class="header-link">1. The Creation</a></h1>');
    expect(sections.toc).toEqual([
      { id: 'nav-obs-1', title: '1. The Creation', story: 1 },
      { id: 'nav-obs-2', title: '2. Sin Enters the World', story: 2 },
      { id: 'nav-obs-12', title: '12. The Exodus', story: 12 },
    ]);
  });

  test('renders frames in numeric order (2 before 10) with their text', () => {
    const story1 = body.slice(body.indexOf('id="nav-obs-1"'), body.indexOf('id="nav-obs-2"'));
    const frameIds = [...story1.matchAll(/id="obs-1-(\d+)"/g)].map((m) => Number(m[1]));
    expect(frameIds).toEqual([1, 2, 10]);
    expect(body).toContain('<p>This is how the beginning of everything happened.</p>');
    expect(body).toContain('<p>God saw that it was good.</p>');
  });

  test('uses the default 360px CDN picture when a frame has no image URL', () => {
    expect(body).toContain(
      '<img src="https://cdn.door43.org/obs/jpg/360px/obs-en-01-01.jpg" alt="Frame 1-1">'
    );
    expect(body).toContain('obs-en-01-10.jpg');
  });

  test("keeps a frame's own image URL over the CDN fallback", () => {
    expect(body).toContain('<img src="https://example.test/custom-02-02.jpg" alt="Frame 2-2">');
    expect(body).not.toContain('obs-en-02-02.jpg');
  });

  test('renders the Bible reference after the frames of each story', () => {
    expect(body).toContain(
      '<div class="article obs-story-bible-ref" id="obs-story-bible-ref-1"><em>A Bible story from: Genesis 1-2</em></div>'
    );
    const lastFrame = body.indexOf('id="obs-1-10"');
    const ref = body.indexOf('id="obs-story-bible-ref-1"');
    expect(ref).toBeGreaterThan(lastFrame);
  });

  test('renders front and back matter from markdown', () => {
    expect(body).toContain('<div class="obs-front-matter"><h1>Front matter</h1>');
    expect(body).toContain('<p>About these stories.</p>');
    expect(body).toContain(
      '<section class="section obs-back-section" data-toc-title="Back Matter">'
    );
    expect(body).toContain(
      '<div class="article obs-back-article" id="obs-back-article"><h1>Back matter</h1>'
    );
    // Front matter comes before the first story; back matter after the last.
    expect(body.indexOf('obs-front-matter')).toBeLessThan(body.indexOf('id="nav-obs-1"'));
    expect(body.indexOf('obs-back-section')).toBeGreaterThan(body.indexOf('id="nav-obs-12"'));
  });

  test('escapes HTML in titles, text, references and the image src attribute', () => {
    const data = buildResourceData({
      stories: {
        1: {
          title: 'Tom & "Jerry" <3',
          reference: 'A <b>ref</b>',
          frames: {
            1: {
              text: 'He said "hi" & left',
              img: 'https://x.test/a.jpg?w=1&h=2"><script>x()</script>',
            },
          },
        },
      },
    });
    // Default resolution keeps the pictures, so the frame's own URL reaches the src sink.
    const { sections: s } = renderObsHtml(data);
    expect(s.body).toContain('data-toc-title="Tom &amp; &quot;Jerry&quot; &lt;3"');
    expect(s.body).toContain('<p>He said &quot;hi&quot; &amp; left</p>');
    expect(s.body).toContain('<em>A &lt;b&gt;ref&lt;/b&gt;</em>');
    expect(s.body).not.toContain('<b>ref</b>');
    expect(s.body).toContain(
      '<img src="https://x.test/a.jpg?w=1&amp;h=2&quot;&gt;&lt;script&gt;x()&lt;/script&gt;" alt="Frame 1-1">'
    );
    expect(s.body).not.toContain('<script>');
  });
});

describe('renderObsHtml options', () => {
  test("resolution: 'none' omits every picture, even a frame's own URL", () => {
    const { sections } = renderObsHtml(buildResourceData(), { resolution: 'none' });
    expect(sections.body).not.toContain('<img');
    expect(sections.body).toContain('<p>But there was a crafty snake.</p>');
  });

  test("resolution: '2160px' points the CDN fallback at the large pictures", () => {
    const { sections } = renderObsHtml(buildResourceData(), { resolution: '2160px' });
    expect(sections.body).toContain('https://cdn.door43.org/obs/jpg/2160px/obs-en-01-01.jpg');
    expect(sections.body).not.toContain('/360px/');
    // A frame's own URL is still preferred.
    expect(sections.body).toContain('https://example.test/custom-02-02.jpg');
  });

  test('chapters limits the stories rendered and listed in the TOC', () => {
    const { sections } = renderObsHtml(buildResourceData(), { chapters: [2] });
    expect(sections.body).toContain('id="nav-obs-2"');
    expect(sections.body).not.toContain('id="nav-obs-1"');
    expect(sections.toc).toEqual([{ id: 'nav-obs-2', title: '2. Sin Enters the World', story: 2 }]);
    // Front and back matter are not story-scoped, so they stay.
    expect(sections.body).toContain('obs-front-matter');
    expect(sections.body).toContain('obs-back-section');
  });

  test('an unknown chapter number renders no stories', () => {
    const { sections } = renderObsHtml(buildResourceData(), { chapters: [99] });
    expect(sections.toc).toEqual([]);
    expect(sections.body).not.toContain('class="section story"');
  });

  test('a story without a title or reference gets a numbered title and no reference block', () => {
    const data = buildResourceData({
      front: '',
      back: '',
      stories: { 7: { frames: { 1: { text: 'Only text.' } } } },
    });
    const { sections } = renderObsHtml(data, { resolution: 'none' });
    expect(sections.body).toContain('data-toc-title="Story 7"');
    expect(sections.body).not.toContain('obs-story-bible-ref');
    expect(sections.body).not.toContain('obs-front-matter');
    expect(sections.body).not.toContain('obs-back-section');
    expect(sections.toc).toEqual([{ id: 'nav-obs-7', title: 'Story 7', story: 7 }]);
  });

  test('a frame without text still renders an (empty) content block', () => {
    const data = buildResourceData({ stories: { 1: { title: 'T', frames: { 1: {} } } } });
    const { sections } = renderObsHtml(data, { resolution: 'none' });
    expect(sections.body).toContain('<div class="obs-frame-content"><p></p></div>');
  });

  test('falls back to the default title when the data has none', () => {
    const data = buildResourceData({ title: undefined });
    const result = renderObsHtml(data, { resolution: 'none' });
    expect(result.title).toBe('Open Bible Stories');
    expect(result.sections.body).toContain('data-toc-title="Open Bible Stories"');
  });
});

describe('renderObsHtml input validation', () => {
  test('rejects missing data', () => {
    expect(() => renderObsHtml(null)).toThrow('OBS renderer expects OBS resource data');
  });

  test('rejects data of another type, even with stories', () => {
    expect(() => renderObsHtml({ ...buildResourceData(), type: 'usfm' })).toThrow(
      'OBS renderer expects OBS resource data'
    );
  });

  test('renders OBS data with no stories as a document with no story sections', () => {
    // The same result as a `chapters` filter that selects nothing.
    const { sections } = renderObsHtml({ type: 'obs', stories: {} }, { resolution: 'none' });
    expect(sections.toc).toEqual([]);
    expect(sections.body).not.toContain('nav-obs-');
  });

  test('rejects OBS data without stories', () => {
    expect(() => renderObsHtml({ type: 'obs' })).toThrow('OBS renderer expects OBS resource data');
  });
});
