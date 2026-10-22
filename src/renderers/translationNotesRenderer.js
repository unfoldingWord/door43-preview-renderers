import { convertNoteFromMD2HTML, convertMarkdown } from '../converters/markdownConverter.js';
import {
  buildCoverPage,
  coverCss,
  runningMarkerWebCss,
  renderAppendicesHtml,
} from './printDocumentAssembler.js';
import { BibleBookData } from '../constants.js';
import {
  escapeHtml,
  parseScriptureExtras,
  getBibleColumns,
  renderScriptureColumns,
  renderQuoteHeader,
  htmlRootAttributes,
} from './scriptureColumns.js';
import {
  twKey,
  extractRcLinks,
  collectAppendices,
  resolveRcLinks,
  findTwArticle,
  neutralizeDanglingAnchors,
} from './rcAppendices.js';
import { renderTwlTable } from './twlTable.js';
import {
  renderQuestionArticle,
  placeQuestions,
  questionEntryWebCss,
  questionEntryPrintCss,
} from './questionEntries.js';
import {
  isObsSubject,
  findObsExtra,
  findObsStory,
  obsStoryLabel,
  obsFrameHeaderRef,
  renderObsFrame,
} from './obsFrames.js';

const tnWebCss = `
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
   Scripture and Translation Words render as parallel columns
   (one per aligned Bible, e.g. ULT | UST). */

table.tn-scripture-cols,
table.tn-verse-twl-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin: 4px 0 8px 0;
  font-size: 0.95em;
}

.tn-col-label {
  text-align: left;
  font-size: 0.72em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #555;
  border-bottom: 1px solid #ccc;
  padding: 1px 6px;
}

table.tn-scripture-cols td,
table.tn-verse-twl-table td {
  vertical-align: top;
  padding: 3px 6px;
  border-right: 1px solid #eee;
}

table.tn-scripture-cols td:last-child,
table.tn-verse-twl-table td:last-child {
  border-right: none;
}

table.tn-scripture-cols {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
}

td.tn-scripture-text {
  font-style: italic;
}

/* OBS story frame — the picture and text the notes are about, standing in for
   the scripture columns of a Bible resource. */
.tn-frame-text {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 8px 12px;
  margin: 4px 0 8px 0;
}

.tn-frame-text p {
  margin: 0;
}

.tn-frame-image {
  display: block;
  margin: 0 auto 8px auto;
  max-width: 100%;
}

.tn-verse-twl-header {
  font-size: 0.85em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #555;
  margin: 8px 0 1px 0;
}

.tn-verse-twl-table a {
  text-decoration: none;
}

/* Notes — compact, with a per-Bible quote line and a small Bible tag. */
.tn-note-header {
  font-size: 0.95em;
  margin: 5px 0 1px 0;
  padding: 2px 8px;
  background-color: #f1f1f1;
  border-left: 3px solid #ccc;
}

.tn-note-quote {
  line-height: 1.35;
}

.tn-bible-tag {
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

.tn-note-body {
  padding: 2px 0;
}

/* The note reads as one block: it sits directly under its quote box, and the
   support reference directly under it. Markdown paragraphs carry the browser's
   default 1em margins, which would open a blank line on each of those seams —
   only the margins *between* paragraphs of a multi-paragraph note are kept. */
.tn-note-body > :first-child {
  margin-top: 0;
}

.tn-note-body > :last-child {
  margin-bottom: 0;
}

.tn-note-support-reference {
  font-size: 0.8em;
  color: #555;
  margin: 1px 0 0 0;
}

/* One blank line closes every note — before the next note, and before whatever
   follows the last one (the Translation Words list, or the next verse). */
article.tn-note {
  margin-bottom: 1em;
}

.tn-note-label {
  font-weight: bold;
}

hr.note-divider {
  border: none;
  border-top: 1px solid #eee;
  margin: 4px 0;
}

.appendix-header {
  text-align: center;
}

.appendix-article {
  margin-bottom: 16px;
}

/* Articles run on rather than each taking a page, so they need a visible
   separator. The first article sits directly under the appendix heading. */
.appendix-article + .appendix-article {
  border-top: 1px solid #ddd;
  padding-top: 12px;
}

.appendix-article-header {
  margin-top: 0;
}

/* Long words (Greek/Hebrew, transliterations, Strong's lists) must not spill out
   of a narrow appendix column. */
.appendix-article-body,
.back-refs {
  overflow-wrap: break-word;
}

/* A narrow appendix column cannot afford the default 40px-a-side blockquote
   indent: TA articles nest quotes, so the inner one is left with a handful of
   words per line. A rule plus a small indent reads better and still nests. */
.appendix-article-body blockquote {
  margin: 0.5em 0 0.5em 0.8em;
  padding-left: 0.7em;
  border-left: 2px solid #ddd;
}

.appendix-article-body ul,
.appendix-article-body ol {
  margin-left: 0;
  padding-left: 1.3em;
}

.appendix-article-body table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.appendix-article-body img {
  max-width: 100%;
  height: auto;
}

.appendix-article-body h1,
.appendix-article-body h2,
.appendix-article-body h3,
.appendix-article-body h4 {
  font-size: 1em;
}

.back-refs {
  margin-top: 8px;
  font-size: 0.9em;
}

.back-refs a {
  margin-right: 8px;
}

.header-title {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.85em;
}
`;

