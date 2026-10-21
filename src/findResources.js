import { fetchJson } from './dcsApi.js';
import { requiredSubjectsMap } from './constants.js';
import { filterCatalogEntries, testamentOf } from './catalogSelection.js';

/**
 * Stage 0 of the pipeline: from a language to an `{ owner, repo, ref }`.
 *
 * The rest of the pipeline starts from a descriptor a caller already knows.
 * These helpers find it: which owners publish a subject for a language, which
 * of them to prefer, and which ref is the current release. All calls are
 * read-only DCS catalog lookups through the request cache in dcsApi.js.
 */

const DEFAULT_API = 'https://git.door43.org/api/v1';
const PAGE_SIZE = 100;
/** A search that never returns a short page is a broken endpoint, not a big catalog. */
const MAX_PAGES = 50;

function apiBase(options = {}) {
  return (options.dcs_api_url || DEFAULT_API).replace(/\/+$/, '');
}

function enc(value) {
  return encodeURIComponent(String(value));
}

/** A release tag is a version number (`v91`, `3.0.0`), not a branch or a commit. */
function isReleaseTag(ref) {
  return /^v?\d+(\.\d+)*$/.test(String(ref));
}

/** Only a definite "not there" (HTTP 404) may fall through; anything else is an outage and aborts. */
function isNotFound(err) {
  return err?.response?.status === 404;
}

/**
 * All published catalog entries for a language, optionally narrowed by
 * subject and owner. Pages through `/catalog/search` until a short page.
 *
 * @param {Object} query
 * @param {string} query.lang - Language code (e.g. `es-419`)
 * @param {string} [query.subject] - Catalog subject (e.g. `TSV Translation Notes`)
 * @param {string} [query.owner] - Owner (user or organisation) to restrict to
 * @param {string} [query.stage='prod'] - Catalog stage: `prod`, `preprod`, `latest`, `branch`
 * @param {Object} [options]
 * @param {string} [options.dcs_api_url] - DCS API base URL
 * @returns {Promise<Array<Object>>} Catalog entries as DCS returns them
 */
export async function findResources({ lang, subject, owner, stage = 'prod' } = {}, options = {}) {
  if (!lang) throw new Error('findResources: lang is required.');
  const api = apiBase(options);
  const params = [`lang=${enc(lang)}`, `stage=${enc(stage)}`, `limit=${PAGE_SIZE}`];
  if (subject) params.push(`subject=${enc(subject)}`);
  if (owner) params.push(`owner=${enc(owner)}`);

  const entries = [];
  for (let page = 1; ; page++) {
    if (page > MAX_PAGES) {
      throw new Error(
        `findResources: ${api}/catalog/search kept returning full pages after ${MAX_PAGES} pages.`
      );
    }
    const url = `${api}/catalog/search?${params.join('&')}&page=${page}`;
    const body = await fetchJson(url);
    const data = Array.isArray(body?.data) ? body.data : [];
    entries.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return entries;
}

/**
 * The ref to render for a repo: a given ref as-is, else the latest published
 * release tag, else the default branch.
 *
 * @param {Object} target
 * @param {string} target.owner
 * @param {string} target.repo
 * @param {string} [target.ref=''] - Empty means "latest release"
 * @param {Object} [options]
 * @returns {Promise<{ref: string, isRelease: boolean}>}
 */
export async function resolveRef({ owner, repo, ref = '' } = {}, options = {}) {
  if (!owner || !repo) throw new Error('resolveRef: owner and repo are required.');
  const api = apiBase(options);
  if (ref) {
    return { ref, isRelease: isReleaseTag(ref) };
  }
  try {
    const release = await fetchJson(`${api}/repos/${enc(owner)}/${enc(repo)}/releases/latest`);
    if (release?.tag_name) return { ref: release.tag_name, isRelease: true };
  } catch (err) {
    // No published release (404): fall through to the branch. An outage aborts.
    if (!isNotFound(err)) throw err;
  }
  try {
    const info = await fetchJson(`${api}/repos/${enc(owner)}/${enc(repo)}`);
    if (info?.default_branch) return { ref: info.default_branch, isRelease: false };
  } catch (err) {
    // No repo metadata (404): assume the conventional default. An outage aborts.
    if (!isNotFound(err)) throw err;
  }
  return { ref: 'master', isRelease: false };
}

/** Candidate order: a requested owner first, gateway languages next, newest release, then as returned. */
function rankCandidates(entries, owner) {
  const time = (e) => (e.released ? Date.parse(e.released) || 0 : 0);
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => {
      if (owner) {
        const ao = a.entry.owner === owner ? 0 : 1;
        const bo = b.entry.owner === owner ? 0 : 1;
        if (ao !== bo) return ao - bo;
      }
      const ag = a.entry.language_is_gl ? 0 : 1;
      const bg = b.entry.language_is_gl ? 0 : 1;
      if (ag !== bg) return ag - bg;
      const dt = time(b.entry) - time(a.entry);
      if (dt !== 0) return dt;
      return a.i - b.i;
    })
    .map((x) => x.entry);
}

