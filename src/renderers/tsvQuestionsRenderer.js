import { convertNoteFromMD2HTML } from '../converters/markdownConverter.js';
import { BibleBookData } from '../constants.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const questionsWebCss = `
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

.tq-question {
  margin: 8px 0;
}

.tq-question-text {
  font-weight: bold;
}

.tq-answer-text {
  margin-top: 4px;
}

.tq-scripture-block {
  border: 1px solid #ccc;
  background-color: #f9f9f9;
  padding: 8px 12px;
  margin: 8px 0;
}

.tq-scripture-text {
  font-style: italic;
}

.header-title {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.85em;
}
`;

const questionsPrintCss = `
.tq-book-header {
  break-after: avoid !important;
}

.tq-chapter-header {
  break-after: avoid !important;
}

.tq-verse-header {
  break-after: avoid !important;
}

article.tq-question {
  break-inside: avoid;
  orphans: 2;
  widows: 2;
}
`;

/**
 * Render TSV Translation Questions / Study Questions / Study Notes into HTML.
 * Works for subjects: TSV Translation Questions, TSV Study Questions, TSV Study Notes.
 *
 * @param {Object} resourceData - Output from getResourceData() with type 'tsv'
 * @param {Object} [options] - Rendering options
 * @returns {Object} Rendered HTML package
 */
export function renderTsvQuestionsHtml(resourceData, options = {}) {
  if (!resourceData || resourceData.type !== 'tsv' || !resourceData.books) {
    throw new Error('TSV Questions renderer expects TSV resource data from getResourceData().');
  }

  const title = resourceData.title || resourceData.subject || 'Questions';
  const toc = [];
  const bodyParts = [];

  const bookIds = Object.keys(resourceData.books).sort((a, b) => {
    const aSort = resourceData.books[a].sort || 0;
    const bSort = resourceData.books[b].sort || 0;
    return aSort - bSort;
  });

  for (const bookId of bookIds) {
    const book = resourceData.books[bookId];
    const bookTitle = book.title || BibleBookData[bookId]?.title || bookId;
    const bookAnchor = `nav-${bookId}`;

    toc.push({ id: bookAnchor, title: `${title} - ${bookTitle}`, book: bookId });

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
      const chapterLabel = isFront ? 'Introduction' : `${bookTitle} ${chapterKey}`;
      const chapterAnchor = `nav-${bookId}-${isFront ? 'front' : chapterKey}`;

      bodyParts.push(
        `<h2 class="tq-chapter-header" id="${chapterAnchor}" data-toc-title="${escapeHtml(chapterLabel)}">` +
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
        const verseLabel = isIntro
          ? `${chapterLabel} Introduction`
          : `${bookTitle} ${chapterKey}:${verseKey}`;
        const verseAnchor = `nav-${bookId}-${chapterKey}-${verseKey}`;

        bodyParts.push(
          `<h3 class="tq-verse-header" id="${verseAnchor}">` +
          `<a href="#${verseAnchor}" class="header-link">${escapeHtml(verseLabel)}</a></h3>\n`
        );

        for (const question of questions) {
          const questionId = question.ID || '';
          const questionAnchor = `nav-${bookId}-${chapterKey}-${verseKey}-${questionId}`;
          const questionText = question.Question || question.Quote || '';
          const answerText = question.Response || question.Note || '';

          let articleHtml = `<article class="tq-question" id="${questionAnchor}">\n`;

          if (questionText) {
            articleHtml += `  <div class="tq-question-text">${escapeHtml(questionText)}</div>\n`;
          }

          if (answerText) {
            const answerHtml = convertNoteFromMD2HTML(answerText, bookId, chapterKey);
            articleHtml += `  <div class="tq-answer-text">${answerHtml}</div>\n`;
          }

          articleHtml += `</article>\n`;
          bodyParts.push(articleHtml);
        }
      }
    }

    bodyParts.push(`</section>\n`);
  }

  const cover = `<h3 class="cover-book-title">${escapeHtml(title)}</h3>`;
  const body = bodyParts.join('');
  const css = { web: questionsWebCss, print: questionsPrintCss };
  const fullHtml = buildFullHtmlDocument(title, questionsWebCss + questionsPrintCss, body);

  return {
    subject: resourceData.subject,
    title,
    sections: {
      cover,
      copyright: '',
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
