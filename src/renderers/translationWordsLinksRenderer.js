import { convertMarkdown } from '../converters/markdownConverter.js';
import {
  buildCoverPage,
  coverCss,
  runningMarkerWebCss,
  renderAppendicesHtml,
  shortenForHeader,
} from './printDocumentAssembler.js';
import { BibleBookData } from '../constants.js';
import {
  escapeHtml,
  parseScriptureExtras,
  getBibleColumns,
  glQuoteForBibleId,
  quoteForDisplay,
  isolatedQuoteHtml,
  renderScriptureColumns,
  htmlRootAttributes,
} from './scriptureColumns.js';
import {
  twKey,
  findTwArticle,
  collectAppendices,
  resolveRcLinks,
  neutralizeDanglingAnchors,
} from './rcAppendices.js';
import { renderTwlTable } from './twlTable.js';
import {
  isObsSubject,
  findObsExtra,
  findObsStory,
  obsStoryLabel,
  obsFrameHeaderRef,
  renderObsFrame,
} from './obsFrames.js';

/**
 * Translation Words Links renderer.
 *
 * A Translation Words Links (TWL) resource pairs each original-language word in
 * a book with the Translation Words article that explains it. Rendered on its
 * own it is "the Translation Words for a book", in one of two layouts:
 *
 *  - `verse` (default): the book read in order. Each verse shows the scripture
 *    (ULT | UST columns) and the table of words in it — the same table the
 *    Translation Notes renderer closes each verse with — linking to the
 *    articles, which are collected into the `tw` appendix with back-references.
 *  - `glossary`: the book's vocabulary. One entry per article cited in the book,
 *    grouped Key Terms / Names / Other and sorted by title, with the article
 *    body inline and the verses where the term occurs. No appendix: the entries
 *    are the articles.
 */

const CATEGORY_ORDER = ['kt', 'names', 'other'];
const CATEGORY_LABELS = { kt: 'Key Terms', names: 'Names', other: 'Other' };

const twlWebCss = `
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

/* ─── Verse layout: scripture columns + the words in the verse ───────────── */

table.twl-scripture-cols,
table.twl-verse-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin: 4px 0 8px 0;
  font-size: 0.95em;
}

.twl-col-label {
  text-align: left;
  font-size: 0.72em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #555;
  border-bottom: 1px solid #ccc;
  padding: 1px 6px;
}

table.twl-scripture-cols td,
table.twl-verse-table td {
  vertical-align: top;
  padding: 3px 6px;
  border-right: 1px solid #eee;
}

table.twl-scripture-cols td:last-child,
table.twl-verse-table td:last-child {
  border-right: none;
}

table.twl-scripture-cols {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
}

td.twl-scripture-text {
  font-style: italic;
}

table.twl-verse-table a {
  text-decoration: none;
}

.twl-verse-header-label {
  display: none;
}

/* OBS story frame — the text the links are about, standing in for scripture. */
.twl-frame-text {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 8px 12px;
  margin: 4px 0 8px 0;
}

.twl-frame-text p {
  margin: 0;
}

.twl-frame-image {
  display: block;
  margin: 0 auto 8px auto;
  max-width: 100%;
}

/* ─── Glossary layout: one entry per article ───────────────────────────── */

.twl-category-header {
  margin-top: 1.2em;
}

article.twl-term {
  margin: 0 0 1em 0;
}

.twl-term-header {
  margin: 0.6em 0 0.2em 0;
}

.twl-term-body h1,
.twl-term-body h2 {
  font-size: 1em;
  margin: 0.5em 0 0.2em 0;
}

.twl-term-refs {
  font-size: 0.9em;
  margin: 0.3em 0 0 0;
}

.twl-term-refs .twl-ref-label {
  font-weight: bold;
}

.twl-term-refs .twl-ref-quote {
  color: #555;
}

.header-title {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.85em;
}
`;

