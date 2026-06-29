import { parseBooksOption, resolveComposeOptions } from '../renderOptions.js';

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
      resolveComposeOptions({ print: { pageNumber: { position: 'top' } } }).print.pageNumber.position
    ).toBe('top');
  });

  test('runningHeader defaults on, can be disabled', () => {
    expect(resolveComposeOptions({}).print.runningHeader).toBe(true);
    expect(resolveComposeOptions({ print: { runningHeader: false } }).print.runningHeader).toBe(false);
  });
});
