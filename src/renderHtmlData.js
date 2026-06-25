import { getResourceData } from './getResourceData.js';
import { renderAlignedBibleHtml } from './renderers/alignedBibleRenderer.js';
import { renderTranslationAcademyHtml } from './renderers/translationAcademyRenderer.js';
import { renderTranslationWordsHtml } from './renderers/translationWordsRenderer.js';
import { renderObsHtml } from './renderers/obsRenderer.js';
import { renderTranslationNotesHtml } from './renderers/translationNotesRenderer.js';
import { renderTsvQuestionsHtml } from './renderers/tsvQuestionsRenderer.js';

const alignedBibleSubjects = new Set([
  'Aligned Bible',
  'Bible',
  'Greek New Testament',
  'Hebrew Old Testament',
]);
const translationAcademySubjects = new Set(['Translation Academy']);
const translationWordsSubjects = new Set(['Translation Words']);
const obsSubjects = new Set(['Open Bible Stories']);
const translationNotesSubjects = new Set([
  'TSV Translation Notes',
  'TSV OBS Translation Notes',
]);
const tsvQuestionsSubjects = new Set([
  'TSV Translation Questions',
  'TSV Study Questions',
  'TSV Study Notes',
  'TSV OBS Translation Questions',
  'TSV OBS Study Notes',
  'TSV OBS Study Questions',
]);

/**
 * Fetch resource data and render it into HTML data sections.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git ref (tag/branch/commit)
 * @param {Array<string>} books - Optional book identifiers
 * @param {Object} options - Options
 * @param {Object} options.renderOptions - Subject-specific rendering options
 * @returns {Promise<Object>} Rendered HTML data package
 */
export async function renderHtmlData(owner, repo, ref, books = [], options = {}) {
  const { renderOptions = {}, ...resourceOptions } = options;

  const resourceData = await getResourceData(owner, repo, ref, books, resourceOptions);
  if (!resourceData) {
    throw new Error('No resource data was returned from getResourceData().');
  }

  if (resourceData.error) {
    throw new Error(resourceData.error);
  }

  if (alignedBibleSubjects.has(resourceData.subject)) {
    const rendered = renderAlignedBibleHtml(resourceData, {
      requestedBooks: books,
      ...renderOptions,
    });

    return {
      ...rendered,
      resourceData,
    };
  }

  if (translationAcademySubjects.has(resourceData.subject)) {
    const rendered = renderTranslationAcademyHtml(resourceData, renderOptions);
    return {
      ...rendered,
      resourceData,
    };
  }

  if (translationWordsSubjects.has(resourceData.subject)) {
    const rendered = renderTranslationWordsHtml(resourceData, renderOptions);
    return {
      ...rendered,
      resourceData,
    };
  }

  if (obsSubjects.has(resourceData.subject)) {
    const rendered = renderObsHtml(resourceData, renderOptions);
    return {
      ...rendered,
      resourceData,
    };
  }

  if (translationNotesSubjects.has(resourceData.subject)) {
    const rendered = renderTranslationNotesHtml(resourceData, renderOptions);
    return {
      ...rendered,
      resourceData,
    };
  }

  if (tsvQuestionsSubjects.has(resourceData.subject)) {
    const rendered = renderTsvQuestionsHtml(resourceData, renderOptions);
    return {
      ...rendered,
      resourceData,
    };
  }

  throw new Error(`HTML rendering is not implemented yet for subject \`${resourceData.subject}\`.`);
}