const tnPrintCss = `
.tn-book-header {
  break-after: avoid !important;
}

.tn-chapter-header {
  break-after: avoid !important;
}

.tn-verse-header {
  break-after: avoid !important;
}

/* One verse per page. Everything a verse owns — its scripture columns, its notes
   and its Translation Words — is read together, so the next verse starts on a
   fresh page. Book and chapter introductions are verses too (front:intro and
   <chapter>:intro), so they get a page of their own on the same rule. The body
   markup is deliberately flat (no per-verse wrapper), so the break is expressed
   on the heading that opens each verse rather than on a container. */
.tn-verse-header,
.tn-chapter-header {
  break-before: page !important;
}

/* ...but a heading must never be left behind on the previous page. The first
   chapter opens under the book heading, and a chapter's first verse opens under
   the chapter heading — those pairs stay together and share the new page. */
.tn-book-header + .tn-chapter-header,
.tn-chapter-header + .tn-verse-header,
/* OBS-based resources have no book heading, so the first chapter opens the
   section directly — it must not break away from the resource heading. */
section > .tn-chapter-header:first-child {
  break-before: avoid !important;
}

/* The ULT/UST verse block is read as one thing — never split it. (This used to
   name .tn-scripture-block, which the renderer never emits, so the rule matched
   nothing; the class is tn-scripture-cols.) */
table.tn-scripture-cols,
.tn-frame-text {
  break-inside: avoid;
}

/* A note is a single thought, and the Translation Words list closes the verse —
   a break in the middle of either one is a break in the middle of a unit. */
article.tn-note,
.tn-verse-twls {
  break-inside: avoid;
}

/* ...except the introduction notes. Those are single articles that run for
   pages, and an unbreakable block taller than the page is pushed to the next
   page whole, leaving its heading stranded behind it. They have to flow. */
article.tn-note-intro {
  break-inside: auto;
}

/* Keep the quote box whole and glued to the start of its note. */
.tn-note-header {
  break-inside: avoid;
  break-after: avoid;
}

article.tn-note {
  orphans: 2;
  widows: 2;
}

hr.note-divider {
  break-before: avoid !important;
}

/* Appendix articles flow continuously down the two appendix columns (see the
   .appendix rules in getPrintCss) — one article per page left most pages
   three-quarters empty. They are separated by a rule, not a page break, and only
   the TA/TW appendix sections themselves start a new page. */
/* Each appendix article starts a new page, so an article is always found at the
   top of a page rather than part-way down another one. */
.appendix-article {
  break-after: page !important;
  break-inside: auto;
  orphans: 2;
  widows: 2;
}

/* Nothing may be left dangling at the foot of a column: not the article title,
   not a heading inside the article body, not the back-reference heading. */
.appendix-article-header,
.appendix-article-body h1,
.appendix-article-body h2,
.appendix-article-body h3,
.appendix-article-body h4,
.appendix-article-body h5,
.appendix-article-body h6 {
  break-after: avoid !important;
}

.appendix-article-body blockquote,
.appendix-article-body li,
.appendix-article-body table {
  break-inside: avoid;
}

.back-refs {
  break-inside: avoid;
}
`;

