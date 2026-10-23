import { removeAlignments } from './usfm/removeAlignments.js';
import { ResourceError } from './errors.js';
import { loggerFor } from './logger.js';
import { contentSourceFor, readLicense } from './contentSource.js';
import { bookIngredientPath, burritoBooks } from './burrito.js';
import { BibleBookData } from './constants.js';

/**
 * Extract a Bible's books from its burrito (`textTranslation`: one USFM file
 * per book, found by its `scope`) and remove the alignments. rc, ts and tc
 * Bibles arrive the same way, DCS having converted them.
 */
export async function extractRcAlignedBibleData(catalogEntry, books = [], options = {}) {
  // DCS, or burritos unpacked on disk (getResourceDataFromDirectory).
  const source = contentSourceFor(options);
  const owner =
    catalogEntry.owner || catalogEntry.repo?.owner?.username || catalogEntry.repo?.owner?.login;
  const repo = catalogEntry.name || catalogEntry.repo?.name;
  const ref = catalogEntry.branch_or_tag_name || catalogEntry.ref;

  if (!owner || !repo || !ref) {
    throw new ResourceError('Catalog entry is missing owner, repo, or ref details.', {
      code: 'INVALID_INPUT',
    });
  }

  const metadata = await source.readMetadata(catalogEntry);
  const booksToFetch =
    books && books.length > 0
      ? books.map((book) => book.toLowerCase()).filter(Boolean)
      : burritoBooks(metadata, '.usfm');

  const booksContent = {};

  for (const bookId of booksToFetch) {
    if (
      (catalogEntry.subject === 'Hebrew Old Testament' &&
        BibleBookData[bookId]?.testament === 'new') ||
      (catalogEntry.subject === 'Greek New Testament' && BibleBookData[bookId]?.testament === 'old')
    ) {
      continue;
    }

    const filePath = bookIngredientPath(metadata, bookId, '.usfm');
    if (!filePath) {
      loggerFor(options).warn(`No ingredient found for book: ${bookId}`);
      continue;
    }

    try {
      const usfmContent = await source.readFile(catalogEntry, filePath);
      booksContent[bookId] = removeAlignments(usfmContent);
    } catch (error) {
      throw ResourceError.wrap(`Failed to fetch or process USFM content for book ${bookId}`, error);
    }
  }

  if (Object.keys(booksContent).length === 0) {
    throw new ResourceError('No valid books were processed from the aligned USFM data', {
      code: 'NO_CONTENT',
    });
  }

  const license = await readLicense(source, catalogEntry);

  return {
    type: 'usfm',
    metadataType: catalogEntry.metadata_type,
    subject: catalogEntry.subject,
    flavorType: catalogEntry.flavor_type || '',
    flavor: catalogEntry.flavor || '',
    title: catalogEntry.title,
    abbreviation: catalogEntry.abbreviation || catalogEntry.repo?.abbreviation || '',
    version: catalogEntry.branch_or_tag_name || catalogEntry.ref || '',
    license,
    books: booksContent,
  };
}
