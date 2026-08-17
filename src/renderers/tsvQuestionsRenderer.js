import { convertNoteFromMD2HTML, convertMarkdown } from '../converters/markdownConverter.js';
import { buildCoverPage, coverCss } from './printDocumentAssembler.js';
import { BibleBookData } from '../constants.js';
import {
  escapeHtml,
  parseScriptureExtras,
  getBibleColumns,
  renderScriptureColumns,
  renderQuoteHeader,
} from './scriptureColumns.js';

// OBS question/note subjects are story-based (no Bible verses). For these the
// story frame text takes the place of the scripture panel.
const OBS_SUBJECTS = new Set([
  'TSV OBS Translation Questions',
  'TSV OBS Study Notes',
  'TSV OBS Study Questions',
]);

const tqWebCss = `
.license-text {
  font-size: 0.9em;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: '#';
  padding-left: 5px;
  color: blue;
  display: inline-block;
}

/* ─── Compact study-Bible layout ──────────────────────────
   Scripture (or, for OBS, the story frame text) renders as a light panel; for
   Bible-versed resources scripture is shown as parallel columns (ULT | UST). */

table.tq-scripture-cols {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin: 4px 0 8px 0;
  font-size: 0.95em;
  background-color: #f9f9f9;
  border: 1px solid #ddd;
}

table.tq-scripture-cols th.tq-col-label {
  text-align: left;
  font-size: 0.72em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #555;
  background: none;
  border: none;
  border-bottom: 1px solid #ccc;
  padding: 1px 6px;
}

table.tq-scripture-cols td {
  vertical-align: top;
  padding: 3px 6px;
  border: none;
  border-right: 1px solid #eee;
}

table.tq-scripture-cols td:last-child {
  border-right: none;
}

td.tq-scripture-text {
  font-style: italic;
}

.tq-frame-text {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 8px 12px;
  margin: 4px 0 8px 0;
}

.tq-frame-text p {
  margin: 0;
}

.tq-frame-image {
  display: block;
  margin: 0 auto 8px auto;
  max-width: 100%;
}

/* Quote header (study questions / study notes) — one line per Bible with a tag. */
.tq-quote-header {
  font-size: 0.95em;
  margin: 5px 0 1px 0;
  padding: 2px 8px;
  background-color: #f1f1f1;
  border-left: 3px solid #ccc;
}

.tq-quote {
  line-height: 1.35;
}

.tq-bible-tag {
  display: inline-block;
  font-size: 0.68em;
  font-weight: bold;
  color: #fff;
  background-color: #8a8a8a;
  border-radius: 3px;
  padding: 0 4px;
  margin-right: 4px;
  vertical-align: middle;
}

.tq-quote-orig {
  font-size: 0.85em;
  color: #666;
}

/* Questions + collapsible answers (click the chevron to reveal). */
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

.header-title {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.85em;
}
`;

