import { removeAlignments } from 'usfm-alignment-remover';
import { fetchContent } from './dcsApi.js';
import { BibleBookData } from './constants.js';

async function fetchLicense(owner, repo, ref, dcs_api_url) {
  const licensePaths = ['LICENSE.md', 'LICENSE', 'LICENSE.txt'];

  for (const licensePath of licensePaths) {
    try {
      const license = await fetchContent(owner, repo, ref, licensePath, dcs_api_url);
      if (license) {
        return license.trim();
      }
    } catch (error) {
      // Try next candidate path.
    }
  }

  return '';
}

/**
 * Extract aligned Bible data and remove alignments from USFM.
 */
export async function extractRcAlignedBibleData(catalogEntry, books = [], options = {}) {
  const { dcs_api_url = 'https://git.door43.org/api/v1' } = options;
  const owner =
    catalogEntry.owner || catalogEntry.repo?.owner?.username || catalogEntry.repo?.owner?.login;
  const repo = catalogEntry.name || catalogEntry.repo?.name;
  const ref = catalogEntry.branch_or_tag_name || catalogEntry.ref;

  if (!owner || !repo || !ref) {
    throw new Error('Catalog entry is missing owner, repo, or ref details.');
  }

  const ingredientBooks = (catalogEntry.ingredients || [])
    .map((ingredient) => ingredient.identifier?.toLowerCase())
    .filter(Boolean);
  const booksToFetch =
    books && books.length > 0
      ? books.map((book) => book.toLowerCase()).filter(Boolean)
      : ingredientBooks;

  const booksContent = {};

  for (const bookId of booksToFetch) {
    if (
      (catalogEntry.subject === 'Hebrew Old Testament' &&
        BibleBookData[bookId]?.testament === 'new') ||
      (catalogEntry.subject === 'Greek New Testament' && BibleBookData[bookId]?.testament === 'old')
    ) {
      continue;
    }

    const ingredient = catalogEntry.ingredients?.find(
      (ing) => ing.identifier?.toLowerCase() === bookId
    );
    if (!ingredient || !ingredient.path) {
      console.warn(`No ingredient found for book: ${bookId}`);
      continue;
    }

    const filePath = ingredient.path.replace(/^\.\//, '');

    try {
      const usfmContent = await fetchContent(owner, repo, ref, filePath, dcs_api_url);
      booksContent[bookId] = removeAlignments(usfmContent);
    } catch (error) {
      throw new Error(
        `Failed to fetch or process USFM content for book ${bookId}: ${error.message}`
      );
    }
  }

  if (Object.keys(booksContent).length === 0) {
    throw new Error('No valid books were processed from the aligned USFM data');
  }

  const license = await fetchLicense(owner, repo, ref, dcs_api_url);

  return {
    type: 'usfm',
    metadataType: catalogEntry.metadata_type,
    subject: catalogEntry.subject,
    flavorType: catalogEntry.flavor_type || '',
    flavor: catalogEntry.flavor || '',
    title: catalogEntry.title,
    license,
    books: booksContent,
  };
}
