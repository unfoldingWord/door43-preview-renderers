import { fetchContent } from './dcsApi.js';

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
 * Normalize TSV columns
 */
function normalizeTsvColumns(rows) {
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

    // Remove GLQuote column
    if (normalized.GLQuote) {
      delete normalized.GLQuote;
    }

    return normalized;
  });
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
    books: {},
    extras: {},
  };

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

    // Fetch and parse the TSV file
    const tsvContent = await fetchContent(owner, repo, ref, filePath, dcs_api_url);
    const rows = parseTsv(tsvContent);
    const normalizedRows = normalizeTsvColumns(rows);
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

  // Use catalogEntries from getAllCatalogEntriesForRendering instead of fetching separately
  if (catalogEntries.length > 1 && !options.is_extra) {
    // Skip the first entry (which is the main catalogEntry) and process the rest
    const extraEntries = catalogEntries.slice(1);

    // Import getResourceData dynamically to avoid circular dependency
    const { getResourceData } = await import('./getResourceData.js');

    for (const entry of extraEntries) {
      const entryOwner = entry.repo?.owner?.username || entry.repo?.owner?.login || entry.owner;
      const entryRepo = entry.repo?.name || entry.name;
      const entryRef = entry.branch_or_tag_name || entry.ref;
      const identifier = entryRepo.replace(`${entry.language}_`, '');

      // Fetch the resource data for this extra entry
      const resourceData = await getResourceData(
        entryOwner,
        entryRepo,
        entryRef,
        books,
        { dcs_api_url, quiet: options.quiet || false },
        true // is_extra = true to prevent recursive fetching
      );

      result.extras[identifier] = resourceData;
    }
  }

  return result;
}
