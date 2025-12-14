import { extractRcSbObsData, extractTsObsData, formatObsData } from './obsHelpers';
import { extractRcTsvData } from './tsvHelpers';
import { extractRcTwData } from './twHelpers';
import { extractRcTaData } from './taHelpers';
import { getBookChapterVersesData } from './bibleHelpers';
import axios from 'axios';

const BibleBookData = {
  gen: { id: 'gen', title: 'Genesis', usfm: '01-GEN', testament: 'old' },
  exo: { id: 'exo', title: 'Exodus', usfm: '02-EXO', testament: 'old' },
  lev: { id: 'lev', title: 'Leviticus', usfm: '03-LEV', testament: 'old' },
  num: { id: 'num', title: 'Numbers', usfm: '04-NUM', testament: 'old' },
  deu: { id: 'deu', title: 'Deuteronomy', usfm: '05-DEU', testament: 'old' },
  jos: { id: 'jos', title: 'Joshua', usfm: '06-JOS', testament: 'old' },
  jdg: { id: 'jdg', title: 'Judges', usfm: '07-JDG', testament: 'old' },
  rut: { id: 'rut', title: 'Ruth', usfm: '08-RUT', testament: 'old' },
  '1sa': { id: '1sa', title: '1 Samuel', usfm: '09-1SA', testament: 'old' },
  '2sa': { id: '2sa', title: '2 Samuel', usfm: '10-2SA', testament: 'old' },
  '1ki': { id: '1ki', title: '1 Kings', usfm: '11-1KI', testament: 'old' },
  '2ki': { id: '2ki', title: '2 Kings', usfm: '12-2KI', testament: 'old' },
  '1ch': { id: '1ch', title: '1 Chronicles', usfm: '13-1CH', testament: 'old' },
  '2ch': { id: '2ch', title: '2 Chronicles', usfm: '14-2CH', testament: 'old' },
  ezr: { id: 'ezr', title: 'Ezra', usfm: '15-EZR', testament: 'old' },
  neh: { id: 'neh', title: 'Nehemiah', usfm: '16-NEH', testament: 'old' },
  est: { id: 'est', title: 'Esther', usfm: '17-EST', testament: 'old' },
  job: { id: 'job', title: 'Job', usfm: '18-JOB', testament: 'old' },
  psa: { id: 'psa', title: 'Psalms', usfm: '19-PSA', testament: 'old' },
  pro: { id: 'pro', title: 'Proverbs', usfm: '20-PRO', testament: 'old' },
  ecc: { id: 'ecc', title: 'Ecclesiastes', usfm: '21-ECC', testament: 'old' },
  sng: { id: 'sng', title: 'Song of Songs', usfm: '22-SNG', testament: 'old' },
  isa: { id: 'isa', title: 'Isaiah', usfm: '23-ISA', testament: 'old' },
  jer: { id: 'jer', title: 'Jeremiah', usfm: '24-JER', testament: 'old' },
  lam: { id: 'lam', title: 'Lamentations', usfm: '25-LAM', testament: 'old' },
  ezk: { id: 'ezk', title: 'Ezekiel', usfm: '26-EZK', testament: 'old' },
  dan: { id: 'dan', title: 'Daniel', usfm: '27-DAN', testament: 'old' },
  hos: { id: 'hos', title: 'Hosea', usfm: '28-HOS', testament: 'old' },
  jol: { id: 'jol', title: 'Joel', usfm: '29-JOL', testament: 'old' },
  amo: { id: 'amo', title: 'Amos', usfm: '30-AMO', testament: 'old' },
  oba: { id: 'oba', title: 'Obadiah', usfm: '31-OBA', testament: 'old' },
  jon: { id: 'jon', title: 'Jonah', usfm: '32-JON', testament: 'old' },
  mic: { id: 'mic', title: 'Micah', usfm: '33-MIC', testament: 'old' },
  nam: { id: 'nam', title: 'Nahum', usfm: '34-NAM', testament: 'old' },
  hab: { id: 'hab', title: 'Habakkuk', usfm: '35-HAB', testament: 'old' },
  zep: { id: 'zep', title: 'Zephaniah', usfm: '36-ZEP', testament: 'old' },
  hag: { id: 'hag', title: 'Haggai', usfm: '37-HAG', testament: 'old' },
  zec: { id: 'zec', title: 'Zechariah', usfm: '38-ZEC', testament: 'old' },
  mal: { id: 'mal', title: 'Malachi', usfm: '39-MAL', testament: 'old' },
  mat: { id: 'mat', title: 'Matthew', usfm: '41-MAT', testament: 'new' },
  mrk: { id: 'mrk', title: 'Mark', usfm: '42-MRK', testament: 'new' },
  luk: { id: 'luk', title: 'Luke', usfm: '43-LUK', testament: 'new' },
  jhn: { id: 'jhn', title: 'John', usfm: '44-JHN', testament: 'new' },
  act: { id: 'act', title: 'Acts', usfm: '45-ACT', testament: 'new' },
  rom: { id: 'rom', title: 'Romans', usfm: '46-ROM', testament: 'new' },
  '1co': { id: '1co', title: '1 Corinthians', usfm: '47-1CO', testament: 'new' },
  '2co': { id: '2co', title: '2 Corinthians', usfm: '48-2CO', testament: 'new' },
  gal: { id: 'gal', title: 'Galatians', usfm: '49-GAL', testament: 'new' },
  eph: { id: 'eph', title: 'Ephesians', usfm: '50-EPH', testament: 'new' },
  php: { id: 'php', title: 'Philippians', usfm: '51-PHP', testament: 'new' },
  col: { id: 'col', title: 'Colossians', usfm: '52-COL', testament: 'new' },
  '1th': { id: '1th', title: '1 Thessalonians', usfm: '53-1TH', testament: 'new' },
  '2th': { id: '2th', title: '2 Thessalonians', usfm: '54-2TH', testament: 'new' },
  '1ti': { id: '1ti', title: '1 Timothy', usfm: '55-1TI', testament: 'new' },
  '2ti': { id: '2ti', title: '2 Timothy', usfm: '56-2TI', testament: 'new' },
  tit: { id: 'tit', title: 'Titus', usfm: '57-TIT', testament: 'new' },
  phm: { id: 'phm', title: 'Philemon', usfm: '58-PHM', testament: 'new' },
  heb: { id: 'heb', title: 'Hebrews', usfm: '59-HEB', testament: 'new' },
  jas: { id: 'jas', title: 'James', usfm: '60-JAS', testament: 'new' },
  '1pe': { id: '1pe', title: '1 Peter', usfm: '61-1PE', testament: 'new' },
  '2pe': { id: '2pe', title: '2 Peter', usfm: '62-2PE', testament: 'new' },
  '1jn': { id: '1jn', title: '1 John', usfm: '63-1JN', testament: 'new' },
  '2jn': { id: '2jn', title: '2 John', usfm: '64-2JN', testament: 'new' },
  '3jn': { id: '3jn', title: '3 John', usfm: '65-3JN', testament: 'new' },
  jud: { id: 'jud', title: 'Jude', usfm: '66-JUD', testament: 'new' },
  rev: { id: 'rev', title: 'Revelation', usfm: '67-REV', testament: 'new' },
};

