import axios from 'axios';
import { BibleBookData, requiredSubjectsMap, subjectIdentifierMap } from './constants.js';
import { getCatalogEntry } from './getResourceData.js';
import pkg from '../package.json' with { type: 'json' };

const { version } = pkg;

// Global quiet flag for logging
let isQuiet = false;

/**
 * Logging function that respects quiet flag
 * @param {...any} args - Arguments to log
 */
function log(...args) {
  if (!isQuiet) {
    console.log(...args);
  }
}

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

    log(searchUrl);
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
 * Search for Aligned Bible entries by subject
 * @param {Object} catalogEntry - The main catalog entry
 * @param {string} dcs_api_url - DCS API base URL
 * @param {Array} books - Array of book identifiers to check
 * @returns {Promise<Object|null>} The best matching Aligned Bible entry or null
 */
async function searchAlignedBibleBySubject(catalogEntry, dcs_api_url, books) {
  try {
    const owner =
      catalogEntry.repo?.owner?.username || catalogEntry.repo?.owner?.login || catalogEntry.owner;
    const lang = catalogEntry.language;
    const stage = catalogEntry.stage || 'latest';
    const isMainBranch = catalogEntry.ref_type === 'branch';

    const searchUrl = `${dcs_api_url}/catalog/search?owner=${owner}&lang=${lang}&subject=Aligned%20Bible&stage=${stage}&includeHistory=1`;
    log(searchUrl);
    const response = await axios.get(searchUrl);

    if (response.data && response.data.data && response.data.data.length > 0) {
      let matchingEntries = response.data.data;

      // If main entry is a tag (not a branch), find best match by release date
      if (!isMainBranch && catalogEntry.released) {
        const bestEntry = findBestCatalogEntryByDate(matchingEntries, catalogEntry.released);
        if (bestEntry) {
          matchingEntries = [bestEntry];
        }
      } else {
        // For branches, just use the first (most recent) entry
        matchingEntries = [matchingEntries[0]];
      }

      // If books are specified, check that the entry has those books
      if (books && books.length > 0) {
        for (const entry of matchingEntries) {
          if (entry.ingredients && entry.ingredients.length > 0) {
            const entryBooks = entry.ingredients.map((i) => i.identifier);
            const hasAllBooks = books.every((book) => entryBooks.includes(book));
            if (hasAllBooks) {
              return entry;
            }
          }
        }
        // If no entry has all books, return null
        return null;
      }

      // No book validation needed, return first matching entry
      return matchingEntries[0];
    }

    return null;
  } catch (error) {
    console.warn('Failed to search for Aligned Bible by subject:', error.message);
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
 * @returns {Promise<Object>} Object with version (string) and catalogEntries (array)
 *
 * @example
 * // Using owner/repo/ref
 * const result = await getAllCatalogEntriesForRendering(
 *   'unfoldingWord',
 *   'en_tn',
 *   'v87',
 *   ['1th'],
 *   { dcs_api_url: 'https://git.door43.org/api/v1' }
 * );
 * console.log(result.version); // "1.4.0"
 * console.log(result.catalogEntries.length); // Number of entries
 *
 * @example
 * // Using catalog entry object
 * const result = await getAllCatalogEntriesForRendering(
 *   catalogEntry,
 *   ['tit']
 * );
 * console.log(result.catalogEntries[0]); // Main entry
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
    isQuiet = options.quiet || false;

    catalogEntry = await getCatalogEntry(owner, repo, ref, dcs_api_url, isQuiet);
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
    isQuiet = options.quiet || false;
  }

  if (!catalogEntry) {
    throw new Error('Catalog entry not found.');
  }

  const catalogEntries = [catalogEntry];
  const subject = catalogEntry.subject;
  const requiredSubjects = requiredSubjectsMap[subject] || [];

  if (requiredSubjects.length === 0) {
    return { version, catalogEntries };
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
        log(searchUrl);
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

    // Special handling for Aligned Bible if not found through standard repo names
    if (!foundEntry && requiredSubject === 'Aligned Bible') {
      log('Standard Aligned Bible repos not found, searching by subject...');
      foundEntry = await searchAlignedBibleBySubject(catalogEntry, dcs_api_url, books);
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

  // Add all found subjects to catalogEntries in the order they appear in requiredSubjects
  for (const requiredSubject of requiredSubjects) {
    if (foundSubjects.has(requiredSubject)) {
      catalogEntries.push(foundSubjects.get(requiredSubject));
    }
  }

  return { version, catalogEntries };
}
