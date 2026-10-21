import usfmjs from 'usfm-js';

/**
 * Strip word-alignment markup from aligned USFM, leaving plain USFM for display.
 *
 * Ported from `usfm-alignment-remover` 0.1.6 (unfoldingWord, MIT) —
 * `helpers/UsfmFileConversionHelper.js`, `removeAlignments()` and the helpers it
 * calls. Only that path is kept: this library never used the package's DCS
 * fetching, zip handling or verse-span conversion, and inlining the one pure
 * function removes four dependencies and a release cycle (issue #45). Behaviour
 * is kept byte-identical; `src/__tests__/removeAlignments.test.js` pins it
 * against output recorded from the original package.
 *
 * What it does: parse the USFM with usfm-js, replace every `\w …\w*` word and
 * `\zaln-s …\zaln-e*` milestone with its plain text (keeping the original
 * word spacing and punctuation rules), and serialise headers, chapters and
 * verses back to USFM.
 */

/**
 * Dive into a milestone to extract its words and text.
 * @param {Object} verseObject - Milestone verse object
 * @returns {string} Text content of the milestone
 */
function parseMilestone(verseObject) {
  let text = verseObject.text || '';
  let wordSpacing = '';
  const length = verseObject.children ? verseObject.children.length : 0;

  for (let i = 0; i < length; i++) {
    const child = verseObject.children[i];

    switch (child.type) {
      case 'word':
        text += wordSpacing + child.text;
        wordSpacing = ' ';
        break;

      case 'milestone':
        text += wordSpacing + parseMilestone(child);
        wordSpacing = ' ';
        break;

      default:
        if (child.text) {
          text += child.text;
          const lastChar = text.substr(-1);

          // Legacy support: make sure there is padding before the next word.
          if (lastChar !== ',' && lastChar !== '.' && lastChar !== '?' && lastChar !== ';') {
            wordSpacing = '';
          }
        }
        break;
    }
  }
  return text;
}

/**
 * Replace a word or milestone verse object with a plain text object.
 * @param {Object} verseObject - Verse object to flatten
 * @param {string} wordSpacing - Spacing to put before the next word
 * @returns {{ verseObject: Object, wordSpacing: string }}
 */
function replaceWordsAndMilestones(verseObject, wordSpacing) {
  let text = '';

  if (verseObject.type === 'word') {
    text = wordSpacing + verseObject.text;
  } else if (verseObject.type === 'milestone') {
    text = wordSpacing + parseMilestone(verseObject);
  }

  if (text) {
    // Replace with a text object.
    verseObject = { type: 'text', text };
    wordSpacing = ' ';
  } else {
    wordSpacing = ' ';

    if (verseObject.nextChar) {
      wordSpacing = ''; // this item already carries the spacing before the next word
    } else if (verseObject.text) {
      const lastChar = verseObject.text.substr(-1);

      // Legacy support: make sure there is padding before the next word after punctuation.
      if (![',', '.', '?', ';'].includes(lastChar)) {
        wordSpacing = '';
      }
    }

    if (verseObject.children) {
      // Handle nested children on a copy so the parsed tree is left untouched.
      const copy = structuredClone(verseObject);
      let childSpacing = '';
      const length = verseObject.children.length;

      for (let i = 0; i < length; i++) {
        const flattened = replaceWordsAndMilestones(verseObject.children[i], childSpacing);
        childSpacing = flattened.wordSpacing;
        copy.children[i] = flattened.verseObject;
      }
      verseObject = copy;
    }
  }
  return { verseObject, wordSpacing };
}

/**
 * Remove milestones and word markers from a verse's verse objects.
 * @param {Object|Array} verseData - `{ verseObjects }` or the array itself
 * @returns {Object} `{ verseObjects }` with words and milestones flattened to text
 */
export function removeMilestonesAndWordMarkers(verseData) {
  const verseObjects = verseData?.verseObjects || verseData;
  if (verseObjects) {
    let wordSpacing = '';
    const flattenedData = [];
    const length = verseObjects.length;

    for (let i = 0; i < length; i++) {
      const flattened = replaceWordsAndMilestones(verseObjects[i], wordSpacing);
      wordSpacing = flattened.wordSpacing;
      flattenedData.push(flattened.verseObject);
    }
    verseData = { verseObjects: flattenedData };
  }
  return verseData;
}

/**
 * Serialise a verse's verse objects to USFM (the content after `\v N `).
 * @param {Object} verseData - `{ verseObjects }`
 * @returns {string}
 */
function convertVerseDataToUSFM(verseData) {
  const outputData = {
    chapters: {},
    headers: [],
    verses: { 1: verseData },
  };
  const USFM = usfmjs.toUSFM(outputData, { chunk: true, forcedNewLines: true });
  const split = USFM.split('\\v 1');

  if (split.length > 1) {
    let content = split[1];

    if (content.substr(0, 1) === ' ') {
      content = content.substr(1); // remove the separator space
    }
    return content;
  }
  return ''; // JSON → USFM failed
}

/**
 * Convert a verse's verse objects to USFM with milestones and word markers removed.
 * @param {Object|Array} verseData
 * @returns {string}
 */
export function getUsfmForVerseContent(verseData) {
  return convertVerseDataToUSFM(removeMilestonesAndWordMarkers(verseData));
}

/** Verse keys in numeric order; non-numeric keys (e.g. "front") sort last, alphabetically. */
function sortKeys(keys) {
  return keys.sort((a, b) => {
    const numA = parseInt(a.split('-')[0], 10);
    const numB = parseInt(b.split('-')[0], 10);

    if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;
    return numA - numB;
  });
}

function flattenChapterData(chapterData) {
  let usfmStr = '';

  if ('front' in chapterData) {
    usfmStr += getUsfmForVerseContent(chapterData['front']);
  }

  const sortedKeys = sortKeys(Object.keys(chapterData));

  sortedKeys.forEach((verseNum) => {
    if (verseNum === 'front') return;
    const verseData = chapterData[verseNum];
    if (usfmStr && usfmStr[usfmStr.length - 1] !== '\n') {
      usfmStr += ' ';
    }
    usfmStr += `\\v ${verseNum} ` + getUsfmForVerseContent(verseData);
  });

  return usfmStr;
}

/**
 * Remove alignment markup (`\zaln-s`/`\zaln-e*` milestones and `\w`/`\w*` word
 * markers) from a USFM document, returning plain USFM.
 *
 * @param {string} usfm - Aligned USFM
 * @returns {string} USFM without alignment markup
 */
export function removeAlignments(usfm) {
  const usfmJSON = usfmjs.toJSON(usfm);
  let usfmStr = '';

  usfmJSON.headers.forEach((header) => {
    if (header.type == 'text') {
      usfmStr += `${header.text}\n`;
    } else if (header.tag && header.content) {
      if (header.content !== '\\*') {
        header.content = ` ${header.content}`;
      }
      usfmStr += `\\${header.tag}${header.content}\n`;
    }
  });

  if ('front' in usfmJSON.chapters) {
    usfmStr += flattenChapterData(usfmJSON.chapters['front']);
  }
  Object.keys(usfmJSON.chapters).forEach((chapterNum) => {
    if (chapterNum === 'front') return;
    usfmStr += `\n\\c ${chapterNum}\n` + flattenChapterData(usfmJSON.chapters[chapterNum]);
  });

  return usfmStr;
}
