import { convertNoteFromMD2HTML } from '../converters/markdownConverter.js';
import { escapeHtml, renderQuoteHeader } from './scriptureColumns.js';

/**
 * A Translation Questions entry: the question, its answer behind a toggle on
 * screen and always shown in print. Shared by the TSV Questions renderer and the
 * Translation Notes renderer, which can show each verse's questions under its
 * notes (`includeQuestions`).
 */

/** Screen CSS for question entries and their answer toggle. */
export const questionEntryWebCss = `/* Questions + collapsible answers (click the chevron to reveal). */
.tq-question {
  margin: 6px 0;
}

.tq-entry {
  margin-left: 12px;
}

.tq-entry-question {
  font-size: 1em;
  font-weight: bold;
  margin: 4px 0;
  display: inline-block;
}

.tq-note-body {
  padding: 2px 0;
}

.response-show-checkbox {
  display: none;
}

.tq-entry-response {
  display: none;
  margin: 4px 0 8px 16px;
}

.response-show-checkbox:checked ~ .tq-entry-response {
  display: block;
}

.response-show-label {
  cursor: pointer;
  user-select: none;
  display: inline-block;
  margin-left: 10px;
  font-size: 0.82em;
  font-weight: bold;
  color: #014263;
}

.response-show-label::after {
  content: ' ▸';
}

.response-show-checkbox:checked ~ .response-show-label::after {
  content: ' ▾';
}
`;

/** Print CSS for question entries: keep each whole, show every answer. */
export const questionEntryPrintCss = `article.tq-question {
  break-inside: avoid;
  orphans: 2;
  widows: 2;
}

/* Keep the quote box and the question line whole and glued to what follows. */
.tq-quote-header,
.tq-entry-question {
  break-inside: avoid;
  break-after: avoid;
}

/* In print/PDF there is no interactivity: always show answers, hide the toggle. */
.response-show-checkbox,
.response-show-label {
  display: none !important;
}

.tq-entry-response {
  display: block !important;
}
`;

/**
 * Render a single question/note row: optional quote header (Bible-versed only),
 * then either a question with a collapsible answer, or a study-note body.
 *
 * @param {Object} row - A TSV row (`Question`/`Response`, or `Note`; `Quote`, `GLQuotes`)
 * @param {Object} ctx
 * @param {string} ctx.anchor - The article's `nav-…` id
 * @param {string} ctx.bookId
 * @param {string} ctx.chapterKey
 * @param {Array} ctx.bibles - From getBibleColumns(); [] for no quote header
 * @param {boolean} ctx.isObs
 * @param {string} [ctx.headingTag='h4'] - The question's heading element
 */
export function renderQuestionArticle(
  row,
  { anchor, bookId, chapterKey, bibles, isObs, headingTag = 'h4' }
) {
  let html = `<article class="tq-question" id="${anchor}">\n`;

  // Quote header (study questions / study notes that target a scripture quote).
  if (!isObs && bibles.length && (row.Quote || row.GLQuotes)) {
    html += renderQuoteHeader(row, bibles, {
      header: 'tq-quote-header',
      quote: 'tq-quote',
      tag: 'tq-bible-tag',
    });
  }

  const questionText = row.Question || '';
  const responseText = row.Response || '';
  const noteText = row.Note || '';

  if (questionText) {
    html += `  <div class="tq-entry">\n`;
    html += `    <${headingTag} class="tq-entry-question"><a href="#${anchor}" class="header-link">${escapeHtml(questionText)}</a></${headingTag}>\n`;
    if (responseText) {
      const checkboxId = `chk-${anchor}`;
      const responseHtml = convertNoteFromMD2HTML(responseText, bookId, chapterKey);
      html += `    <input type="checkbox" class="response-show-checkbox" id="${checkboxId}">\n`;
      html += `    <label class="response-show-label" for="${checkboxId}">Answer</label>\n`;
      html += `    <div class="tq-entry-response">${responseHtml}</div>\n`;
    }
    html += `  </div>\n`;
  } else if (noteText) {
    // Study Notes: a note body, no question/answer toggle.
    html += `  <div class="tq-note-body">${convertNoteFromMD2HTML(noteText, bookId, chapterKey)}</div>\n`;
  } else if (responseText) {
    // Orphan response with no question — show it plainly so it isn't hidden.
    html += `  <div class="tq-note-body">${convertNoteFromMD2HTML(responseText, bookId, chapterKey)}</div>\n`;
  }

  html += `</article>\n`;
  return html;
}

/** `{ start, end }` of a verse key (`'5'`, `'6-8'`), or null for `intro`/`front`. */
function verseSpan(key) {
  const m = /^(\d+)(?:-(\d+))?$/.exec(String(key));
  if (!m) return null;
  const start = parseInt(m[1], 10);
  return { start, end: m[2] ? parseInt(m[2], 10) : start };
}

/** True when span `a` comes after span `b` in reading order (by end, then start). */
function readsAfter(a, b) {
  return a.end > b.end || (a.end === b.end && a.start > b.start);
}

/**
 * Decide where a chapter's Translation Questions go among its Translation Notes.
 *
 * A question follows the verse block that covers the last verse it asks about,
 * so "1:1-3" comes after the notes on 1:3, once those verses have been read. A
 * question whose verses have no notes gets a block of its own, in reading order,
 * so no question is dropped. A chapter-level question (`intro` or any other
 * non-verse key) goes after the chapter's last block.
 *
 * @param {Array<string>} noteKeys - The verse keys that have notes, in render order
 * @param {Object} questionVerses - `{ [verseKey]: rows }` from the questions resource
 * @returns {{ keys: Array<string>, questions: Map<string, Array<{ key: string, rows: Array }>> }}
 *   `keys`: the blocks to render, in order (the note keys plus any question-only
 *   keys); `questions`: each block's question groups, keyed by block
 */
export function placeQuestions(noteKeys, questionVerses = {}) {
  const keys = [...noteKeys];
  const questions = new Map();
  const attach = (blockKey, key, rows) => {
    if (!questions.has(blockKey)) questions.set(blockKey, []);
    questions.get(blockKey).push({ key, rows });
  };

  const entries = Object.entries(questionVerses || {}).filter(
    ([, rows]) => Array.isArray(rows) && rows.length
  );
  const versed = entries
    .map(([key, rows]) => ({ key, rows, span: verseSpan(key) }))
    .filter((q) => q.span)
    // Reading order: by the last verse asked about, then the first.
    .sort((a, b) => a.span.end - b.span.end || a.span.start - b.span.start);
  const chapterLevel = entries.filter(([key]) => !verseSpan(key));

  for (const q of versed) {
    if (keys.includes(q.key)) {
      attach(q.key, q.key, q.rows);
      continue;
    }
    const cover = noteKeys.find((k) => {
      const s = verseSpan(k);
      return s && s.start <= q.span.end && q.span.end <= s.end;
    });
    if (cover) {
      attach(cover, q.key, q.rows);
      continue;
    }
    // No notes on that verse: a block of its own, before the first verse block
    // that reads after it (an `intro` block stays first).
    const at = keys.findIndex((k) => {
      const s = verseSpan(k);
      return s && readsAfter(s, q.span);
    });
    keys.splice(at === -1 ? keys.length : at, 0, q.key);
    attach(q.key, q.key, q.rows);
  }

  for (const [key, rows] of chapterLevel) {
    if (!keys.length) keys.push(key);
    attach(keys[keys.length - 1], key, rows);
  }
  return { keys, questions };
}
