import { extractRcSbObsData, extractTsObsData, formatObsData } from './obsHelpers.js';
import { extractRcTsvData } from './tsvHelpers.js';
import { extractRcTwData } from './twHelpers.js';
import { extractRcTaData } from './taHelpers.js';
import { extractRcAlignedBibleData } from './rcAlignedBibleHelpers.js';
import { requiredSubjectsMap, subjectIdentifierMap } from './constants.js';
import { getAllCatalogEntriesForRendering } from './getAllCatalogEntriesForRendering.js';
import axios from 'axios';

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
 * Fetches the catalog entry from DCS API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git reference
 * @param {string} dcs_api_url - Base URL for DCS API
 * @param {boolean} quiet - Suppress logging output
 * @returns {Promise<Object>} The catalog entry data
 */
export async function getCatalogEntry(
  owner,
  repo,
  ref,
  dcs_api_url = 'https://git.door43.org/api/v1',
  quiet = false
) {
  isQuiet = quiet;
  try {
    const url = `${dcs_api_url}/catalog/entry/${owner}/${repo}/${ref}`;
    log(url);
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get catalog entry: ${error.message}`);
  }
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
  const { dcs_api_url = 'https://git.door43.org/api/v1', quiet = false } = options;

  options.is_extra = is_extra;

  let catalogEntry;
  try {
    catalogEntry = await getCatalogEntry(owner, repo, ref, dcs_api_url, quiet);
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
  return await extractRcAlignedBibleData(catalogEntry, books, options);
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
  // Use getAllCatalogEntriesForRendering to get all required dependencies
  const { catalogEntries } = await getAllCatalogEntriesForRendering(catalogEntry, books, options);

  // Pass the catalog entries to extractRcTsvData
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV Study Questions
 */
async function getRcTsvStudyQuestionsData(catalogEntry, books, options) {
  // Use getAllCatalogEntriesForRendering to get all required dependencies
  const { catalogEntries } = await getAllCatalogEntriesForRendering(catalogEntry, books, options);

  // Pass the catalog entries to extractRcTsvData
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV Translation Notes
 */
async function getRcTsvTranslationNotesData(catalogEntry, books, options) {
  // Use getAllCatalogEntriesForRendering to get all required dependencies
  const { catalogEntries } = await getAllCatalogEntriesForRendering(catalogEntry, books, options);

  // Pass the catalog entries to extractRcTsvData
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV Translation Questions
 */
async function getRcTsvTranslationQuestionsData(catalogEntry, books, options) {
  // Use getAllCatalogEntriesForRendering to get all required dependencies
  const { catalogEntries } = await getAllCatalogEntriesForRendering(catalogEntry, books, options);

  // Pass the catalog entries to extractRcTsvData
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
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
  // Use getAllCatalogEntriesForRendering to get all required dependencies
  const { catalogEntries } = await getAllCatalogEntriesForRendering(catalogEntry, books, options);

  // Pass the catalog entries to extractRcTsvData
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV Translation Words Links (OLD - TO BE REMOVED)
 */
async function getRcTsvTranslationWordsLinksDataOLD(catalogEntry, books, options) {
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
 * @param {boolean} quiet - Suppress logging output
 * @returns {Promise<Object>} The extra resources
 */
export async function getExtraResources(
  catalogEntry,
  books,
  dcs_api_url,
  requiredSubjects,
  quiet = false
) {
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
            const entry = await getCatalogEntry(owner, `${lang}_${id}`, ref, dcs_api_url, quiet);
            if (entry.subject === subject) {
              extras[id] = await getResourceData(
                owner,
                `${lang}_${id}`,
                ref,
                books,
                { dcs_api_url, quiet },
                true
              );
            }
          } catch (e) {
            if (!quiet) {
              console.warn(`Failed to fetch extra subject ${subject} (${id}):`, e);
            }
          }
        }
      }
    } else if (identifier.includes('/')) {
      if (!extras[identifier]) {
        try {
          const [o, r] = identifier.split('/');
          const entry = await getCatalogEntry(o, r, ref, dcs_api_url, quiet);
          if (entry.subject === subject) {
            extras[r] = await getResourceData(o, r, ref, books, { dcs_api_url, quiet }, true);
          }
        } catch (e) {
          if (!quiet) {
            console.warn(`Failed to fetch extra subject ${subject} (${identifier}):`, e);
          }
        }
      }
    } else {
      if (!extras[identifier]) {
        try {
          const entry = await getCatalogEntry(
            owner,
            `${lang}_${identifier}`,
            ref,
            dcs_api_url,
            quiet
          );
          if (entry.subject === subject) {
            extras[identifier] = await getResourceData(
              owner,
              `${lang}_${identifier}`,
              ref,
              books,
              { dcs_api_url, quiet },
              true
            );
          }
        } catch (e) {
          if (!quiet) {
            console.warn(`Failed to fetch extra subject ${subject} (${identifier}):`, e);
          }
        }
      }
    }
  }

  return extras;
}
