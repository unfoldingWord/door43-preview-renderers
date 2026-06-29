import usfm from 'usfm-js';

/**
 * Shared scripture-column + GL-quote helpers used by the Translation Notes and
 * TSV Questions renderers. The data helpers (parse/select/lookup) are pure; the
 * two render helpers take a `classes` map so each renderer keeps its own CSS
 * class names (e.g. `tn-scripture-cols` vs `tq-scripture-cols`).
 */

// Subjects whose verse text should appear in a scripture block. The Greek/Hebrew
// originals are sources for quote conversion, NOT scripture to display.
export const GL_SCRIPTURE_SUBJECTS = new Set(['Aligned Bible', 'Bible']);

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Recursively pull plain text out of usfm-js verseObjects, skipping footnotes,
 * cross references and any residual milestone/alignment wrappers.
 */
export function extractVerseObjectsText(verseObjects) {
  if (!Array.isArray(verseObjects)) return '';
  let text = '';
  for (const obj of verseObjects) {
    if (!obj) continue;
    if (obj.type === 'text' || obj.type === 'word') {
      text += obj.text || '';
    } else if (obj.type === 'footnote' || obj.tag === 'f' || obj.tag === 'x') {
      // Skip note/cross-reference content
      continue;
    } else if (Array.isArray(obj.children)) {
      text += extractVerseObjectsText(obj.children);
    } else if (typeof obj.text === 'string') {
      text += obj.text;
    }
  }
  return text;
}

/**
 * Parse the aligned-Bible extras once into { identifier: { abbr, chapters } } where
 * chapters maps chapter -> verse -> plain verse text. The data layer hands us raw
 * (alignment-stripped) USFM strings per book, so we parse them with usfm-js here.
 * Greek/Hebrew originals are excluded — they are quote-conversion sources, not GL scripture.
 */
export function parseScriptureExtras(extras) {
  const parsed = {};
  if (!extras) return parsed;

  for (const [identifier, resource] of Object.entries(extras)) {
    if (resource?.type !== 'usfm' || !resource.books) continue;
    if (!GL_SCRIPTURE_SUBJECTS.has(resource.subject)) continue;

    const chaptersByBook = {};
    for (const [bookId, usfmContent] of Object.entries(resource.books)) {
      if (typeof usfmContent !== 'string') continue;
      try {
        const json = usfm.toJSON(usfmContent);
        const out = {};
        for (const [ch, verses] of Object.entries(json.chapters || {})) {
          out[ch] = {};
          for (const [v, verseData] of Object.entries(verses)) {
            if (v === 'front') continue;
            const text = extractVerseObjectsText(verseData?.verseObjects).replace(/\s+/g, ' ').trim();
            if (text) out[ch][v] = text;
          }
        }
        chaptersByBook[bookId] = out;
      } catch {
        // Leave this book unparsed; scripture block will simply be omitted for it.
      }
    }

    parsed[identifier] = {
      abbr: (resource.abbreviation || identifier).toUpperCase(),
      chapters: chaptersByBook,
    };
  }

  return parsed;
}

/**
 * Build the ordered list of GL Bibles to render as parallel columns, from the
 * aligned-Bible extras. Literal (ult/glt) first, then simplified (ust/gst),
 * then any others. Returns [{ id, abbr }] where id is the extras key (e.g. 'ult').
 */
export function getBibleColumns(extras) {
  const bibles = [];
  for (const [id, resource] of Object.entries(extras || {})) {
    if (resource?.type === 'usfm' && GL_SCRIPTURE_SUBJECTS.has(resource.subject)) {
      bibles.push({ id, abbr: id.toUpperCase() });
    }
  }
  const rank = (id) => (/^(ult|glt)$/i.test(id) ? 0 : /^(ust|gst)$/i.test(id) ? 1 : 2);
  return bibles.sort((a, b) => rank(a.id) - rank(b.id));
}

/**
 * Look up the GL quote for a specific Bible from a row's GLQuotes object.
 * GLQuotes is keyed by Bible repo identifier (e.g. "en_ult"); `id` is the short
 * extras key (e.g. "ult"). Matches a direct key or a repo whose final
 * underscore-segment equals the id.
 */
export function glQuoteForBibleId(glQuotes, id) {
  if (!glQuotes || typeof glQuotes !== 'object' || !id) return '';
  if (glQuotes[id]?.Quote) return glQuotes[id].Quote;
  const key = Object.keys(glQuotes).find(
    (k) => k.split('_').pop().toLowerCase() === id.toLowerCase()
  );
  return key ? glQuotes[key].Quote || '' : '';
}

/**
 * Render the per-verse scripture as parallel columns (one per Bible, e.g. ULT | UST).
 * Returns '' if no Bible has text for this verse.
 *
 * @param {Array} bibles - From getBibleColumns()
 * @param {Object} parsedExtras - From parseScriptureExtras()
 * @param {Object} classes - { table, label, text } CSS class names
 */
export function renderScriptureColumns(bibles, parsedExtras, bookId, ch, v, classes = {}) {
  const { table = 'scripture-cols', label = 'col-label', text = 'scripture-text' } = classes;
  const cols = bibles.length ? bibles : [];
  const cells = cols.map((b) => ({
    abbr: b.abbr,
    text: parsedExtras[b.id]?.chapters?.[bookId]?.[String(ch)]?.[String(v)] || '',
  }));
  if (cells.length === 0 || cells.every((c) => !c.text)) return '';

  const head = cells.map((c) => `<th class="${label}">${escapeHtml(c.abbr)}</th>`).join('');
  const row = cells.map((c) => `<td class="${text}">${escapeHtml(c.text)}</td>`).join('');
  return (
    `<table class="${table}">\n` +
    `  <thead><tr>${head}</tr></thead>\n` +
    `  <tbody><tr>${row}</tr></tbody>\n` +
    `</table>\n`
  );
}

/**
 * Render a row's quote header: one line per Bible (literal Bible bold) tagged
 * with the Bible abbreviation, plus the original-language quote once. Falls back
 * to the original quote alone when no GL quotes converted. Returns '' when the
 * row has no quote at all.
 *
 * @param {Object} row - Note/question row carrying `Quote` and `GLQuotes`
 * @param {Array} bibles - From getBibleColumns()
 * @param {Object} classes - { header, quote, tag, orig } CSS class names
 */
export function renderQuoteHeader(row, bibles, classes = {}) {
  const { header = 'note-header', quote = 'note-quote', tag = 'bible-tag', orig = 'note-orig' } = classes;
  const origQuote = row.Quote || '';
  const lines = [];
  let anyGl = false;
  bibles.forEach((b, i) => {
    const q = glQuoteForBibleId(row.GLQuotes, b.id);
    if (!q) return;
    anyGl = true;
    const quoteHtml = i === 0 ? `<strong>${escapeHtml(q)}</strong>` : escapeHtml(q);
    lines.push(
      `  <div class="${quote}"><span class="${tag}">${escapeHtml(b.abbr)}</span> ${quoteHtml}</div>`
    );
  });
  if (!anyGl && origQuote) {
    lines.push(`  <div class="${quote}"><strong>${escapeHtml(origQuote)}</strong></div>`);
  }
  if (lines.length === 0) return '';
  let html = `<div class="${header}">\n${lines.join('\n')}\n`;
  if (anyGl && origQuote) {
    html += `  <div class="${orig}">(${escapeHtml(origQuote)})</div>\n`;
  }
  html += `</div>\n`;
  return html;
}