/**
 * Requested books the resource does not carry, judged by the ingredients the
 * blueprint (or, failing that, the search) lists for it. No ingredient list
 * at all means the catalog did not say, so nothing is ruled out.
 */
function booksMissingFrom(blueprintMain, searchEntry, books) {
  if (!books || !books.length) return [];
  const ingredients = Array.isArray(blueprintMain?.ingredients)
    ? blueprintMain.ingredients
    : Array.isArray(searchEntry?.ingredients)
      ? searchEntry.ingredients
      : null;
  if (!ingredients) return [];
  const have = new Set(ingredients.map((i) => String(i?.identifier || '').toLowerCase()));
  return books.filter((b) => !have.has(String(b).toLowerCase()));
}

/** The required subjects a blueprint must supply for `subject`, given the books asked for. */
function requiredSubjectsFor(subject, books) {
  const required = requiredSubjectsMap[subject] || [];
  const testaments = new Set((books || []).map(testamentOf).filter(Boolean));
  const unknown = (books || []).some((b) => !testamentOf(b));
  return required.filter((s) => {
    if (!testaments.size || unknown) return true;
    if (s === 'Hebrew Old Testament') return testaments.has('old');
    if (s === 'Greek New Testament') return testaments.has('new');
    return true;
  });
}

/**
 * The best book-package entry point for a language and subject.
 *
 * Candidates come from `findResources`. They are tried in order of: the
 * requested owner, gateway-language publishers, newest release. The first
 * whose blueprint (`/catalog/bp/`) supplies every subject the main subject
 * needs for the requested books wins.
 *
 * @param {Object} query
 * @param {string} query.lang
 * @param {string} query.subject
 * @param {Array<string>} [query.books] - Books to be rendered (decides which original-language Bible is needed)
 * @param {string} [query.owner] - Preferred owner
 * @param {string} [query.stage='prod']
 * @param {Object} [options]
 * @returns {Promise<{owner: string, repo: string, ref: string, entry: Object, catalogEntries: Array}>}
 */
