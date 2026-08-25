import { getVerseTextsFromUsfm } from './bibleHelpers.js';
import { trimQuoteToTermWords, recalculateOccurrence } from './twQuoteTrim.js';

/**
 * Narrow each Translation Words Link's GL quotes to the word that names its
 * article, once the resource and its extras are all resolved.
 *
 * A TWL row's GL quote is reconstructed from the Bible alignment, so it is often
 * wider than the term itself — Matthew 5:27's ULT quote for the "adultery"
 * article is "Do & commit adultery". Trimming needs the TW article's header, and
 * renumbering the occurrence needs the GL verse text, so this runs here rather
 * than in normalizeTsvColumns: neither is available until the extras are in.
 *
 * Each GLQuotes entry keeps what it started with, so nothing is lost:
 *   { Quote, Occurrence, FullGLQuote, FullGLOccurrence }
 * where Quote/Occurrence are the trimmed values and the Full* pair is what the
 * alignment produced.
 */

const TWL_SUBJECTS = new Set(['TSV Translation Words Links', 'TSV OBS Translation Words Links']);
const GL_BIBLE_SUBJECTS = new Set(['Aligned Bible', 'Bible']);

/** Normalize a TWLink to the "category/slug" key TW articles are stored under. */
function twArticleKey(link) {
  if (!link) return '';
  return String(link)
    .replace(/^rc:\/\/[^/]+\/tw\/dict\//, '')
    .replace(/^rc:\/\/[^/]+\/tw\//, '')
    .replace(/^bible\//, '')
    .replace(/\.md$/, '');
}

/** The TW article's first-line header (its list of term forms), or ''. */
function twHeaderFor(twResource, link) {
  const [category, slug] = twArticleKey(link).split('/');
  const article = twResource?.articles?.[category]?.[slug];
  return article && typeof article === 'object' && article.title ? article.title : '';
}

/**
 * Verse text per aligned Bible, keyed by the extras identifier (e.g. 'ult'),
 * parsed once per book rather than per row.
 */
function buildVerseTexts(extras) {
  const byBible = {};
  for (const [identifier, resource] of Object.entries(extras || {})) {
    if (resource?.type !== 'usfm' || !resource.books) continue;
    if (!GL_BIBLE_SUBJECTS.has(resource.subject)) continue;
    const books = {};
    for (const [bookId, usfmContent] of Object.entries(resource.books)) {
      books[bookId] = getVerseTextsFromUsfm(usfmContent);
    }
    byBible[identifier] = books;
  }
  return byBible;
}

/**
 * GLQuotes is keyed by Bible repo ("en_ult"); the extras are keyed by the short
 * identifier ("ult"). Match on the repo's final underscore-segment, as the
 * renderers do.
 */
function verseTextsForRepo(verseTexts, repo) {
  if (verseTexts[repo]) return verseTexts[repo];
  const suffix = repo.split('_').pop().toLowerCase();
  const key = Object.keys(verseTexts).find((id) => id.toLowerCase() === suffix);
  return key ? verseTexts[key] : null;
}

/**
 * Plain text for a row's reference. TWL references are always a single verse in
 * practice, but a range is joined in order so the occurrence still counts across
 * everything the row covers.
 */
function verseTextForReference(bookVerses, reference) {
  if (!bookVerses || !reference) return '';
  const [chapterPart, versePart = ''] = String(reference).split(':');
  const chapter = bookVerses[chapterPart.trim()];
  if (!chapter) return '';
  const [from, to] = versePart.split('-').map((v) => parseInt(v, 10));
  if (!Number.isFinite(from)) return '';
  const last = Number.isFinite(to) ? to : from;
  const parts = [];
  for (let v = from; v <= last; v++) {
    if (chapter[String(v)]) parts.push(chapter[String(v)]);
  }
  return parts.join(' ');
}

/** Every row of a TSV resource, flattened. */
function* eachRow(tsvResource) {
  for (const [bookId, book] of Object.entries(tsvResource?.books || {})) {
    for (const chapter of Object.values(book?.chapters || {})) {
      for (const rows of Object.values(chapter?.verses || {})) {
        for (const row of rows || []) yield { bookId, row };
      }
    }
  }
}

/**
 * Trim the GL quotes of every TWL row in `resourceData` and its extras, in place.
 *
 * @param {Object} resourceData - A fully-resolved ResourceData (extras populated)
 * @param {Object} [options]
 * @param {string} [options.lang='en'] - Gateway Language code, selects inflection rules
 * @returns {Object} The same resourceData
 */
export function applyTwlQuoteTrimming(resourceData, options = {}) {
  const { lang = 'en' } = options;
  const extras = resourceData?.extras || {};
  const twResource = extras.tw;
  if (!twResource?.articles) return resourceData;

  // TWL rows are either this resource (a TWL rendered on its own) or its twl extra.
  const twlResources = [resourceData, ...Object.values(extras)].filter((r) =>
    TWL_SUBJECTS.has(r?.subject)
  );
  if (twlResources.length === 0) return resourceData;

  const verseTexts = buildVerseTexts(extras);

  for (const twlResource of twlResources) {
    for (const { bookId, row } of eachRow(twlResource)) {
      const header = twHeaderFor(twResource, row.TWLink || row.SupportReference);
      if (!header || !row.GLQuotes) continue;

      for (const [repo, glQuote] of Object.entries(row.GLQuotes)) {
        if (!glQuote?.Quote || glQuote.FullGLQuote !== undefined) continue;

        const trim = trimQuoteToTermWords(glQuote.Quote, header, { lang });
        if (!trim.trimmed) continue;

        const verseText = verseTextForReference(
          verseTextsForRepo(verseTexts, repo)?.[bookId],
          row.Reference
        );

        glQuote.FullGLQuote = glQuote.Quote;
        glQuote.FullGLOccurrence = glQuote.Occurrence;
        glQuote.Quote = trim.quote;
        glQuote.Occurrence = recalculateOccurrence(
          verseText,
          trim,
          glQuote.FullGLQuote,
          glQuote.FullGLOccurrence
        );
      }
    }
  }

  return resourceData;
}
