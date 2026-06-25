import MarkdownIt from 'markdown-it';
import { fetchContent } from '../dcsApi.js';

const md = new MarkdownIt();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    return d.toISOString().split('T')[0];
  } catch {
    return String(isoDate);
  }
}

/**
 * Generate HTML for the copyright and licensing page.
 *
 * @param {Object} catalogEntry - The main resource catalog entry
 * @param {Array<Object>} builtWith - Array of catalog entries for resources used in rendering
 * @param {Object} [options] - Options
 * @param {string} [options.dcs_api_url] - DCS API base URL
 * @param {string} [options.generatorName] - Name of the generating tool
 * @param {string} [options.generatorVersion] - Version of the generating tool
 * @param {string} [options.generatorUrl] - URL of the generating tool
 * @returns {Promise<string>} Copyright page HTML
 */
export async function generateCopyrightAndLicenseHtml(catalogEntry, builtWith = [], options = {}) {
  const {
    dcs_api_url = 'https://git.door43.org/api/v1',
    generatorName = 'door43-preview-renderers',
    generatorVersion = '',
    generatorUrl = '',
  } = options;

  let html = '<h1>Copyrights &amp; Licensing</h1>\n';

  // Fetch and render the LICENSE.md file
  const owner = catalogEntry.repo?.owner?.username || catalogEntry.owner || '';
  const repo = catalogEntry.repo?.name || catalogEntry.name || '';
  const ref = catalogEntry.branch_or_tag_name || catalogEntry.commit_sha || 'master';

  let licenseHtml = '';
  try {
    const licenseContent = await fetchContent(owner, repo, ref, 'LICENSE.md', dcs_api_url);
    if (licenseContent) {
      licenseHtml = md.render(licenseContent);
    }
  } catch {
    // LICENSE.md not found — use license field from data if available
  }

  if (licenseHtml) {
    html += licenseHtml + '\n';
  }

  // Add built-with entries (the main resource + dependencies)
  const allEntries = [catalogEntry, ...builtWith];
  for (const entry of allEntries) {
    const title = entry.repo?.title || entry.title || entry.repo?.name || entry.name || '';
    const released = entry.released || entry.repo?.released || '';
    const version = entry.branch_or_tag_name || entry.ref || '';
    const publishedBy =
      entry.repo?.owner?.full_name ||
      entry.repo?.owner?.username ||
      entry.owner ||
      '';

    html += `<div class="built-with-entry">\n`;
    html += `  <div class="built-with-title">${escapeHtml(title)}</div>\n`;
    if (released) {
      html += `  <div><span class="built-with-label">Date:</span> ${escapeHtml(formatDate(released))}</div>\n`;
    }
    if (version) {
      html += `  <div><span class="built-with-label">Version:</span> ${escapeHtml(version)}</div>\n`;
    }
    if (publishedBy) {
      html += `  <div><span class="built-with-label">Published by:</span> ${escapeHtml(publishedBy)}</div>\n`;
    }
    html += `</div>\n`;
  }

  // Generator footer
  const now = new Date().toISOString().split('T')[0];
  html += `<div class="generated-with-footer">\n`;
  if (generatorUrl) {
    html += `  <span><span class="built-with-label">Generated with:</span> <a href="${escapeHtml(generatorUrl)}" target="_blank">${escapeHtml(generatorName)}</a></span>\n`;
  } else if (generatorName) {
    html += `  <span><span class="built-with-label">Generated with:</span> ${escapeHtml(generatorName)}</span>\n`;
  }
  if (generatorVersion) {
    html += `  <span><span class="built-with-label">Version:</span> ${escapeHtml(generatorVersion)}</span>\n`;
  }
  html += `  <span><span class="built-with-label">Date:</span> ${escapeHtml(now)}</span>\n`;
  html += `</div>\n`;

  return html;
}

export const copyrightCss = `
.built-with-entry {
  padding-bottom: 10px;
}

.built-with-title {
  font-weight: bold;
}

.built-with-label {
  font-weight: bold;
}

.generated-with-footer {
  font-size: 0.8em;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid black;
  margin-top: 10px;
  padding-top: 5px;
}
`;
