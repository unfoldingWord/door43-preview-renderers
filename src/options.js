import { loggerFor } from './logger.js';

/** The DCS API the library talks to unless told otherwise. */
export const DEFAULT_DCS_API_URL = 'https://git.door43.org/api/v1';

// Each deprecation is reported once per process, not on every call.
const reported = new Set();
function deprecated(key, message, options) {
  if (reported.has(key)) return;
  reported.add(key);
  loggerFor(options).warn(message);
}

/**
 * The DCS API base URL from options (or a source object): `dcsApiUrl`, else the
 * deprecated `dcs_api_url` (1.x still accepts it, with one warning), else the
 * default. The library passes `dcsApiUrl` along internally, so only a caller's
 * own `dcs_api_url` is reported.
 *
 * @param {Object} [options]
 * @returns {string}
 */
export function dcsApiUrlOf(options = {}) {
  if (options?.dcsApiUrl) return options.dcsApiUrl;
  if (options?.dcs_api_url) {
    deprecated(
      'dcs_api_url',
      'door43-preview-renderers: the option `dcs_api_url` is deprecated; pass `dcsApiUrl` (`dcs_api_url` will be removed in 2.0).',
      options
    );
    return options.dcs_api_url;
  }
  return DEFAULT_DCS_API_URL;
}

/**
 * The DCS API base URL from the first of `sources` (options first, then e.g. a
 * descriptor) that names one, in either spelling; else the default.
 *
 * @param {...Object} sources
 * @returns {string}
 */
export function dcsApiUrlFrom(...sources) {
  const named = sources.find((o) => o?.dcsApiUrl || o?.dcs_api_url);
  return named ? dcsApiUrlOf(named) : DEFAULT_DCS_API_URL;
}

// getResourceData's plumbing between itself and its extras. 1.x still honors
// them on `options` (with one warning); they belong in the private third
// argument, and 2.0 will ignore them on `options`.
const INTERNAL_KEYS = ['isExtra', 'catalogEntry', 'preEntries', 'glBibleEntries', 'contentSource'];

/**
 * Split getResourceData's arguments into the public options and the internal
 * context. Internal keys found on `options` (1.x callers) are moved to the
 * context with one deprecation warning; the private `internal` argument wins.
 *
 * @param {Object} [options]
 * @param {Object} [internal]
 * @returns {{ options: Object, context: Object }}
 */
export function splitInternalOptions(options = {}, internal = {}) {
  const publicOptions = { ...options };
  const legacy = {};
  for (const key of INTERNAL_KEYS) {
    if (key in publicOptions) {
      legacy[key] = publicOptions[key];
      delete publicOptions[key];
    }
  }
  if (Object.keys(legacy).length) {
    deprecated(
      'internal-options',
      `door43-preview-renderers: getResourceData options ${Object.keys(legacy)
        .map((k) => `\`${k}\``)
        .join(', ')} are internal and deprecated on \`options\`; they will be ignored in 2.0.`,
      options
    );
  }
  return { options: publicOptions, context: { ...publicOptions, ...legacy, ...internal } };
}
