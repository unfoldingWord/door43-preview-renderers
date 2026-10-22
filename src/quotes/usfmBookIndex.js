import usfm from 'usfm-js';

/**
 * Index one book of USFM for quote lookup.
 *
 * Both sides of a Gateway Language (GL) quote lookup are indexed the same way:
 * the original-language (OL) Bible (UHB / UGNT) and each aligned GL Bible (ULT,
 * UST). A verse becomes a flat, ordered list of tokens: `word` tokens, each with
 * its occurrence count within the verse and (for an aligned Bible) the OL words
 * it is aligned to, and `text` tokens for whatever sits between words
 * (spaces, punctuation, the `{`/`}` around supplied words).
 *
 * Alignment is carried by `\zaln-s` milestones in the GL USFM: a milestone names
 * one OL word (`x-content`) and which occurrence of it in the OL verse
 * (`x-occurrence`), and the `\w` words nested inside it are the GL rendering of
 * that word. Nested milestones mean one GL span renders several OL words; every
 * ancestor milestone applies to a word.
 */

/** Word joiner U+2060, used inside Hebrew words between prefix and stem. */
const WORD_JOINER = /⁠/g;
/** Maqaf U+05BE joins Hebrew words; the OL USFM splits on it. */
const MAQAF = '־';

/**
 * Normalise a word for comparison: NFC (so Hebrew points and accents compose
 * the same way on both sides), no word joiners, no punctuation.
 * Case is kept — Greek proper nouns are matched as written.
 */
export function normalizeWord(word) {
  return String(word || '')
    .normalize('NFC')
    .replace(WORD_JOINER, '')
    .replace(/\p{P}/gu, '')
    .trim();
}

/**
 * Split a quote (or any run of OL text) into normalised words. Whitespace and
 * maqaf separate words; punctuation is dropped.
 */
export function tokenizeWords(text) {
  return String(text || '')
    .normalize('NFC')
    .split(new RegExp(`[\\s${MAQAF}]+`))
    .map(normalizeWord)
    .filter(Boolean);
}

/**
 * Every verse a verse label covers: "6" → ["6"], "11-13" → ["11","12","13"],
 * anything else (e.g. "front") → [label].
 */
export function expandVerseRange(label) {
  const [first, last] = String(label).split('-');
  const start = parseInt(first, 10);
  const end = parseInt(last, 10);
  if (last === undefined || Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return [String(label)];
  }
  const verses = [];
  for (let v = start; v <= end; v++) verses.push(String(v));
  return verses;
}

/**
 * Walk a verse's usfm-js verseObjects into flat tokens.
 * @param {Array} verseObjects
 * @param {Array<{content:string, occurrence:number}>} aligned - milestones enclosing this level
 * @param {Array} out
 * @param {Object} counts - per-verse occurrence counts by normalised word
 * @param {string} chapter
 * @param {string} verse - the verse label the tokens belong to (a bridge label for a bridged verse)
 */
function walk(verseObjects, aligned, out, counts, chapter, verse) {
  for (const obj of verseObjects || []) {
    if (!obj || typeof obj !== 'object') continue;
    if (obj.type === 'milestone' && obj.tag === 'zaln') {
      const next = obj.content
        ? [...aligned, { content: normalizeWord(obj.content), occurrence: Number(obj.occurrence) || 1 }]
        : aligned;
      walk(obj.children, next, out, counts, chapter, verse);
      continue;
    }
    if (obj.type === 'word') {
      const norm = normalizeWord(obj.text);
      if (!norm) continue;
      counts[norm] = (counts[norm] || 0) + 1;
      out.push({
        type: 'word',
        text: String(obj.text).normalize('NFC'),
        norm,
        occurrence: counts[norm],
        aligned,
        chapter,
        verse,
      });
      continue;
    }
    if (obj.type === 'footnote' || obj.tag === 'f' || obj.tag === 'x') {
      // Footnotes and cross-references contribute no words to a quote.
      continue;
    }
    // Plain text, and the text usfm-js hangs on a paragraph or poetry marker
    // (`\q2 {` puts the opening brace on the q2 object). Line breaks are just
    // whitespace to a quote.
    if (typeof obj.text === 'string' && obj.type !== 'word') {
      const text = obj.text.replace(/\s+/g, ' ');
      if (text) out.push({ type: 'text', text, chapter, verse });
    } else if (obj.nextChar && /\s/.test(obj.nextChar)) {
      out.push({ type: 'text', text: ' ', chapter, verse });
    }
    // A milestone we do not know still gets walked, to be safe.
    if (Array.isArray(obj.children)) {
      walk(obj.children, aligned, out, counts, chapter, verse);
    }
  }
}

/**
 * Index a book's USFM.
 *
 * @param {string} usfmText - Raw USFM (alignment markers intact for a GL Bible)
 * @returns {{ get: (ref: string) => Array|undefined, verses: Map<string, Array> }}
 *   `get('1:1')` returns the verse's tokens; a verse inside a bridge (`\v 6-7`)
 *   returns the bridge's tokens (the same array for every verse in it);
 *   `get('3:front')` returns a chapter's `\d` superscription tokens when present.
 */
export function indexUsfmBook(usfmText) {
  const json = usfm.toJSON(String(usfmText || ''), {
    convertToInt: ['occurrence', 'occurrences'],
  });
  const verses = new Map();
  for (const [chapter, chapterData] of Object.entries(json.chapters || {})) {
    for (const [verseLabel, verseData] of Object.entries(chapterData || {})) {
      const out = [];
      walk(verseData?.verseObjects, [], out, {}, chapter, verseLabel);
      if (verseLabel === 'front') {
        if (out.some((t) => t.type === 'word')) verses.set(`${chapter}:front`, out);
        continue;
      }
      for (const v of expandVerseRange(verseLabel)) verses.set(`${chapter}:${v}`, out);
    }
  }
  return {
    verses,
    get: (ref) => verses.get(String(ref)),
  };
}