const tqPrintCss = `
.tq-book-header {
  break-after: avoid !important;
}

.tq-chapter-header {
  break-after: avoid !important;
}

.tq-verse-header {
  break-after: avoid !important;
}

/* One chapter per page: a chapter's questions are worked through together, so
   the next chapter starts on a fresh page. (Translation Notes break per verse
   instead — a TN verse carries far more material than a TQ one.) */
.tq-chapter-header {
  break-before: page !important;
}

/* ...but the first chapter opens under the book heading and shares its page,
   rather than leaving that heading behind on the previous one, and a chapter's
   first verse block opens under the chapter heading for the same reason. */
.tq-book-header + .tq-chapter-header,
.tq-chapter-header + .tq-verse-block {
  break-before: avoid !important;
}

/* The ULT/UST verse block (and the OBS frame that stands in for it) is read as
   one thing — never split it. */
table.tq-scripture-cols,
.tq-frame-text {
  break-inside: avoid;
}

/* A verse is read as a unit — its scripture block, its questions and their
   responses stay together on one page. Most verses carry only one or two
   questions, so this fits comfortably. When a verse is genuinely taller than a
   page the engine drops the constraint, and the per-question rule below still
   keeps each individual question whole. */
.tq-verse-block {
  break-inside: avoid;
}

article.tq-question {
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
 * Find the OBS resource among the extras (keyed by short identifier, e.g. 'obs').
 * Returns the OBS resourceData ({ stories: {...} }) or null.
 */
function findObsExtra(extras) {
  for (const resource of Object.values(extras || {})) {
    if (resource?.type === 'obs' && resource.stories) return resource;
  }
  return null;
}

/**
 * Render a single question/note row: optional quote header (Bible-versed only),
 * then either a question with a collapsible answer, or a study-note body.
 */
function renderQuestionArticle(row, { anchor, bookId, chapterKey, bibles, isObs }) {
  let html = `<article class="tq-question" id="${anchor}">\n`;

  // Quote header (study questions / study notes that target a scripture quote).
  if (!isObs && bibles.length && (row.Quote || row.GLQuotes)) {
    html += renderQuoteHeader(row, bibles, {
      header: 'tq-quote-header',
      quote: 'tq-quote',
      tag: 'tq-bible-tag',
      orig: 'tq-quote-orig',
    });
  }

  const questionText = row.Question || '';
  const responseText = row.Response || '';
  const noteText = row.Note || '';

  if (questionText) {
    html += `  <div class="tq-entry">\n`;
    html += `    <h4 class="tq-entry-question"><a href="#${anchor}" class="header-link">${escapeHtml(questionText)}</a></h4>\n`;
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

/**
 * Render TSV Translation Questions / Study Questions / Study Notes (and their OBS
 * variants) into HTML. Bible-versed resources get parallel scripture columns and a
 * Bible-tag quote header; OBS resources get the story frame text + optional image.
 *
 * @param {Object} resourceData - Output from getResourceData() with type 'tsv'
 * @param {Object} [options] - Rendering options
 * @param {string} [options.resolution='none'] - OBS image resolution: 'none', '360px', '2160px'
 * @returns {Object} Rendered HTML package
 */
export function renderTsvQuestionsHtml(resourceData, options = {}) {
  if (!resourceData || resourceData.type !== 'tsv' || !resourceData.books) {
    throw new Error('TSV Questions renderer expects TSV resource data from getResourceData().');
  }

  const title = resourceData.title || resourceData.subject || 'Questions';
  const extras = resourceData.extras || {};
  const isObs = OBS_SUBJECTS.has(resourceData.subject);
  const resolution = options.resolution || 'none';

  // Bible-versed: parse aligned-Bible USFM and pick the ordered GL Bibles.
  // OBS: locate the OBS stories carried in the extras.
  const parsedScriptureExtras = isObs ? {} : parseScriptureExtras(extras);
  const bibles = isObs ? [] : getBibleColumns(extras);
  const obsData = isObs ? findObsExtra(extras) : null;

  const toc = [];
  const bodyParts = [];

  const bookIds = Object.keys(resourceData.books).sort((a, b) => {
    const aSort = resourceData.books[a].sort || 0;
    const bSort = resourceData.books[b].sort || 0;
    return aSort - bSort;
  });

  // Chapters are listed in the TOC only for a single-book document. Once a
  // document covers more than one book the chapter list swamps the book names —
  // the TOC should get the reader to a book, and the book's own headings take it
  // from there. Callers can force either way with `showChaptersInToc`.
  const showChaptersInTocResolved =
    typeof options.showChaptersInToc === 'boolean'
      ? options.showChaptersInToc
      : bookIds.length === 1;

  for (const bookId of bookIds) {
    const book = resourceData.books[bookId];
    const bookTitle = book.title || BibleBookData[bookId]?.title || bookId;
    const bookAnchor = `nav-${bookId}`;

    // Book entry (level 1); chapter/story entries are nested under it (level 2).
    const bookToc = { id: bookAnchor, title: `${title} - ${bookTitle}`, book: bookId, sections: [] };
    toc.push(bookToc);

    bodyParts.push(
      `<section id="${bookAnchor}" data-toc-title="${escapeHtml(title)} - ${escapeHtml(bookTitle)}">\n` +
      `  <h1 class="tq-book-header"><a href="#${bookAnchor}" class="header-link">${escapeHtml(title)} - ${escapeHtml(bookTitle)}</a></h1>\n`
    );

    const chapterKeys = Object.keys(book.chapters || {}).sort((a, b) => {
      if (a === 'front') return -1;
      if (b === 'front') return 1;
      return parseInt(a, 10) - parseInt(b, 10);
    });

    for (const chapterKey of chapterKeys) {
      const chapter = book.chapters[chapterKey];
      const isFront = chapterKey === 'front';
      const story = isObs && !isFront ? obsData?.stories?.[parseInt(chapterKey, 10)] : null;
      const chapterLabel = isFront
        ? isObs
          ? 'Introduction'
          : `${bookTitle} Introduction`
        : isObs
        ? story?.title || `Story ${chapterKey}`
        : `${bookTitle} ${chapterKey}`;
      const chapterAnchor = `nav-${bookId}-${isFront ? 'front' : chapterKey}`;

      if (showChaptersInTocResolved) {
        bookToc.sections.push({ id: chapterAnchor, title: chapterLabel });
      }

      // `data-toc-title` marks an element for the TOC, so it is only emitted
      // when chapters belong there; the id anchor always remains.
      bodyParts.push(
        `<h2 class="tq-chapter-header" id="${chapterAnchor}"` +
        (showChaptersInTocResolved ? ` data-toc-title="${escapeHtml(chapterLabel)}"` : '') +
        `>` +
        `<a href="#${chapterAnchor}" class="header-link">${escapeHtml(chapterLabel)}</a></h2>\n`
      );

      const verseKeys = Object.keys(chapter.verses || {}).sort((a, b) => {
        if (a === 'intro') return -1;
        if (b === 'intro') return 1;
        return parseInt(a, 10) - parseInt(b, 10);
      });

      for (const verseKey of verseKeys) {
        const questions = chapter.verses[verseKey];
        if (!questions || questions.length === 0) continue;

        const isIntro = verseKey === 'intro';
        // The book intro is the only content under the "front" chapter, so its own
        // header would just repeat the chapter header. Skip it and let the chapter
        // header anchor the intro content.
        const isBookIntro = isFront && isIntro;
        const verseLabel = isBookIntro
          ? chapterLabel
          : isIntro
          ? `${chapterLabel} Introduction`
          : isObs
          ? `${chapterKey}:${verseKey}`
          : `${bookTitle} ${chapterKey}:${verseKey}`;
        const verseAnchor = isBookIntro
          ? chapterAnchor
          : `nav-${bookId}-${chapterKey}-${verseKey}`;

        // A verse is one unit of work — its scripture, its questions and their
        // responses are wrapped together so print CSS can keep them on one page.
        // Flat sibling selectors cannot group them, so this is the one place the
        // markup needs a container (see .tq-verse-block in the print CSS).
        bodyParts.push(`<div class="tq-verse-block">\n`);

        if (!isBookIntro) {
          bodyParts.push(
            `<h3 class="tq-verse-header" id="${verseAnchor}">` +
            `<a href="#${verseAnchor}" class="header-link">${escapeHtml(verseLabel)}</a></h3>\n`
          );
        }

        if (!isIntro && !isFront) {
          if (isObs) {
            // OBS story frame text (the OBS analog of scripture) + optional image.
            const frame = story?.frames?.[parseInt(verseKey, 10)];
            if (frame) {
              let panel = `<div class="tq-frame-text">\n`;
              if (resolution !== 'none' && frame.img) {
                panel += `  <img class="tq-frame-image" src="${escapeHtml(frame.img)}" alt="Frame ${chapterKey}-${verseKey}">\n`;
              }
              if (frame.text) panel += `  <p>${escapeHtml(frame.text)}</p>\n`;
              panel += `</div>\n`;
              bodyParts.push(panel);
            }
          } else {
            // Bible-versed: parallel scripture columns (ULT | UST).
            const scriptureHtml = renderScriptureColumns(
              bibles,
              parsedScriptureExtras,
              bookId,
              chapterKey,
              verseKey,
              { table: 'tq-scripture-cols', label: 'tq-col-label', text: 'tq-scripture-text' }
            );
            if (scriptureHtml) bodyParts.push(scriptureHtml);
          }
        }

        for (const question of questions) {
          const questionId = question.ID || '';
          const questionAnchor = `nav-${bookId}-${chapterKey}-${verseKey}-${questionId}`;
          bodyParts.push(
            renderQuestionArticle(question, {
              anchor: questionAnchor,
              bookId,
              chapterKey,
              bibles,
              isObs,
            })
          );
        }

        bodyParts.push(`</div>\n`);
      }
    }

    bodyParts.push(`</section>\n`);
  }

  const cover = buildCoverPage({
    title,
    version: resourceData.version,
    abbreviation: resourceData.abbreviation,
    // Single-book documents name the book on the cover, under the version.
    // OBS-based questions are not book-scoped, so they get no book heading.
    bookTitle:
      !isObs && bookIds.length === 1
        ? resourceData.books[bookIds[0]].title || BibleBookData[bookIds[0]]?.title || bookIds[0]
        : '',
  });
  const copyright = resourceData.license
    ? `<div class="license-text">${convertMarkdown(resourceData.license)}</div>`
    : '';
  const body = bodyParts.join('');
  const css = { web: tqWebCss + coverCss, print: tqPrintCss };
  const fullHtml = buildFullHtmlDocument(
    title,
    tqWebCss + tqPrintCss + coverCss,
    `<div class="section cover-page">${cover}</div>\n${body}`
  );

  return {
    subject: resourceData.subject,
    title,
    sections: {
      cover,
      copyright,
      body,
      toc,
      css,
      webView: null,
    },
    renderedBooks: {},
    fullHtml,
  };
}

function buildFullHtmlDocument(title, css, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  ${content}
</body>
</html>`;
}
