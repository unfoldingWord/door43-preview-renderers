import {
  filterCatalogEntries,
  selectAlignedBibles,
  testamentOf,
} from '../catalogSelection.js';
import { requiredSubjectsMap } from '../constants.js';

const entry = (name, subject, abbreviation) => ({ name, subject, abbreviation });

const ult = entry('en_ult', 'Aligned Bible', 'ult');
const ust = entry('en_ust', 'Aligned Bible', 'ust');
const glt = entry('es_glt', 'Aligned Bible', 'glt');
const gst = entry('es_gst', 'Aligned Bible', 'gst');
const other1 = entry('xx_one', 'Aligned Bible', 'one');
const other2 = entry('xx_two', 'Aligned Bible', 'two');
const other3 = entry('xx_three', 'Aligned Bible', 'three');

const tn = entry('en_tn', 'TSV Translation Notes', 'tn');
const tq = entry('en_tq', 'TSV Translation Questions', 'tq');
const ta = entry('en_ta', 'Translation Academy', 'ta');
const tw = entry('en_tw', 'Translation Words', 'tw');
const twl = entry('en_twl', 'TSV Translation Words Links', 'twl');
const uhb = entry('hbo_uhb', 'Hebrew Old Testament', 'uhb');
const ugnt = entry('el-x-koine_ugnt', 'Greek New Testament', 'ugnt');
const obs = entry('en_obs', 'Open Bible Stories', 'obs');

describe('testamentOf', () => {
  test('knows both testaments and ignores case', () => {
    expect(testamentOf('gen')).toBe('old');
    expect(testamentOf('TIT')).toBe('new');
    expect(testamentOf('xyz')).toBeUndefined();
    expect(testamentOf()).toBeUndefined();
  });
});

describe('selectAlignedBibles', () => {
  test('prefers ult + ust over the others, in that order', () => {
    expect(selectAlignedBibles([other1, ust, other2, ult])).toEqual([ult, ust]);
  });

  test('prefers glt + gst the same way', () => {
    expect(selectAlignedBibles([other1, gst, glt])).toEqual([glt, gst]);
  });

  test('a literal Bible alone is paired with the first other entry', () => {
    expect(selectAlignedBibles([other1, ult, other2])).toEqual([ult, other1]);
  });

  test('a simplified Bible alone comes second, after the first other entry', () => {
    expect(selectAlignedBibles([other1, ust, other2])).toEqual([other1, ust]);
  });

  test('without preferred abbreviations the first two win', () => {
    expect(selectAlignedBibles([other1, other2, other3])).toEqual([other1, other2]);
  });

  test('two or fewer entries are returned unchanged', () => {
    expect(selectAlignedBibles([other2, other1])).toEqual([other2, other1]);
    expect(selectAlignedBibles([ust])).toEqual([ust]);
    expect(selectAlignedBibles([])).toEqual([]);
  });

  test('orders a literal + simplified pair by preference even when only two are given', () => {
    expect(selectAlignedBibles([ust, ult])).toEqual([ult, ust]);
  });

  test('a null hole never fills the second slot', () => {
    expect(selectAlignedBibles([null, ult, other1])).toEqual([ult, other1]);
    expect(selectAlignedBibles([null, ust, other1])).toEqual([other1, ust]);
    expect(selectAlignedBibles([null, ult])).toEqual([ult]);
    expect(selectAlignedBibles([null])).toEqual([]);
  });

  test('tolerates a non-array', () => {
    expect(selectAlignedBibles(undefined)).toEqual([]);
  });

  test('tolerates null holes when choosing among more than two', () => {
    expect(() => selectAlignedBibles([null, other1, other2, other3])).not.toThrow();
  });
});

describe('filterCatalogEntries', () => {
  const blueprint = [tn, ult, ust, ta, tw, tq, twl, uhb, ugnt];

  test('keeps the main entry first, then the Aligned Bibles, then the other required subjects', () => {
    expect(filterCatalogEntries(blueprint)).toEqual([tn, ult, ust, ta, tw, twl, uhb, ugnt]);
  });

  test('drops subjects the main subject does not require', () => {
    // Translation Questions need neither TA, TW nor TWL.
    expect(filterCatalogEntries([tq, ult, ust, ta, tw, tn, twl, uhb, ugnt])).toEqual([
      tq,
      ult,
      ust,
      uhb,
      ugnt,
    ]);
  });

  test('applies the Aligned Bible selection to more than two Bibles', () => {
    expect(filterCatalogEntries([tn, other1, ust, other2, ult, ta])).toEqual([tn, ult, ust, ta]);
  });

  test('takes the subject from options when given', () => {
    expect(filterCatalogEntries([tn, ult, ta], { subject: 'TSV Translation Questions' })).toEqual([
      tn,
      ult,
    ]);
  });

  test('returns the entries unchanged for a subject with no requirements', () => {
    const input = [obs, ult, ta];
    expect(filterCatalogEntries(input)).toBe(input);
    expect(requiredSubjectsMap['Open Bible Stories']).toBeUndefined();
  });

  test('New Testament books drop the Hebrew Old Testament', () => {
    expect(filterCatalogEntries(blueprint, { books: ['tit', '3jn'] })).toEqual([
      tn,
      ult,
      ust,
      ta,
      tw,
      twl,
      ugnt,
    ]);
  });

  test('Old Testament books drop the Greek New Testament', () => {
    expect(filterCatalogEntries(blueprint, { books: ['rut'] })).toEqual([
      tn,
      ult,
      ust,
      ta,
      tw,
      twl,
      uhb,
    ]);
  });

  test('books from both testaments keep both original-language Bibles', () => {
    expect(filterCatalogEntries(blueprint, { books: ['rut', 'tit'] })).toEqual([
      tn,
      ult,
      ust,
      ta,
      tw,
      twl,
      uhb,
      ugnt,
    ]);
  });

  test('empty or unknown books keep both original-language Bibles', () => {
    expect(filterCatalogEntries(blueprint, { books: [] })).toContainEqual(uhb);
    expect(filterCatalogEntries(blueprint, { books: [] })).toContainEqual(ugnt);
    expect(filterCatalogEntries(blueprint, { books: ['nope'] })).toContainEqual(uhb);
    expect(filterCatalogEntries(blueprint, { books: ['nope'] })).toContainEqual(ugnt);
  });

  test('an unknown id among known books keeps both original-language Bibles', () => {
    for (const books of [['tit', 'nope'], ['rut', 'nope']]) {
      expect(filterCatalogEntries(blueprint, { books })).toContainEqual(uhb);
      expect(filterCatalogEntries(blueprint, { books })).toContainEqual(ugnt);
    }
  });

  test('handles empty input and skips null entries', () => {
    expect(filterCatalogEntries([])).toEqual([]);
    expect(filterCatalogEntries(undefined)).toEqual([]);
    expect(filterCatalogEntries([tn, null, ult])).toEqual([tn, ult]);
  });
});
