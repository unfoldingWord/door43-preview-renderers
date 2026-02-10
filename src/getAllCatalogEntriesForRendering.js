import axios from 'axios';
import pkg from '../package.json' with { type: 'json' };

const { version } = pkg;

// Global quiet flag for logging
let isQuiet = false;

/**
 * Logging function that respects quiet flag
 * @param {...any} args - Arguments to log
 */
function log(...args) {
  if (!isQuiet) {
    console.log(...args);
  }
}

/**
 * Get all catalog entries needed for rendering a resource
 *
 * @param {string|Object} ownerOrCatalogEntry - Repository owner OR catalog entry object
 * @param {string|Array} [repoOrBooks] - Repository name OR books array
 * @param {string|Object} [refOrOptions] - Git reference OR options object with dcs_api_url
 * @param {Array} [booksOrUndefined] - Books array (when first param is owner)
 * @param {Object} [optionsOrUndefined] - Options object (when first param is owner)
 * @returns {Promise<Object>} Object with version (string) and catalogEntries (array)
 *
 * @example
 * // Using owner/repo/ref
 * const result = await getAllCatalogEntriesForRendering(
 *   'unfoldingWord',
 *   'en_tn',
 *   'v87',
 *   ['1th'],
 *   { dcs_api_url: 'https://qa.door43.org/api/v1' }
 * );
 * console.log(result.version); // "1.4.0"
 * console.log(result.catalogEntries.length); // Number of entries
 *
 * @example
 * // Using catalog entry object
 * const result = await getAllCatalogEntriesForRendering(
 *   catalogEntry,
 *   ['tit']
 * );
 * console.log(result.catalogEntries[0]); // Main entry
 */
export async function getAllCatalogEntriesForRendering(
  ownerOrCatalogEntry,
  repoOrBooks,
  refOrOptions,
  booksOrUndefined,
  optionsOrUndefined
) {
  let owner;
  let repo;
  let ref;
  let dcs_api_url = 'https://git.door43.org/api/v1';

  // Determine which signature was used
  if (typeof ownerOrCatalogEntry === 'string') {
    // First signature: (owner, repo, ref, books?, options?)
    owner = ownerOrCatalogEntry;
    repo = repoOrBooks;
    ref = refOrOptions;
    const options = optionsOrUndefined || {};
    dcs_api_url = options.dcs_api_url || dcs_api_url;
    isQuiet = options.quiet || false;
  } else {
    // Second signature: (catalogEntry, books?, options?)
    const catalogEntry = ownerOrCatalogEntry;
    const options =
      typeof repoOrBooks === 'object' && !Array.isArray(repoOrBooks)
        ? repoOrBooks
        : refOrOptions || {};

    // Extract owner/repo/ref from catalogEntry
    owner = catalogEntry.owner;
    repo = catalogEntry.name;
    ref = catalogEntry.branch_or_tag_name;

    // Extract dcs_api_url from catalogEntry.url
    if (catalogEntry.url) {
      const urlParts = catalogEntry.url.split('/');
      if (urlParts.length >= 3) {
        dcs_api_url = `${urlParts[0]}//${urlParts[2]}/${urlParts[3]}/${urlParts[4]}`;
      }
    }
    if (options.dcs_api_url) {
      dcs_api_url = options.dcs_api_url;
    }
    isQuiet = options.quiet || false;
  }

  if (!owner || !repo || !ref) {
    throw new Error('Owner, repo, and ref are required.');
  }

  // Call the new /catalog/bp endpoint
  const bpUrl = `${dcs_api_url}/catalog/bp/${owner}/${repo}/${ref}`;
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

    return { version, catalogEntries };
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Failed to fetch catalog entries: ${error.response.status} ${error.response.statusText}`
      );
    }
    throw error;
  }
}
