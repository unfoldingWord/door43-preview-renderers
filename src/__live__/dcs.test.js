import { getAllCatalogEntries } from '../getAllCatalogEntries.js';
import { getResourceData } from '../getResourceData.js';
import { renderHtmlData } from '../renderHtmlData.js';
import { renderHTML } from '../renderHTML.js';
import { EN_RELEASE, RELEASES } from '../demoExamples.js';

/**
 * Live smoke tests (#30): real DCS, current releases, the whole pipeline. They
 * catch what mocks cannot (a catalog shape that moved, an archive layout, a
 * link the renderers no longer resolve). Run with `pnpm test:live`; CI runs
 * them nightly and by hand, never on pull requests. Bump the releases in
 * src/demoExamples.js.
 */

const quiet = { quiet: true };

/** Compose the print document and check what any render should satisfy. */
function checkDocument(htmlData, { lang = 'en', dir = 'ltr' } = {}) {
  const html = renderHTML(htmlData, { media: 'print' });
  expect(html).toContain(`<html lang="${lang}" dir="${dir}">`);
  // Anchors are rewritten from the renderers' `nav-` prefix.
  expect(html).not.toMatch(/\bid="nav-/);
  // rc:// links are resolved to anchors (or neutralized), never left raw in a link.
  expect(html).not.toMatch(/href="rc:\/\//);
  // Every in-document link lands on an element that exists.
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const dangling = [...html.matchAll(/href="#([^"]+)"/g)]
    .map((m) => m[1])
    .filter((id) => !ids.has(id));
  expect([...new Set(dangling)]).toEqual([]);
  return html;
}

const render = async (descriptor, options = {}, renderOptions = {}) => {
  const set = await getAllCatalogEntries(descriptor, quiet);
  const data = await getResourceData(set, { ...quiet, ...options });
  expect(data.error).toBeUndefined();
  return { set, data, htmlData: renderHtmlData(data, { books: set.source.books, renderOptions }) };
};

describe('live DCS', () => {
  test(`en_ult ${EN_RELEASE}, Titus`, async () => {
    const { htmlData } = await render({
      owner: 'unfoldingWord',
      repo: 'en_ult',
      ref: EN_RELEASE,
      books: ['tit'],
    });
    expect(htmlData.subject).toBe('Aligned Bible');
    expect(checkDocument(htmlData)).toContain('Paul');
  });

  test(`en_tn ${EN_RELEASE}, 3 John, with Translation Questions`, async () => {
    const { data, htmlData } = await render(
      { owner: 'unfoldingWord', repo: 'en_tn', ref: EN_RELEASE, books: ['3jn'] },
      { extraSubjects: ['TSV Translation Questions'] }
    );
    const extras = Object.values(data.extras).map((e) => e.subject);
    for (const subject of [
      'Aligned Bible',
      'Translation Academy',
      'Translation Words',
      'TSV Translation Words Links',
      'Greek New Testament',
      'TSV Translation Questions',
    ]) {
      expect(extras).toContain(subject);
    }
    // GL quotes worked out locally for most notes.
    const rows = Object.values(data.books['3jn'].chapters).flatMap((c) =>
      Object.values(c.verses).flat()
    );
    const withQuote = rows.filter((r) => r.Quote);
    const converted = withQuote.filter((r) => Object.keys(r.GLQuotes || {}).length);
    expect(converted.length / withQuote.length).toBeGreaterThan(0.9);
    const html = checkDocument(htmlData);
    expect(html).toContain('tn-verse-questions');
    expect(html).toContain('id="appendix-ta"');
  });

  test(`en_obs ${RELEASES.obs}`, async () => {
    const { data, htmlData } = await render({
      owner: 'unfoldingWord',
      repo: 'en_obs',
      ref: RELEASES.obs,
    });
    expect(Object.keys(data.stories)).toHaveLength(50);
    checkDocument(htmlData);
  });

  test(`en_obs-tn ${RELEASES['obs-tn']}`, async () => {
    const { data, htmlData } = await render({
      owner: 'unfoldingWord',
      repo: 'en_obs-tn',
      ref: RELEASES['obs-tn'],
      books: ['obs'],
    });
    expect(Object.values(data.extras).map((e) => e.subject)).toContain('Open Bible Stories');
    checkDocument(htmlData);
  });

  test('a language and subject find the unfoldingWord release (stage 0)', async () => {
    const set = await getAllCatalogEntries(
      { lang: 'en', subject: 'TSV Translation Notes', books: ['tit'] },
      quiet
    );
    expect(set.source).toMatchObject({ owner: 'unfoldingWord', repo: 'en_tn' });
    expect(set.catalogEntries[0].name).toBe('en_tn');
  });
});
