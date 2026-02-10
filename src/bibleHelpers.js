import * as usfm from 'usfm-js';
import { fetchContent } from './dcsApi.js';
import { BibleBookData } from './constants.js';

/**
 * Fetch and parse USFM content for specified books
 * @param {Object} catalogEntry - Catalog entry object
 * @param {Array<string>} books - List of book identifiers
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Parsed USFM data for each book
 */
export async function getBookChapterVersesData(catalogEntry, books, options) {
  const { dcs_api_url = 'https://git.door43.org/api/v1' } = options;

  const bookData = {};

  for (const book of books) {
    if (
      (catalogEntry.subject == 'Hebrew Old Testament' && BibleBookData[book]?.testament == 'new') ||
      (catalogEntry.subject == 'Greek New Testament' && BibleBookData[book]?.testament == 'old')
    ) {
      continue;
    }
    const ingredient = catalogEntry.ingredients.find(
      (ing) => ing.identifier === book.toLocaleLowerCase()
    );
    if (!ingredient || !ingredient.path) {
      throw new Error(
        `Ingredient for book ${book} not found for ${catalogEntry.owner}/${catalogEntry.name}. ${catalogEntry.subject} || ${book} || ${BibleBookData[book]?.testament}`
      );
    }

    const filePath = ingredient.path.replace(/^\.\//, '');

    try {
      const usfmContent = await fetchContent(
        catalogEntry.owner,
        catalogEntry.name,
        catalogEntry.branch_or_tag_name,
        filePath,
        dcs_api_url
      );
      const bookJson = usfm.toJSON(usfmContent);
    } catch (error) {
      throw new Error(`Failed to fetch or parse USFM content for book ${book}: ${error.message}`);
    }
  }

  return bookData;
}

const sortKeys = (keys) => {
  return keys.sort((a, b) => {
    const numA = parseInt(a.split('-')[0], 10);
    const numB = parseInt(b.split('-')[0], 10);

    if (isNaN(numA) && isNaN(numB)) {
      // Both are NaN, sort lexicographically
      return a.localeCompare(b);
    } else if (isNaN(numA)) {
      // Only numA is NaN, numA should come after numB
      return 1;
    } else if (isNaN(numB)) {
      // Only numB is NaN, numB should come after numA
      return -1;
    } else {
      // Both are numbers, sort numerically
      return numA - numB;
    }
  });
};