export async function resolveResource(
  { lang, subject, books = [], owner, stage = 'prod' } = {},
  options = {}
) {
  if (!lang || !subject) throw new Error('resolveResource: lang and subject are required.');
  const api = apiBase(options);
  const candidates = rankCandidates(await findResources({ lang, subject, stage }, options), owner);
  if (!candidates.length) {
    throw new Error(`No ${subject} published for language "${lang}" (stage ${stage}).`);
  }

  const required = requiredSubjectsFor(subject, books);
  // A book-scoped blueprint only lists that book's dependencies, so scope it
  // only for a single book; several books are checked against the full package.
  const bookParam = books.length === 1 ? `?book=${enc(books[0])}` : '';
  let lastReason = '';
  for (const entry of candidates) {
    const ref = entry.branch_or_tag_name;
    const url = `${api}/catalog/bp/${enc(entry.owner)}/${enc(entry.name)}/${enc(ref)}${bookParam}`;
    let catalogEntries;
    try {
      const body = await fetchJson(url);
      catalogEntries = Array.isArray(body?.data) ? body.data : [];
    } catch (e) {
      // Only a missing blueprint moves on to the next publisher; an outage aborts.
      if (!isNotFound(e)) throw e;
      lastReason = `${entry.full_name || `${entry.owner}/${entry.name}`}@${ref}: ${e.message}`;
      continue;
    }
    if (!catalogEntries.length) {
      lastReason = `${entry.owner}/${entry.name}@${ref}: empty blueprint`;
      continue;
    }
    // Downstream treats the first entry as the resource to render, whatever
    // order the blueprint listed its rows in.
    const mainIndex = catalogEntries.findIndex(
      (e) => e?.owner === entry.owner && e?.name === entry.name && e?.branch_or_tag_name === ref
    );
    if (mainIndex === -1) {
      lastReason = `${entry.owner}/${entry.name}@${ref}: blueprint does not list the resource itself`;
      continue;
    }
    if (mainIndex > 0) {
      catalogEntries = [catalogEntries[mainIndex], ...catalogEntries.filter((_, i) => i !== mainIndex)];
    }
    // The package must hold every book asked for, or the render comes back short.
    const missingBooks = booksMissingFrom(catalogEntries[0], entry, books);
    if (missingBooks.length) {
      lastReason = `${entry.owner}/${entry.name}@${ref}: lacks book${missingBooks.length > 1 ? 's' : ''} ${missingBooks.join(', ')}`;
      continue;
    }
    const filtered = filterCatalogEntries(catalogEntries, { subject, books });
    const present = new Set(filtered.map((e) => e?.subject));
    const missing = required.filter((s) => !present.has(s));
    if (missing.length) {
      lastReason = `${entry.owner}/${entry.name}@${ref}: blueprint lacks ${missing.join(', ')}`;
      continue;
    }
    return { owner: entry.owner, repo: entry.name, ref, entry, catalogEntries };
  }
  throw new Error(
    `No complete book package for ${subject} in "${lang}"` + (lastReason ? ` (last tried ${lastReason})` : '.')
  );
}

/**
 * Turn what a caller gave into `{ owner, repo, ref }`: a language and subject
 * name the publisher (keeping a ref the caller gave, else the found release);
 * an owner and repo without a ref take the latest release.
 *
 * @param {Object} target - `{ owner?, repo?, ref?, lang?, subject?, books?, stage? }`
 * @param {Object} [options]
 * @returns {Promise<{owner: string, repo: string, ref: string, resolved?: Object}>}
 */
export async function resolveTarget(
  { owner, repo, ref = '', lang, subject, books = [], stage } = {},
  options = {}
) {
  if (lang && subject) {
    const found = await resolveResource({ lang, subject, books, owner, stage }, options);
    // A ref the caller named wins; the found package belongs to the found ref,
    // so it is not carried over to a different one.
    return ref
      ? { owner: found.owner, repo: found.repo, ref }
      : { owner: found.owner, repo: found.repo, ref: found.ref, resolved: found };
  }
  if (!owner || !repo) throw new Error('resolveTarget: owner and repo, or lang and subject, are required.');
  if (ref) return { owner, repo, ref };
  const latest = await resolveRef({ owner, repo }, options);
  return { owner, repo, ref: latest.ref };
}

/**
 * Languages with published content, as the catalog lists them.
 *
 * @param {Object} [query]
 * @param {string} [query.stage='prod']
 * @param {Object} [options]
 * @returns {Promise<Array<{code: string, name: string, native: string, direction: string, gateway: boolean}>>}
 */
export async function listLanguages({ stage = 'prod' } = {}, options = {}) {
  const api = apiBase(options);
  const body = await fetchJson(`${api}/catalog/list/languages?stage=${enc(stage)}`);
  const data = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  return data
    .filter((l) => l && l.lc)
    .map((l) => ({
      code: l.lc,
      name: l.ang || l.ln || l.lc,
      native: l.ln || l.ang || l.lc,
      direction: l.ld === 'rtl' ? 'rtl' : 'ltr',
      gateway: Boolean(l.gw),
    }));
}
