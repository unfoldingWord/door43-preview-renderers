import axios from 'axios';
import JSZip from 'jszip';
import { BibleBookData } from './constants.js';

/**
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a single translationStudio (ts) Bible book to USFM.
 *
 * ts Bible repos hold one book each, split into "chunk" text files stored under
 * numeric chapter directories: `<chapter>/<startVerse>.txt`. Each chunk file
 * already contains `\c` / `\v` markers, so the USFM is reconstructed by
 * concatenating the chunks in chapter/verse order, wrapping each chunk in its
 * own `\p` paragraph (matching door43-preview-app's ts2usfm()).
 *
 * @param {Object} catalogEntry - Catalog entry (used for the book title)
 * @param {Object} ingredient - The book ingredient (identifier, path, title)
 * @param {JSZip} zip - The loaded repo zip
 * @param {string} basePath - Path within the zip to the book root (no trailing slash)
 * @returns {Promise<string>} USFM string (empty if the book is unknown or has no chunks)
 */
export async function ts2usfm(catalogEntry, ingredient, zip, basePath) {
  const bookId = ingredient?.identifier?.toLowerCase();
  if (!bookId || !(bookId in BibleBookData)) {
    return '';
  }

  // Book title: front/title.txt, then 00/title.txt, then the ingredient title.
  let bookTitle = ingredient.title || BibleBookData[bookId].title;
  for (const titlePath of [`${basePath}/front/title.txt`, `${basePath}/00/title.txt`]) {
    const titleFile = zip.file(titlePath);
    if (titleFile) {
      bookTitle = (await titleFile.async('string')).trim();
      break;
    }
  }

  // Collect chunk files grouped by chapter: <basePath>/<chapter>/<verse>.txt
  const chunkRe = new RegExp(`^${escapeRegExp(basePath)}/(\\d+)/(\\d+)\\.txt$`);
  const chapters = {};
  for (const name of Object.keys(zip.files)) {
    const match = name.match(chunkRe);
    if (!match) continue;
    const chapter = parseInt(match[1], 10);
    const verse = parseInt(match[2], 10);
    (chapters[chapter] ||= []).push({ verse, path: name });
  }

  const sortedChapters = Object.keys(chapters)
    .map(Number)
    .sort((a, b) => a - b);
  if (sortedChapters.length === 0) {
    return '';
  }

  let usfm = `\\id ${bookId.toUpperCase()} ${catalogEntry.title}
\\usfm 3.0
\\ide UTF-8
\\h ${bookTitle}
\\toc1 ${bookTitle}
\\toc2 ${bookTitle}
\\toc3 ${bookTitle}
\\mt1 ${bookTitle}

`;

  for (const chapter of sortedChapters) {
    const chunks = chapters[chapter].sort((a, b) => a.verse - b.verse);
    let chapterStarted = false;
    for (const chunk of chunks) {
      let text = (await zip.file(chunk.path).async('string')).trim();
      // The first chunk of each chapter should carry its \c marker.
      if (!chapterStarted && !new RegExp(`\\\\c\\s+${chapter}\\b`).test(text)) {
        text = `\\c ${chapter}\n${text}`;
      }
      chapterStarted = true;
      usfm += `\\p\n${text}\n`;
    }
  }

  return usfm;
}

/**
 * Extract Bible data from a translationStudio (ts) repository.
 *
 * Downloads the repo zip once and reconstructs USFM for each book ingredient
 * via {@link ts2usfm}. Returns the same shape as RC aligned Bible data so the
 * downstream renderers can treat ts Bibles like any other USFM resource.
 *
 * @param {Object} catalogEntry - Catalog entry object
 * @param {Array<string>} [books] - Book identifiers to include (defaults to all ingredients)
 * @param {Object} [options] - Options
 * @returns {Promise<Object>} { type: 'usfm', ..., books: { [bookId]: usfmString } }
 */
export async function extractTsBibleData(catalogEntry, books = [], _options = {}) {
  const zipUrl = catalogEntry.zipball_url;
  if (!zipUrl) {
    throw new Error('Catalog entry is missing a zipball_url for the ts Bible repository.');
  }

  const repoName = catalogEntry.name || catalogEntry.repo?.name;
  if (!repoName) {
    throw new Error('Catalog entry is missing a repository name.');
  }

  const response = await axios.get(zipUrl, { responseType: 'arraybuffer' });
  const zip = await JSZip.loadAsync(response.data);

  // Gitea lowercases the repo name in the archive's root folder, so match
  // case-insensitively and use the actual folder name from the zip.
  const rootFolders = Object.keys(zip.files).map((name) => name.split('/')[0]);
  const repoBaseName = repoName.split('/').pop().toLowerCase();
  const actualRepoName =
    rootFolders.find((name) => name.toLowerCase().startsWith(repoBaseName)) || repoName;

  const ingredientBooks = (catalogEntry.ingredients || [])
    .map((ingredient) => ingredient.identifier?.toLowerCase())
    .filter(Boolean);
  const booksToFetch =
    books && books.length > 0
      ? books.map((book) => book.toLowerCase()).filter(Boolean)
      : ingredientBooks;

  const booksContent = {};
  for (const bookId of booksToFetch) {
    const ingredient = catalogEntry.ingredients?.find(
      (ing) => ing.identifier?.toLowerCase() === bookId
    );
    if (!ingredient) {
      console.warn(`No ingredient found for book: ${bookId}`);
      continue;
    }

    // ingredient.path is typically "." (book at repo root); otherwise a subdir.
    const cleanPath = (ingredient.path || '.').replace(/^\.\//, '').replace(/^\.$/, '');
    const basePath = cleanPath ? `${actualRepoName}/${cleanPath}` : actualRepoName;

    const usfm = await ts2usfm(catalogEntry, ingredient, zip, basePath);
    if (usfm) {
      booksContent[bookId] = usfm;
    }
  }

  if (Object.keys(booksContent).length === 0) {
    throw new Error('No valid books were processed from the ts Bible data.');
  }

  // License lives at the repo root.
  let license = '';
  for (const licenseName of ['LICENSE.md', 'LICENSE', 'LICENSE.txt']) {
    const licenseFile = zip.file(`${actualRepoName}/${licenseName}`);
    if (licenseFile) {
      license = (await licenseFile.async('string')).trim();
      break;
    }
  }

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
