import { ResourceError } from './errors.js';
import { dcsApiUrlOf, splitInternalOptions } from './options.js';
import {
  extractRcSbObsData,
  extractTsObsData,
  formatObsData,
  getObsContentPath,
} from './obsHelpers.js';
import { extractRcTsvData } from './tsvHelpers.js';
import { extractRcTwData } from './twHelpers.js';
import { extractRcTaData } from './taHelpers.js';
import { extractRcAlignedBibleData } from './rcAlignedBibleHelpers.js';
import { extractTsBibleData } from './tsBibleHelpers.js';
import { filterCatalogEntries } from './catalogSelection.js';
import { directoryContentSource } from './contentSource.js';
import { getAllCatalogEntries } from './getAllCatalogEntries.js';
import axios from 'axios';
import { loggerFor } from './logger.js';
import { REQUEST_TIMEOUT_MS } from './dcsApi.js';

/**
 * Fetches the catalog entry from DCS API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git reference
 * @param {string} dcs_api_url - Base URL for DCS API
 * @param {boolean} quiet - Suppress progress logging (the URL fetched)
 * @param {Object} [logger] - `{ info, warn }` in place of the console (see logger.js)
 * @returns {Promise<Object>} The catalog entry data
 */
export async function getCatalogEntry(
  owner,
  repo,
  ref,
  dcs_api_url = 'https://git.door43.org/api/v1',
  quiet = false,
  logger
) {
  const url = `${dcs_api_url}/catalog/entry/${owner}/${repo}/${ref}`;
  try {
    loggerFor({ quiet, logger }).info(url);
    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
    return response.data;
  } catch (error) {
    throw ResourceError.fromRequest('Failed to get catalog entry', error, url);
  }
}

/**
 * Fetch and parse a resource (and its dependencies) into ResourceData. Stage 2
 * of the pipeline.
 *
 * @param {Object} input - One of:
 *   - a descriptor `{ owner, repo, ref, books? }`
 *   - a **CatalogSet** from getAllCatalogEntries() (reused — no second /catalog/bp/ call)
 *   - a catalog entry object
 *   - existing **ResourceData** (returned unchanged — passthrough)
 * @param {Object} [options]
 * @param {string} [options.dcsApiUrl] - DCS API base URL (default: https://git.door43.org/api/v1)
 * @param {boolean} [options.quiet] - Suppress progress logging (warnings still reach the logger)
 * @param {Object} [options.logger] - `{ info, warn }` in place of the console
 * @param {Array<string>} [options.books] - Books (when not carried on `input`)
 * @param {Array<string>} [options.extraSubjects] - Blueprint subjects to fetch as
 *   extras beyond the ones the subject requires, e.g. `['TSV Translation
 *   Questions']` so Translation Notes can show the questions under each verse
 * @param {number} [options.archiveMaxBytes] - Largest repository archive accepted
 *   (TA, TW, OBS, tS are read from their archive; default 100 MB)
 * @param {number} [options.archiveTimeoutMs] - Archive download time limit (default 120 s)
 * @param {Object} [internal] - Private plumbing between this call and its extras
 *   (`isExtra`, `catalogEntry`, `glBibleEntries`, `contentSource`); not for callers.
 *   The same keys on `options` are ignored
 * @returns {Promise<Object>} ResourceData
 *
 * @example
 * const data = await getResourceData({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v89', books: ['tit'] });
 * // or reuse a CatalogSet:
 * const set = await getAllCatalogEntries({ owner: 'unfoldingWord', repo: 'en_tn', ref: 'v89', books: ['tit'] });
 * const data2 = await getResourceData(set);
 */
const RESOURCE_TYPES = new Set(['usfm', 'tsv', 'obs', 'ta', 'tw']);

