import { BibleBookData, requiredSubjectsMap } from './constants.js';

/**
 * Pure helpers that decide which entries of a book-package blueprint a render
 * actually uses. getResourceData() applies them before fetching extras, and a
 * caller that needs the same set (door43-preview-app derives its cache identity
 * from it) can apply them to a CatalogSet without re-implementing the rules.
 */

/**
 * Testament of a book id: 'old', 'new', or undefined for an unknown id.
 * @param {string} bookId
 * @returns {'old'|'new'|undefined}
 */
export function testamentOf(bookId) {
  return BibleBookData[String(bookId || '').toLowerCase()]?.testament;
}

/**
 * Select at most 2 Aligned Bible entries from the blueprint results, in
 * preference order:
 *
 *  - the "literal" Bible (abbreviation ult or glt) first, then the
 *    "simplified" one (ust or gst);
 *  - a lone preferred Bible is paired with the first other entry, the literal
 *    one leading and the simplified one trailing;
 *  - with no preferred abbreviation at all, the first two in blueprint order.
 *
 * Entries that are not objects (a null hole in the list) are ignored.
 *
 * @param {Array} entries - Aligned Bible catalog entries from the blueprint
 * @returns {Array} At most 2 selected entries
 */
export function selectAlignedBibles(entries) {
  if (!Array.isArray(entries)) return [];
  const list = entries.filter((e) => e && typeof e === 'object');
  if (list.length <= 1) return list;

  const literal = list.find((e) => ['ult', 'glt'].includes(e.abbreviation));
  const simplified = list.find((e) => ['ust', 'gst'].includes(e.abbreviation));

  if (literal && simplified) return [literal, simplified];
  if (literal) return [literal, list.find((e) => e !== literal)];
  if (simplified) return [list.find((e) => e !== simplified), simplified];

  // No preferred abbreviations found — use first two
  return list.slice(0, 2);
}

/**
 * Filter a blueprint's catalog entries to the ones a render of the main entry
 * (`catalogEntries[0]`) needs, per requiredSubjectsMap:
 *
 *  - entries whose subject the main subject does not require are dropped,
 *    unless the caller asks for that subject too (`extraSubjects`, e.g.
 *    `['TSV Translation Questions']` for Translation Notes with questions);
 *  - of the Aligned Bibles, at most two are kept (see selectAlignedBibles);
 *  - when `books` is given, the original-language Bible of a testament none of
 *    the books belongs to is dropped (a New Testament render has no use for the
 *    Hebrew Old Testament, and vice versa); empty `books`, or any unknown id, keeps both.
 *
 * The result is `[main, ...selectedAlignedBibles, ...otherRequiredEntries]`:
 * the Aligned Bible pair in preference order (literal first, then simplified;
 * see selectAlignedBibles), the remaining required entries in blueprint order.
 * A main subject with no required subjects, and no `extraSubjects`, returns the
 * entries unchanged.
 *
 * @param {Array} catalogEntries - Blueprint entries, main entry first
 * @param {Object} [options]
 * @param {string} [options.subject] - Main subject (default: `catalogEntries[0].subject`)
 * @param {Array<string>} [options.books] - Book ids the render covers
 * @param {Array<string>} [options.extraSubjects] - Subjects to keep beyond the
 *   main subject's required ones
 * @returns {Array}
 */
export function filterCatalogEntries(catalogEntries, { subject, books, extraSubjects } = {}) {
  if (!Array.isArray(catalogEntries) || catalogEntries.length === 0) return [];

  const main = catalogEntries[0];
  const extras = Array.isArray(extraSubjects)
    ? extraSubjects.filter((s) => typeof s === 'string' && s)
    : [];
  const requiredSubjects = [...(requiredSubjectsMap[subject || main?.subject] || []), ...extras];
  if (requiredSubjects.length === 0) {
    return catalogEntries;
  }

  // Testaments the requested books span; an original-language Bible for a
  // testament outside this set is not needed. Any unknown id keeps both.
  const testaments = new Set();
  let unresolved = false;
  for (const bookId of Array.isArray(books) ? books : []) {
    const t = testamentOf(bookId);
    if (t) testaments.add(t);
    else unresolved = true;
  }
  const skipTestament = (entrySubject) => {
    if (unresolved || testaments.size === 0) return false;
    if (entrySubject === 'Hebrew Old Testament') return !testaments.has('old');
    if (entrySubject === 'Greek New Testament') return !testaments.has('new');
    return false;
  };

  const alignedBibleEntries = [];
  const otherEntries = [];
  for (let i = 1; i < catalogEntries.length; i++) {
    const entry = catalogEntries[i];
    if (!entry || !requiredSubjects.includes(entry.subject)) continue;
    if (skipTestament(entry.subject)) continue;
    if (entry.subject === 'Aligned Bible') {
      alignedBibleEntries.push(entry);
    } else {
      otherEntries.push(entry);
    }
  }

  const selectedBibles = requiredSubjects.includes('Aligned Bible')
    ? selectAlignedBibles(alignedBibleEntries)
    : [];

  return [main, ...selectedBibles, ...otherEntries];
}