const twlPrintCss = `
.twl-book-header,
.twl-chapter-header,
.twl-verse-header,
.twl-category-header,
.twl-term-header {
  break-after: avoid !important;
}

/* Verse layout: one chapter per page, like Translation Questions — a chapter's
   words are read together, so the next chapter opens a fresh page. */
.twl-chapter-header {
  break-before: page !important;
}

/* ...but the first chapter opens under the book heading rather than stranding
   it, and a chapter's first verse opens under the chapter heading. */
.twl-book-header + .twl-chapter-header,
.twl-chapter-header + .twl-verse-block,
section > .twl-chapter-header:first-child {
  break-before: avoid !important;
}

/* A verse — its scripture and its word table — is read as one thing. */
.twl-verse-block,
table.twl-scripture-cols,
.twl-frame-text {
  break-inside: avoid;
}

/* Glossary layout: each category opens a page. An entry's heading stays with
   the start of its body, but the body itself may split — a Translation Words
   article can run longer than a page, and an unbreakable block taller than the
   page is pushed whole, leaving the previous page short. */
.twl-category-header {
  break-before: page !important;
}

.twl-book-header + .twl-category-header,
section > .twl-category-header:first-child {
  break-before: avoid !important;
}

article.twl-term {
  orphans: 2;
  widows: 2;
}

.twl-term-refs {
  break-inside: avoid;
}
`;

const twlObsPrintCss = `
/* OBS: the picture and the story text are one thing — never split them. */
.twl-frame-text {
  break-inside: avoid;
}
`;

function sortChapterKeys(keys) {
  return keys.sort((a, b) => {
    if (a === 'front') return -1;
    if (b === 'front') return 1;
    return parseInt(a, 10) - parseInt(b, 10);
  });
}

function sortVerseKeys(keys) {
  return keys.sort((a, b) => {
    if (a === 'intro') return -1;
    if (b === 'intro') return 1;
    return parseInt(a, 10) - parseInt(b, 10);
  });
}

function categoryLabel(category, twResource) {
  const meta = twResource?.articles?.[category]?.title;
  return (typeof meta === 'string' && meta) || CATEGORY_LABELS[category] || category;
}

/**
 * Render the resource/book scaffolding shared by both layouts and hand each
 * book's content to `renderBook`. Returns { body, toc }.
 */
function renderBooks(resourceData, ctx, renderBook) {
  const { title, isObs } = ctx;
  const toc = [];
  const bodyParts = [];

  const resourceAnchor = 'nav-resource';
  const resourceToc = { id: resourceAnchor, title, sections: [] };
  toc.push(resourceToc);
  bodyParts.push(
    `<h1 class="twl-resource-header" id="${resourceAnchor}" data-toc-title="${escapeHtml(title)}">` +
      `<a href="#${resourceAnchor}" class="header-link">${escapeHtml(title)}</a></h1>\n` +
      `<span class="running-title">${escapeHtml(title)}</span>\n`
  );

  for (const bookId of ctx.bookIds) {
    const book = resourceData.books[bookId];
    const bookTitle = book.title || BibleBookData[bookId]?.title || bookId;
    const bookAnchor = `nav-${bookId}`;
    // OBS-based resources carry one pseudo-book titled like the resource; a book
    // heading there would repeat the H1, so the chapters hang off the resource.
    const hasBookHeading = bookTitle !== title;
    const bookToc = hasBookHeading
      ? { id: bookAnchor, title: bookTitle, book: bookId, sections: [] }
      : resourceToc;
    if (hasBookHeading) resourceToc.sections.push(bookToc);

    bodyParts.push(
      `<section id="${bookAnchor}"` +
        (isObs ? ' class="obs-frames-body"' : '') +
        (hasBookHeading ? ` data-toc-title="${escapeHtml(bookTitle)}"` : '') +
        `>\n` +
        (hasBookHeading
          ? `  <h2 class="twl-book-header"><a href="#${bookAnchor}" class="header-link">${escapeHtml(bookTitle)}</a></h2>\n`
          : '')
    );

    renderBook({ bookId, book, bookTitle, bookToc, hasBookHeading, bodyParts });

    bodyParts.push(`</section>\n`);
  }

  return { body: bodyParts.join(''), toc };
}

