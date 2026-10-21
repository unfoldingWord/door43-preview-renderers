import { fetchContent, fetchLicense } from './dcsApi.js';
import { addGLQuoteCols } from 'tsv-quote-converters';
import { applyTwlQuoteTrimming } from './twlQuoteTrimming.js';
import { BibleBookData } from './constants.js';

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
 * @param {string|null} singleBibleRepo - When addGLQuoteCols was called with a single bible,
 *   the repo identifier columns will be "GLQuote"/"GLOccurrence" (no suffix). This param
 *   provides the repo name to key them under in GLQuotes.
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

/** owner/repo/ref of a catalog entry, derived the same way the Bible extractor does. */
function entryCoords(entry) {
  return {
    owner: entry.repo?.owner?.username || entry.repo?.owner?.login || entry.owner,
    repo: entry.repo?.name || entry.name,
    ref: entry.branch_or_tag_name || entry.ref,
  };
}

/** Link string for the quote converter: "owner/repo/ref". */
function entryLink(entry) {
  const { owner, repo, ref } = entryCoords(entry);
  return `${owner}/${repo}/${ref}`;
}

/**
 * Build bibleLinks array from catalog entries that are Aligned Bibles.
 * Returns links in the format "owner/repo/ref" for addGLQuoteCols.
 */
function buildBibleLinks(catalogEntries) {
  return catalogEntries.filter((entry) => entry.subject === 'Aligned Bible').map(entryLink);
}

/**
 * Fetch the raw USFM (alignment markers intact) of one book from a catalog entry.
 * Returns undefined when the entry has no ingredient for the book or the fetch
 * fails, in which case the converter downloads it itself (its fallback).
 */