export async function getResourceData(input, rawOptions = {}, internal = {}) {
  // ResourceData passthrough — already parsed upstream or restored from cache.
  if (input && typeof input === 'object' && RESOURCE_TYPES.has(input.type) && input.subject) {
    return input;
  }

  // `options` are the caller's; `context` adds the plumbing between this call
  // and its extras (the private third argument), and is what the extractors get.
  const { options, context } = splitInternalOptions(rawOptions, internal);
  const quiet = options.quiet || false;

  // Books selection comes from the descriptor / CatalogSet source, or options.
  const books =
    (input && input.books) || (input && input.source && input.source.books) || options.books || [];

  let catalogEntry;
  if (context.catalogEntry) {
    // Parent passed a pre-resolved entry (e.g. when fetching an extra) — avoids a
    // redundant /catalog/entry/ round-trip.
    catalogEntry = context.catalogEntry;
  } else if (input && Array.isArray(input.catalogEntries)) {
    // CatalogSet — reuse it. The main entry is first, and the filtered-entries
    // step reuses these (via context.preEntries) instead of re-calling /catalog/bp/.
    catalogEntry = input.catalogEntries[0];
    context.preEntries = input.catalogEntries;
  } else if (input && input.ref && input.repo) {
    // Descriptor { owner, repo, ref }
    catalogEntry = await getCatalogEntry(
      input.owner,
      input.repo,
      input.ref,
      dcsApiUrlOf(options),
      quiet,
      options.logger
    );
  } else if (input && (input.name || input.branch_or_tag_name || input.ingredients)) {
    // A catalog entry object
    catalogEntry = input;
  } else {
    throw new ResourceError(
      'getResourceData: input must be { owner, repo, ref }, a catalog entry, a CatalogSet, or ResourceData.',
      { code: 'INVALID_INPUT' }
    );
  }

  if (!catalogEntry) {
    throw new ResourceError('Catalog entry not found.', { code: 'NOT_FOUND' });
  }

  return withLanguage(await extractResourceData(catalogEntry, books, context), catalogEntry);
}

/**
 * Stage 2′: the same ResourceData as getResourceData(), read from repositories
 * checked out on disk instead of DCS.
 *
 * `dirPath` holds one folder per repository, named as its catalog entry names
 * it (`en_tn`, `en_ult`, `hbo_uhb`, …), checked out at the version the entry
 * gives. The catalog entries say what each repository is and where its files
 * are (subject, metadata type, ingredient paths), so no manifest is read; take
 * them from getAllCatalogEntries() (its CatalogSet can be passed whole, or saved
 * and reused offline). The blueprint rules apply as online: only the supporting
 * resources the subject needs are read (plus `extraSubjects`), and each must be
 * checked out too; one that is missing is skipped, as an unreachable extra is
 * online.
 *
 * @param {Array<Object>|Object} catalogEntries - Full catalog entries, main
 *   resource first, or a CatalogSet
 * @param {string} dirPath - The directory holding the checked-out repositories
 * @param {Object} [options] - getResourceData()'s options (`books`, `extraSubjects`, `quiet`)
 * @returns {Promise<Object>} ResourceData
 */
export async function getResourceDataFromDirectory(catalogEntries, dirPath, options = {}) {
  const set = Array.isArray(catalogEntries) ? { catalogEntries } : catalogEntries;
  if (!set || !Array.isArray(set.catalogEntries) || set.catalogEntries.length === 0) {
    throw new ResourceError(
      'getResourceDataFromDirectory: pass the catalog entries (main resource first) or a CatalogSet.',
      { code: 'INVALID_INPUT' }
    );
  }
  if (typeof dirPath !== 'string' || !dirPath) {
    throw new ResourceError('getResourceDataFromDirectory: dirPath must name a directory.', {
      code: 'INVALID_INPUT',
    });
  }
  return getResourceData({ catalogEntries: set.catalogEntries, source: set.source }, options, {
    contentSource: directoryContentSource(dirPath),
  });
}

/**
 * Copy the catalog entry's language onto the extracted data: `language` (code,
 * e.g. `ar`), `languageTitle`, `direction` (`'ltr'` | `'rtl'`, from
 * `language_direction`) and `isGatewayLanguage`. Only what the entry says is
 * copied, and a value the extractor set itself is kept. renderHtmlData() carries
 * `language` and `direction` on to the document's `lang` and `dir`.
 */
function withLanguage(data, catalogEntry) {
  if (!data || typeof data !== 'object') return data;
  const pick = (key) => catalogEntry[key] ?? catalogEntry.repo?.[key];
  const fields = {};
  if (pick('language')) fields.language = pick('language');
  if (pick('language_title')) fields.languageTitle = pick('language_title');
  const direction = pick('language_direction');
  if (direction === 'rtl' || direction === 'ltr') fields.direction = direction;
  if (typeof pick('language_is_gl') === 'boolean')
    fields.isGatewayLanguage = pick('language_is_gl');
  const unset = (key) =>
    data[key] == null || (key === 'direction' && data[key] !== 'ltr' && data[key] !== 'rtl');
  const missing = Object.entries(fields).filter(([key]) => unset(key));
  return missing.length ? { ...data, ...Object.fromEntries(missing) } : data;
}

