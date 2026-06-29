/**
 * Reference-range filtering for rendered resources (stage 3 pre-filter).
 *
 * The `books` option may carry per-book ranges, e.g. `{ '1ki': '10:1-13' }`.
 * This module narrows a ResourceData to those ranges before rendering, so the
 * renderers stay range-unaware. Supports TSV (chapter/verse object slicing) and
 * USFM (raw `\c`/`\v` string slicing). Other types are returned unchanged.
 *
 * Range grammar (see docs/options.md):
 *   '10'         whole chapter 10
 *   '10-12'      whole chapters 10..12
 *   '10:1-13'    chapter 10, verses 1..13
 *   '10:1-12:5'  chapter 10 v1 .. chapter 12 v5
 *   '10:5'       single verse
 */

/**
 * Parse a range string into { startCh, startV, endCh, endV } (verse may be null
 * = whole chapter). Returns null for empty / '*' / unparseable input.
 */
export function parseRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const s = rangeStr.trim();
  if (!s || s === '*') return null;

  const dash = s.indexOf('-');
  const left = dash === -1 ? s : s.slice(0, dash).trim();
  const right = dash === -1 ? undefined : s.slice(dash + 1).trim();

  const parsePoint = (p) => {
    if (!p) return null;
    if (p.includes(':')) {
      const [c, v] = p.split(':');
      return { ch: parseInt(c, 10), v: parseInt(v, 10) };
    }
    return { ch: parseInt(p, 10), v: null };
  };

  const start = parsePoint(left);
  if (!start || Number.isNaN(start.ch)) return null;

  let endCh;
  let endV;
  if (right === undefined || right === '') {
    // Single point: '10' (whole chapter) or '10:5' (single verse)
    endCh = start.ch;
    endV = start.v;
  } else if (right.includes(':')) {
    const e = parsePoint(right);
    endCh = e.ch;
    endV = e.v;
  } else {
    const n = parseInt(right, 10);
    if (Number.isNaN(n)) {
      endCh = start.ch;
      endV = start.v;
    } else if (start.v != null) {
      // Left had a verse → bare right is a verse in the same chapter ('10:1-13')
      endCh = start.ch;
      endV = n;
    } else {
      // Left was a whole chapter → bare right is a chapter ('10-12')
      endCh = n;
      endV = null;
    }
  }

  return { startCh: start.ch, startV: start.v, endCh, endV };
}

function chapterInRange(range, chapterKey) {
  if (chapterKey === 'front') return false; // book front matter excluded when ranged
  const ch = parseInt(chapterKey, 10);
  if (Number.isNaN(ch)) return false;
  return ch >= range.startCh && ch <= range.endCh;
}

function verseInRange(range, chapterKey, verseKey) {
  const ch = parseInt(chapterKey, 10);
  if (Number.isNaN(ch) || ch < range.startCh || ch > range.endCh) return false;
  if (verseKey === 'intro') return true; // chapter intro kept for in-range chapters
  const v = parseInt(verseKey, 10);
  if (Number.isNaN(v)) return true;
  if (range.startV != null && ch === range.startCh && v < range.startV) return false;
  if (range.endV != null && ch === range.endCh && v > range.endV) return false;
  return true;
}

/** Filter a TSV book ({ chapters: { ch: { verses: { v: [...] } } } }) to a range. */
function filterTsvBookByRange(book, range) {
  if (!book || !book.chapters) return book;
  const chapters = {};
  for (const chKey of Object.keys(book.chapters)) {
    if (!chapterInRange(range, chKey)) continue;
    const chapter = book.chapters[chKey];
    const verses = {};
    for (const vKey of Object.keys(chapter.verses || {})) {
      if (verseInRange(range, chKey, vKey)) verses[vKey] = chapter.verses[vKey];
    }
    if (Object.keys(verses).length) chapters[chKey] = { ...chapter, verses };
  }
  return { ...book, chapters };
}

/**
 * Slice a USFM string to a chapter/verse range. Keeps the header (everything
 * before the first `\c`), then the in-range `\c` blocks, trimming verses at the
 * boundary chapters. Verses keep their inner markup (incl. alignment) intact.
 */
export function sliceUsfmByRange(usfm, range) {
  if (typeof usfm !== 'string' || !range) return usfm;
  const firstC = usfm.search(/\\c\s+\d+/);
  if (firstC === -1) return usfm; // no chapters — nothing to slice

  const header = usfm.slice(0, firstC);
  const chapterBlocks = usfm.slice(firstC).split(/(?=\\c\s+\d+)/);

  const kept = [header];
  for (const block of chapterBlocks) {
    const m = block.match(/^\\c\s+(\d+)/);
    if (!m) continue;
    const ch = parseInt(m[1], 10);
    if (ch < range.startCh || ch > range.endCh) continue;

    const trimStart = ch === range.startCh && range.startV != null ? range.startV : null;
    const trimEnd = ch === range.endCh && range.endV != null ? range.endV : null;
    kept.push(trimStart != null || trimEnd != null ? sliceChapterVerses(block, trimStart, trimEnd) : block);
  }
  return kept.join('');
}

/** Trim verses outside [vStart, vEnd] within a single `\c` block. */
function sliceChapterVerses(block, vStart, vEnd) {
  const firstV = block.search(/\\v\s+\d+/);
  if (firstV === -1) return block;

  const head = block.slice(0, firstV); // \c N + any chapter-level markup
  const segments = block.slice(firstV).split(/(?=\\v\s+\d+)/);

  const kept = [head];
  for (const seg of segments) {
    const m = seg.match(/^\\v\s+(\d+)/);
    if (!m) continue;
    const v = parseInt(m[1], 10); // \v 1-2 -> 1 (range start)
    if (vStart != null && v < vStart) continue;
    if (vEnd != null && v > vEnd) continue;
    kept.push(seg);
  }
  return kept.join('');
}

/**
 * Return a copy of resourceData with the given per-book ranges applied. Books
 * without a range (or with an unparseable one) are kept whole. Returns the
 * original object when nothing changes.
 *
 * @param {Object} resourceData
 * @param {Object<string,string>} ranges - { bookId: rangeStr }
 */
export function filterResourceDataByRanges(resourceData, ranges) {
  if (!resourceData || !ranges || !Object.keys(ranges).length) return resourceData;
  if (!resourceData.books || typeof resourceData.books !== 'object') return resourceData;
  if (resourceData.type !== 'usfm' && resourceData.type !== 'tsv') return resourceData;

  const books = { ...resourceData.books };
  let changed = false;

  for (const [bookId, rangeStr] of Object.entries(ranges)) {
    const range = parseRange(rangeStr);
    if (!range) continue;
    const id = bookId.toLowerCase();
    const key =
      books[id] !== undefined ? id : Object.keys(books).find((k) => k.toLowerCase() === id);
    if (key === undefined || books[key] == null) continue;

    books[key] =
      resourceData.type === 'usfm'
        ? sliceUsfmByRange(books[key], range)
        : filterTsvBookByRange(books[key], range);
    changed = true;
  }

  return changed ? { ...resourceData, books } : resourceData;
}
