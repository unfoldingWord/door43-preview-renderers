import { jest } from '@jest/globals';

// The copyright page reads the license from the resource's burrito through
// dcsApi (metadata.json, then the license ingredient); stub those two calls so
// the renderer is exercised offline. (dcsApi itself is covered elsewhere.)
const fetchJsonMock = jest.fn();
const fetchTextMock = jest.fn();
jest.unstable_mockModule('../dcsApi.js', () => ({
  fetchJson: fetchJsonMock,
  fetchText: fetchTextMock,
}));

const LICENSED = {
  identification: { primary: { dcs: { 'unfoldingWord/en_tn': { revision: 'rev1' } } } },
  ingredients: { 'ingredients/LICENSE.md': { mimeType: 'text/markdown' } },
};
// metadata.json with a license ingredient (dcsApi caches it, so every read of it
// answers the same), and that license's text.
const license = (text) => {
  fetchJsonMock.mockResolvedValue(LICENSED);
  fetchTextMock.mockResolvedValueOnce(text);
};

const { generateCopyrightAndLicenseHtml, copyrightCss } =
  await import('../renderers/copyrightAndLicenseRenderer.js');

const mainEntry = {
  repo: {
    name: 'en_tn',
    title: 'unfoldingWord® Translation Notes',
    owner: { username: 'unfoldingWord', full_name: 'unfoldingWord®' },
  },
  branch_or_tag_name: 'v91',
  released: '2026-09-26T14:00:00Z',
};

const ultEntry = {
  name: 'en_ult',
  title: 'unfoldingWord® Literal Text',
  owner: 'unfoldingWord',
  ref: 'v91',
  repo: { released: '2026-09-20T00:00:00Z' },
};

