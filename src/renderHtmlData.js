import { renderAlignedBibleHtml } from './renderers/alignedBibleRenderer.js';
import { renderTranslationAcademyHtml } from './renderers/translationAcademyRenderer.js';
import { renderTranslationWordsHtml } from './renderers/translationWordsRenderer.js';
import { renderObsHtml } from './renderers/obsRenderer.js';
import { renderTranslationNotesHtml } from './renderers/translationNotesRenderer.js';
import { renderTsvQuestionsHtml } from './renderers/tsvQuestionsRenderer.js';
import { parseBooksOption } from './renderOptions.js';
import { rewriteSectionAnchors } from './renderers/anchors.js';
import { filterResourceDataByRanges } from './rangeFilter.js';

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
  const { ids, ranges } = parseBooksOption(options.books);
  const requestedBooks =
    Array.isArray(resourceData.requestedBooks) && resourceData.requestedBooks.length
      ? resourceData.requestedBooks
      : ids;

  // Apply per-book reference ranges (e.g. { '1ki': '10:1-13' }) before rendering.
  const data = Object.keys(ranges).length
    ? filterResourceDataByRanges(resourceData, ranges)
    : resourceData;

  let rendered;
  if (alignedBibleSubjects.has(data.subject)) {
    rendered = renderAlignedBibleHtml(data, { requestedBooks, ...renderOptions });
  } else if (translationAcademySubjects.has(data.subject)) {
    rendered = renderTranslationAcademyHtml(data, renderOptions);
  } else if (translationWordsSubjects.has(data.subject)) {
    rendered = renderTranslationWordsHtml(data, renderOptions);
  } else if (obsSubjects.has(data.subject)) {
    rendered = renderObsHtml(data, renderOptions);
  } else if (translationNotesSubjects.has(data.subject)) {
    rendered = renderTranslationNotesHtml(data, renderOptions);
  } else if (tsvQuestionsSubjects.has(data.subject)) {
    rendered = renderTsvQuestionsHtml(data, renderOptions);
  } else {
    throw new Error(`HTML rendering is not implemented yet for subject \`${data.subject}\`.`);
  }

  // Apply the resource-scoped anchor scheme (nav- -> `${abbreviation}-`) so the
  // app can deep-link to unique anchors. Centralized here; see renderers/anchors.js.
  const abbreviation = resourceData.abbreviation;
  const sections = abbreviation
    ? rewriteSectionAnchors(rendered.sections, abbreviation)
    : rendered.sections;

  // Promote cover/identity fields onto HtmlData so downstream stages
  // (renderHTML, renderPdf) never need the resourceData again.
  return {
    subject: rendered.subject ?? resourceData.subject,
    title: rendered.title ?? resourceData.title,
    abbreviation,
    version: resourceData.version,
    direction: resourceData.direction || rendered.direction || 'ltr',
    sections,
  };
}