const subjectIdentifierMap = {
  'Aligned Bible': ['ult', 'ust', 'glt', 'gst'],
  'Hebrew Old Testament': 'unfoldingWord/hbo_uhb',
  'Greek New Testament': 'unfoldingWord/el-x-koine_ugnt',
  'Translation Academy': 'ta',
  'Translation Words': 'tw',
  'TSV Translation Words Links': 'twl',
  'Open Bible Stories': 'obs',
  'TSV OBS Study Questions': 'obs-sq',
  'TSV OBS Study Notes': 'obs-sn',
  'TSV OBS Translation Notes': 'obs-tn',
  'TSV OBS Translation Words Links': 'obs-twl',
};

const requiredSubjectsMap = {
  'TSV Translation Notes': [
    'Aligned Bible',
    'Translation Academy',
    'Translation Words',
    'TSV Translation Words Links',
    'Hebrew Old Testament',
    'Greek New Testament',
  ],
  'TSV Study Notes': ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament'],
  'TSV Study Questions': ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament'],
  'TSV Translation Questions': ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament'],
  'TSV Translation Words Links': [
    'Aligned Bible',
    'Hebrew Old Testament',
    'Greek New Testament',
    'Translation Words',
  ],
  'TSV OBS Study Notes': ['Open Bible Stories'],
  'TSV OBS Study Questions': ['Open Bible Stories'],
  'TSV OBS Translation Notes': [
    'Open Bible Stories',
    'TSV OBS Translation Words Links',
    'Translation Academy',
    'Translation Words',
  ],
  'TSV OBS Translation Questions': ['Open Bible Stories'],
};

/**
 * Determine which testaments are needed based on the books array
 * @param {Array} books - Array of book identifiers
 * @returns {Object} Object with needsOldTestament and needsNewTestament booleans
 */
function determineNeededTestaments(books) {
  if (!books || books.length === 0) {
    return { needsOldTestament: true, needsNewTestament: true };
  }

  let hasOldTestament = false;
  let hasNewTestament = false;

  for (const book of books) {
    const bookData = BibleBookData[book.toLowerCase()];
    if (bookData) {
      if (bookData.testament === 'old') {
        hasOldTestament = true;
      } else if (bookData.testament === 'new') {
        hasNewTestament = true;
      }
    }
  }

  return {
    needsOldTestament: hasOldTestament,
    needsNewTestament: hasNewTestament,
  };
}

/**
 * Map relation identifier to subject name
 * @param {string} identifier - The identifier from relation
 * @returns {string|null} The subject name or null if not recognized
 */