describe('generateCopyrightAndLicenseHtml', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchTextMock.mockReset();
  });

  test('renders LICENSE.md from the main entry as HTML under the page heading', async () => {
    license('# License\n\n**CC BY-SA 4.0** applies.');

    const html = await generateCopyrightAndLicenseHtml(mainEntry);

    expect(fetchJsonMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/repos/unfoldingWord/en_tn/sb/raw/metadata.json?ref=v91'
    );
    // Read at the commit metadata.json was converted from.
    expect(fetchTextMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/repos/unfoldingWord/en_tn/sb/raw/ingredients/LICENSE.md?ref=rev1'
    );
    expect(html.startsWith('<h1>Copyrights &amp; Licensing</h1>\n')).toBe(true);
    expect(html).toContain('<h1>License</h1>');
    expect(html).toContain('<strong>CC BY-SA 4.0</strong> applies.');
  });

  test('escapes raw HTML inside fetched license markdown', async () => {
    license('# License\n\n<script>alert(1)</script> and <b>bold</b>');
    const html = await generateCopyrightAndLicenseHtml(mainEntry);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).not.toContain('<script>');
  });

  test('passes a custom DCS API URL through to the license fetch', async () => {
    license('');
    await generateCopyrightAndLicenseHtml(mainEntry, [], {
      dcsApiUrl: 'https://qa.door43.org/api/v1',
    });
    expect(fetchJsonMock).toHaveBeenCalledWith(
      'https://qa.door43.org/api/v1/repos/unfoldingWord/en_tn/sb/raw/metadata.json?ref=v91'
    );
  });

  test('lists the main entry and every built-with entry with date, version and publisher', async () => {
    license('');

    const html = await generateCopyrightAndLicenseHtml(mainEntry, [ultEntry]);

    // Main entry (repo.* fields)
    expect(html).toContain('<div class="built-with-title">unfoldingWord® Translation Notes</div>');
    expect(html).toContain('<span class="built-with-label">Date:</span> 2026-09-26');
    expect(html).toContain('<span class="built-with-label">Version:</span> v91');
    expect(html).toContain('<span class="built-with-label">Published by:</span> unfoldingWord®');
    // Dependency (top-level fields, `ref` and `repo.released` fallbacks)
    expect(html).toContain('<div class="built-with-title">unfoldingWord® Literal Text</div>');
    expect(html).toContain('<span class="built-with-label">Date:</span> 2026-09-20');
    expect(html).toContain(
      '<span class="built-with-label">Published by:</span> unfoldingWord</div>'
    );
    // Order: main first, then dependencies
    expect(html.indexOf('Translation Notes</div>')).toBeLessThan(
      html.indexOf('Literal Text</div>')
    );
    expect((html.match(/class="built-with-entry"/g) || []).length).toBe(2);
  });

  test('omits date, version and publisher lines that the entry does not carry', async () => {
    license('');
    const html = await generateCopyrightAndLicenseHtml({ name: 'bare' });
    expect(html).toContain('<div class="built-with-title">bare</div>');
    // The generator footer carries today's date, so look inside the entry only.
    const entry = html.slice(
      html.indexOf('<div class="built-with-entry">'),
      html.indexOf('<div class="generated-with-footer">')
    );
    expect(entry).toContain('built-with-title');
    expect(entry).not.toContain('Date:');
    expect(entry).not.toContain('Version:');
    expect(entry).not.toContain('Published by:');
  });

  test('reads the default branch when the entry has no ref, and carries on without a license', async () => {
    fetchJsonMock.mockRejectedValueOnce(new Error('404'));
    const html = await generateCopyrightAndLicenseHtml({ owner: 'o', name: 'r' });
    expect(fetchJsonMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/repos/o/r/sb/raw/metadata.json'
    );
    expect(html).toContain('<h1>Copyrights &amp; Licensing</h1>');
    expect(html).not.toContain('<h1>License</h1>');
    expect(html).toContain('class="built-with-entry"');
  });

  test('uses the commit sha as the ref when there is no tag or branch', async () => {
    license('');
    await generateCopyrightAndLicenseHtml({ owner: 'o', name: 'r', commit_sha: 'abc123' });
    expect(fetchJsonMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/repos/o/r/sb/raw/metadata.json?ref=abc123'
    );
  });

  test('renders the generator footer: linked name, version, and today', async () => {
    license('');
    const today = new Date().toISOString().split('T')[0];

    const html = await generateCopyrightAndLicenseHtml(mainEntry, [], {
      generatorName: 'Door43 Preview',
      generatorVersion: '2.0.0',
      generatorUrl: 'https://preview.door43.org/?a=1&b=2',
    });

    expect(html).toContain(
      '<a href="https://preview.door43.org/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Door43 Preview</a>'
    );
    expect(html).toContain('<span class="built-with-label">Version:</span> 2.0.0</span>');
    expect(html).toContain(`<span class="built-with-label">Date:</span> ${today}</span>`);
  });

  test('renders an unlinked generator name by default, and no version line', async () => {
    license('');
    const html = await generateCopyrightAndLicenseHtml(mainEntry);
    const footer = html.slice(html.indexOf('<div class="generated-with-footer">'));
    expect(footer).toContain(
      '<span class="built-with-label">Generated with:</span> door43-preview-renderers</span>'
    );
    expect(footer).not.toContain('<a ');
    expect(footer).not.toContain('Version:');
  });

  test('escapes HTML in titles and publishers', async () => {
    license('');
    const html = await generateCopyrightAndLicenseHtml({
      title: 'Notes <b>&</b> "Quotes"',
      owner: "O'Brien <org>",
    });
    expect(html).toContain('Notes &lt;b&gt;&amp;&lt;/b&gt; &quot;Quotes&quot;');
    expect(html).toContain('O&#39;Brien &lt;org&gt;');
  });
});

describe('copyrightCss', () => {
  test('is a stylesheet for the built-with entries and footer', () => {
    expect(typeof copyrightCss).toBe('string');
    expect(copyrightCss).toContain('.built-with-entry');
    expect(copyrightCss).toContain('.generated-with-footer');
  });
});
