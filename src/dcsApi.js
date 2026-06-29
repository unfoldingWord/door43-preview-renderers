import axios from 'axios';

/**
 * Fetch and decode base64 file content from DCS
 */
export async function fetchContent(owner, repo, ref, filePath, dcs_api_url) {
  const url = `${dcs_api_url}/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;
  const response = await axios.get(url);
  const base64Content = response.data.content;

  // Decode base64 - works in both browser and Node.js
  let decodedContent;
  if (typeof window !== 'undefined' && window.atob) {
    // Browser environment
    decodedContent = decodeURIComponent(
      atob(base64Content)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } else {
    // Node.js environment
    decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
  }

  return decodedContent;
}

/**
 * Fetch a repository's license file from DCS.
 *
 * Tries the common license filenames in order and returns the first that
 * exists (trimmed). Returns an empty string if none are found.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git reference
 * @param {string} dcs_api_url - DCS API base URL
 * @returns {Promise<string>} License content, or '' if not found
 */
export async function fetchLicense(owner, repo, ref, dcs_api_url) {
  const licensePaths = ['LICENSE.md', 'LICENSE', 'LICENSE.txt'];

  for (const licensePath of licensePaths) {
    try {
      const license = await fetchContent(owner, repo, ref, licensePath, dcs_api_url);
      if (license) {
        return license.trim();
      }
    } catch {
      // Try next candidate path.
    }
  }

  return '';
}

/**
 * Read the license file from an already-loaded repository zip.
 *
 * Matches a LICENSE file at the archive root (`<rootFolder>/LICENSE[.md|.txt]`)
 * case-insensitively, so it works regardless of how DCS cases the root folder.
 * Use this for zip-based extractors (TA, TW, OBS) to avoid an extra request.
 *
 * @param {JSZip} zip - A loaded JSZip instance for the repo archive
 * @returns {Promise<string>} License content, or '' if not found
 */
export async function readLicenseFromZip(zip) {
  const licenseName = Object.keys(zip.files).find((name) =>
    /^[^/]+\/LICENSE(\.md|\.txt)?$/i.test(name)
  );
  if (!licenseName) {
    return '';
  }
  const file = zip.file(licenseName);
  if (!file) {
    return '';
  }
  return (await file.async('string')).trim();
}