function mapIdentifierToSubject(identifier) {
  const identifierMap = {
    ta: 'Translation Academy',
    tw: 'Translation Words',
    twl: 'TSV Translation Words Links',
    uhb: 'Hebrew Old Testament',
    ugnt: 'Greek New Testament',
    tn: 'TSV Translation Notes',
    tq: 'TSV Translation Questions',
    obs: 'Open Bible Stories',
    'obs-tn': 'TSV OBS Translation Notes',
    'obs-tq': 'TSV OBS Translation Questions',
    'obs-sq': 'TSV OBS Study Questions',
    'obs-sn': 'TSV OBS Study Notes',
    'obs-twl': 'TSV OBS Translation Words Links',
    ult: 'Aligned Bible',
    ust: 'Aligned Bible',
    glt: 'Aligned Bible',
    gst: 'Aligned Bible',
  };

  return identifierMap[identifier] || null;
}

/**
 * Find best matching catalog entry by release date
 * @param {Array} entries - Array of catalog entries sorted by release date (descending)
 * @param {string} targetReleaseDate - The main catalog entry's release date
 * @returns {Object|null} The best matching catalog entry or null
 */
function findBestCatalogEntryByDate(entries, targetReleaseDate) {
  if (!entries || entries.length === 0) return null;

  const targetDate = new Date(targetReleaseDate);
  const targetDay = new Date(targetDate.toISOString().split('T')[0]); // Just the date part
  const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;

  // Filter to entries within 5 days (before or after)
  const withinFiveDays = entries.filter((entry) => {
    const entryDate = new Date(entry.released);
    const diff = Math.abs(entryDate - targetDate);
    return diff <= fiveDaysInMs;
  });

  // Check for same-day entries
  const sameDayEntries = withinFiveDays.filter((entry) => {
    const entryDay = new Date(new Date(entry.released).toISOString().split('T')[0]);
    return entryDay.getTime() === targetDay.getTime();
  });

  if (sameDayEntries.length > 0) {
    // Return latest entry from same day (already sorted descending)
    return sameDayEntries[0];
  }

  // Find closest earlier entry within 5 days
  const earlierEntries = withinFiveDays.filter((entry) => {
    return new Date(entry.released) < targetDate;
  });

  if (earlierEntries.length > 0) {
    return earlierEntries[0]; // Closest earlier (already sorted descending)
  }

  // Find closest later entry within 5 days
  const laterEntries = withinFiveDays.filter((entry) => {
    return new Date(entry.released) > targetDate;
  });

  if (laterEntries.length > 0) {
    return laterEntries[laterEntries.length - 1]; // Closest later (last in descending order)
  }

  // If no entries within 5 days, use any later entry
  const anyLaterEntries = entries.filter((entry) => {
    return new Date(entry.released) > targetDate;
  });

  if (anyLaterEntries.length > 0) {
    return anyLaterEntries[anyLaterEntries.length - 1]; // Closest later
  }

  // No suitable match found
  return null;
}

/**
 * Fetches the catalog entry from DCS API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git reference
 * @param {string} dcs_api_url - Base URL for DCS API
 * @returns {Promise<Object>} The catalog entry data
 */
