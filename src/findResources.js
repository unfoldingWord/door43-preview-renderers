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

/** Lower-cased ingredient identifiers of a catalog row, or null when it lists none. */
function ingredientIds(row) {
  return Array.isArray(row?.ingredients)
    ? row.ingredients.map((i) => String(i?.identifier || '').toLowerCase())
    : null;
}

/**
 * Requested books the resource does not carry, judged by the ingredients the
 * blueprint (or, failing that, the search) lists for it. No ingredient list
 * at all means the catalog did not say, so nothing is ruled out.
 */
function booksMissingFrom(blueprintMain, searchEntry, books) {
  if (!books || !books.length) return [];
  const ids = ingredientIds(blueprintMain) ?? ingredientIds(searchEntry);
  if (!ids) return [];
  const have = new Set(ids);
  return books.filter((b) => !have.has(String(b).toLowerCase()));
}

/** Dependency subjects whose content is per Bible book, whatever their ingredient list says. */
const BOOK_BASED_SUBJECTS = new Set([
  'Aligned Bible',
  'Bible',
  'Hebrew Old Testament',
  'Greek New Testament',
  'TSV Translation Words Links',
  'TSV Translation Notes',
  'TSV Translation Questions',
  'TSV Study Notes',
  'TSV Study Questions',
]);

/**
 * Requested books a dependency should carry and does not. A row is judged
 * when its subject is book-based or its ingredients are Bible books (not
 * Translation Academy or Translation Words); a row with no ingredient list
 * is not judged, but an empty one carries no books. Only books a testament
 * claims count, and an original-language Bible only for its own testament.
 */
function booksMissingFromDependency(row, books) {
  const ids = ingredientIds(row);
  if (!ids) return [];
  if (!BOOK_BASED_SUBJECTS.has(row?.subject) && !ids.some((id) => testamentOf(id))) return [];
  const have = new Set(ids);
  return books.filter((b) => {
    const t = testamentOf(b);
    if (!t) return false;
    if (row?.subject === 'Hebrew Old Testament' && t !== 'old') return false;
    if (row?.subject === 'Greek New Testament' && t !== 'new') return false;
    return !have.has(String(b).toLowerCase());
  });
}

/**
 * The books whose testaments decide which original-language Bibles are
 * needed: the ones asked for, or with none asked for, the Bible books the
 * resource itself lists. Empty when neither says.
 */
function booksForTestaments(books, blueprintMain, searchEntry) {
  if (books.length) return books;
  const ids = ingredientIds(blueprintMain) ?? ingredientIds(searchEntry) ?? [];
  return ids.filter((id) => testamentOf(id));
}

/**
 * The required subjects a blueprint must supply for `subject`: an
 * original-language Bible only for a testament the books are in. No books
 * means no testament is known, so neither is required; an id no testament
 * claims keeps both.
 */
