import axios from 'axios';
import { loggerFor } from './logger.js';
import { ResourceError } from './errors.js';
import { dcsApiUrlFrom } from './options.js';
import { REQUEST_TIMEOUT_MS } from './dcsApi.js';
import { resolveResource } from './findResources.js';

// The npm package version of this renderer library (distinct from the *resource*
// version, e.g. 'v89', which is carried separately on the CatalogSet).
const libraryVersion =
  typeof process !== 'undefined' && process?.env?.npm_package_version
    ? process.env.npm_package_version
    : '0.0.0';

/**
 * Resolve a `source` into { owner, repo, ref, books, dcsApiUrl }.
 *
 * `source` is either:
 *  - a descriptor: `{ owner, repo, ref, books?, dcsApiUrl? }`  (has `ref`; the
 *    deprecated `dcs_api_url` is still read)
 *  - a catalog entry: `{ owner, name, branch_or_tag_name, url, ... }`
 */
function resolveDescriptor(source, options) {
  let dcsApiUrl = dcsApiUrlFrom(options);

  if (source.ref) {
    return {
      owner: source.owner,
      repo: source.repo,
      ref: source.ref,
      books: source.books || options.books || [],
      // The options win over the descriptor; either may use the old spelling.
      dcsApiUrl: dcsApiUrlFrom(options, source),
    };
  }

  // Catalog entry: derive the DCS API base from its `url` when present.
  if (source.url) {
    const parts = source.url.split('/');
    if (parts.length >= 5) {
      dcsApiUrl = `${parts[0]}//${parts[2]}/${parts[3]}/${parts[4]}`;
    }
  }
  if (options.dcsApiUrl || options.dcs_api_url) dcsApiUrl = dcsApiUrlFrom(options);

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
 * @param {Object} source - `{ owner, repo, ref, books? }` | `{ lang, subject, books?, owner?, stage?, ref? }`
 *   (the preferred publisher is found first, see findResources.js; its current
 *   release is used unless `ref` names one) | a catalog entry | a CatalogSet (returned as-is)
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

  // CatalogSet passthrough — already resolved upstream.
  if (Array.isArray(source.catalogEntries)) {
    return source;
  }

  // Language + subject: find the publisher and release first (stage 0). The
  // blueprint fetched while choosing is the CatalogSet, so nothing is fetched twice.
  if (source.lang && source.subject && !source.repo && !source.name) {
    const books = source.books || options.books || [];
    // A ref the caller named wins over the found release, and each candidate
    // is judged by its blueprint at that ref, not by its current release.
    const resolved = await resolveResource(
      {
        lang: source.lang,
        subject: source.subject,
        books,
        owner: source.owner,
        stage: source.stage,
        ref: source.ref,
      },
      {
        ...options,
        dcsApiUrl: dcsApiUrlFrom(options, source),
      }
    );
    // The version is the ref that was resolved, not whatever row the blueprint lists first.
    return {
      resourceVersion: resolved.ref,
      libraryVersion,
      catalogEntries: resolved.catalogEntries,
      source: {
        owner: resolved.owner,
        repo: resolved.repo,
        ref: resolved.ref,
        books,
        dcsApiUrl: dcsApiUrlFrom(options, source),
        lang: source.lang,
        subject: source.subject,
      },
    };
  }

  const { owner, repo, ref, books, dcsApiUrl } = resolveDescriptor(source, options);
  if (!owner || !repo || !ref) {
    throw new Error('Owner, repo, and ref are required.');
  }

  const bpUrl = `${dcsApiUrl}/catalog/bp/${owner}/${repo}/${ref}`;
  loggerFor(options).info(bpUrl);

  try {
    const response = await axios.get(bpUrl, { timeout: REQUEST_TIMEOUT_MS });

    if (!response.data || !response.data.data) {
      throw new ResourceError('Invalid response from /catalog/bp endpoint', {
        code: 'HTTP',
        url: bpUrl,
      });
    }

    let catalogEntries = response.data.data;
    if (!Array.isArray(catalogEntries) || catalogEntries.length === 0) {
      throw new ResourceError('No catalog entries returned from /catalog/bp endpoint', {
        code: 'NOT_FOUND',
        url: bpUrl,
      });
    }

    // Downstream treats the first entry as the resource to render. DCS lists
    // the queried repo first; should a blueprint ever not, put it there.
    const mainIndex = catalogEntries.findIndex(
      (e) =>
        e?.owner === owner &&
        e?.name === repo &&
        (!e.branch_or_tag_name || e.branch_or_tag_name === ref)
    );
    if (mainIndex > 0) {
      catalogEntries = [
        catalogEntries[mainIndex],
        ...catalogEntries.filter((_, i) => i !== mainIndex),
      ];
    }
    const main = catalogEntries[0] || {};
    const resourceVersion =
      mainIndex === -1 ? ref : main.branch_or_tag_name || main.release?.tag_name || ref;

    return {
      resourceVersion,
      libraryVersion,
      catalogEntries,
      source: { owner, repo, ref, books, dcsApiUrl },
    };
  } catch (error) {
    if (error instanceof ResourceError) throw error;
    if (error.response) {
      throw new ResourceError(
        `Failed to fetch catalog entries: ${error.response.status} ${error.response.statusText}`,
        { status: error.response.status, url: bpUrl, cause: error }
      );
    }
    throw ResourceError.fromRequest('Failed to fetch catalog entries', error, bpUrl);
  }
}
