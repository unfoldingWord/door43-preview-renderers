import usfm from 'usfm-js';
import { extractVerseObjectsText } from '../bibleHelpers.js';

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
 * The `lang` and `dir` attributes for a document's <html> element, from the
 * resource's language code and direction (`en` and `ltr` when unknown).
 *
 * @param {Object} [resource] - ResourceData or HtmlData: `{ language, direction }`
 * @returns {string} e.g. `lang="ar" dir="rtl"`
 */
export function htmlRootAttributes({ language, direction } = {}) {
  return `lang="${escapeHtml(language || 'en')}" dir="${direction === 'rtl' ? 'rtl' : 'ltr'}"`;
}

// Verse-text extraction is shared with the data layer (which recomputes TWL GL
// occurrences against the verse), so it lives in bibleHelpers.
export { extractVerseObjectsText };

/**
 * Parse the aligned-Bible extras once into { identifier: { abbr, chapters } } where
 * chapters maps chapter -> verse -> plain verse text. The data layer hands us raw
 * (alignment-stripped) USFM strings per book, so we parse them with usfm-js here.
 * Greek/Hebrew originals are excluded — they are quote-conversion sources, not GL scripture.
 *
 * ULT/UST mark supplied words with {curly braces}. The Aligned Bible renderer
 * hides those unless `editorMode`; the columns do the same by dropping the
 * braces from the text, keeping them only when `editorMode` is set.
 *
 * @param {Object} extras - ResourceData extras
 * @param {Object} [options]
 * @param {boolean} [options.editorMode=false] - Keep the implied-word braces
 */
export function parseScriptureExtras(extras, { editorMode = false } = {}) {
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
            const raw = extractVerseObjectsText(verseData?.verseObjects)
              .replace(/\s+/g, ' ')
              .trim();
            const text = editorMode
              ? raw
              : raw
                  .replace(/[{}]/g, '')
                  .replace(/\s{2,}/g, ' ')
                  .trim();
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
 * Display form of a TSV quote. A discontiguous quote is stored with its spans
 * joined by `&` — the form the quote lookup emits and the form
 * twQuoteTrim.js splits on — but it reads as an ellipsis:
 * "God & the people whom he has chosen" → "God … the people whom he has chosen".
 *
 * Only a `&` that stands between the spans is converted (whitespace on at least
 * one side), so an ampersand inside a word is left alone.
 */
export function quoteForDisplay(quote) {
  if (!quote) return '';
  return String(quote).replace(/\s+&\s*|\s*&\s+/g, ' … ');
}

// Hebrew, Arabic, Syriac, Thaana, N'Ko, Samaritan, Mandaic and their
// presentation forms: the scripts written right to left.
const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;

/**
 * The direction a text runs in, by its first letter: 'rtl' for a right-to-left
 * script, 'ltr' for any other letter, '' when it has no letter to judge by.
 */
export function textDirection(text) {
  for (const ch of String(text || '')) {
    // Only a letter decides: Arabic punctuation and digits sit in the RTL
    // ranges but say nothing about the quote's script.
    if (/\p{L}/u.test(ch)) return RTL_CHAR.test(ch) ? 'rtl' : 'ltr';
  }
  return '';
}

/**
 * Escape a quote for HTML and isolate it in `<bdi dir="…">` in its own
 * direction, so it cannot reorder the text around it (a Hebrew quote in English
 * notes, a Greek one in Arabic notes). Every quote with a letter is wrapped,
 * whichever way the document runs: the sections are rendered before
 * `renderHTML` settles the document's direction, and a caller can override it
 * there. A quote with no letter is returned escaped and unwrapped.
 *
 * @param {string} text
 */
export function isolatedQuoteHtml(text) {
  const html = escapeHtml(text);
  const detected = textDirection(text);
  if (!detected) return html;
  // Only the two values reach the attribute, whatever textDirection returns.
  const dir = detected === 'rtl' ? 'rtl' : 'ltr';
  return `<bdi dir="${dir}">${html}</bdi>`;
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
 * with the Bible abbreviation. The original-language quote is NOT shown — the
 * GL quotes are what a translator reads — except as the fallback when no GL
 * quote converted (and for OBS notes, whose `Quote` is already the GL text).
 * Returns '' when the row has no quote at all.
 *
 * @param {Object} row - Note/question row carrying `Quote` and `GLQuotes`
 * @param {Array} bibles - From getBibleColumns()
 * @param {Object} classes - { header, quote, tag } CSS class names
 */
export function renderQuoteHeader(row, bibles, classes = {}) {
  const { header = 'note-header', quote = 'note-quote', tag = 'bible-tag' } = classes;
  const lines = [];
  bibles.forEach((b, i) => {
    const q = quoteForDisplay(glQuoteForBibleId(row.GLQuotes, b.id));
    if (!q) return;
    const quoteHtml = i === 0 ? `<strong>${isolatedQuoteHtml(q)}</strong>` : isolatedQuoteHtml(q);
    lines.push(
      `  <div class="${quote}"><span class="${tag}">${escapeHtml(b.abbr)}</span> ${quoteHtml}</div>`
    );
  });
  if (lines.length === 0) {
    const origQuote = quoteForDisplay(row.Quote);
    if (!origQuote) return '';
    lines.push(`  <div class="${quote}"><strong>${isolatedQuoteHtml(origQuote)}</strong></div>`);
  }
  return `<div class="${header}">\n${lines.join('\n')}\n</div>\n`;
}