/**
 * Verse layout: chapters and verses in order, each verse with its scripture
 * and the table of the words in it.
 */
function renderVerseLayout(resourceData, ctx) {
  const { bibles, parsedScriptureExtras, isObs, obsData, resolution, options } = ctx;
  const allRcLinks = { ta: new Set(), tw: new Set() };
  const backRefs = { ta: {}, tw: {} };
  const dedupe =
    options.dedupe === 'chapter' || options.dedupe === 'book' ? options.dedupe : 'none';

  const { body, toc } = renderBooks(resourceData, ctx, (b) => {
    const { bookId, book, bookTitle, bookToc, hasBookHeading, bodyParts } = b;
    const chapterTag = hasBookHeading ? 'h3' : 'h2';
    const verseTag = hasBookHeading ? 'h4' : 'h3';
    const seenInBook = new Set();

    for (const chapterKey of sortChapterKeys(Object.keys(book.chapters || {}))) {
      const chapter = book.chapters[chapterKey];
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
      const seenInChapter = new Set();

      if (ctx.showChaptersInToc) {
        bookToc.sections.push({ id: chapterAnchor, title: chapterLabel });
      }
      bodyParts.push(
        `<${chapterTag} class="twl-chapter-header" id="${chapterAnchor}"` +
          (ctx.showChaptersInToc ? ` data-toc-title="${escapeHtml(chapterLabel)}"` : '') +
          `>` +
          `<a href="#${chapterAnchor}" class="header-link">${escapeHtml(chapterLabel)}</a></${chapterTag}>\n`
      );

      for (const verseKey of sortVerseKeys(Object.keys(chapter.verses || {}))) {
        const rows = chapter.verses[verseKey];
        if (!rows || rows.length === 0) continue;

        const isIntro = verseKey === 'intro';
        const verseLabel = isIntro
          ? `${chapterLabel} Introduction`
          : isObs
            ? `${chapterKey}:${verseKey}`
            : `${bookTitle} ${chapterKey}:${verseKey}`;
        const verseAnchor = `nav-${bookId}-${chapterKey}-${verseKey}`;

        const seen = dedupe === 'book' ? seenInBook : seenInChapter;
        const tableHtml = renderTwlTable(rows, {
          bibles,
          bookId,
          chapterKey,
          verseKey,
          // The tw appendix is emitted once, under the first book.
          anchorBookId: ctx.bookIds[0],
          heading: '',
          // The verse header above already carries this verse's id.
          id: false,
          classes: {
            wrapper: 'twl-verse-words',
            header: 'twl-verse-header-label',
            table: 'twl-verse-table',
            label: 'twl-col-label',
            cell: 'twl-verse-cell',
          },
          hasArticle: (key) => Boolean(findTwArticle(ctx.twResource, key)),
          skip: (row, key) => {
            if (dedupe === 'none' || !key) return false;
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
          },
          onArticle: (key) => {
            allRcLinks.tw.add(key);
            if (!backRefs.tw[key]) backRefs.tw[key] = [];
            // One back-reference per verse, however many rows cite the article
            // there — the glossary lists references the same way.
            const refs = backRefs.tw[key];
            if (!refs.length || refs[refs.length - 1].anchor !== verseAnchor) {
              refs.push({ anchor: verseAnchor, label: verseLabel });
            }
          },
        });
        // Every word in the verse was already listed earlier in the scope.
        if (!tableHtml) continue;

        bodyParts.push(`<div class="twl-verse-block">\n`);
        bodyParts.push(
          `<span class="running-ref">${escapeHtml(
            isIntro
              ? chapterLabel
              : isObs
                ? obsFrameHeaderRef(story, chapterKey, verseKey)
                : verseLabel
          )}</span>\n`
        );
        bodyParts.push(
          `<${verseTag} class="twl-verse-header" id="${verseAnchor}">` +
            `<a href="#${verseAnchor}" class="header-link">${escapeHtml(verseLabel)}</a></${verseTag}>\n`
        );

        if (!isIntro && !isFront && ctx.includeScripture) {
          if (isObs) {
            const frameHtml = renderObsFrame(story?.frames?.[parseInt(verseKey, 10)], {
              chapterKey,
              verseKey,
              resolution,
              classes: { panel: 'twl-frame-text', image: 'twl-frame-image' },
            });
            if (frameHtml) bodyParts.push(frameHtml);
          } else {
            const scriptureHtml = renderScriptureColumns(
              bibles,
              parsedScriptureExtras,
              bookId,
              chapterKey,
              verseKey,
              { table: 'twl-scripture-cols', label: 'twl-col-label', text: 'twl-scripture-text' }
            );
            if (scriptureHtml) bodyParts.push(scriptureHtml);
          }
        }

        bodyParts.push(tableHtml);
        bodyParts.push(`</div>\n`);
      }
    }
  });

  return { body, toc, allRcLinks, backRefs };
}

