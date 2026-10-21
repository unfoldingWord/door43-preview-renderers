import axios from 'axios';

/**
 * Request-level fetch cache.
 *
 * One render asks for the same DCS file from several places: the aligned
 * Bible USFM is needed for GL-quote conversion and again for display, a
 * resource's license is wanted by the main resource and by every extra. The
 * cache dedupes those by URL: an in-flight request is shared, and a resolved
 * value is reused until its TTL runs out. The TTL is short on purpose so a
 * branch that moved is picked up by the next render; it is not a persistent
 * cache (that is the caller's job).
 */
let fetchCacheTtlMs = 60 * 1000;
const fetchCache = new Map(); // url -> { promise, expires }

/**
 * Set how long a fetched response is reused, in milliseconds (default 60 s).
 * `0` disables reuse between calls (in-flight requests are still shared).
 */
export function setFetchCacheTtl(ms) {
  fetchCacheTtlMs = Math.max(0, Number(ms) || 0);
}

/** Drop every cached response (tests, or after a known upstream change). */
export function clearFetchCache() {
  fetchCache.clear();
}

/** Number of entries currently held (for tests). */
export function fetchCacheSize() {
  return fetchCache.size;
}

/**
 * Run `start(forget)` once per key per TTL window. A pending entry never
 * expires, so in-flight work is shared even at TTL 0; the TTL counts from when
 * it settles. A rejection is evicted so the next caller retries, and `start`
 * may call `forget()` to keep a resolved value out of the cache. Expired
 * entries are swept on every miss so a key nobody asks for again is released.
 */
function remember(key, start) {
  const now = Date.now();
  const hit = fetchCache.get(key);
  if (hit && hit.expires > now) {
    return hit.promise;
  }
  for (const [k, e] of fetchCache) {
    if (e.expires <= now) fetchCache.delete(k);
  }
  const entry = { promise: null, expires: Infinity };
  const forget = () => {
    if (fetchCache.get(key) === entry) fetchCache.delete(key);
  };
  entry.promise = new Promise((resolve) => resolve(start(forget))).then(
    (value) => {
      entry.expires = Date.now() + fetchCacheTtlMs;
      if (fetchCacheTtlMs === 0) forget();
      return value;
    },
    (error) => {
      forget();
      throw error;
    }
  );
  fetchCache.set(key, entry);
  return entry.promise;
}

/** GET a URL once per TTL window; failures are not cached. */
function cachedGet(url) {
  return remember(url, () => axios.get(url).then((response) => response.data));
}

/**
 * Fetch and decode base64 file content from DCS
 */
export async function fetchContent(owner, repo, ref, filePath, dcs_api_url) {
  const url = `${dcs_api_url}/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;
  const data = await cachedGet(url);
  const base64Content = data.content;

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
 * exists (trimmed). Returns an empty string if none are found. The outcome is
 * cached per repo/ref for the TTL, so the main resource and its extras share
 * one lookup. "No license" is cached only when every candidate was a 404; an
 * empty result caused by a 5xx or network error is not, so the next call retries.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git reference
 * @param {string} dcs_api_url - DCS API base URL
 * @returns {Promise<string>} License content, or '' if not found
 */
export async function fetchLicense(owner, repo, ref, dcs_api_url) {
  const key = `license:${dcs_api_url}/repos/${owner}/${repo}?ref=${ref}`;
  return remember(key, async (forget) => {
    const licensePaths = ['LICENSE.md', 'LICENSE', 'LICENSE.txt'];
    let transient = false;
    for (const licensePath of licensePaths) {
      try {
        const license = await fetchContent(owner, repo, ref, licensePath, dcs_api_url);
        if (license) {
          return license.trim();
        }
      } catch (e) {
        // A 404 confirms absence; anything else may heal. Try the next path.
        if (e?.response?.status !== 404) transient = true;
      }
    }
    if (transient) forget();
    return '';
  });
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
