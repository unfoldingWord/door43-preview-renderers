import { BibleBookData } from './constants.js';

/**
 * Reading a Scripture Burrito's metadata.json.
 *
 * DCS serves every resource as a burrito: rc, ts and tc repositories are
 * converted on the fly (`/sb/raw/{path}`, `/sb/{ref}.zip`), so the extractors
 * read one layout. A burrito's files are its ingredients, keyed by their path
 * inside it (`ingredients/TIT.tsv`, `ingredients/payload/kt/god.md`); a book's
 * file is the ingredient whose `scope` names the book. These helpers are pure:
 * they take the parsed metadata.json (or a loaded archive) and read nothing.
 */

/** The burrito's language tag (`languages[0].tag`), e.g. `en`; '' when absent. */
export function burritoLanguage(metadata) {
  return metadata?.languages?.[0]?.tag || '';
}

/**
 * The commit a DCS burrito was converted from, for pinning later reads to it:
 * the `dcs` primary identifier for `owner/repo`, else the only one listed.
 * Undefined for a burrito without one (a repository already in SB format).
 */
export function burritoRevision(metadata, owner, repo) {
  const dcs = metadata?.identification?.primary?.dcs;
  if (!dcs || typeof dcs !== 'object') return undefined;
  const exact = dcs[`${owner}/${repo}`];
  if (exact?.revision) return exact.revision;
  const ids = Object.values(dcs);
  return ids.length === 1 ? ids[0]?.revision : undefined;
}

/**
 * The path of the ingredient holding a book, or undefined.
 *
 * The ingredient whose `scope` names the book (`TIT`), with the extension asked
 * for (`.usfm`, `.tsv`); a burrito that leaves out `scope` is matched by file
 * name (`ingredients/TIT.tsv`). Open Bible Stories TSVs are one `OBS.tsv`, so
 * `obs` also finds the burrito's only file with that extension.
 *
 * @param {Object} metadata - Parsed metadata.json
 * @param {string} bookId - Book id, any case (`tit`, `obs`)
 * @param {string} ext - File extension, with its dot
 * @returns {string|undefined}
 */
export function bookIngredientPath(metadata, bookId, ext) {
  const ingredients = metadata?.ingredients || {};
  const code = String(bookId || '').toUpperCase();
  const paths = Object.keys(ingredients).filter((path) => path.toLowerCase().endsWith(ext));
  const scoped = paths.find((path) => ingredients[path]?.scope?.[code]);
  if (scoped) return scoped;
  const named = paths.find(
    (path) => path.split('/').pop().toUpperCase() === `${code}${ext.toUpperCase()}`
  );
  if (named) return named;
  return code === 'OBS' && paths.length === 1 ? paths[0] : undefined;
}

/** The book ids a burrito holds files for, with that extension, in canon order. */
export function burritoBooks(metadata, ext) {
  const ingredients = metadata?.ingredients || {};
  const ids = new Set();
  for (const [path, ingredient] of Object.entries(ingredients)) {
    if (!path.toLowerCase().endsWith(ext)) continue;
    for (const code of Object.keys(ingredient?.scope || {})) ids.add(code.toLowerCase());
  }
  const canon = Object.keys(BibleBookData);
  return [...ids].sort((a, b) => {
    const ia = canon.indexOf(a);
    const ib = canon.indexOf(b);
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib) || a.localeCompare(b);
  });
}

/**
 * A book's title in the burrito's language (`localizedNames['book-tit'].short`),
 * else the library's English title, else ''.
 */
export function bookTitle(metadata, bookId) {
  const short = metadata?.localizedNames?.[`book-${String(bookId).toLowerCase()}`]?.short;
  const lang = burritoLanguage(metadata);
  return short?.[lang] || (short && Object.values(short)[0]) || BibleBookData[bookId]?.title || '';
}

/** A book's canonical sort number (`57` for Titus, from its USFM number), else 0. */
export function bookSort(bookId) {
  return parseInt(BibleBookData[String(bookId).toLowerCase()]?.usfm, 10) || 0;
}

/** The burrito's name in its language (`identification.name`), else ''. */
export function burritoName(metadata) {
  const name = metadata?.identification?.name;
  if (!name || typeof name !== 'object') return '';
  return name[burritoLanguage(metadata)] || Object.values(name)[0] || '';
}

/** The path of the burrito's license ingredient (`ingredients/LICENSE.md`), or undefined. */
export function licenseIngredientPath(metadata) {
  return Object.keys(metadata?.ingredients || {}).find((path) =>
    /(^|\/)license(\.md|\.txt)?$/i.test(path)
  );
}

/**
 * The folder an archive keeps the burrito in, with its trailing slash
 * (`en_tn/`): the one holding metadata.json. '' when it sits at the root.
 *
 * @param {{files: Object}} zip - A loaded archive (JSZip, or the same shape)
 * @returns {string|undefined} Undefined when the archive has no metadata.json
 */
export function archiveRoot(zip) {
  const name = Object.keys(zip?.files || {}).find((n) => /^([^/]+\/)?metadata\.json$/.test(n));
  return name === undefined ? undefined : name.slice(0, -'metadata.json'.length);
}

/**
 * The parsed metadata.json of a loaded burrito archive.
 *
 * @param {{files: Object, file: Function}} zip
 * @returns {Promise<Object>}
 */
export async function readArchiveMetadata(zip) {
  const root = archiveRoot(zip);
  if (root === undefined) throw new Error('The archive has no metadata.json.');
  return JSON.parse(await zip.file(`${root}metadata.json`).async('string'));
}

/** The license of a loaded burrito archive, trimmed; '' when it has none. */
export async function readArchiveLicense(zip, metadata) {
  const path = licenseIngredientPath(metadata);
  const file = path && zip.file(`${archiveRoot(zip)}${path}`);
  return file ? (await file.async('string')).trim() : '';
}
