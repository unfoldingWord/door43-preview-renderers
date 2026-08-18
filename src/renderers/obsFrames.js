/**
 * Shared Open Bible Stories helpers for the TSV renderers.
 *
 * The OBS-based TSV resources — obs-tn, obs-tq, obs-sn, obs-sq — are laid out
 * like their Bible counterparts with one substitution: where a Bible resource
 * shows the verse as parallel scripture columns, an OBS resource shows the story
 * frame the notes or questions are about. A "chapter" is a story and a "verse" is
 * a frame within it.
 *
 * The frame text is always rendered. The notes and questions are *about* that
 * text, so hiding it leaves them unanchored — there is no useful document with
 * the notes but not the text. The picture is the part that is optional, because
 * it is a large network image that only some outputs want; it appears when the
 * caller asks for a resolution.
 */

import { escapeHtml } from './scriptureColumns.js';

/** The TSV subjects whose "books" are Open Bible Stories rather than Bible books. */
export const OBS_TSV_SUBJECTS = new Set([
  'TSV OBS Translation Notes',
  'TSV OBS Translation Questions',
  'TSV OBS Study Notes',
  'TSV OBS Study Questions',
]);

/**
 * Whether a subject's content is Open Bible Stories frames rather than scripture.
 * @param {string} subject
 * @returns {boolean}
 */
export function isObsSubject(subject) {
  return OBS_TSV_SUBJECTS.has(subject);
}

/**
 * Find the Open Bible Stories resource among a TSV resource's extras.
 * @param {Object} extras - resourceData.extras
 * @returns {Object|null} The OBS resource ({ stories }), or null
 */
export function findObsExtra(extras) {
  for (const resource of Object.values(extras || {})) {
    if (resource?.type === 'obs' && resource.stories) return resource;
  }
  return null;
}

/**
 * The story a chapter key refers to. Chapter keys are story numbers; 'front'
 * carries the resource's own introduction and has no story.
 *
 * @param {Object|null} obsData - Result of findObsExtra()
 * @param {string} chapterKey
 * @returns {Object|null}
 */
export function findObsStory(obsData, chapterKey) {
  if (!obsData || chapterKey === 'front') return null;
  return obsData.stories?.[parseInt(chapterKey, 10)] || null;
}

/**
 * The heading for a story, e.g. "1. The Creation". Falls back to the number when
 * the story is missing from the extras.
 *
 * @param {Object|null} story
 * @param {string} chapterKey
 * @returns {string}
 */
export function obsStoryLabel(story, chapterKey) {
  return story?.title || `Story ${chapterKey}`;
}

/**
 * Render the frame panel that stands in for a Bible resource's scripture columns:
 * the picture (only when a resolution is requested) above the frame text.
 *
 * @param {Object|null} frame - story.frames[frameNumber]
 * @param {Object} options
 * @param {string} options.chapterKey - Story number, for the image alt text
 * @param {string} options.verseKey - Frame number, for the image alt text
 * @param {string} [options.resolution='none'] - 'none' to omit the picture, else e.g. '360px'
 * @param {Object} [options.classes] - { panel, image } class names, so each
 *   renderer keeps its own `tn-`/`tq-` prefix
 * @returns {string} HTML, or '' when there is nothing to show
 */
export function renderObsFrame(frame, { chapterKey, verseKey, resolution = 'none', classes = {} }) {
  if (!frame) return '';
  const { panel = 'obs-frame-text', image = 'obs-frame-image' } = classes;

  const showImage = resolution !== 'none' && Boolean(frame.img);
  if (!showImage && !frame.text) return '';

  let html = `<div class="${panel}">\n`;
  if (showImage) {
    html +=
      `  <img class="${image}" src="${escapeHtml(frame.img)}" ` +
      `alt="Open Bible Stories ${escapeHtml(chapterKey)}:${escapeHtml(verseKey)}">\n`;
  }
  if (frame.text) html += `  <p>${escapeHtml(frame.text)}</p>\n`;
  html += `</div>\n`;
  return html;
}