export async function getCatalogEntry(
  owner,
  repo,
  ref,
  dcs_api_url = 'https://git.door43.org/api/v1'
) {
  try {
    const url = `${dcs_api_url}/catalog/entry/${owner}/${repo}/${ref}`;
    console.log(url);
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get catalog entry: ${error.message}`);
  }
}

/**
 * Fetch catalog entry from a relation
 * @param {Object} relation - The relation object
 * @param {Object} mainCatalogEntry - The main catalog entry
 * @param {string} dcs_api_url - DCS API base URL
 * @returns {Promise<Object|null>} The catalog entry or null if not found
 */
async function fetchCatalogEntryFromRelation(relation, mainCatalogEntry, dcs_api_url) {
  try {
    let owner =
      mainCatalogEntry.repo?.owner?.username ||
      mainCatalogEntry.repo?.owner?.login ||
      mainCatalogEntry.owner;

    // Special handling for uhb and ugnt
    if (relation.identifier === 'uhb' || relation.identifier === 'ugnt') {
      owner = 'unfoldingWord';
    }

    let searchUrl;

    if (relation.version) {
      // Version specified - search by tag
      searchUrl = `${dcs_api_url}/catalog/search?owner=${owner}&abbreviation=${relation.identifier}&lang=${relation.lang}&tag=v${relation.version}&includeHistory=1`;
    } else if (mainCatalogEntry.ref_type === 'branch') {
      // No version and main is a branch - get latest
      searchUrl = `${dcs_api_url}/catalog/search?owner=${owner}&abbreviation=${relation.identifier}&lang=${relation.lang}&stage=latest`;
    } else {
      // No version and main is a tag - search with history and match by date
      const stage = mainCatalogEntry.stage || 'latest';
      searchUrl = `${dcs_api_url}/catalog/search?owner=${owner}&abbreviation=${relation.identifier}&lang=${relation.lang}&stage=${stage}&includeHistory=1`;
    }

    console.log(searchUrl);
    const response = await axios.get(searchUrl);

    if (response.data && response.data.data && response.data.data.length > 0) {
      if (relation.version || mainCatalogEntry.ref_type === 'branch') {
        // Return first result for version-specific or branch queries
        return response.data.data[0];
      } else {
        // Find best match by date for tag queries
        return findBestCatalogEntryByDate(response.data.data, mainCatalogEntry.released);
      }
    }

    return null;
  } catch (error) {
    console.warn(`Failed to fetch relation ${relation.identifier}:`, error.message);
    return null;
  }
}

/**
 * Get all catalog entries needed for rendering a resource
 *
 * @param {string|Object} ownerOrCatalogEntry - Repository owner OR catalog entry object
 * @param {string|Array} [repoOrBooks] - Repository name OR books array
 * @param {string|Object} [refOrOptions] - Git reference OR options object with dcs_api_url
 * @param {Array} [booksOrUndefined] - Books array (when first param is owner)
 * @param {Object} [optionsOrUndefined] - Options object (when first param is owner)
 * @returns {Promise<Array>} Array of catalog entries [main, ...required]
 *
 * @example
 * // Using owner/repo/ref
 * const entries = await getAllCatalogEntriesForRendering(
 *   'unfoldingWord',
 *   'en_tn',
 *   'v87',
 *   ['1th'],
 *   { dcs_api_url: 'https://git.door43.org/api/v1' }
 * );
 *
 * @example
 * // Using catalog entry object
 * const entries = await getAllCatalogEntriesForRendering(
 *   catalogEntry,
 *   ['tit']
 * );
 */
export async function getAllCatalogEntriesForRendering(
  ownerOrCatalogEntry,
  repoOrBooks,
  refOrOptions,
  booksOrUndefined,
  optionsOrUndefined
) {
  let catalogEntry;
  let books = [];
  let dcs_api_url = 'https://git.door43.org/api/v1';

  // Determine which signature was used
  if (typeof ownerOrCatalogEntry === 'string') {
    // First signature: (owner, repo, ref, books?, options?)
    const owner = ownerOrCatalogEntry;
    const repo = repoOrBooks;
    const ref = refOrOptions;
    books = booksOrUndefined || [];
    const options = optionsOrUndefined || {};
    dcs_api_url = options.dcs_api_url || dcs_api_url;

    catalogEntry = await getCatalogEntry(owner, repo, ref, dcs_api_url);
  } else {
    // Second signature: (catalogEntry, books?, options?)
    catalogEntry = ownerOrCatalogEntry;
    books = Array.isArray(repoOrBooks) ? repoOrBooks : [];
    const options =
      typeof repoOrBooks === 'object' && !Array.isArray(repoOrBooks)
        ? repoOrBooks
        : refOrOptions || {};

    // Extract dcs_api_url from catalogEntry.url
    if (catalogEntry.url) {
      const urlParts = catalogEntry.url.split('/');
      if (urlParts.length >= 3) {
        dcs_api_url = `${urlParts[0]}//${urlParts[2]}/${urlParts[3]}`;
      }
    }
    if (options.dcs_api_url) {
      dcs_api_url = options.dcs_api_url;
    }
  }

  if (!catalogEntry) {
    throw new Error('Catalog entry not found.');
  }

  const result = [catalogEntry];
  const subject = catalogEntry.subject;
  const requiredSubjects = requiredSubjectsMap[subject] || [];

  if (requiredSubjects.length === 0) {
    return result;
  }

  const owner =
    catalogEntry.repo?.owner?.username || catalogEntry.repo?.owner?.login || catalogEntry.owner;
  const stage = catalogEntry.stage || 'latest';
  const lang = catalogEntry.language;

  // Determine which testaments are needed based on the books
  const { needsOldTestament, needsNewTestament } = determineNeededTestaments(books);

  // Track which subjects we've found
  const foundSubjects = new Map(); // subject -> catalogEntry

  // First, process relations from the main catalog entry
  if (catalogEntry.relations && Array.isArray(catalogEntry.relations)) {
    for (const relation of catalogEntry.relations) {
      const relatedSubject = mapIdentifierToSubject(relation.identifier);

      if (relatedSubject && requiredSubjects.includes(relatedSubject)) {
        // Skip if we don't need this testament
        if (relatedSubject === 'Hebrew Old Testament' && !needsOldTestament) {
          continue;
        }
        if (relatedSubject === 'Greek New Testament' && !needsNewTestament) {
          continue;
        }

        // Try to fetch the catalog entry for this relation
        const relatedEntry = await fetchCatalogEntryFromRelation(
          relation,
          catalogEntry,
          dcs_api_url
        );

        if (relatedEntry) {
          // Validate books if needed
          const needsBookValidation =
            books.length > 0 &&
            ((relatedSubject.startsWith('TSV') && !relatedSubject.startsWith('TSV OBS')) ||
              relatedSubject === 'Bible' ||
              relatedSubject === 'Aligned Bible' ||
              relatedSubject === 'Hebrew Old Testament' ||
              relatedSubject === 'Greek New Testament');

          if (needsBookValidation) {
            let booksToCheck = books;
            if (relatedSubject === 'Hebrew Old Testament') {
              booksToCheck = books.filter((book) => {
                const bookData = BibleBookData[book.toLowerCase()];
                return bookData && bookData.testament === 'old';
              });
            } else if (relatedSubject === 'Greek New Testament') {
              booksToCheck = books.filter((book) => {
                const bookData = BibleBookData[book.toLowerCase()];
                return bookData && bookData.testament === 'new';
              });
            }

            // Check if entry has all required books
            if (relatedEntry.ingredients && relatedEntry.ingredients.length > 0) {
              const entryBooks = relatedEntry.ingredients.map((i) => i.identifier);
              const hasAllBooks = booksToCheck.every((book) => entryBooks.includes(book));

              if (hasAllBooks) {
                foundSubjects.set(relatedSubject, relatedEntry);
              }
            }
          } else {
            // No book validation needed
            foundSubjects.set(relatedSubject, relatedEntry);
          }
        }
      }
    }
  }

  // Now handle any missing required subjects by searching
  for (const requiredSubject of requiredSubjects) {
    // Skip if we already found this subject from relations
    if (foundSubjects.has(requiredSubject)) {
      continue;
    }

    // Skip Hebrew OT if only NT books are requested
    if (requiredSubject === 'Hebrew Old Testament' && !needsOldTestament) {
      continue;
    }

    // Skip Greek NT if only OT books are requested
    if (requiredSubject === 'Greek New Testament' && !needsNewTestament) {
      continue;
    }

    let searchOwner = owner;
    let searchLang = lang;

    // Special handling for Hebrew OT and Greek NT
    if (requiredSubject === 'Hebrew Old Testament') {
      searchOwner = 'unfoldingWord';
      searchLang = 'hbo';
    } else if (requiredSubject === 'Greek New Testament') {
      searchOwner = 'unfoldingWord';
      searchLang = 'el-x-koine';
    }

    // Get identifier(s) for this subject
    const identifier = subjectIdentifierMap[requiredSubject];
    let repoNames = [];

    if (Array.isArray(identifier)) {
      repoNames = identifier.map((id) => `${searchLang}_${id}`);
    } else if (identifier && identifier.includes('/')) {
      const [idOwner, idRepo] = identifier.split('/');
      searchOwner = idOwner;
      repoNames = [idRepo];
    } else if (identifier) {
      repoNames = [`${searchLang}_${identifier}`];
    } else {
      throw new Error(`No identifier mapping found for subject: ${requiredSubject}`);
    }

    let foundEntry = null;

    // Determine search parameters based on whether main entry is branch or tag
    const isMainBranch = catalogEntry.ref_type === 'branch';
    const searchStage = isMainBranch ? 'latest' : stage;
    const includeHistory = isMainBranch ? '' : '&includeHistory=1';

    // Try each possible repo name
    for (const repoName of repoNames) {
      try {
        const searchUrl = `${dcs_api_url}/catalog/search?owner=${searchOwner}&repo=${repoName}&stage=${searchStage}&lang=${searchLang}${includeHistory}`;
        console.log(searchUrl);
        const searchResponse = await axios.get(searchUrl);

        if (
          searchResponse.data &&
          searchResponse.data.data &&
          searchResponse.data.data.length > 0
        ) {
          // Filter by subject match
          let matchingEntries = searchResponse.data.data.filter(
            (entry) => entry.subject === requiredSubject
          );

          // If main entry is a tag, find the best match by release date
          if (!isMainBranch && matchingEntries.length > 0 && catalogEntry.released) {
            matchingEntries = [findBestCatalogEntryByDate(matchingEntries, catalogEntry.released)];
          }

          // Determine if this subject needs book validation
          const needsBookValidation =
            (books.length > 0 &&
              requiredSubject.startsWith('TSV') &&
              !requiredSubject.startsWith('TSV OBS')) ||
            requiredSubject === 'Bible' ||
            requiredSubject === 'Aligned Bible' ||
            requiredSubject === 'Hebrew Old Testament' ||
            requiredSubject === 'Greek New Testament';

          if (!needsBookValidation) {
            // No books filter needed, use first matching entry
            if (matchingEntries.length > 0) {
              foundEntry = matchingEntries[0];
              break;
            }
          } else {
            // Determine which books to check based on subject
            let booksToCheck = books;
            if (requiredSubject === 'Hebrew Old Testament') {
              // Only check Old Testament books
              booksToCheck = books.filter((book) => {
                const bookData = BibleBookData[book.toLowerCase()];
                return bookData && bookData.testament === 'old';
              });
            } else if (requiredSubject === 'Greek New Testament') {
              // Only check New Testament books
              booksToCheck = books.filter((book) => {
                const bookData = BibleBookData[book.toLowerCase()];
                return bookData && bookData.testament === 'new';
              });
            }

            // Find entry with all requested books (filtered by testament if applicable)
            for (const entry of matchingEntries) {
              if (entry.ingredients && entry.ingredients.length > 0) {
                const entryBooks = entry.ingredients.map((i) => i.identifier);
                const hasAllBooks = booksToCheck.every((book) => entryBooks.includes(book));
                if (hasAllBooks) {
                  foundEntry = entry;
                  break;
                }
              }
            }
            if (foundEntry) break;
          }
        }
      } catch (error) {
        console.warn(`Failed to search for ${requiredSubject} (${repoName}):`, error.message);
        // Continue to next repo name
      }
    }

    if (!foundEntry) {
      const needsBookValidation =
        books.length > 0 &&
        ((requiredSubject.startsWith('TSV') && !requiredSubject.startsWith('TSV OBS')) ||
          requiredSubject === 'Bible' ||
          requiredSubject === 'Aligned Bible' ||
          requiredSubject === 'Hebrew Old Testament' ||
          requiredSubject === 'Greek New Testament');

      if (needsBookValidation) {
        // Determine which books were being checked
        let relevantBooks = books;
        if (requiredSubject === 'Hebrew Old Testament') {
          relevantBooks = books.filter((book) => {
            const bookData = BibleBookData[book.toLowerCase()];
            return bookData && bookData.testament === 'old';
          });
        } else if (requiredSubject === 'Greek New Testament') {
          relevantBooks = books.filter((book) => {
            const bookData = BibleBookData[book.toLowerCase()];
            return bookData && bookData.testament === 'new';
          });
        }

        throw new Error(
          `No catalog entry found for required subject "${requiredSubject}" with all requested books: ${relevantBooks.join(', ')}`
        );
      } else {
        throw new Error(`No catalog entry found for required subject: ${requiredSubject}`);
      }
    }

    foundSubjects.set(requiredSubject, foundEntry);
  }

  // Add all found subjects to result in the order they appear in requiredSubjects
  for (const requiredSubject of requiredSubjects) {
    if (foundSubjects.has(requiredSubject)) {
      result.push(foundSubjects.get(requiredSubject));
    }
  }

  return result;
}