// Added whenever a questions extra is shown (even one with no rows for these
// books), so a render without the extra, or with includeQuestions: false, is unchanged.
const tnQuestionsWebCss = `
.tn-verse-questions-header {
  font-size: 0.85em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #555;
  margin: 8px 0 1px 0;
}

.tn-verse-questions-ref {
  font-size: 0.85em;
  color: #555;
  margin: 4px 0 0 12px;
}
${questionEntryWebCss}`;

const tnQuestionsPrintCss = `
/* The heading (and a range's reference) stays with the first question. */
.tn-verse-questions-header,
.tn-verse-questions-ref {
  break-after: avoid;
}
${questionEntryPrintCss}`;

const tnObsPrintCss = `
/* ─── OBS overrides ──────────────────────────────────────── */
/* An OBS frame carries a picture, a few lines of story and one or two notes —
   nowhere near a page. Frames flow instead, and the story takes the page break,
   so a page break only ever lands between notes. */
.tn-verse-header {
  break-before: auto !important;
}

/* The story title opens its page. It deliberately does NOT use "column-span: all"
   to sit across both columns: WeasyPrint 68.1 drops content when a spanning
   element sits inside a multi-column container — measured, en_obs-tn lost 198 of
   its 582 story frames. The title still leads the page, in the first column. */

/* The picture and the story text are one thing — never split them, and never
   split the picture from the text it illustrates. */
.tn-frame-text {
  break-inside: avoid;
}
`;

/**
 * Render TSV Translation Notes resource data into HTML sections.
 *
 * The HTML structure is intentionally flat to avoid deep nesting that breaks
 * PDF generation. Instead of nesting divs for book > chapter > verse > note,
 * we use flat sections with data attributes and CSS classes for styling.
 *
 * Max nesting depth: 4 levels (section > article > div > inline elements)
 *
 * @param {Object} resourceData - Output from getResourceData() with type 'tsv'
 * @param {Object} [options] - Rendering options
 * @param {boolean} [options.showChaptersInToc] - Force chapter entries in the TOC
 * @param {string} [options.resolution='none'] - OBS frame picture resolution:
 *   'none' omits the pictures, '360px' / '2160px' include them. The frame *text*
 *   is always rendered — the notes are about it.
 * @param {boolean} [options.includeQuestions] - Show each verse's (or frame's)
 *   Translation Questions after its notes. Default: on when the data carries a
 *   Translation Questions extra, which getResourceData() fetches only when asked
 *   (`extraSubjects: ['TSV Translation Questions']`, or the OBS subject)
 * @returns {Object} Rendered HTML package
 */
