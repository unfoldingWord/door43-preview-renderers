/** The DCS API the library talks to unless told otherwise. */
export const DEFAULT_DCS_API_URL = 'https://git.door43.org/api/v1';

/**
 * The DCS API base URL from options (or a source object): `dcsApiUrl`, else the
 * default.
 *
 * Any string is the caller's URL, `''` included (it fails at the request); only
 * a missing or non-string value falls through to the default, so a blank
 * setting never silently reaches the public Door43 API.
 *
 * @param {Object} [options]
 * @returns {string}
 */
export function dcsApiUrlOf(options = {}) {
  return namesDcsApiUrl(options) ? options.dcsApiUrl : DEFAULT_DCS_API_URL;
}

/** Whether `o` names a DCS API URL (any string, `''` included). */
export const namesDcsApiUrl = (o) => typeof o?.dcsApiUrl === 'string';

/**
 * The DCS API base URL from the first of `sources` (options first, then e.g. a
 * descriptor) that names one; else the default.
 *
 * @param {...Object} sources
 * @returns {string}
 */
export function dcsApiUrlFrom(...sources) {
  return dcsApiUrlOf(sources.find(namesDcsApiUrl));
}

// getResourceData's plumbing between itself and its extras. It travels in the
// private third argument only; the same keys on `options` are ignored.
const INTERNAL_KEYS = ['isExtra', 'catalogEntry', 'preEntries', 'glBibleEntries', 'contentSource'];

/**
 * Split getResourceData's arguments into the public options and the internal
 * context (the options plus the private `internal` argument). Internal keys on
 * `options` are dropped, so a caller cannot reach the plumbing.
 *
 * @param {Object} [options]
 * @param {Object} [internal]
 * @returns {{ options: Object, context: Object }}
 */
export function splitInternalOptions(options = {}, internal = {}) {
  const publicOptions = { ...options };
  for (const key of INTERNAL_KEYS) delete publicOptions[key];
  return { options: publicOptions, context: { ...publicOptions, ...internal } };
}
