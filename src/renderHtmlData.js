import { renderAlignedBibleHtml } from './renderers/alignedBibleRenderer.js';
import { renderTranslationAcademyHtml } from './renderers/translationAcademyRenderer.js';
import { renderTranslationWordsHtml } from './renderers/translationWordsRenderer.js';
import { renderObsHtml } from './renderers/obsRenderer.js';
import { renderTranslationNotesHtml } from './renderers/translationNotesRenderer.js';
import { renderTsvQuestionsHtml } from './renderers/tsvQuestionsRenderer.js';
import { parseBooksOption } from './renderOptions.js';

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
 * Render parsed resource data into HTML sections (the reusable HtmlData package).
 *
 * Pure and synchronous — no network, no disk. Feed it the output of
 * getResourceData() (online) or getResourceDataFromDirectory() (local), or any
 * hand-built / cached ResourceData object. This is stage 3 of the pipeline; see
 * docs/rendering-pipeline.md §4.3 / §5.
 *
 * @param {Object} resourceData - Parsed resource data (subject, title, books/…, extras)
 * @param {Object} [options] - Rendering options
 * @param {Object} [options.renderOptions] - Subject-specific rendering options
 * @param {Array<string>|Object} [options.books] - Book selection/ordering: an array of
 *   ids, or a map of `{ id: range }` (used when resourceData has no requestedBooks)
 * @returns {Object} HtmlData: { subject, title, abbreviation, version, direction, sections }
 */
export function renderHtmlData(resourceData, options = {}) {
  if (!resourceData) {
    throw new Error('renderHtmlData: resourceData is required (the output of getResourceData()).');
  }
  if (resourceData.error) {
    throw new Error(resourceData.error);
  }

  const { renderOptions = {} } = options;

  // Book ordering/selection: prefer the selection baked into the data; fall back
  // to the `books` option for callers that pass it alongside un-tagged data.
  const requestedBooks =
    Array.isArray(resourceData.requestedBooks) && resourceData.requestedBooks.length
      ? resourceData.requestedBooks
      : parseBooksOption(options.books).ids;

  let rendered;
  if (alignedBibleSubjects.has(resourceData.subject)) {
    rendered = renderAlignedBibleHtml(resourceData, { requestedBooks, ...renderOptions });
  } else if (translationAcademySubjects.has(resourceData.subject)) {
    rendered = renderTranslationAcademyHtml(resourceData, renderOptions);
  } else if (translationWordsSubjects.has(resourceData.subject)) {
    rendered = renderTranslationWordsHtml(resourceData, renderOptions);
  } else if (obsSubjects.has(resourceData.subject)) {
    rendered = renderObsHtml(resourceData, renderOptions);
  } else if (translationNotesSubjects.has(resourceData.subject)) {
    rendered = renderTranslationNotesHtml(resourceData, renderOptions);
  } else if (tsvQuestionsSubjects.has(resourceData.subject)) {
    rendered = renderTsvQuestionsHtml(resourceData, renderOptions);
  } else {
    throw new Error(`HTML rendering is not implemented yet for subject \`${resourceData.subject}\`.`);
  }

  // Promote cover/identity fields onto HtmlData so downstream stages
  // (renderHTML, renderPdf) never need the resourceData again.
  return {
    subject: rendered.subject ?? resourceData.subject,
    title: rendered.title ?? resourceData.title,
    abbreviation: resourceData.abbreviation,
    version: resourceData.version,
    direction: resourceData.direction || rendered.direction || 'ltr',
    sections: rendered.sections,
  };
}
