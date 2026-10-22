import {
  parseBooksOption,
  resolveComposeOptions,
  normalizeMargins,
  selectAppendices,
  supportsBodyColumns,
  runningHeaderModeFor,
} from '../renderOptions.js';

describe('parseBooksOption', () => {
  test('returns empty for undefined', () => {
    expect(parseBooksOption(undefined)).toEqual({ ids: [], ranges: {} });
  });

  test('array form lowercases ids and carries no ranges', () => {
    expect(parseBooksOption(['TIT', 'Rom'])).toEqual({ ids: ['tit', 'rom'], ranges: {} });
  });

  test('object form collects ids and per-book ranges', () => {
    expect(parseBooksOption({ '1KI': '10:1-13', '2CH': '9:1-12' })).toEqual({
      ids: ['1ki', '2ch'],
      ranges: { '1ki': '10:1-13', '2ch': '9:1-12' },
    });
  });

  test("'*' and true mean the whole book (no range)", () => {
    expect(parseBooksOption({ tit: '*', rom: true })).toEqual({
      ids: ['tit', 'rom'],
      ranges: {},
    });
  });
});

describe('resolveComposeOptions', () => {
  test('screen defaults hide cover/copyright/toc', () => {
    const opts = resolveComposeOptions({}, {});
    expect(opts.media).toBe('screen');
    expect(opts.show).toEqual({
      cover: false,
      copyright: false,
      toc: false,
      body: true,
      appendices: true,
    });
    expect(opts.columns).toBe(1);
    expect(opts.direction).toBe('ltr');
  });

  test('print defaults show cover/copyright/toc', () => {
    const opts = resolveComposeOptions({ media: 'print' }, {});
    expect(opts.show).toEqual({
      cover: true,
      copyright: true,
      toc: true,
      body: true,
      appendices: true,
    });
  });

  test('explicit show overrides win over media defaults', () => {
    const opts = resolveComposeOptions({ media: 'screen', show: { cover: true } }, {});
    expect(opts.show.cover).toBe(true);
    expect(opts.show.body).toBe(true);
  });

  test('direction falls back to htmlData then ltr', () => {
    expect(resolveComposeOptions({}, { direction: 'rtl' }).direction).toBe('rtl');
    expect(resolveComposeOptions({ direction: 'rtl' }, { direction: 'ltr' }).direction).toBe('rtl');
  });

  test('page number position defaults to bottom and honors top', () => {
    expect(resolveComposeOptions({}).print.pageNumber.position).toBe('bottom');
    expect(
      resolveComposeOptions({ print: { pageNumber: { position: 'top' } } }).print.pageNumber
        .position
    ).toBe('top');
  });

  test('runningHeader defaults on, can be disabled', () => {
    expect(resolveComposeOptions({}).print.runningHeader).toBe(true);
    expect(resolveComposeOptions({ print: { runningHeader: false } }).print.runningHeader).toBe(
      false
    );
  });
});

describe('supportsBodyColumns', () => {
  test('is true for the subjects the Aligned Bible renderer handles', () => {
    // Only those bodies carry .section.bible-book, which `columns` targets.
    for (const subject of [
      'Aligned Bible',
      'Bible',
      'Greek New Testament',
      'Hebrew Old Testament',
    ]) {
      expect(supportsBodyColumns(subject)).toBe(true);
    }
  });

  test('is true for OBS-based TSV subjects, whose frames flow as running text', () => {
    for (const subject of ['TSV OBS Translation Notes', 'TSV OBS Translation Questions']) {
      expect(supportsBodyColumns(subject)).toBe(true);
    }
  });

  test('is false where `columns` does nothing', () => {
    // Bible-versed Notes/Questions lay out per verse or per chapter, not as
    // running text; the pure OBS renderer has its own layout.
    for (const subject of [
      'TSV Translation Notes',
      'TSV Translation Questions',
      'Open Bible Stories',
    ]) {
      expect(supportsBodyColumns(subject)).toBe(false);
    }
  });

  test('accepts anything carrying a subject, and tolerates nothing', () => {
    expect(supportsBodyColumns({ subject: 'Aligned Bible' })).toBe(true);
    expect(supportsBodyColumns(undefined)).toBe(false);
    expect(supportsBodyColumns({})).toBe(false);
  });
});

describe('runningHeaderModeFor', () => {
  test('scripture shows a reference range instead of the resource name', () => {
    for (const subject of [
      'Aligned Bible',
      'Bible',
      'Greek New Testament',
      'Hebrew Old Testament',
    ]) {
      expect(runningHeaderModeFor(subject)).toBe('range');
    }
  });

  test('Open Bible Stories has no running header — it is a picture book', () => {
    expect(runningHeaderModeFor('Open Bible Stories')).toBe(false);
  });

  test('everything else pairs a title with a reference', () => {
    for (const subject of [
      'TSV Translation Notes',
      'TSV Translation Questions',
      'Translation Academy',
      'Translation Words',
      'TSV OBS Translation Notes',
    ]) {
      expect(runningHeaderModeFor(subject)).toBe('title-ref');
    }
  });

  test('accepts anything carrying a subject', () => {
    expect(runningHeaderModeFor({ subject: 'Aligned Bible' })).toBe('range');
  });
});

describe('normalizeMargins', () => {
  test('keeps plain CSS lengths and fills the missing sides with the theme default', () => {
    expect(normalizeMargins({ top: '15mm', left: '1in' })).toEqual({
      top: '15mm',
      right: '20mm',
      bottom: '1cm',
      left: '1in',
    });
  });

  test('a bare number is millimetres; zero is allowed', () => {
    expect(normalizeMargins({ top: 12, bottom: 0 })).toMatchObject({ top: '12mm', bottom: '0mm' });
    expect(normalizeMargins({ right: '0' })).toMatchObject({ right: '0' });
  });

  test('anything but a plain length is ignored, so nothing reaches the stylesheet', () => {
    expect(normalizeMargins({ top: '1cm; } body { display: none' })).toBeUndefined();
    expect(normalizeMargins({ top: 'calc(1cm + 2px)', left: -5, right: '2em' })).toBeUndefined();
    expect(normalizeMargins({})).toBeUndefined();
    expect(normalizeMargins('1cm')).toBeUndefined();
    expect(normalizeMargins(undefined)).toBeUndefined();
  });

  test('resolveComposeOptions normalises print.margins', () => {
    expect(resolveComposeOptions({ print: { margins: { top: 10 } } }).print.margins).toEqual({
      top: '10mm',
      right: '20mm',
      bottom: '1cm',
      left: '30mm',
    });
    expect(resolveComposeOptions({}).print.margins).toBeUndefined();
  });
});

describe('selectAppendices', () => {
  const appendices = { ta: { a: {} }, tw: { b: {} } };
  test('true or unset keeps all, false or an empty list keeps none', () => {
    expect(selectAppendices(appendices, true)).toBe(appendices);
    expect(selectAppendices(appendices, undefined)).toBe(appendices);
    expect(selectAppendices(appendices, false)).toBeNull();
    expect(selectAppendices(appendices, [])).toBeNull();
    expect(selectAppendices(null, true)).toBeNull();
  });

  test('a list keeps the kinds it names', () => {
    expect(selectAppendices(appendices, ['tw'])).toEqual({ tw: { b: {} } });
    expect(selectAppendices(appendices, ['tw', 'ta', 'xx'])).toEqual(appendices);
    expect(selectAppendices(appendices, ['xx'])).toBeNull();
  });
});
