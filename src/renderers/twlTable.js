import { escapeHtml, glQuoteForBibleId, quoteForDisplay } from './scriptureColumns.js';
import { twKey } from './rcAppendices.js';

/**
 * The per-verse Translation Words table: one row per Translation Words Link,
 * one column per aligned Bible (e.g. ULT | UST) holding that Bible's GL quote
 * for the word, linked to the Translation Words article. Shared by the
 * Translation Notes renderer (where it closes each verse) and the Translation
 * Words Links renderer (where it is the verse's content).
 *
 * @param {Array<Object>} rows - TWL rows for one verse (`Quote`, `GLQuotes`, `TWLink`)
 * @param {Object} opts
 * @param {Array<{id:string, abbr:string}>} opts.bibles - From getBibleColumns(); empty
 *   falls back to a single "Quote" column showing the row's own quote
 * @param {string} opts.bookId
 * @param {string} opts.chapterKey
 * @param {string} opts.verseKey
 * @param {Object} [opts.classes] - { wrapper, header, table, label, cell } CSS class names
 * @param {string} [opts.heading='Translation Words'] - Table heading; '' omits it
 * @param {function} [opts.onArticle] - Called with each row's TW article key
 *   (`category/slug`) so the caller can collect appendix articles / back-references
 * @param {function} [opts.skip] - Called with (row, key); return true to leave the row out
 * @returns {string} HTML, or '' when no row is rendered
 */
export function renderTwlTable(rows, opts = {}) {
  const {
    bibles = [],
    bookId,
    chapterKey,
    verseKey,
    heading = 'Translation Words',
    onArticle,
    skip,
  } = opts;
  const classes = {
    wrapper: 'verse-twls',
    header: 'verse-twl-header',
    table: 'verse-twl-table',
    label: 'col-label',
    cell: 'verse-twl-cell',
    ...(opts.classes || {}),
  };
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const cols = bibles.length ? bibles : [{ id: null, abbr: 'Quote' }];
  const head = cols.map((b) => `<th class="${classes.label}">${escapeHtml(b.abbr)}</th>`).join('');

  const bodyRows = [];
  for (const row of rows) {
    const key = twKey(row.TWLink || row.SupportReference || '');
    if (skip && skip(row, key)) continue;
    if (key && onArticle) onArticle(key, row);
    const twAnchor = key ? `nav-${bookId}--tw-${key.replace(/\//g, '-')}` : '';
    const cells = cols
      .map((b) => {
        const q = quoteForDisplay((b.id && glQuoteForBibleId(row.GLQuotes, b.id)) || row.Quote || '');
        const inner = twAnchor
          ? `<a href="#${twAnchor}" class="internal-link">${escapeHtml(q)}</a>`
          : escapeHtml(q);
        return `<td class="${classes.cell}">${inner}</td>`;
      })
      .join('');
    bodyRows.push(`      <tr>${cells}</tr>\n`);
  }
  if (bodyRows.length === 0) return '';

  let html = `<div class="${classes.wrapper}" id="twl-${bookId}-${chapterKey}-${verseKey}">\n`;
  if (heading) html += `  <h4 class="${classes.header}">${escapeHtml(heading)}</h4>\n`;
  html += `  <table class="${classes.table}">\n    <thead><tr>${head}</tr></thead>\n    <tbody>\n`;
  html += bodyRows.join('');
  html += `    </tbody>\n  </table>\n</div>\n`;
  return html;
}