async function fetchBookUsfm(entry, bookId, dcsApiUrl, quiet) {
  const ingredient = entry.ingredients?.find(
    (ing) => ing.identifier?.toLowerCase() === bookId.toLowerCase()
  );
  if (!ingredient?.path) return undefined;
  const { owner, repo, ref } = entryCoords(entry);
  try {
    return await fetchContent(owner, repo, ref, ingredient.path.replace(/^\.\//, ''), dcsApiUrl);
  } catch (e) {
    if (!quiet) console.warn(`Could not preload ${owner}/${repo}/${ref} ${bookId}: ${e.message}`);
    return undefined;
  }
}

/**
 * Add GL quote columns to TSV content using tsv-quote-converters.
 *
 * The Bibles the converter aligns against are fetched here first (through the
 * dcsApi cache, so the display extractor reuses the same download) and handed
 * to addGLQuoteCols as content. The original-language Bible is the one the
 * blueprint pinned, not whatever is in production today.
 *
 * @param {string} tsvContent
 * @param {string} bookCode
 * @param {Array} bibleEntries - Catalog entries for the Aligned Bibles, plus the
 *   Hebrew OT / Greek NT entries when known
 * @param {Object} options
 */
async function addGLQuotes(tsvContent, bookCode, bibleEntries, options = {}) {
  const glEntries = bibleEntries.filter((e) => e.subject === 'Aligned Bible');
  const bibleLinks = glEntries.map(entryLink);
  if (bibleLinks.length === 0) return tsvContent;

  const dcsApiUrl = options.dcs_api_url || 'https://git.door43.org/api/v1';
  // Strip /api/v1 to get the base DCS URL that addGLQuoteCols expects
  const dcsUrl = dcsApiUrl.replace(/\/api\/v[0-9]+\/?$/, '');
  const quiet = options.quiet !== false;

  const olEntry = bibleEntries.find((e) => e.subject === olSubjectForBook(bookCode));

  // Preload every Bible the converter needs, concurrently.
  const [glContents, olBibleContent] = await Promise.all([
    Promise.all(glEntries.map((entry) => fetchBookUsfm(entry, bookCode, dcsApiUrl, quiet))),
    olEntry ? fetchBookUsfm(olEntry, bookCode, dcsApiUrl, quiet) : undefined,
  ]);
  const bibleContents = {};
  glEntries.forEach((entry, i) => {
    if (glContents[i] != null) bibleContents[entryLink(entry)] = glContents[i];
  });

  const result = await addGLQuoteCols({
    bibleLinks,
    bookCode,
    tsvContent,
    trySeparatorsAndOccurrences: true,
    usePreviousGLQuotes: true,
    dcsUrl,
    quiet,
    // Honoured by tsv-quote-converters >= 1.2.0; older versions ignore these
    // and download the Bibles themselves.
    bibleContents,
    olBibleLink: olEntry ? entryLink(olEntry) : undefined,
    olBibleContent,
  });

  if (result.errors && result.errors.length > 0 && !quiet) {
    console.warn(`GL quote conversion had ${result.errors.length} error(s) for ${bookCode}`);
  }

  return result.output;
}

/** Whether any row carries an original-language quote worth converting. */
function hasQuotes(rows) {
  return rows.some((row) =>
    String(row.Quote || row.OrigQuote || row.OrigWords || row.OrigWord || '').trim()
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
  const { dcs_api_url = 'https://git.door43.org/api/v1' } = options;
  const owner = catalogEntry.repo.owner.username || catalogEntry.repo.owner.login;
  const repo = catalogEntry.repo.name;
  const ref = catalogEntry.branch_or_tag_name;

  const result = {
    type: 'tsv',
    metadataType: catalogEntry.metadata_type,
    subject: catalogEntry.subject,
    flavorType: catalogEntry.flavor_type || '',
    flavor: catalogEntry.flavor || '',
    title: catalogEntry.title,
    abbreviation: catalogEntry.abbreviation || catalogEntry.repo?.abbreviation || '',
    version: catalogEntry.branch_or_tag_name || catalogEntry.ref || '',
    license: await fetchLicense(owner, repo, ref, dcs_api_url),
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
  // When there's exactly one aligned bible, addGLQuoteCols outputs "GLQuote"/"GLOccurrence"
  // without a repo suffix — pass the single repo name so normalization can key it properly.
  const singleBibleRepo = bibleLinks.length === 1 ? bibleLinks[0].split('/')[1] : null;

  // Process each requested book
  for (const bookId of books) {
    // Find the ingredient for this book
    const ingredient = catalogEntry.ingredients.find((ing) => ing.identifier === bookId);
    if (!ingredient) {
      console.warn(`No ingredient found for book: ${bookId}`);
      continue;
    }

    // Extract the file path (remove leading ./)
    const filePath = ingredient.path.replace(/^\.\//, '');

    // Fetch the TSV file
    let tsvContent = await fetchContent(owner, repo, ref, filePath, dcs_api_url);

    // Add GL quote columns if aligned bibles are available and there is
    // anything to convert (Translation Questions rows carry no Quote).
    if (bibleLinks.length > 0 && hasQuotes(parseTsv(tsvContent))) {
      try {
        tsvContent = await addGLQuotes(tsvContent, bookId, bibleEntriesForGl, options);
      } catch (e) {
        if (!options.quiet) {
          console.warn(`GL quote conversion failed for ${bookId}: ${e.message}`);
        }
      }
    }

    // Parse and normalize the TSV
    const rows = parseTsv(tsvContent);
    const normalizedRows = normalizeTsvColumns(rows, singleBibleRepo);
    const chapters = groupByChapterVerse(normalizedRows);

    // Add book data
    result.books[bookId] = {
      title: ingredient.title,
      identifier: ingredient.identifier,
      sort: ingredient.sort,
      chapters: chapters,
    };
  }

  if (Object.keys(result.books).length === 0) {
    throw new Error('No valid books were processed from the TSV data');
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
              dcs_api_url,
              quiet: options.quiet || false,
              glBibleEntries: bibleEntriesForGl,
              catalogEntry: entry,
              isExtra: true, // prevent recursive dependency fetching
            }
          );
          return resourceData && !resourceData.error ? [identifier, resourceData] : null;
        } catch (e) {
          // Dependency resource doesn't have the requested books — skip gracefully.
          // This is expected, e.g., when requesting NT book 'tit' from Hebrew OT.
          if (!options.quiet) {
            console.warn(`Skipping extra resource ${identifier}: ${e.message}`);
          }
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