/**
 * Route a resolved catalog entry to the extractor for its metadata type,
 * subject and flavor.
 */
async function extractResourceData(catalogEntry, books, options) {
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
      throw new ResourceError(
        `This references an invalid ${catalogEntry.ref_type ? catalogEntry.ref_type : 'entry'}. Unable to determine its type and/or ingredients.`,
        { code: 'INVALID_INPUT' }
      );
    }
  }
  metadataType = catalogEntry.metadata_type;
  subject = catalogEntry.subject;
  flavorType = catalogEntry.flavor_type;
  flavor = catalogEntry.flavor;

  if (metadataType && subject) {
    if (!['rc', 'sb', 'ts', 'tc'].includes(metadataType)) {
      throw new ResourceError(`Not a valid repository that can be convert.`, {
        code: 'UNSUPPORTED',
      });
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
            return getRcTsvObsTranslationNotesData(catalogEntry, options);
          case 'TSV OBS Translation Questions':
            return getRcTsvObsTranslationQuestionsData(catalogEntry, options);
          case 'TSV OBS Translation Words Links':
            return getRcTsvObsTranslationWordsLinksData(catalogEntry, options);
          default:
            throw new ResourceError(
              `Conversion of \`${subject}\` resources is currently not supported.`,
              { code: 'UNSUPPORTED' }
            );
        }
      case 'sb':
        switch (flavorType) {
          case 'scripture':
            switch (flavor) {
              case 'textTranslation':
                return getSbBibleData(catalogEntry, books, options);
              default:
                throw new ResourceError(
                  `Conversion of SB flavor \`${flavor}\` is not currently supported.`,
                  { code: 'UNSUPPORTED' }
                );
            }
          case 'gloss':
            switch (catalogEntry.flavor) {
              case 'textStories':
                return getSbObsData(catalogEntry, options);
              default:
                throw new ResourceError(
                  `Conversion of SB gloss flavor \`${catalogEntry.flavor}\` is not currently supported.`,
                  { code: 'UNSUPPORTED' }
                );
            }
          default:
            throw new ResourceError(
              `Conversion of SB flavor type \`${flavorType}\` is not currently supported.`,
              { code: 'UNSUPPORTED' }
            );
        }
      case 'ts':
        switch (subject) {
          case 'Open Bible Stories':
            return getTsObsData(catalogEntry, options);
          case 'Bible':
            return getTsBibleData(catalogEntry, books, options);
          default:
            throw new ResourceError(
              'Conversion of translationStudio repositories is currently not supported.',
              { code: 'UNSUPPORTED' }
            );
        }
      case 'tc':
        switch (subject) {
          case 'Aligned Bible':
          case 'Bible':
            return getTcBibleData(catalogEntry, books, options);
          default:
            throw new ResourceError(
              `Conversion of translationCore \`${subject}\` repositories is currently not supported.`,
              { code: 'UNSUPPORTED' }
            );
        }
      default:
        throw new ResourceError(
          `Conversion of \`${metadataType}\` repositories is currently not supported.`,
          { code: 'UNSUPPORTED' }
        );
    }
  } else {
    throw new ResourceError('Catalog entry is missing required metadata.', {
      code: 'INVALID_INPUT',
    });
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
  if (!catalogEntry.ingredients?.length) {
    throw new ResourceError('No ingredients found in catalog entry', { code: 'INVALID_INPUT' });
  }

  const data = await extractRcSbObsData(
    catalogEntry,
    { path: getObsContentPath(catalogEntry) },
    options
  );
  return formatObsData(data, catalogEntry);
}

/**
 * Get resource data for RC Translation Academy
 */
async function getRcTranslationAcademyData(catalogEntry, options) {
  return await extractRcTaData(catalogEntry, options);
}

/**
 * Fetch and filter blueprint catalog entries to only include resources
 * that the given subject actually needs (per requiredSubjectsMap).
 *
 * The /catalog/bp/ endpoint is the source of truth for which resources
 * (and specific versions) are available for a book package. This function
 * filters those entries to the subjects the main resource actually needs
 * for rendering, applies Aligned Bible selection logic (at most 2,
 * preferring ult/glt + ust/gst), and drops the original-language Bible of a
 * testament the requested books do not touch — see filterCatalogEntries().
 *
 * When options.isExtra is set, skips the blueprint call entirely — extras should
 * not recursively fetch their own dependencies. When options.preEntries is set
 * (a CatalogSet was passed to getResourceData), those entries are reused instead
 * of re-fetching /catalog/bp/.
 */