function requiredSubjectsFor(subject, books) {
  const required = requiredSubjectsMap[subject] || [];
  const testaments = new Set(books.map(testamentOf).filter(Boolean));
  const unknown = books.some((b) => !testamentOf(b));
  return required.filter((s) => {
    if (unknown) return true;
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
 * needs for the requested books wins. With books asked for, the resource
 * and every book-based dependency must carry all of them (a dependency
 * that does not is left out of `catalogEntries`, as DCS does for one
 * book). With none asked for, the package is judged as a whole: the
 * original-language Bibles needed are those of the testaments its own
 * ingredients span, and dependencies are not checked book by book.
 *
 * With a `ref`, each candidate is judged by its blueprint at that ref, not at
 * its current release; a candidate without that ref (404) is skipped.
 *
 * @param {Object} query
 * @param {string} query.lang
 * @param {string} query.subject
 * @param {Array<string>} [query.books] - Books to be rendered (decides which original-language Bible is needed)
 * @param {string} [query.owner] - Preferred owner
 * @param {string} [query.stage='prod']
 * @param {string} [query.ref] - A ref to pin instead of each candidate's current release
 * @param {Object} [options]
 * @returns {Promise<{owner: string, repo: string, ref: string, entry: Object, catalogEntries: Array}>}
 */
export async function resolveResource(
  { lang, subject, books = [], owner, stage = 'prod', ref: pinnedRef = '' } = {},
  options = {}
) {
  if (!lang || !subject) throw new Error('resolveResource: lang and subject are required.');
  const api = apiBase(options);
  const candidates = rankCandidates(await findResources({ lang, subject, stage }, options), owner);
  if (!candidates.length) {
    throw new Error(`No ${subject} published for language "${lang}" (stage ${stage}).`);
  }

  // A book-scoped blueprint only lists that book's dependencies, so scope it
  // only for a single book; several books are checked against the full package.
  const bookParam = books.length === 1 ? `?book=${enc(books[0])}` : '';
  let lastReason = '';
  for (const entry of candidates) {
    const ref = pinnedRef || entry.branch_or_tag_name;
    // The search row describes the current release; for a pinned ref it says
    // nothing about that ref's books.
    const searchRow = pinnedRef ? null : entry;
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
    // A pinned ref may be a branch or commit the row names differently, and
    // this blueprint was fetched for that ref, so owner and name identify it.
    const mainIndex = catalogEntries.findIndex(
      (e) =>
        e?.owner === entry.owner &&
        e?.name === entry.name &&
        (pinnedRef || e?.branch_or_tag_name === ref)
    );
    if (mainIndex === -1) {
      lastReason = `${entry.owner}/${entry.name}@${ref}: blueprint does not list the resource itself`;
      continue;
    }
    if (mainIndex > 0) {
      catalogEntries = [
        catalogEntries[mainIndex],
        ...catalogEntries.filter((_, i) => i !== mainIndex),
      ];
    }
    // The package must hold every book asked for, or the render comes back short.
    const missingBooks = booksMissingFrom(catalogEntries[0], searchRow, books);
    if (missingBooks.length) {
      lastReason = `${entry.owner}/${entry.name}@${ref}: lacks book${missingBooks.length > 1 ? 's' : ''} ${missingBooks.join(', ')}`;
      continue;
    }
    // So must every book-based dependency the render draws on. A one-book
    // blueprint from DCS already leaves out the rows without that book; an
    // unscoped one does not, so drop them here, before the Bibles are chosen.
    const gaps = [];
    if (books.length) {
      catalogEntries = catalogEntries.filter((row, i) => {
        if (i === 0) return true;
        const lacking = booksMissingFromDependency(row, books);
        if (!lacking.length) return true;
        gaps.push({ subject: row?.subject, text: `${row?.name} lacks ${lacking.join(', ')}` });
        return false;
      });
    }
    const required = requiredSubjectsFor(
      subject,
      booksForTestaments(books, catalogEntries[0], searchRow)
    );
    const filtered = filterCatalogEntries(catalogEntries, { subject, books });
    const present = new Set(filtered.map((e) => e?.subject));
    const missing = required.filter((s) => !present.has(s));
    if (missing.length) {
      const why = gaps.filter((g) => missing.includes(g.subject)).map((g) => g.text);
      lastReason =
        `${entry.owner}/${entry.name}@${ref}: blueprint lacks ${missing.join(', ')}` +
        (why.length ? ` for ${books.join(', ')} (${why.join('; ')})` : '');
      continue;
    }
    return { owner: entry.owner, repo: entry.name, ref, entry, catalogEntries };
  }
  throw new Error(
    `No complete book package for ${subject} in "${lang}"` +
      (lastReason ? ` (last tried ${lastReason})` : '.')
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
    // A ref the caller named is the one each candidate is judged at, so the
    // found package belongs to it.
    const found = await resolveResource({ lang, subject, books, owner, stage, ref }, options);
    return { owner: found.owner, repo: found.repo, ref: found.ref, resolved: found };
  }
  if (!owner || !repo)
    throw new Error('resolveTarget: owner and repo, or lang and subject, are required.');
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
