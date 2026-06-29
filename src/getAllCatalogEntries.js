import axios from 'axios';

// The npm package version of this renderer library (distinct from the *resource*
// version, e.g. 'v89', which is carried separately on the CatalogSet).
const libraryVersion =
  typeof process !== 'undefined' && process?.env?.npm_package_version
    ? process.env.npm_package_version
    : '0.0.0';

let isQuiet = false;
function log(...args) {
  if (!isQuiet) console.warn(...args);
}

/**
 * Resolve a `source` into { owner, repo, ref, books, dcsApiUrl }.
 *
 * `source` is either:
 *  - a descriptor: `{ owner, repo, ref, books?, dcs_api_url? }`  (has `ref`)
 *  - a catalog entry: `{ owner, name, branch_or_tag_name, url, ... }`
 */
function resolveDescriptor(source, options) {
  let dcsApiUrl = options.dcs_api_url || 'https://git.door43.org/api/v1';

  if (source.ref) {
    return {
      owner: source.owner,
      repo: source.repo,
      ref: source.ref,
      books: source.books || options.books || [],
      dcsApiUrl: options.dcs_api_url || source.dcs_api_url || dcsApiUrl,
    };
  }

  // Catalog entry: derive the DCS API base from its `url` when present.
  if (source.url) {
    const parts = source.url.split('/');
    if (parts.length >= 5) {
      dcsApiUrl = `${parts[0]}//${parts[2]}/${parts[3]}/${parts[4]}`;
    }
  }
  if (options.dcs_api_url) dcsApiUrl = options.dcs_api_url;

  return {
    owner: source.owner,
    repo: source.name,
    ref: source.branch_or_tag_name,
    books: options.books || [],
    dcsApiUrl,
  };
}

/**
 * Fetch the full book-package catalog (the blueprint) for a resource.
 *
 * Stage 1 of the rendering pipeline. Calls `/catalog/bp/` once and returns a
 * CatalogSet. Accepts a discriminated `source` so callers can fetch fresh or
 * pass an already-resolved set straight through:
 *
 * @param {Object} source - `{ owner, repo, ref, books? }` | a catalog entry | a CatalogSet (returned as-is)
 * @param {Object} [options]
 * @param {string} [options.dcs_api_url] - DCS API base URL
 * @param {boolean} [options.quiet] - Suppress logging
 * @param {Array<string>} [options.books] - Books (used with the catalog-entry source form)
 * @returns {Promise<{resourceVersion: string, libraryVersion: string, catalogEntries: Array, source: Object}>}
 */
export async function getAllCatalogEntries(source, options = {}) {
  if (!source || typeof source !== 'object') {
    throw new Error(
      'getAllCatalogEntries: source must be an object ({ owner, repo, ref }, a catalog entry, or a CatalogSet).'
    );
  }

  isQuiet = options.quiet || false;

  // CatalogSet passthrough — already resolved upstream.
  if (Array.isArray(source.catalogEntries)) {
    return source;
  }

  const { owner, repo, ref, books, dcsApiUrl } = resolveDescriptor(source, options);
  if (!owner || !repo || !ref) {
    throw new Error('Owner, repo, and ref are required.');
  }

  const bpUrl = `${dcsApiUrl}/catalog/bp/${owner}/${repo}/${ref}`;
  log(bpUrl);

  try {
    const response = await axios.get(bpUrl);

    if (!response.data || !response.data.data) {
      throw new Error('Invalid response from /catalog/bp endpoint');
    }

    const catalogEntries = response.data.data;
    if (!Array.isArray(catalogEntries) || catalogEntries.length === 0) {
      throw new Error('No catalog entries returned from /catalog/bp endpoint');
    }

    const main = catalogEntries[0] || {};
    const resourceVersion = main.branch_or_tag_name || main.release?.tag_name || ref;

    return {
      resourceVersion,
      libraryVersion,
      catalogEntries,
      source: { owner, repo, ref, books, dcsApiUrl },
    };
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Failed to fetch catalog entries: ${error.response.status} ${error.response.statusText}`
      );
    }
    throw error;
  }
}
