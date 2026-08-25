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
      bookData[book] = usfm.toJSON(usfmContent);
    } catch (error) {
      throw new Error(`Failed to fetch or parse USFM content for book ${book}: ${error.message}`);
    }
  }

  return bookData;
}

/**
 * Recursively pull plain text out of usfm-js verseObjects, skipping footnotes,
 * cross references and any residual milestone/alignment wrappers.
 */
export function extractVerseObjectsText(verseObjects) {
  if (!Array.isArray(verseObjects)) return '';
  let text = '';
  for (const obj of verseObjects) {
    if (!obj) continue;
    if (obj.type === 'text' || obj.type === 'word') {
      text += obj.text || '';
    } else if (obj.type === 'footnote' || obj.tag === 'f' || obj.tag === 'x') {
      // Skip the note's content but keep the character that followed it, which is
      // usually the space separating the words on either side. Dropping it runs
      // them together — Matthew 9:8 reads "they were afraidand glorified God".
      text += obj.nextChar || '';
      continue;
    } else if (Array.isArray(obj.children)) {
      text += extractVerseObjectsText(obj.children);
    } else if (typeof obj.text === 'string') {
      text += obj.text;
    }
  }
  return text;
}

/**
 * Plain verse text for one book of USFM, as { chapter: { verse: text } }.
 * Returns {} if the USFM cannot be parsed.
 */
export function getVerseTextsFromUsfm(usfmContent) {
  if (typeof usfmContent !== 'string') return {};
  let json;
  try {
    json = usfm.toJSON(usfmContent);
  } catch {
    return {};
  }
  const out = {};
  for (const [chapter, verses] of Object.entries(json.chapters || {})) {
    out[chapter] = {};
    for (const [verse, verseData] of Object.entries(verses)) {
      if (verse === 'front') continue;
      const text = extractVerseObjectsText(verseData?.verseObjects).replace(/\s+/g, ' ').trim();
      if (text) out[chapter][verse] = text;
    }
  }
  return out;
}
