import { jest } from '@jest/globals';

// The copyright page fetches LICENSE.md through dcsApi; stub that one call so
// the renderer is exercised offline. (dcsApi itself is covered elsewhere.)
const fetchContentMock = jest.fn();
jest.unstable_mockModule('../dcsApi.js', () => ({
  fetchContent: fetchContentMock,
  fetchLicense: jest.fn(),
}));

const { generateCopyrightAndLicenseHtml, copyrightCss } = await import(
  '../renderers/copyrightAndLicenseRenderer.js'
);

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
    fetchContentMock.mockReset();
  });

  test('renders LICENSE.md from the main entry as HTML under the page heading', async () => {
    fetchContentMock.mockResolvedValueOnce('# License\n\n**CC BY-SA 4.0** applies.');

    const html = await generateCopyrightAndLicenseHtml(mainEntry);

    expect(fetchContentMock).toHaveBeenCalledWith(
      'unfoldingWord',
      'en_tn',
      'v91',
      'LICENSE.md',
      'https://git.door43.org/api/v1'
    );
    expect(html.startsWith('<h1>Copyrights &amp; Licensing</h1>\n')).toBe(true);
    expect(html).toContain('<h1>License</h1>');
    expect(html).toContain('<strong>CC BY-SA 4.0</strong> applies.');
  });

  test('passes a custom DCS API URL through to the license fetch', async () => {
    fetchContentMock.mockResolvedValueOnce('');
    await generateCopyrightAndLicenseHtml(mainEntry, [], { dcs_api_url: 'https://qa.door43.org/api/v1' });
    expect(fetchContentMock).toHaveBeenCalledWith(
      'unfoldingWord',
      'en_tn',
      'v91',
      'LICENSE.md',
      'https://qa.door43.org/api/v1'
    );
  });

  test('lists the main entry and every built-with entry with date, version and publisher', async () => {
    fetchContentMock.mockResolvedValueOnce('');

    const html = await generateCopyrightAndLicenseHtml(mainEntry, [ultEntry]);

    // Main entry (repo.* fields)
    expect(html).toContain('<div class="built-with-title">unfoldingWord® Translation Notes</div>');
    expect(html).toContain('<span class="built-with-label">Date:</span> 2026-09-26');
    expect(html).toContain('<span class="built-with-label">Version:</span> v91');
    expect(html).toContain('<span class="built-with-label">Published by:</span> unfoldingWord®');
    // Dependency (top-level fields, `ref` and `repo.released` fallbacks)
    expect(html).toContain('<div class="built-with-title">unfoldingWord® Literal Text</div>');
    expect(html).toContain('<span class="built-with-label">Date:</span> 2026-09-20');
    expect(html).toContain('<span class="built-with-label">Published by:</span> unfoldingWord</div>');
    // Order: main first, then dependencies
    expect(html.indexOf('Translation Notes</div>')).toBeLessThan(html.indexOf('Literal Text</div>'));
    expect((html.match(/class="built-with-entry"/g) || []).length).toBe(2);
  });

  test('omits date, version and publisher lines that the entry does not carry', async () => {
    fetchContentMock.mockResolvedValueOnce('');
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

  test('falls back to master when the entry has no ref, and carries on without a license', async () => {
    fetchContentMock.mockRejectedValueOnce(new Error('404'));
    const html = await generateCopyrightAndLicenseHtml({ owner: 'o', name: 'r' });
    expect(fetchContentMock).toHaveBeenCalledWith('o', 'r', 'master', 'LICENSE.md', expect.any(String));
    expect(html).toContain('<h1>Copyrights &amp; Licensing</h1>');
    expect(html).not.toContain('<h1>License</h1>');
    expect(html).toContain('class="built-with-entry"');
  });

  test('uses the commit sha as the ref when there is no tag or branch', async () => {
    fetchContentMock.mockResolvedValueOnce('');
    await generateCopyrightAndLicenseHtml({ owner: 'o', name: 'r', commit_sha: 'abc123' });
    expect(fetchContentMock).toHaveBeenCalledWith('o', 'r', 'abc123', 'LICENSE.md', expect.any(String));
  });

  test('renders the generator footer: linked name, version, and today', async () => {
    fetchContentMock.mockResolvedValueOnce('');
    const today = new Date().toISOString().split('T')[0];

    const html = await generateCopyrightAndLicenseHtml(mainEntry, [], {
      generatorName: 'Door43 Preview',
      generatorVersion: '2.0.0',
      generatorUrl: 'https://preview.door43.org/?a=1&b=2',
    });

    expect(html).toContain(
      '<a href="https://preview.door43.org/?a=1&amp;b=2" target="_blank">Door43 Preview</a>'
    );
    expect(html).toContain('<span class="built-with-label">Version:</span> 2.0.0</span>');
    expect(html).toContain(`<span class="built-with-label">Date:</span> ${today}</span>`);
  });

  test('renders an unlinked generator name by default, and no version line', async () => {
    fetchContentMock.mockResolvedValueOnce('');
    const html = await generateCopyrightAndLicenseHtml(mainEntry);
    const footer = html.slice(html.indexOf('<div class="generated-with-footer">'));
    expect(footer).toContain('<span class="built-with-label">Generated with:</span> door43-preview-renderers</span>');
    expect(footer).not.toContain('<a ');
    expect(footer).not.toContain('Version:');
  });

  test('escapes HTML in titles and publishers', async () => {
    fetchContentMock.mockResolvedValueOnce('');
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