/**
 * Get resource data from DCS
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git reference (branch, tag, or commit)
 * @param {Array} books - List of book identifiers to include (if applicable)
 * @param {Object} options - Options object
 * @param {string} options.dcs_api_url - DCS API base URL (default: https://git.door43.org/api/v1)
 * @param {boolean} is_extra - Whether to include extra data (default: false)
 * @returns {Promise<Object>} Catalog entry JSON object
 *
 * @example
 * const result = await getResourceData(
 *   'unfoldingWord',
 *   'en_tn',
 *   'master',
 *   { dcs_api_url: 'https://git.door43.org/api/v1' }
 * );
 * console.log(result);
 */
export async function getResourceData(
  owner,
  repo,
  ref,
  books = [],
  options = {},
  is_extra = false
) {
  const { dcs_api_url = 'https://git.door43.org/api/v1' } = options;

  options.is_extra = is_extra;

  let catalogEntry;
  try {
    catalogEntry = await getCatalogEntry(owner, repo, ref, dcs_api_url);
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }

  if (!catalogEntry) {
    throw new Error('Catalog entry not found.');
  }

  let metadataType = ''; // default
  let subject = '';
  let flavorType = '';
  let flavor = '';

  if (!catalogEntry.subject || !catalogEntry.ingredients || !catalogEntry.metadata_type) {
    if (
      catalogEntry.repo?.title &&
      catalogEntry.repo?.subject &&
      catalogEntry.repo?.ingredients &&
      catalogEntry.repo?.metadata_type
    ) {
      catalogEntry.title = catalogEntry.repo.title;
      catalogEntry.subject = catalogEntry.repo.subject;
      catalogEntry.ingredients = catalogEntry.repo.ingredients;
      catalogEntry.metadata_type = catalogEntry.repo.metadata_type;
      catalogEntry.flavor_type = catalogEntry.repo.flavor_type;
      catalogEntry.flavor = catalogEntry.repo.flavor;
    } else {
      throw new Error(
        `This references an invalid ${catalogEntry.ref_type ? catalogEntry.ref_type : 'entry'}. Unable to determine its type and/or ingredients.`
      );
    }
  }
  metadataType = catalogEntry.metadata_type;
  subject = catalogEntry.subject;
  flavorType = catalogEntry.flavor_type;
  flavor = catalogEntry.flavor;

  if (metadataType && subject) {
    if (!['rc', 'sb', 'ts', 'tc'].includes(metadataType)) {
      throw new Error(`Not a valid repository that can be convert.`);
    }
    switch (metadataType) {
      case 'rc':
        switch (subject) {
          case 'Aligned Bible':
          case 'Bible':
          case 'Greek New Testament':
          case 'Hebrew Old Testament':
            return getRcAlignedBibleData(catalogEntry, books, options);
          case 'Open Bible Stories':
            return getRcObsData(catalogEntry, options);
          case 'Translation Academy':
            return getRcTranslationAcademyData(catalogEntry, options);
          case 'TSV Study Notes':
            return getRcTsvStudyNotesData(catalogEntry, books, options);
          case 'TSV Study Questions':
            return getRcTsvStudyQuestionsData(catalogEntry, books, options);
          case 'TSV Translation Notes':
            return getRcTsvTranslationNotesData(catalogEntry, books, options);
          case 'TSV Translation Questions':
            return getRcTsvTranslationQuestionsData(catalogEntry, books, options);
          case 'Translation Words':
            return getRcTranslationWordsData(catalogEntry, options);
          case 'TSV Translation Words Links':
            return getRcTsvTranslationWordsLinksData(catalogEntry, books, options);
          case 'TSV OBS Study Notes':
            return getRcTsvObsStudyNotesData(catalogEntry, options);
          case 'TSV OBS Study Questions':
            return getRcTsvObsStudyQuestionsData(catalogEntry, options);
          case 'TSV OBS Translation Notes':
            getRcTsvObsTranslationNotesData(catalogEntry, options);
          case 'TSV OBS Translation Questions':
            return getRcTsvObsTranslationQuestionsData(catalogEntry, options);
          case 'TSV OBS Translation Words Links':
            return getRcTsvObsTranslationWordsLinksData(catalogEntry, options);
          default:
            setErrorMessage(`Conversion of \`${subject}\` resources is currently not supported.`);
        }
      case 'sb':
        switch (flavorType) {
          case 'scripture':
            switch (flavor) {
              case 'textTranslation':
                return getSbBibleData(catalogEntry, books, options);
              default:
                throw new Error(
                  `Conversion of SB flavor \`${flavor}\` is not currently supported.`
                );
            }
          case 'gloss':
            switch (catalogEntry.flavor) {
              case 'textStories':
                return getSbObsData(catalogEntry, options);
            }
          default:
            throw new Error(
              `Conversion of SB flavor type \`${flavorType}\` is not currently supported.`
            );
        }
      case 'ts':
        switch (subject) {
          case 'Open Bible Stories':
            return getTsObsData(catalogEntry, options);
          case 'Bible':
            return getTsBibleData(catalogEntry, books, options);
          default:
            throw error('Conversion of translationStudio repositories is currently not supported.');
        }
      case 'tc':
        switch (subject) {
          case 'Aligned Bible':
          case 'Bible':
            return getTcBibleData(catalogEntry, books, options);
          default:
            throw new Error(
              `Conversion of translationCore \`${subject}\` repositories is currently not supported.`
            );
        }
      default:
        throw new Error(
          `Conversion of \`${metadataType}\` repositories is currently not supported.`
        );
    }
  } else {
    throw new Error('Catalog entry is missing required metadata.');
  }
}

