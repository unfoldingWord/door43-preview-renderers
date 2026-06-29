import { convertNoteFromMD2HTML, convertMarkdown } from '../converters/markdownConverter.js';
import { buildCoverPage, coverCss } from './printDocumentAssembler.js';
import { BibleBookData } from '../constants.js';
import {
  escapeHtml,
  parseScriptureExtras,
  getBibleColumns,
  glQuoteForBibleId,
  renderScriptureColumns,
  renderQuoteHeader,
} from './scriptureColumns.js';

/**
 * Normalize a Translation Words reference to a canonical "category/slug" key.
 * Accepts rc links ("rc://*\/tw/dict/bible/names/paul"), already-stripped paths
 * ("bible/names/paul" or "names/paul"). The leading "bible/" container is dropped.
 */
function twKey(ref) {
  if (!ref) return '';
  let p = String(ref).replace(/^rc:\/\/[^/]+\/tw\/dict\//, '').replace(/^rc:\/\/[^/]+\/tw\//, '');
  p = p.replace(/^bible\//, '');
  return p.replace(/\.md$/, '');
}

/**
 * Search note HTML for rc:// links to TA and TW articles.
 * Returns found links categorized by resource type.
 */
function extractRcLinks(html) {
  const links = { ta: new Set(), tw: new Set() };
  const regex = /rc:\/\/[^/]+\/([^/]+)\/[^/]+\/([A-Za-z0-9/_-]+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const resourceType = match[1];
    const articlePath = match[2];
    if (resourceType === 'ta' || resourceType === 'tw') {
      links[resourceType].add(articlePath);
    }
  }
  return links;
}

/**
 * Render a single appendix article block (markdown body -> HTML).
 */
function renderAppendixArticle(anchorId, article, backRefList, bookId) {
  const bodyHtml = convertMarkdown(article.text || article.body || '');
  let html = `<article class="appendix-article" id="${anchorId}" data-toc-title="${escapeHtml(article.title)}">\n`;
  html += `  <h3 class="appendix-article-header"><a href="#${anchorId}" class="header-link">${escapeHtml(article.title)}</a></h3>\n`;
  html += `  <div class="appendix-article-body">${bodyHtml}</div>\n`;
  if (backRefList && backRefList.length > 0) {
    html += `  <div class="back-refs"><h4>${escapeHtml(BibleBookData[bookId]?.title || bookId)} References:</h4>\n`;
    html += backRefList
      .map((ref) => `    <a href="#${ref.anchor}" class="internal-link">${escapeHtml(ref.label)}</a>`)
      .join('\n');
    html += `\n  </div>\n`;
  }
  html += `</article>\n`;
  return html;
}

/**
 * Build appendix HTML for TA and TW articles referenced in notes / TWL lists.
 */
function buildAppendix(rcLinks, extras, bookId, backRefs) {
  let html = '';

  // TA Appendix
  const taResource = extras?.ta;
  if (taResource?.manuals && rcLinks.ta.size > 0) {
    let inner = '';
    for (const articlePath of Array.from(rcLinks.ta).sort()) {
      const article = findTaArticle(taResource, articlePath);
      if (!article) continue;
      const anchorId = `nav-${bookId}--ta-${articlePath.replace(/\//g, '-')}`;
      inner += renderAppendixArticle(anchorId, article, backRefs.ta[articlePath], bookId);
    }
    if (inner) {
      html += `<section class="appendix ta" id="appendix-ta" data-toc-title="Translation Academy">\n`;
      html += `  <h2 class="appendix-header">Translation Academy</h2>\n`;
      html += inner;
      html += `</section>\n`;
    }
  }

  // TW Appendix
  const twResource = extras?.tw;
  if (twResource?.articles && rcLinks.tw.size > 0) {
    let inner = '';
    for (const articlePath of Array.from(rcLinks.tw).sort()) {
      const article = findTwArticle(twResource, articlePath);
      if (!article) continue;
      const anchorId = `nav-${bookId}--tw-${articlePath.replace(/\//g, '-')}`;
      inner += renderAppendixArticle(anchorId, article, backRefs.tw[articlePath], bookId);
    }
    if (inner) {
      html += `<section class="appendix tw" id="appendix-tw" data-toc-title="Translation Words">\n`;
      html += `  <h2 class="appendix-header">Translation Words</h2>\n`;
      html += inner;
      html += `</section>\n`;
    }
  }

  return html;
}

/**
 * Look up a TA article by "manual/article" path, e.g. "translate/figs-abstractnouns".
 * Returns { title, text } or null.
 */
function findTaArticle(taResource, articlePath) {
  const [manualId, articleId] = String(articlePath).split('/');
  const article = taResource?.manuals?.[manualId]?.articles?.[articleId];
  return article && article.title ? article : null;
}

/**
 * Look up a TW article by canonical "category/slug" key, e.g. "names/paul".
 * twResource.articles[category] is an object keyed by slug (with a stray "title"
 * meta key for the category name). Returns { title, text } or null.
 */
function findTwArticle(twResource, articlePath) {
  const [category, slug] = twKey(articlePath).split('/');
  const article = twResource?.articles?.[category]?.[slug];
  return article && typeof article === 'object' && article.title ? article : null;
}

/**
 * Resolve rc:// links to internal anchors. Handles three forms:
 *   - markdown-link hrefs:  <a href="rc://*\/ta/man/translate/figs-x">text</a>
 *   - double-bracket refs:  [[rc://*\/ta/man/translate/figs-x]]   (becomes a titled link)
 *   - bare references:      rc://*\/ta/man/translate/figs-x        (e.g. SupportReference)
 * Bracket/bare forms are replaced with a link whose text is the article title.
 */
function resolveRcLinks(html, bookId, rcLinks, extras, bookIdSet = new Set()) {
  const taAnchor = (path) => `nav-${bookId}--ta-${path.replace(/\//g, '-')}`;
  const twAnchor = (key) => `nav-${bookId}--tw-${key.replace(/\//g, '-')}`;

  // Pass 1: rewrite hrefs of existing markdown links, keeping their visible text.
  html = html.replace(/href="rc:\/\/[^"]*\/ta\/[^/]+\/([A-Za-z0-9/_-]+)"/g, (m, path) =>
    rcLinks.ta.has(path) ? `href="#${taAnchor(path)}" class="internal-link"` : 'href="#" class="unresolved-link"'
  );
  html = html.replace(/href="(rc:\/\/[^"]*\/tw\/[^"]+)"/g, (m, rc) => {
    const key = twKey(rc);
    return rcLinks.tw.has(key) ? `href="#${twAnchor(key)}" class="internal-link"` : 'href="#" class="unresolved-link"';
  });
  // Scripture/TN cross-references (e.g. rc://*\/tn/help/jud/01/17 inside TW/TA articles).
  // Link internally when the target book is in this document; otherwise neutralize —
  // a single-book TN doc cannot anchor verses in books it does not contain.
  html = html.replace(
    /href="rc:\/\/[^"]*\/(?:tn\/help|bible\/[^/]+)\/([a-z0-9-]{3})\/0*(\d+)\/0*(\d+)"/g,
    (m, bk, ch, v) =>
      bookIdSet.has(bk)
        ? `href="#nav-${bk}-${parseInt(ch, 10)}-${parseInt(v, 10)}" class="internal-link"`
        : 'href="#" class="external-ref"'
  );
  // Final href catch-all: never leave a raw rc:// in a link target.
  html = html.replace(/href="rc:\/\/[^"]+"/g, 'href="#" class="unresolved-link"');

  // Pass 2: bracket refs and bare refs -> titled links. Negative lookbehind keeps us
  // out of attribute values (those were handled in pass 1).
  html = html.replace(
    /\[\[\s*(rc:\/\/[^\]\s]+)\s*\]\]|(?<!["'(=>])(rc:\/\/[^\s"'<>)\]]+)/g,
    (match, bracketed, bare) => {
      const rc = bracketed || bare;
      const taMatch = rc.match(/\/ta\/[^/]+\/([A-Za-z0-9/_-]+)/);
      if (taMatch) {
        const path = taMatch[1];
        if (rcLinks.ta.has(path)) {
          const title = findTaArticle(extras?.ta, path)?.title || path;
          return `<a href="#${taAnchor(path)}" class="internal-link">${escapeHtml(title)}</a>`;
        }
        return `<span class="unresolved-link">${escapeHtml(path)}</span>`;
      }
      if (/\/tw\//.test(rc)) {
        const key = twKey(rc);
        if (key && rcLinks.tw.has(key)) {
          const title = findTwArticle(extras?.tw, key)?.title || key;
          return `<a href="#${twAnchor(key)}" class="internal-link">${escapeHtml(title)}</a>`;
        }
        return `<span class="unresolved-link">${escapeHtml(key)}</span>`;
      }
      // Non TA/TW rc:// link (e.g. obs) — leave untouched.
      return match;
    }
  );

  return html;
}

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

.tn-note-orig {
  font-size: 0.85em;
  color: #666;
}

.tn-note-body {
  padding: 2px 0;
}

.tn-note-support-reference {
  font-size: 0.8em;
  color: #555;
  margin: 1px 0 0 0;
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

.tn-scripture-block {
  break-inside: avoid;
}

article.tn-note {
  break-inside: avoid;
  orphans: 2;
  widows: 2;
}

hr {
  break-before: avoid !important;
}

.appendix-article {
  break-after: page !important;
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
 * @returns {Object} Rendered HTML package
 */
export function renderTranslationNotesHtml(resourceData, options = {}) {
  if (!resourceData || resourceData.type !== 'tsv' || !resourceData.books) {
    throw new Error('Translation Notes renderer expects TSV resource data from getResourceData().');
  }

  const title = resourceData.title || 'Translation Notes';
  const extras = resourceData.extras || {};
  // Parse aligned-Bible USFM once up front so per-verse scripture lookups are cheap.
  const parsedScriptureExtras = parseScriptureExtras(extras);
  // Ordered GL Bibles (e.g. ULT, UST) rendered as parallel columns for scripture + TWL.
  const bibles = getBibleColumns(extras);
  const toc = [];
  const bodyParts = [];

  // Collect all rc links for appendix generation
  const allRcLinks = { ta: new Set(), tw: new Set() };
  const backRefs = { ta: {}, tw: {} };

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

    // Book header
    bodyParts.push(
      `<section id="${bookAnchor}" data-toc-title="${escapeHtml(title)} - ${escapeHtml(bookTitle)}">\n` +
      `  <h1 class="tn-book-header"><a href="#${bookAnchor}" class="header-link">${escapeHtml(title)} - ${escapeHtml(bookTitle)}</a></h1>\n`
    );

    // Sort chapters numerically (handle 'front' as 0)
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

      // Chapter header
      bodyParts.push(
        `<h2 class="tn-chapter-header" id="${chapterAnchor}" data-toc-title="${escapeHtml(chapterLabel)}">` +
        `<a href="#${chapterAnchor}" class="header-link">${escapeHtml(chapterLabel)}</a></h2>\n`
      );

      // Sort verses numerically (handle 'intro' as 0)
      const verseKeys = Object.keys(chapter.verses || {}).sort((a, b) => {
        if (a === 'intro') return -1;
        if (b === 'intro') return 1;
        return parseInt(a, 10) - parseInt(b, 10);
      });

      for (const verseKey of verseKeys) {
        const notes = chapter.verses[verseKey];
        if (!notes || notes.length === 0) continue;

        const isIntro = verseKey === 'intro';
        const verseLabel = isIntro
          ? `${chapterLabel} Introduction`
          : `${bookTitle} ${chapterKey}:${verseKey}`;
        const verseAnchor = `nav-${bookId}-${chapterKey}-${verseKey}`;

        // Verse header
        bodyParts.push(
          `<h3 class="tn-verse-header" id="${verseAnchor}">` +
          `<a href="#${verseAnchor}" class="header-link">${escapeHtml(verseLabel)}</a></h3>\n`
        );

        // Scripture as parallel columns (one per aligned Bible, e.g. ULT | UST)
        if (!isIntro && !isFront) {
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
            orig: 'tn-note-orig',
          });

          let noteArticle = `<article class="tn-note" id="${noteAnchor}">\n`;
          noteArticle += quoteHeader;
          noteArticle += `  <div class="tn-note-body">${noteHtml}</div>\n`;

          if (supportRef) {
            noteArticle += `  <div class="tn-note-support-reference"><span class="tn-note-label">Support Reference:</span> ${escapeHtml(supportRef)}</div>\n`;
          }

          noteArticle += `</article>\n`;
          noteArticle += `<hr class="note-divider">\n`;

          bodyParts.push(noteArticle);
        }

        // Translation Words Links for this verse (from extras.twl)
        const twlResource = extras?.twl;
        if (twlResource?.books?.[bookId]?.chapters?.[chapterKey]?.verses?.[verseKey]) {
          const twlNotes = twlResource.books[bookId].chapters[chapterKey].verses[verseKey];
          if (twlNotes.length > 0) {
            // Columns: one per aligned Bible (e.g. ULT | UST); fall back to a single
            // "Quote" column when no aligned Bibles are available.
            const twlCols = bibles.length ? bibles : [{ id: null, abbr: 'Quote' }];
            const head = twlCols
              .map((b) => `<th class="tn-col-label">${escapeHtml(b.abbr)}</th>`)
              .join('');

            let twlHtml = `<div class="tn-verse-twls" id="twl-${bookId}-${chapterKey}-${verseKey}">\n`;
            twlHtml += `  <h4 class="tn-verse-twl-header">Translation Words</h4>\n`;
            twlHtml += `  <table class="tn-verse-twl-table">\n    <thead><tr>${head}</tr></thead>\n    <tbody>\n`;

            for (const twlNote of twlNotes) {
              const twRef = twlNote.TWLink || twlNote.SupportReference || '';
              const key = twKey(twRef);
              // Register the referenced TW article so it appears in the appendix,
              // and record a back-reference from the article to this verse.
              if (key) {
                allRcLinks.tw.add(key);
                if (!backRefs.tw[key]) backRefs.tw[key] = [];
                backRefs.tw[key].push({ anchor: verseAnchor, label: verseLabel });
              }
              const twAnchor = key ? `nav-${bookId}--tw-${key.replace(/\//g, '-')}` : '';

              const cells = twlCols
                .map((b) => {
                  const q = (b.id && glQuoteForBibleId(twlNote.GLQuotes, b.id)) || twlNote.Quote || '';
                  const inner = twAnchor
                    ? `<a href="#${twAnchor}" class="internal-link">${escapeHtml(q)}</a>`
                    : escapeHtml(q);
                  return `<td class="tn-verse-twl-cell">${inner}</td>`;
                })
                .join('');
              twlHtml += `      <tr>${cells}</tr>\n`;
            }

            twlHtml += `    </tbody>\n  </table>\n</div>\n`;
            bodyParts.push(twlHtml);
          }
        }
      }
    }

    bodyParts.push(`</section>\n`);
  }

  // Build appendices (after the main loop so TWL-referenced TW articles are collected)
  const appendixHtml = buildAppendix(allRcLinks, extras, bookIds[0] || '', backRefs);

  // Resolve rc links across the whole document, including appendix cross-links
  let body = bodyParts.join('') + appendixHtml;
  body = resolveRcLinks(body, bookIds[0] || '', allRcLinks, extras, new Set(bookIds));

  const cover = buildCoverPage({
    title,
    version: resourceData.version,
    abbreviation: resourceData.abbreviation,
  });
  const copyright = resourceData.license
    ? `<div class="license-text">${convertMarkdown(resourceData.license)}</div>`
    : '';
  const css = { web: tnWebCss + coverCss, print: tnPrintCss };
  const fullHtml = buildFullHtmlDocument(
    title,
    tnWebCss + tnPrintCss + coverCss,
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