/**
 * Collect, per book, the articles cited by its links with the references
 * (chapter:verse + literal-Bible quote) where each occurs.
 * Returns { [key]: { key, category, slug, title, article, refs: [{ ref, quote }] } }.
 */
function collectBookTerms(book, bookId, ctx) {
  const { bibles, twResource } = ctx;
  const literal = bibles[0];
  const terms = {};
  for (const chapterKey of sortChapterKeys(Object.keys(book.chapters || {}))) {
    const chapter = book.chapters[chapterKey];
    for (const verseKey of sortVerseKeys(Object.keys(chapter.verses || {}))) {
      for (const row of chapter.verses[verseKey] || []) {
        const key = twKey(row.TWLink || row.SupportReference || '');
        if (!key) continue;
        if (!terms[key]) {
          const [category, slug] = key.split('/');
          const article = findTwArticle(twResource, key);
          terms[key] = {
            key,
            category: category || 'other',
            slug: slug || key,
            title: article?.title || slug || key,
            article,
            refs: [],
          };
        }
        const quote = quoteForDisplay(
          (literal?.id && glQuoteForBibleId(row.GLQuotes, literal.id)) || row.Quote || ''
        );
        const ref = `${chapterKey}:${verseKey}`;
        const last = terms[key].refs[terms[key].refs.length - 1];
        // The same word several times in one verse is one reference.
        if (!(last && last.ref === ref && last.quote === quote)) {
          terms[key].refs.push({ ref, quote });
        }
      }
    }
  }
  return terms;
}

/**
 * Glossary layout: each book's cited articles, grouped by category and sorted
 * by title, with the article body inline and the references where it occurs.
 */
