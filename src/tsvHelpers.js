import { contentSourceFor, entryCoords } from './contentSource.js';
import { ResourceError } from './errors.js';
import { loggerFor } from './logger.js';
import { dcsApiUrlOf } from './options.js';
import { applyTwlQuoteTrimming } from './twlQuoteTrimming.js';
import { BibleBookData } from './constants.js';
import { indexUsfmBook } from './quotes/usfmBookIndex.js';
import { addGlQuotes } from './quotes/addGlQuotes.js';

/**
 * Parse TSV content into array of objects
 */
function parseTsv(tsvContent) {
  const lines = tsvContent.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split('\t');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Normalize TSV columns, converting GLQuote/GLOccurrence columns into a GLQuotes object.
 * @param {Array} rows - Parsed TSV rows
 * @param {string|null} singleBibleRepo - A published TSV may already carry GL quote
 *   columns; when they are unsuffixed ("GLQuote"/"GLOccurrence") this names the
 *   repo to key them under in GLQuotes.
 */
function normalizeTsvColumns(rows, singleBibleRepo = null) {
  if (rows.length === 0) return rows;

  return rows.map((row) => {
    const normalized = { ...row };

    // Convert Book/Chapter/Verse to Reference if needed
    if (!normalized.Reference && normalized.Chapter && normalized.Verse) {
      normalized.Reference = `${normalized.Chapter}:${normalized.Verse}`;
      delete normalized.Book;
      delete normalized.Chapter;
      delete normalized.Verse;
    }

    // Normalize quote column names to "Quote"
    if (normalized.OrigQuote) {
      normalized.Quote = normalized.OrigQuote;
      delete normalized.OrigQuote;
    } else if (normalized.OrigWord) {
      normalized.Quote = normalized.OrigWord;
      delete normalized.OrigWord;
    } else if (normalized.OrigWords) {
      normalized.Quote = normalized.OrigWords;
      delete normalized.OrigWords;
    }

    // Normalize note column name
    if (normalized.OccurrenceNote) {
      normalized.Note = normalized.OccurrenceNote;
      delete normalized.OccurrenceNote;
    }

    // Collect GLQuote/GLOccurrence columns into a GLQuotes object
    const glQuotes = {};
    const glKeys = Object.keys(normalized).filter(
      (k) => k.startsWith('GLQuote') || k.startsWith('GLOccurrence')
    );

    for (const key of glKeys) {
      if (key.startsWith('GLQuote')) {
        // "GLQuote:en_ult" -> repo = "en_ult", or "GLQuote" -> use singleBibleRepo
        const repo = key.includes(':') ? key.split(':')[1] : singleBibleRepo;
        if (!repo) continue;
        if (!glQuotes[repo]) glQuotes[repo] = {};
        glQuotes[repo].Quote = normalized[key];
      } else if (key.startsWith('GLOccurrence')) {
        const repo = key.includes(':') ? key.split(':')[1] : singleBibleRepo;
        if (!repo) continue;
        if (!glQuotes[repo]) glQuotes[repo] = {};
        const occ = normalized[key];
        glQuotes[repo].Occurrence = isNaN(parseInt(occ)) ? occ : parseInt(occ);
      }
      delete normalized[key];
    }

    if (Object.keys(glQuotes).length > 0) {
      normalized.GLQuotes = glQuotes;
    }

    return normalized;
  });
}

/** Subjects whose USFM the quote converter needs: the GL Bibles plus the originals. */
const GL_CONVERSION_SUBJECTS = new Set([
  'Aligned Bible',
  'Hebrew Old Testament',
  'Greek New Testament',
]);

/** The original-language subject a book is aligned against. */
function olSubjectForBook(bookId) {
  const testament = BibleBookData[bookId?.toLowerCase()]?.testament;
  if (testament === 'old') return 'Hebrew Old Testament';
  if (testament === 'new') return 'Greek New Testament';
  return null;
}

/** Link string for the quote converter: "owner/repo/ref". */
function entryLink(entry) {
  const { owner, repo, ref } = entryCoords(entry);
  return `${owner}/${repo}/${ref}`;
}

/**
 * Build bibleLinks array from catalog entries that are Aligned Bibles.
 * Returns links in the format "owner/repo/ref".
 */
function buildBibleLinks(catalogEntries) {
  return catalogEntries.filter((entry) => entry.subject === 'Aligned Bible').map(entryLink);
}

/**
 * Fetch the raw USFM (alignment markers intact) of one book from a catalog entry.
 * Returns undefined when the entry has no ingredient for the book or the read
 * fails (also when a directory source refuses it); that Bible then gives no GL
 * quotes. Nothing is downloaded in its place.
 */
async function fetchBookUsfm(entry, bookId, contentSource, logger) {
  const ingredient = entry.ingredients?.find(
    (ing) => ing.identifier?.toLowerCase() === bookId.toLowerCase()
  );
  if (!ingredient?.path) return undefined;
  const { owner, repo, ref } = entryCoords(entry);
  try {
    return await contentSource.readFile(entry, ingredient.path);
  } catch (e) {
    logger.warn(`Could not read ${owner}/${repo}/${ref} ${bookId} for GL quotes: ${e.message}`);
    return undefined;
  }
}

/**
 * Fill the rows' GLQuotes from their original-language quotes.
 *
 * The aligned Bibles and the original-language Bible the blueprint pinned are
 * fetched (through the dcsApi cache, so the display extractor reuses the same
 * download), indexed once per book, and looked up locally — see src/quotes/.
 * A quote that cannot be matched leaves that Bible out of the row's GLQuotes;
 * the renderers then show the original-language quote.
 *
 * @param {Array<Object>} rows - Normalised rows (Reference, Quote, Occurrence)
 * @param {string} bookCode
 * @param {Array} bibleEntries - Catalog entries for the Aligned Bibles, plus the
 *   Hebrew OT / Greek NT entries when known
 * @param {Object} options
 * @returns {Promise<{converted: number, missed: Array}>}
 */
async function convertQuotes(rows, bookCode, bibleEntries, options = {}) {
  const glEntries = bibleEntries.filter((e) => e.subject === 'Aligned Bible');
  if (glEntries.length === 0) return { converted: 0, missed: [] };

  const contentSource = contentSourceFor(options);
  const logger = loggerFor(options);
  const olEntry = bibleEntries.find((e) => e.subject === olSubjectForBook(bookCode));
  if (!olEntry) {
    logger.warn(`No original-language Bible for ${bookCode}; GL quotes skipped`);
    return { converted: 0, missed: [] };
  }

  // Fetch every Bible the lookup needs, concurrently.
  const [glContents, olContent] = await Promise.all([
    Promise.all(glEntries.map((entry) => fetchBookUsfm(entry, bookCode, contentSource, logger))),
    fetchBookUsfm(olEntry, bookCode, contentSource, logger),
  ]);
  if (olContent == null) return { converted: 0, missed: [] };

  const source = indexUsfmBook(olContent);
  const bibles = [];
  glEntries.forEach((entry, i) => {
    if (glContents[i] != null) {
      bibles.push({ repo: entryCoords(entry).repo, index: indexUsfmBook(glContents[i]) });
    }
  });
  if (!bibles.length) return { converted: 0, missed: [] };

  // addGlQuotes keeps a GLQuotes[repo] the row already has on purpose: a GL quote
  // an editor put in the published TSV wins over the computed one.
  const result = addGlQuotes(rows, { source, bibles });
  // Progress, not a fault: a quote whose words are not aligned falls back to
  // the original-language quote.
  if (result.missed.length) {
    logger.info(`${result.missed.length} quote(s) in ${bookCode} had no aligned words`);
  }
  return result;
}

/** Whether any row carries an original-language quote worth converting. */
function hasQuotes(rows) {
  return rows.some(
    (row) => String(row.Quote || row.OrigQuote || row.OrigWords || row.OrigWord || '').trim() !== ''
  );
}

/**
 * Group TSV rows by chapter and verse
 */
function groupByChapterVerse(rows) {
  const chapters = {};

  rows.forEach((row) => {
    if (!row.Reference) return;

    const colonIndex = row.Reference.indexOf(':');
    if (colonIndex === -1) return;

    const chapter = row.Reference.substring(0, colonIndex);
    const verse = row.Reference.substring(colonIndex + 1);

    if (!chapters[chapter]) {
      chapters[chapter] = { verses: {} };
    }

    if (!chapters[chapter].verses[verse]) {
      chapters[chapter].verses[verse] = [];
    }

    chapters[chapter].verses[verse].push(row);
  });

  return chapters;
}

/**
 * Common function to extract and format TSV data
 */
export async function extractRcTsvData(catalogEntry, books, options = {}, catalogEntries = []) {
  // DCS, or a local checkout (getResourceDataFromDirectory).
  const contentSource = contentSourceFor(options);

  const result = {
    type: 'tsv',
    metadataType: catalogEntry.metadata_type,
    subject: catalogEntry.subject,
    flavorType: catalogEntry.flavor_type || '',
    flavor: catalogEntry.flavor || '',
    title: catalogEntry.title,
    abbreviation: catalogEntry.abbreviation || catalogEntry.repo?.abbreviation || '',
    version: catalogEntry.branch_or_tag_name || catalogEntry.ref || '',
    license: await contentSource.readLicense(catalogEntry),
    books: {},
    extras: {},
  };

  // Bibles to convert quotes against: the Aligned Bibles plus the original-language
  // Bible the blueprint pinned. For a primary resource these come from the filtered
  // blueprint entries; for an extra TSV that still needs GL quotes (e.g. TSV
  // Translation Words Links fetched as an extra of TN), the parent passes its
  // already-resolved entries via options.glBibleEntries.
  const bibleEntriesForGl =
    !options.isExtra && catalogEntries.length > 1
      ? catalogEntries.filter((e) => GL_CONVERSION_SUBJECTS.has(e.subject))
      : options.glBibleEntries || [];
  const bibleLinks = buildBibleLinks(bibleEntriesForGl);
  // A published TSV with exactly one GL Bible may carry unsuffixed
  // "GLQuote"/"GLOccurrence" columns — the single repo name keys them.
  const singleBibleRepo = bibleLinks.length === 1 ? bibleLinks[0].split('/')[1] : null;

  // Process each requested book
  for (const bookId of books) {
    // Find the ingredient for this book
    const ingredient = catalogEntry.ingredients.find((ing) => ing.identifier === bookId);
    if (!ingredient) {
      loggerFor(options).warn(`No ingredient found for book: ${bookId}`);
      continue;
    }

    // Extract the file path (remove leading ./)
    const filePath = ingredient.path.replace(/^\.\//, '');

    // Fetch and parse the TSV
    let tsvContent;
    try {
      tsvContent = await contentSource.readFile(catalogEntry, filePath);
    } catch (error) {
      throw ResourceError.wrap(`Failed to read the TSV for book ${bookId}`, error);
    }
    const normalizedRows = normalizeTsvColumns(parseTsv(tsvContent), singleBibleRepo);

    // Look up the GL quotes if aligned bibles are available and there is
    // anything to convert (Translation Questions rows carry no Quote).
    let glQuoteMisses = [];
    if (bibleLinks.length > 0 && hasQuotes(normalizedRows)) {
      try {
        glQuoteMisses =
          (await convertQuotes(normalizedRows, bookId, bibleEntriesForGl, options)).missed || [];
      } catch (e) {
        loggerFor(options).warn(`GL quote lookup failed for ${bookId}: ${e.message}`);
      }
    }

    const chapters = groupByChapterVerse(normalizedRows);

    // Add book data
    result.books[bookId] = {
      title: ingredient.title,
      identifier: ingredient.identifier,
      sort: ingredient.sort,
      chapters: chapters,
      // Quotes whose aligned words were not found for a Bible: those rows fall
      // back to the original-language quote. Listed so an app can say why.
      ...(glQuoteMisses.length ? { glQuoteMisses } : {}),
    };
  }

  if (Object.keys(result.books).length === 0) {
    throw new ResourceError('No valid books were processed from the TSV data', {
      code: 'NO_CONTENT',
    });
  }

  // Use the already-resolved catalogEntries instead of fetching separately
  if (catalogEntries.length > 1 && !options.isExtra) {
    // Skip the first entry (which is the main catalogEntry) and process the rest
    const extraEntries = catalogEntries.slice(1);

    // Import getResourceData dynamically to avoid circular dependency
    const { getResourceData } = await import('./getResourceData.js');

    // The extras are independent of one another, so fetch them concurrently.
    // Promise.all keeps the entry order, which is the order result.extras is
    // filled in below.
    const fetched = await Promise.all(
      extraEntries.map(async (entry) => {
        const { owner: entryOwner, repo: entryRepo, ref: entryRef } = entryCoords(entry);
        const identifier = entryRepo.replace(`${entry.language}_`, '');

        // Fetch the resource data for this extra entry.
        // Use try/catch because some dependencies may not contain the requested books
        // (e.g., Hebrew OT won't have New Testament books like 'tit').
        try {
          const resourceData = await getResourceData(
            { owner: entryOwner, repo: entryRepo, ref: entryRef, books },
            {
              dcsApiUrl: dcsApiUrlOf(options),
              quiet: options.quiet || false,
              logger: options.logger,
            },
            {
              // Extras come from where the resource came from, with the same
              // limits (an explicit DCS source carries the archive limits).
              contentSource: contentSourceFor(options),
              glBibleEntries: bibleEntriesForGl,
              catalogEntry: entry,
              isExtra: true, // prevent recursive dependency fetching
            }
          );
          return resourceData ? [identifier, resourceData] : null;
        } catch (e) {
          // Dependency resource doesn't have the requested books — skip gracefully.
          // This is expected, e.g., when requesting NT book 'tit' from Hebrew OT.
          loggerFor(options).warn(`Skipping extra resource ${identifier}: ${e.message}`);
          return null;
        }
      })
    );
    for (const pair of fetched) {
      if (pair) result.extras[pair[0]] = pair[1];
    }

    // Now that the TW articles and aligned Bibles are in, narrow each TWL row's GL
    // quote to the word naming its article. Needs the whole tree, so it cannot run
    // during normalization.
    applyTwlQuoteTrimming(result, { lang: catalogEntry.language || 'en' });
  }

  return result;
}
