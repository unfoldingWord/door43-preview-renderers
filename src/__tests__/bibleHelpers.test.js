import { extractVerseObjectsText, getVerseTextsFromUsfm } from '../bibleHelpers.js';

describe('extractVerseObjectsText', () => {
  test('keeps the separator that followed a skipped footnote', () => {
    // A footnote between two words carries the space that separated them in its
    // nextChar. Dropping the note whole ran the words together: Matthew 9:8 read
    // "they were afraidand glorified God".
    const objects = [
      { type: 'word', text: 'afraid' },
      { type: 'footnote', tag: 'f', content: '+ \\ft a note', nextChar: '\n' },
      { type: 'word', text: 'and' },
    ];
    expect(extractVerseObjectsText(objects).replace(/\s+/g, ' ')).toBe('afraid and');
  });

  test('adds no separator when the footnote is followed by punctuation', () => {
    const objects = [
      { type: 'word', text: 'Nazarene' },
      { type: 'footnote', tag: 'f', content: '+ \\ft a note' },
      { type: 'text', text: '.' },
    ];
    expect(extractVerseObjectsText(objects)).toBe('Nazarene.');
  });

  test('drops the note’s own content', () => {
    const objects = [
      { type: 'footnote', tag: 'f', content: '+ \\ft some manuscripts read otherwise' },
      { type: 'word', text: 'word' },
    ];
    expect(extractVerseObjectsText(objects).trim()).toBe('word');
  });

  test('reads words nested inside alignment milestones', () => {
    const objects = [
      { tag: 'zaln', type: 'milestone', children: [{ type: 'word', text: 'Paul' }] },
      { type: 'text', text: ' ' },
      { tag: 'zaln', type: 'milestone', children: [{ type: 'word', text: 'a' }] },
    ];
    expect(extractVerseObjectsText(objects)).toBe('Paul a');
  });
});

describe('getVerseTextsFromUsfm', () => {
  test('returns plain verse text keyed by chapter and verse', () => {
    const usfmContent =
      '\\id TIT\n\\c 1\n\\p\n\\v 1 Paul, a servant of God.\n\\v 2 In hope of life.\n';
    expect(getVerseTextsFromUsfm(usfmContent)).toEqual({
      1: { 1: 'Paul, a servant of God.', 2: 'In hope of life.' },
    });
  });

  test('returns an empty object for unusable input', () => {
    expect(getVerseTextsFromUsfm(null)).toEqual({});
    expect(getVerseTextsFromUsfm(undefined)).toEqual({});
  });
});