function renderGlossaryLayout(resourceData, ctx) {
  const { twResource } = ctx;
  const allRcLinks = { ta: new Set(), tw: new Set() };

  // Every cited article across the books is known before any entry is
  // rendered, so cross-links between entries resolve whichever book they are in.
  // An article cited in several books has an entry in each; a link to it goes
  // to the entry in the linking book if there is one, else the first book's.
  const termsByBook = {};
  const twHome = {};
  for (const bookId of ctx.bookIds) {
    termsByBook[bookId] = collectBookTerms(resourceData.books[bookId], bookId, ctx);
    for (const key of Object.keys(termsByBook[bookId])) {
      allRcLinks.tw.add(key);
      if (!twHome[key]) twHome[key] = bookId;
    }
  }
  ctx.twBookFor = (key) => twHome[key];

  const { body, toc } = renderBooks(resourceData, ctx, (b) => {
    const { bookId, bookTitle, bookToc, hasBookHeading, bodyParts } = b;
    const categoryTag = hasBookHeading ? 'h3' : 'h2';
    const termTag = hasBookHeading ? 'h4' : 'h3';
    const terms = termsByBook[bookId];

    const categories = [
      ...CATEGORY_ORDER,
      ...Object.keys(
        Object.values(terms).reduce((acc, t) => ((acc[t.category] = 1), acc), {})
      ).filter((c) => !CATEGORY_ORDER.includes(c)),
    ];

    for (const category of categories) {
      const entries = Object.values(terms)
        .filter((t) => t.category === category)
        .sort((x, y) => x.title.localeCompare(y.title, undefined, { sensitivity: 'base' }));
      if (entries.length === 0) continue;

      const label = categoryLabel(category, twResource);
      const categoryAnchor = `nav-${bookId}-${category}`;
      bookToc.sections.push({ id: categoryAnchor, title: label });
      bodyParts.push(
        `<${categoryTag} class="twl-category-header" id="${categoryAnchor}" data-toc-title="${escapeHtml(label)}">` +
          `<a href="#${categoryAnchor}" class="header-link">${escapeHtml(label)}</a></${categoryTag}>\n`
      );

      for (const term of entries) {
        const anchor = `nav-${bookId}--tw-${term.key.replace(/\//g, '-')}`;
        let html = `<article class="twl-term" id="${anchor}">\n`;
        html += `  <span class="running-ref">${escapeHtml(shortenForHeader(term.title, 4))}</span>\n`;
        html += `  <${termTag} class="twl-term-header"><a href="#${anchor}" class="header-link">${escapeHtml(term.title)}</a></${termTag}>\n`;
        if (ctx.includeArticles && term.article) {
          // Same-category relative links need the entry's own category, so each
          // body is resolved here; the whole-body pass below handles the rest.
          const articleHtml = resolveRcLinks(
            convertMarkdown(term.article.text || term.article.body || ''),
            bookId,
            allRcLinks,
            ctx.extras,
            ctx.bookIdSet,
            {
              twCategory: term.category,
              twBookFor: (key) => (terms[key] ? bookId : twHome[key]),
            }
          );
          html += `  <div class="twl-term-body">${articleHtml}</div>\n`;
        }
        const refs = term.refs
          .map(
            (r) =>
              `<span class="twl-ref">${escapeHtml(r.ref)}` +
              (r.quote
                ? ` <span class="twl-ref-quote">(${isolatedQuoteHtml(r.quote)})</span>`
                : '') +
              `</span>`
          )
          .join(', ');
        html += `  <div class="twl-term-refs"><span class="twl-ref-label">${escapeHtml(bookTitle)}:</span> ${refs}</div>\n`;
        html += `</article>\n`;
        bodyParts.push(html);
      }
    }
  });

  return { body, toc, allRcLinks, backRefs: { ta: {}, tw: {} } };
}

/**
 * Render TSV Translation Words Links (and the OBS variant) into HTML.
 *
 * @param {Object} resourceData - Output from getResourceData() with type 'tsv'
 * @param {Object} [options] - Rendering options
 * @param {'verse'|'glossary'} [options.layout='verse'] - Book in reading order
 *   with a word table per verse, or one entry per article cited in the book
 * @param {boolean} [options.includeScripture=true] - Verse layout: show the verse
 *   in parallel scripture columns (ULT | UST) above its word table
 * @param {boolean} [options.includeArticles=true] - Include the Translation Words
 *   article bodies: as the `tw` appendix (verse layout) or inline (glossary)
 * @param {'none'|'chapter'|'book'} [options.dedupe='none'] - Verse layout: list a
 *   word only the first time it occurs in the chapter / the book
 * @param {boolean} [options.showChaptersInToc] - Verse layout: force chapter entries
 *   in the TOC (default: on for a single-book document). The glossary lists each
 *   book's categories either way
 * @param {string} [options.resolution='none'] - OBS frame picture resolution
 * @returns {Object} Rendered HTML package
 */
