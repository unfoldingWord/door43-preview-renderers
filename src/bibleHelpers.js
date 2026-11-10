import * as usfm from 'usfm-js';

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
      // Skip the note's content but keep the character that followed it, which is
      // usually the space separating the words on either side. Dropping it runs
      // them together — Matthew 9:8 reads "they were afraidand glorified God".
      text += obj.nextChar || '';
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
 * Plain verse text for one book of USFM, as { chapter: { verse: text } }.
 * Returns {} if the USFM cannot be parsed.
 */
export function getVerseTextsFromUsfm(usfmContent) {
  if (typeof usfmContent !== 'string') return {};
  let json;
  try {
    json = usfm.toJSON(usfmContent);
  } catch {
    return {};
  }
  const out = {};
  for (const [chapter, verses] of Object.entries(json.chapters || {})) {
    out[chapter] = {};
    for (const [verse, verseData] of Object.entries(verses)) {
      if (verse === 'front') continue;
      const text = extractVerseObjectsText(verseData?.verseObjects).replace(/\s+/g, ' ').trim();
      if (text) out[chapter][verse] = text;
    }
  }
  return out;
}