async function getFilteredCatalogEntries(catalogEntry, books, options) {
  if (options.isExtra) {
    // Extras should not recursively fetch dependencies — return only the main entry
    return [catalogEntry];
  }

  // Reuse a CatalogSet passed into getResourceData (no second /catalog/bp/ call).
  const catalogEntries =
    options.preEntries ||
    (await getAllCatalogEntries(catalogEntry, { ...options, books })).catalogEntries;

  // The selection rules live in catalogSelection.js (exported, so a caller can
  // derive the same set from a CatalogSet without re-implementing them).
  return filterCatalogEntries(catalogEntries, {
    subject: catalogEntry.subject,
    books,
    extraSubjects: options.extraSubjects,
  });
}

/**
 * Get resource data for RC TSV Study Notes
 */
async function getRcTsvStudyNotesData(catalogEntry, books, options) {
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV Study Questions
 */
async function getRcTsvStudyQuestionsData(catalogEntry, books, options) {
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV Translation Notes
 */
async function getRcTsvTranslationNotesData(catalogEntry, books, options) {
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV Translation Questions
 */
async function getRcTsvTranslationQuestionsData(catalogEntry, books, options) {
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
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
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV OBS Study Notes
 */
async function getRcTsvObsStudyNotesData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV OBS Study Questions
 */
async function getRcTsvObsStudyQuestionsData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV OBS Translation Notes
 */
async function getRcTsvObsTranslationNotesData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV OBS Translation Questions
 */
async function getRcTsvObsTranslationQuestionsData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for RC TSV OBS Translation Words Links
 *
 * One TSV for every story (`Reference` is `story:frame`), read like the other
 * OBS TSV subjects. Its `OrigWords` are already Gateway Language words, the
 * OBS text being in the GL, so there is no quote lookup to do.
 */
async function getRcTsvObsTranslationWordsLinksData(catalogEntry, options) {
  // OBS doesn't use books parameter, extract all ingredients
  const books = catalogEntry.ingredients.map((i) => i.identifier);
  const catalogEntries = await getFilteredCatalogEntries(catalogEntry, books, options);
  return await extractRcTsvData(catalogEntry, books, options, catalogEntries);
}

/**
 * Get resource data for SB Bible (scripture / textTranslation)
 *
 * A Scripture Burrito Bible stores one USFM file per book at the ingredient
 * paths the catalog entry lists (`./ingredients/PHM.usfm`, or `./01-GEN.usfm`
 * for the aligned Bibles) — the same layout as RC and TC Bibles — so the same
 * extractor fetches the books and strips alignments for display. Both
 * `Bible` and `Aligned Bible` subjects arrive here, as DCS publishes both
 * with this flavor.
 */
async function getSbBibleData(catalogEntry, books, options) {
  return await extractRcAlignedBibleData(catalogEntry, books, options);
}

/**
 * Get resource data for SB OBS
 */
async function getSbObsData(catalogEntry, options) {
  if (!catalogEntry.ingredients?.length) {
    throw new ResourceError('No ingredients found in catalog entry', { code: 'INVALID_INPUT' });
  }

  const data = await extractRcSbObsData(
    catalogEntry,
    { path: getObsContentPath(catalogEntry) },
    options
  );
  return formatObsData(data, catalogEntry);
}
/**
 * Get resource data for TS OBS
 */
async function getTsObsData(catalogEntry, options) {
  if (!catalogEntry.ingredients?.length) {
    throw new ResourceError('No ingredients found in catalog entry', { code: 'INVALID_INPUT' });
  }

  const data = await extractTsObsData(
    catalogEntry,
    { path: getObsContentPath(catalogEntry) },
    options
  );
  return formatObsData(data, catalogEntry);
}
/**
 * Get resource data for TS Bible
 *
 * ts Bible repos hold a single book split into chunk files; extractTsBibleData
 * pieces those chunks back together into USFM.
 */
async function getTsBibleData(catalogEntry, books, options) {
  return await extractTsBibleData(catalogEntry, books, options);
}

/**
 * Get resource data for TC Bible
 *
 * tc Aligned Bible/Bible repos store each book as a USFM file referenced by its
 * ingredient path — structurally identical to RC aligned Bibles — so the same
 * extractor fetches the content and strips alignments for display.
 */
async function getTcBibleData(catalogEntry, books, options) {
  return await extractRcAlignedBibleData(catalogEntry, books, options);
}