export function renderTranslationWordsLinksHtml(resourceData, options = {}) {
  if (!resourceData || resourceData.type !== 'tsv' || !resourceData.books) {
    throw new Error(
      'Translation Words Links renderer expects TSV resource data from getResourceData().'
    );
  }

  const title = resourceData.title || 'Translation Words Links';
  const extras = resourceData.extras || {};
  const isObs = isObsSubject(resourceData.subject);
  const layout = options.layout === 'glossary' ? 'glossary' : 'verse';

  const bookIds = Object.keys(resourceData.books).sort((a, b) => {
    const aSort = resourceData.books[a].sort || 0;
    const bSort = resourceData.books[b].sort || 0;
    return aSort - bSort;
  });

  const ctx = {
    title,
    options,
    isObs,
    bookIds,
    bibles: isObs ? [] : getBibleColumns(extras),
    parsedScriptureExtras: isObs
      ? {}
      : parseScriptureExtras(extras, { editorMode: options.editorMode === true }),
    obsData: isObs ? findObsExtra(extras) : null,
    twResource: extras.tw,
    extras,
    bookIdSet: new Set(bookIds),
    resolution: options.resolution || 'none',
    includeScripture: options.includeScripture !== false,
    includeArticles: options.includeArticles !== false,
    showChaptersInToc:
      typeof options.showChaptersInToc === 'boolean'
        ? options.showChaptersInToc
        : bookIds.length === 1,
  };

  const rendered =
    layout === 'glossary'
      ? renderGlossaryLayout(resourceData, ctx)
      : renderVerseLayout(resourceData, ctx);

  const firstBook = bookIds[0] || '';
  const bookIdSet = new Set(bookIds);
  // Verse layout: the cited articles become the `tw` appendix. Glossary: the
  // entries are the articles, so there is nothing to append.
  const appendices =
    layout === 'verse' && ctx.includeArticles
      ? collectAppendices(rendered.allRcLinks, extras, firstBook, rendered.backRefs)
      : {};
  const appendixTitles = { tw: extras.tw?.title };

  let body = resolveRcLinks(rendered.body, firstBook, rendered.allRcLinks, extras, bookIdSet, {
    twBookFor: ctx.twBookFor,
  });
  for (const kind of Object.keys(appendices)) {
    for (const id of Object.keys(appendices[kind])) {
      appendices[kind][id].html = resolveRcLinks(
        appendices[kind][id].html,
        firstBook,
        rendered.allRcLinks,
        extras,
        bookIdSet,
        kind === 'tw' ? { twCategory: id.split('/')[0] } : {}
      );
    }
  }

  // Article bodies link to verses ("Titus 3:1"); the glossary has no verse
  // anchors, and a deduplicated verse layout drops verses. Point any such link
  // at nothing, as references to other books already are, rather than leave a
  // dead anchor.
  const neutralized = neutralizeDanglingAnchors(body, appendices);
  body = neutralized.body;
  const finalAppendices = neutralized.appendices;

  const cover = buildCoverPage({
    title,
    version: resourceData.version,
    abbreviation: resourceData.abbreviation,
    bookTitle:
      !isObs && bookIds.length === 1
        ? resourceData.books[bookIds[0]].title || BibleBookData[bookIds[0]]?.title || bookIds[0]
        : '',
  });
  const copyright = resourceData.license
    ? `<div class="license-text">${convertMarkdown(resourceData.license)}</div>`
    : '';
  const css = {
    web: twlWebCss + coverCss + runningMarkerWebCss,
    print: isObs ? twlPrintCss + twlObsPrintCss : twlPrintCss,
  };
  const fullHtml = buildFullHtmlDocument(
    title,
    twlWebCss + twlPrintCss + coverCss + runningMarkerWebCss,
    `<div class="section cover-page">${cover}</div>\n${body}${renderAppendicesHtml(finalAppendices, { titles: appendixTitles })}`,
    resourceData
  );

  return {
    subject: resourceData.subject,
    title,
    sections: {
      cover,
      copyright,
      body,
      toc: rendered.toc,
      css,
      webView: null,
      appendices: finalAppendices,
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
