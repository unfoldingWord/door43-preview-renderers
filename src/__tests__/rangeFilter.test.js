import { parseRange, sliceUsfmByRange, filterResourceDataByRanges } from '../rangeFilter.js';

describe('parseRange', () => {
  test('whole chapter', () => {
    expect(parseRange('10')).toEqual({ startCh: 10, startV: null, endCh: 10, endV: null });
  });
  test('chapter span', () => {
    expect(parseRange('10-12')).toEqual({ startCh: 10, startV: null, endCh: 12, endV: null });
  });
  test('verses within one chapter', () => {
    expect(parseRange('10:1-13')).toEqual({ startCh: 10, startV: 1, endCh: 10, endV: 13 });
  });
  test('cross-chapter verse span', () => {
    expect(parseRange('10:1-12:5')).toEqual({ startCh: 10, startV: 1, endCh: 12, endV: 5 });
  });
  test('single verse', () => {
    expect(parseRange('10:5')).toEqual({ startCh: 10, startV: 5, endCh: 10, endV: 5 });
  });
  test('empty / wildcard -> null', () => {
    expect(parseRange('*')).toBeNull();
    expect(parseRange('')).toBeNull();
    expect(parseRange(undefined)).toBeNull();
  });
});

describe('sliceUsfmByRange', () => {
  const usfm =
    '\\id TIT\n\\h Titus\n' +
    '\\c 1\n\\v 1 one\n\\v 2 two\n' +
    '\\c 2\n\\v 1 three\n\\v 2 four\n\\v 3 five\n' +
    '\\c 3\n\\v 1 six\n';

  test('keeps the header and only the in-range chapter', () => {
    const out = sliceUsfmByRange(usfm, parseRange('2'));
    expect(out).toContain('\\id TIT');
    expect(out).toContain('\\h Titus');
    expect(out).toContain('\\c 2');
    expect(out).toContain('three');
    expect(out).not.toContain('\\c 1');
    expect(out).not.toContain('\\c 3');
    expect(out).not.toContain('one');
    expect(out).not.toContain('six');
  });

  test('trims verses at the boundary chapter', () => {
    const out = sliceUsfmByRange(usfm, parseRange('2:2-3'));
    expect(out).toContain('\\c 2');
    expect(out).not.toContain('three'); // v1 dropped
    expect(out).toContain('four'); // v2
    expect(out).toContain('five'); // v3
  });

  test('keeps a chapter span whole', () => {
    const out = sliceUsfmByRange(usfm, parseRange('1-2'));
    expect(out).toContain('\\c 1');
    expect(out).toContain('\\c 2');
    expect(out).not.toContain('\\c 3');
    expect(out).toContain('one');
    expect(out).toContain('five');
  });
});

describe('filterResourceDataByRanges', () => {
  test('TSV: keeps only the in-range chapters/verses', () => {
    const rd = {
      type: 'tsv',
      subject: 'TSV Translation Notes',
      books: {
        tit: {
          chapters: {
            front: { verses: { intro: [{ Note: 'book intro' }] } },
            '1': { verses: { '1': [{ Note: 'c1v1' }], '2': [{ Note: 'c1v2' }] } },
            '2': { verses: { '1': [{ Note: 'c2v1' }] } },
          },
        },
      },
    };
    const out = filterResourceDataByRanges(rd, { tit: '1:2' });
    expect(Object.keys(out.books.tit.chapters)).toEqual(['1']);
    expect(Object.keys(out.books.tit.chapters['1'].verses)).toEqual(['2']);
    // original is not mutated
    expect(Object.keys(rd.books.tit.chapters)).toContain('front');
  });

  test('USFM: slices the book string', () => {
    const rd = {
      type: 'usfm',
      subject: 'Aligned Bible',
      books: { gen: '\\id GEN\n\\c 1\n\\v 1 a\n\\c 2\n\\v 1 b\n' },
    };
    const out = filterResourceDataByRanges(rd, { gen: '2' });
    expect(out.books.gen).toContain('\\c 2');
    expect(out.books.gen).not.toContain('\\c 1');
  });

  test('returns the original for non-sliceable types', () => {
    const rd = { type: 'obs', subject: 'Open Bible Stories', stories: {} };
    expect(filterResourceDataByRanges(rd, { obs: '1-2' })).toBe(rd);
  });

  test('returns the original when no ranges apply', () => {
    const rd = { type: 'usfm', books: { gen: 'x' } };
    expect(filterResourceDataByRanges(rd, {})).toBe(rd);
  });
});
