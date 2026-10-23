import axios from 'axios';
import { ResourceError } from './errors.js';

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

/**
 * Time limit for a DCS API request. A request is shared while in flight, so
 * without one a stalled request would hold every caller of that URL until the
 * socket died; with it, the request fails, is forgotten, and the next caller
 * retries.
 */
export const REQUEST_TIMEOUT_MS = 30000;

/**
 * GET a file's raw text (a burrito ingredient from `/sb/raw/`) once per TTL
 * window. A body that is not a string is not cached.
 */
export async function fetchText(url) {
  return remember(url, (forget) =>
    axios
      .get(url, {
        timeout: REQUEST_TIMEOUT_MS,
        responseType: 'text',
        transformResponse: [(data) => data], // keep JSON files as text
      })
      .then((response) => {
        const body = response?.data;
        if (typeof body !== 'string') {
          forget();
          throw new ResourceError(`Unexpected response from ${url}`, { code: 'HTTP', url });
        }
        return body;
      })
  );
}

/**
 * GET a JSON endpoint (catalog search, blueprint, repo metadata) once per TTL
 * window; the parsed body is returned. A non-object body is not cached.
 */
export async function fetchJson(url) {
  return remember(url, (forget) =>
    axios.get(url, { timeout: REQUEST_TIMEOUT_MS }).then((response) => {
      const body = response?.data;
      if (body === null || typeof body !== 'object') {
        forget();
        throw new ResourceError(`Unexpected response from ${url}`, { code: 'HTTP', url });
      }
      return body;
    })
  );
}