/**
 * Get resource data for RC Aligned Bible
 */
async function getRcAlignedBibleData(catalogEntry, books, options) {
  return {
    flavorType: catalogEntry.flavor_type,
    flavor: catalogEntry.flavor,
    subject: catalogEntry.subject,
    ingredients: catalogEntry.ingredients.map((i) => i.identifier),
    title: catalogEntry.title,
    books: await getBookChapterVersesData(catalogEntry, books, options),
    options,
  };
}

/**
 * Get resource data for RC OBS
 */
async function getRcObsData(catalogEntry, options) {
  const ingredient = catalogEntry.ingredients && catalogEntry.ingredients[0];
  if (!ingredient) {
    throw new Error('No ingredients found in catalog entry');
  }

  const data = await extractRcSbObsData(catalogEntry, ingredient);
  return formatObsData(data, catalogEntry);
}

/**
 * Get resource data for RC Translation Academy
 */
async function getRcTranslationAcademyData(catalogEntry, options) {
  return await extractRcTaData(catalogEntry, options);
}

/**
 * Get resource data for RC TSV Study Notes
 */
async function getRcTsvStudyNotesData(catalogEntry, books, options) {
  const requiredSubjects = ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament'];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC TSV Study Questions
 */
async function getRcTsvStudyQuestionsData(catalogEntry, books, options) {
  const requiredSubjects = ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament'];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC TSV Translation Notes
 */
async function getRcTsvTranslationNotesData(catalogEntry, books, options) {
  const requiredSubjects = [
    'Aligned Bible',
    'Translation Academy',
    'Translation Words',
    'TSV Translation Words Links',
    'Hebrew Old Testament',
    'Greek New Testament',
  ];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC TSV Translation Questions
 */
async function getRcTsvTranslationQuestionsData(catalogEntry, books, options) {
  const requiredSubjects = ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament'];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC Translation Words
 */
async function getRcTranslationWordsData(catalogEntry, options) {
  return await extractRcTwData(catalogEntry, options);
}

/**
 * Get resource data for RC TSV Translation Words Links
 */
async function getRcTsvTranslationWordsLinksData(catalogEntry, books, options) {
  const requiredSubjects = [
    'Aligned Bible',
    'Hebrew Old Testament',
    'Greek New Testament',
    'Translation Words',
  ];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC TSV OBS Study Notes
 */
async function getRcTsvObsStudyNotesData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const requiredSubjects = ['Open Bible Stories'];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC TSV OBS Study Questions
 */
async function getRcTsvObsStudyQuestionsData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const requiredSubjects = ['Open Bible Stories'];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC TSV OBS Translation Notes
 */
async function getRcTsvObsTranslationNotesData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const requiredSubjects = [
    'Open Bible Stories',
    'TSV OBS Translation Words Links',
    'Translation Academy',
    'Translation Words',
  ];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC TSV OBS Translation Questions
 */
async function getRcTsvObsTranslationQuestionsData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const requiredSubjects = ['Open Bible Stories'];
  return await extractRcTsvData(catalogEntry, books, options, requiredSubjects);
}

/**
 * Get resource data for RC TSV OBS Translation Words Links
 */
async function getRcTsvObsTranslationWordsLinksData(catalogEntry, options) {
  return {
    flavorType: catalogEntry.flavor_type,
    flavor: catalogEntry.flavor,
    subject: catalogEntry.subject,
    ingredients: catalogEntry.ingredients.map((i) => i.identifier),
    title: catalogEntry.title,
    options,
  };
}

/**
 * Get resource data for SB Bible
 */
async function getSbBibleData(catalogEntry, books, options) {
  return {
    flavorType: catalogEntry.flavor_type,
    flavor: catalogEntry.flavor,
    subject: catalogEntry.subject,
    ingredients: catalogEntry.ingredients.map((i) => i.identifier),
    title: catalogEntry.title,
    books,
    options,
  };
}

/**
/**
 * Get resource data for SB OBS
 */
async function getSbObsData(catalogEntry, options) {
  const ingredient = catalogEntry.ingredients && catalogEntry.ingredients[0];
  if (!ingredient) {
    throw new Error('No ingredients found in catalog entry');
  }

  const data = await extractRcSbObsData(catalogEntry, ingredient);
  return formatObsData(data, catalogEntry);
}
/**
/**
 * Get resource data for TS OBS
 */
async function getTsObsData(catalogEntry, options) {
  const ingredient = catalogEntry.ingredients && catalogEntry.ingredients[0];
  if (!ingredient) {
    throw new Error('No ingredients found in catalog entry');
  }

  const data = await extractTsObsData(catalogEntry, ingredient);
  return formatObsData(data, catalogEntry);
}
/**
 * Get resource data for TS Bible
 */
async function getTsBibleData(catalogEntry, books, options) {
  return {
    flavorType: catalogEntry.flavor_type,
    flavor: catalogEntry.flavor,
    subject: catalogEntry.subject,
    ingredients: catalogEntry.ingredients.map((i) => i.identifier),
    title: catalogEntry.title,
    books,
    options,
  };
}

/**
 * Get resource data for TC Bible
 */
async function getTcBibleData(catalogEntry, books, options) {
  return {
    flavorType: catalogEntry.flavor_type,
    flavor: catalogEntry.flavor,
    subject: catalogEntry.subject,
    ingredients: catalogEntry.ingredients.map((i) => i.identifier),
    title: catalogEntry.title,
    books,
    options,
  };
}

/**
 * Fetches extra resources based on required subjects
 * @param {Object} catalogEntry - The main catalog entry
 * @param {string} dcs_api_url - Base URL for DCS API
 * @param {Array<string>} requiredSubjects - List of required subjects
 * @returns {Promise<Object>} The extra resources
 */
export async function getExtraResources(catalogEntry, books, dcs_api_url, requiredSubjects) {
  const owner = catalogEntry.owner;
  const lang = catalogEntry.language;
  const ref = 'master' || catalogEntry.branch_or_tag_name;

  const extras = {};

  for (const subject of requiredSubjects) {
    const identifier = subjectIdentifierMap[subject];
    if (Array.isArray(identifier)) {
      for (const id of identifier) {
        if (!extras[id]) {
          try {
            const entry = await getCatalogEntry(owner, `${lang}_${id}`, ref, dcs_api_url);
            if (entry.subject === subject) {
              extras[id] = await getResourceData(
                owner,
                `${lang}_${id}`,
                ref,
                books,
                { dcs_api_url },
                true
              );
            }
          } catch (e) {
            console.warn(`Failed to fetch extra subject ${subject} (${id}):`, e);
          }
        }
      }
    } else if (identifier.includes('/')) {
      if (!extras[identifier]) {
        try {
          const [o, r] = identifier.split('/');
          const entry = await getCatalogEntry(o, r, ref, dcs_api_url);
          if (entry.subject === subject) {
            extras[r] = await getResourceData(o, r, ref, books, { dcs_api_url }, true);
          }
        } catch (e) {
          console.warn(`Failed to fetch extra subject ${subject} (${identifier}):`, e);
        }
      }
    } else {
      if (!extras[identifier]) {
        try {
          const entry = await getCatalogEntry(owner, `${lang}_${identifier}`, ref, dcs_api_url);
          if (entry.subject === subject) {
            extras[identifier] = await getResourceData(
              owner,
              `${lang}_${identifier}`,
              ref,
              books,
              { dcs_api_url },
              true
            );
          }
        } catch (e) {
          console.warn(`Failed to fetch extra subject ${subject} (${identifier}):`, e);
        }
      }
    }
  }

  return extras;
}