export function renderTranslationNotesHtml(resourceData, options = {}) {
  if (!resourceData || resourceData.type !== 'tsv' || !resourceData.books) {
    throw new Error('Translation Notes renderer expects TSV resource data from getResourceData().');
  }

  const title = resourceData.title || 'Translation Notes';
  const extras = resourceData.extras || {};
  // OBS notes are about story frames, not verses: the frame's picture and text
  // stand in for the scripture columns, and there are no aligned Bibles to quote
  // from — the TSV Quote is already in the Gateway Language.
  const isObs = isObsSubject(resourceData.subject);
  const resolution = options.resolution || 'none';
  const obsData = isObs ? findObsExtra(extras) : null;
  // The Translation Words Links extra, found by subject (extras are keyed by
  // repo identifier, `twl` for the Bible notes and `obs-twl` for the OBS notes).
  const twlSubject = isObs ? 'TSV OBS Translation Words Links' : 'TSV Translation Words Links';
  const twlExtra = Object.values(extras).find((e) => e?.subject === twlSubject);
  // The Translation Questions extra, present only when the caller asked
  // getResourceData() for it; shown unless includeQuestions is false.
  const questionsSubject = isObs ? 'TSV OBS Translation Questions' : 'TSV Translation Questions';
  const questionsExtra = Object.values(extras).find((e) => e?.subject === questionsSubject);
  const includeQuestions = Boolean(questionsExtra) && options.includeQuestions !== false;
  // Parse aligned-Bible USFM once up front so per-verse scripture lookups are cheap.
  const parsedScriptureExtras = isObs
    ? {}
    : parseScriptureExtras(extras, { editorMode: options.editorMode === true });
  // Ordered GL Bibles (e.g. ULT, UST) rendered as parallel columns for scripture + TWL.
  const bibles = isObs ? [] : getBibleColumns(extras);
  const toc = [];
  const bodyParts = [];

  // Collect all rc links for appendix generation
  const allRcLinks = { ta: new Set(), tw: new Set() };
  const backRefs = { ta: {}, tw: {} };

  // With questions, a book that has questions but no notes is rendered too.
  const hasRows = (chapter) =>
    Object.values(chapter?.verses || {}).some((rows) => Array.isArray(rows) && rows.length);
  const books = { ...resourceData.books };
  if (includeQuestions) {
    for (const [bookId, qBook] of Object.entries(questionsExtra.books || {})) {
      if (books[bookId] || !Object.values(qBook?.chapters || {}).some(hasRows)) continue;
      books[bookId] = { title: qBook.title, sort: qBook.sort, chapters: {} };
    }
  }
  // Canonical position: the catalog's `sort`, else the number in the USFM file
  // name (`57-TIT`).
  const sortOf = (id) => books[id].sort || parseInt(BibleBookData[id]?.usfm, 10) || 0;
  const bookIds = Object.keys(books).sort((a, b) => sortOf(a) - sortOf(b));

  // Chapters are listed in the TOC only for a single-book document. Once a
  // document covers more than one book the chapter list swamps the book names —
  // the TOC should get the reader to a book, and the book's own headings take it
  // from there. Callers can force either way with `showChaptersInToc`.
  const showChaptersInTocResolved =
    typeof options.showChaptersInToc === 'boolean'
      ? options.showChaptersInToc
      : bookIds.length === 1;

  // Heading levels: H1 the resource, H2 each book, H3 each chapter, H4 each
  // verse. The resource title is the document's own heading, so it is emitted
  // once, above the books, rather than repeated into every book heading.
  const resourceAnchor = 'nav-resource';
  const resourceToc = { id: resourceAnchor, title, sections: [] };
  toc.push(resourceToc);
  bodyParts.push(
    `<h1 class="tn-resource-header" id="${resourceAnchor}" data-toc-title="${escapeHtml(title)}">` +
      `<a href="#${resourceAnchor}" class="header-link">${escapeHtml(title)}</a></h1>\n` +
      // Names the resource in every running header from here on.
      `<span class="running-title">${escapeHtml(title)}</span>\n`
  );

  for (const bookId of bookIds) {
    const book = books[bookId];
    const bookTitle = book.title || BibleBookData[bookId]?.title || bookId;
    const bookAnchor = `nav-${bookId}`;
    // OBS-based resources carry a single pseudo-book whose title is the resource
    // title itself, so a book heading there would just repeat the H1. Drop the
    // book level for those and hang the chapters straight off the resource.
    const hasBookHeading = bookTitle !== title;
    // Without a book heading the chapter opens the section, so it moves up a
    // level rather than leaving a gap in the document outline.
    const chapterTag = hasBookHeading ? 'h3' : 'h2';
    const verseTag = hasBookHeading ? 'h4' : 'h3';

    // Book entry (level 2, under the resource); chapters nest under it (level 3).
    const bookToc = hasBookHeading
      ? { id: bookAnchor, title: bookTitle, book: bookId, sections: [] }
      : resourceToc;
    if (hasBookHeading) resourceToc.sections.push(bookToc);

    // Book header
    bodyParts.push(
      `<section id="${bookAnchor}"` +
        (isObs ? ' class="obs-frames-body"' : '') +
        (hasBookHeading ? ` data-toc-title="${escapeHtml(bookTitle)}"` : '') +
        `>\n` +
        (hasBookHeading
          ? `  <h2 class="tn-book-header"><a href="#${bookAnchor}" class="header-link">${escapeHtml(bookTitle)}</a></h2>\n`
          : '')
    );

    // With questions, a chapter that has questions but no notes is visited too,
    // so none of its questions is dropped.
    const questionChapters = includeQuestions
      ? Object.entries(questionsExtra.books?.[bookId]?.chapters || {})
          .filter(([, ch]) => hasRows(ch))
          .map(([key]) => key)
      : [];
    // Sort chapters numerically (handle 'front' as 0)
    const chapterKeys = [
      ...new Set([...Object.keys(book.chapters || {}), ...questionChapters]),
    ].sort((a, b) => {
      if (a === 'front') return -1;
      if (b === 'front') return 1;
      return parseInt(a, 10) - parseInt(b, 10);
    });

    for (const chapterKey of chapterKeys) {
      const chapter = book.chapters?.[chapterKey] || { verses: {} };
      const isFront = chapterKey === 'front';
      const story = isObs ? findObsStory(obsData, chapterKey) : null;
      const chapterLabel = isFront
        ? isObs
          ? 'Introduction'
          : `${bookTitle} Introduction`
        : isObs
          ? obsStoryLabel(story, chapterKey)
          : `${bookTitle} ${chapterKey}`;
      const chapterAnchor = `nav-${bookId}-${isFront ? 'front' : chapterKey}`;

      if (showChaptersInTocResolved) {
        bookToc.sections.push({ id: chapterAnchor, title: chapterLabel });
      }

      // Chapter header. `data-toc-title` marks an element for the TOC, so it is
      // only emitted when chapters belong there; the id anchor always remains.
      bodyParts.push(
        `<${chapterTag} class="tn-chapter-header" id="${chapterAnchor}"` +
          (showChaptersInTocResolved ? ` data-toc-title="${escapeHtml(chapterLabel)}"` : '') +
          `>` +
          `<a href="#${chapterAnchor}" class="header-link">${escapeHtml(chapterLabel)}</a></${chapterTag}>\n`
      );

      // Sort verses numerically (handle 'intro' as 0)
      const verseKeys = Object.keys(chapter.verses || {}).sort((a, b) => {
        if (a === 'intro') return -1;
        if (b === 'intro') return 1;
        return parseInt(a, 10) - parseInt(b, 10);
      });

      // With questions, a verse that has questions but no notes gets a block too.
      const placed = placeQuestions(
        verseKeys.filter((k) => chapter.verses[k]?.length),
        includeQuestions ? questionsExtra.books?.[bookId]?.chapters?.[chapterKey]?.verses || {} : {}
      );

      for (const verseKey of placed.keys) {
        const notes = chapter.verses[verseKey] || [];
        const questionGroups = placed.questions.get(verseKey) || [];
        if (notes.length === 0 && questionGroups.length === 0) continue;

        const isIntro = verseKey === 'intro';
        // The book intro is the only content under the "front" chapter, so its own
        // header would just repeat the chapter header ("3 John Introduction"
        // twice). Skip it and let the chapter header anchor the intro notes.
        const isBookIntro = isFront && isIntro;
        const verseLabel = isBookIntro
          ? chapterLabel
          : isIntro
            ? `${chapterLabel} Introduction`
            : isObs
              ? `${chapterKey}:${verseKey}`
              : `${bookTitle} ${chapterKey}:${verseKey}`;
        const verseAnchor = isBookIntro ? chapterAnchor : `nav-${bookId}-${chapterKey}-${verseKey}`;

        // Verse header
        // The running header tracks the first item on the page: the verse
        // reference, or for an introduction the book or chapter it introduces.
        bodyParts.push(
          `<span class="running-ref">${escapeHtml(
            isBookIntro
              ? bookTitle
              : isIntro
                ? chapterLabel
                : isObs
                  ? obsFrameHeaderRef(story, chapterKey, verseKey)
                  : verseLabel
          )}</span>\n`
        );

        if (!isBookIntro) {
          bodyParts.push(
            `<${verseTag} class="tn-verse-header" id="${verseAnchor}">` +
              `<a href="#${verseAnchor}" class="header-link">${escapeHtml(verseLabel)}</a></${verseTag}>\n`
          );
        }

        // What the notes are about: an OBS story frame, or the verse in parallel
        // scripture columns (one per aligned Bible, e.g. ULT | UST).
        if (!isIntro && !isFront) {
          if (isObs) {
            const frameHtml = renderObsFrame(story?.frames?.[parseInt(verseKey, 10)], {
              chapterKey,
              verseKey,
              resolution,
              classes: { panel: 'tn-frame-text', image: 'tn-frame-image' },
            });
            if (frameHtml) bodyParts.push(frameHtml);
          } else {
            const scriptureHtml = renderScriptureColumns(
              bibles,
              parsedScriptureExtras,
              bookId,
              chapterKey,
              verseKey,
              { table: 'tn-scripture-cols', label: 'tn-col-label', text: 'tn-scripture-text' }
            );
            if (scriptureHtml) bodyParts.push(scriptureHtml);
          }
        }

        // Individual notes — flat articles, no nesting wrapper
        for (const note of notes) {
          const noteId = note.ID || '';
          const noteAnchor = `nav-${bookId}-${chapterKey}-${verseKey}-${noteId}`;
          const noteText = note.Note || '';
          const supportRef = note.SupportReference || '';

          // Convert note markdown to HTML
          const noteHtml = convertNoteFromMD2HTML(noteText, bookId, chapterKey);

          // Track rc links from both the note body and the SupportReference column
          const foundLinks = extractRcLinks(`${noteHtml}\n${supportRef}`);
          foundLinks.ta.forEach((link) => {
            allRcLinks.ta.add(link);
            if (!backRefs.ta[link]) backRefs.ta[link] = [];
            backRefs.ta[link].push({ anchor: verseAnchor, label: verseLabel });
          });
          foundLinks.tw.forEach((rawLink) => {
            const link = twKey(rawLink);
            if (!link) return;
            allRcLinks.tw.add(link);
            if (!backRefs.tw[link]) backRefs.tw[link] = [];
            backRefs.tw[link].push({ anchor: verseAnchor, label: verseLabel });
          });

          // Quote header — one line per Bible (ULT/UST) plus the original quote
          const quoteHeader = renderQuoteHeader(note, bibles, {
            header: 'tn-note-header',
            quote: 'tn-note-quote',
            tag: 'tn-bible-tag',
          });

          // Introduction notes are marked so print CSS can let them flow; every
          // other note is kept whole on one page.
          let noteArticle = `<article class="tn-note${isIntro ? ' tn-note-intro' : ''}" id="${noteAnchor}">\n`;
          noteArticle += quoteHeader;
          noteArticle += `  <div class="tn-note-body">${noteHtml}</div>\n`;

          if (supportRef) {
            noteArticle += `  <div class="tn-note-support-reference"><span class="tn-note-label">Support Reference:</span> ${escapeHtml(supportRef)}</div>\n`;
          }

          noteArticle += `</article>\n`;
          noteArticle += `<hr class="note-divider">\n`;

          bodyParts.push(noteArticle);
        }

        // Translation Words Links for this verse or OBS frame (from the twl extra),
        // as the same table the Translation Words Links renderer draws.
        const twlRows = twlExtra?.books?.[bookId]?.chapters?.[chapterKey]?.verses?.[verseKey];
        if (twlRows?.length) {
          bodyParts.push(
            renderTwlTable(twlRows, {
              bibles,
              bookId,
              chapterKey,
              verseKey,
              classes: {
                wrapper: 'tn-verse-twls',
                header: 'tn-verse-twl-header',
                table: 'tn-verse-twl-table',
                label: 'tn-col-label',
                cell: 'tn-verse-twl-cell',
              },
              hasArticle: (key) => Boolean(findTwArticle(extras.tw, key)),
              // Register each article for the appendix and note the verse citing it.
              onArticle: (key) => {
                allRcLinks.tw.add(key);
                if (!backRefs.tw[key]) backRefs.tw[key] = [];
                backRefs.tw[key].push({ anchor: verseAnchor, label: verseLabel });
              },
            })
          );
        }

        // Translation Questions for this verse (and any range ending in it),
        // after its notes and words.
        if (questionGroups.length) {
          let html = `<div class="tn-verse-questions">\n`;
          html += `  <h4 class="tn-verse-questions-header">Translation Questions</h4>\n`;
          for (const group of questionGroups) {
            // A range or chapter-level question placed under this verse says
            // which verses it asks about.
            if (group.key !== verseKey) {
              const groupLabel =
                group.key === 'intro'
                  ? chapterLabel
                  : isObs
                    ? `${chapterKey}:${group.key}`
                    : `${bookTitle} ${chapterKey}:${group.key}`;
              html += `  <div class="tn-verse-questions-ref">${escapeHtml(groupLabel)}</div>\n`;
            }
            group.rows.forEach((row, i) => {
              html += renderQuestionArticle(row, {
                anchor: `nav-${bookId}-${chapterKey}-${group.key}-tq-${row.ID || i + 1}`,
                bookId,
                chapterKey,
                // The question is the verse's; the notes above already quote it.
                bibles: [],
                isObs,
                headingTag: 'h5',
              });
            });
          }
          html += `</div>\n`;
          bodyParts.push(html);
        }
      }
    }

    bodyParts.push(`</section>\n`);
  }

  // Collect appendices (after the main loop so TWL-referenced TW articles are
  // included), keyed by kind so the composer can render/toggle them separately.
  const firstBook = bookIds[0] || '';
  const bookIdSet = new Set(bookIds);
  let appendices = collectAppendices(allRcLinks, extras, firstBook, backRefs);
  // The names of the resources the appendix articles came from, for their
  // running headers (e.g. "unfoldingWord® Translation Academy").
  const appendixTitles = { ta: extras?.ta?.title, tw: extras?.tw?.title };

  // Resolve rc:// links to internal anchors — across the body and across each
  // appendix article (so their cross-links resolve to the same anchors).
  let body = resolveRcLinks(bodyParts.join(''), firstBook, allRcLinks, extras, bookIdSet);
  for (const kind of Object.keys(appendices)) {
    for (const id of Object.keys(appendices[kind])) {
      appendices[kind][id].html = resolveRcLinks(
        appendices[kind][id].html,
        firstBook,
        allRcLinks,
        extras,
        bookIdSet,
        kind === 'tw' ? { twCategory: id.split('/')[0] } : {}
      );
    }
  }
  // Translation Words articles cite verses and OBS frames ("Titus 3:1", "18:11");
  // one without notes has no anchor in this document, so point those links at
  // nothing rather than leave them dangling.
  ({ body, appendices } = neutralizeDanglingAnchors(body, appendices));

  const cover = buildCoverPage({
    title,
    version: resourceData.version,
    abbreviation: resourceData.abbreviation,
    // Single-book documents name the book on the cover, under the version.
    bookTitle:
      bookIds.length === 1
        ? books[bookIds[0]].title || BibleBookData[bookIds[0]]?.title || bookIds[0]
        : '',
  });
  const copyright = resourceData.license
    ? `<div class="license-text">${convertMarkdown(resourceData.license)}</div>`
    : '';
  const css = {
    web: tnWebCss + (includeQuestions ? tnQuestionsWebCss : '') + coverCss + runningMarkerWebCss,
    print:
      (isObs ? tnPrintCss + tnObsPrintCss : tnPrintCss) +
      (includeQuestions ? tnQuestionsPrintCss : ''),
  };
  const fullHtml = buildFullHtmlDocument(
    title,
    tnWebCss +
      tnPrintCss +
      (includeQuestions ? tnQuestionsWebCss + tnQuestionsPrintCss : '') +
      coverCss +
      runningMarkerWebCss,
    `<div class="section cover-page">${cover}</div>\n${body}${renderAppendicesHtml(appendices, { titles: appendixTitles })}`,
    resourceData
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
      appendices,
      appendixTitles,
    },
    renderedBooks: {},
    // Deprecated: renderHtmlData drops it and renderHTML composes the document.
    // Kept for callers of this renderer in 1.x; removed in 2.0.
    fullHtml,
  };
}

function buildFullHtmlDocument(title, css, content, resource = {}) {
  return `<!DOCTYPE html>
<html ${htmlRootAttributes(resource)}>
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
