/**
 * Option normalization for the staged rendering pipeline.
 *
 * One options object flows through every stage; this module resolves the slices
 * that the composition stage (renderHTML, stage 4) cares about, applying
 * media-aware defaults. See docs/rendering-pipeline.md §6 for the full schema.
 */

/**
 * Parse the `books` option into book ids + per-book reference ranges.
 *
 * Accepts:
 *  - an array of book ids:        `['tit', 'rom']`               → whole books
 *  - an object map of id → range: `{ '1ki': '10:1-13', tit: '*' }`
 *    where the range is a string (`'10'`, `'10-12'`, `'10:1-13'`, `'10:1-12:5'`)
 *    or `'*'`/`true` for the whole book.
 *
 * @param {Array<string>|Object|undefined} books
 * @returns {{ ids: string[], ranges: Object<string,string> }}
 */
export function parseBooksOption(books) {
  if (!books) return { ids: [], ranges: {} };

  if (Array.isArray(books)) {
    return {
      ids: books.map((b) => String(b || '').toLowerCase()).filter(Boolean),
      ranges: {},
    };
  }

  if (typeof books === 'object') {
    const ids = [];
    const ranges = {};
    for (const [rawId, range] of Object.entries(books)) {
      const id = String(rawId || '').toLowerCase();
      if (!id) continue;
      ids.push(id);
      if (range && range !== '*' && range !== true) {
        ranges[id] = String(range);
      }
    }
    return { ids, ranges };
  }

  return { ids: [], ranges: {} };
}

const SCREEN_SHOW_DEFAULTS = {
  cover: false,
  copyright: false,
  toc: false,
  body: true,
  appendices: true,
};
const PRINT_SHOW_DEFAULTS = {
  cover: true,
  copyright: true,
  toc: true,
  body: true,
  appendices: true,
};
const PAGE_NUMBER_SHOW_DEFAULTS = {
  cover: false,
  copyright: false,
  toc: true,
  body: true,
  appendices: true,
};

/**
 * Resolve composition options (stage 4, renderHTML) with media-aware defaults.
 *
 * @param {Object} [options] - Raw options (see docs §6)
 * @param {Object} [htmlData] - HtmlData, used to default `direction`
 * @returns {{ media: 'screen'|'print', show: Object, columns: number, direction: string, print: Object }}
 */
export function resolveComposeOptions(options = {}, htmlData = {}) {
  const media = options.media === 'print' ? 'print' : 'screen';
  const showDefaults = media === 'print' ? PRINT_SHOW_DEFAULTS : SCREEN_SHOW_DEFAULTS;
  const show = { ...showDefaults, ...(options.show || {}) };

  const print = options.print || {};
  const pageNumber = print.pageNumber || {};

  return {
    media,
    show,
    columns: Number.isFinite(options.columns) ? options.columns : 1,
    direction: options.direction || htmlData.direction || 'ltr',
    print: {
      pageSize: print.pageSize || 'A4_PORTRAIT',
      margins: print.margins,
      runningHeader: print.runningHeader !== false,
      footerHtml: print.footerHtml || '',
      pageNumber: {
        position: pageNumber.position === 'top' ? 'top' : 'bottom',
        show: { ...PAGE_NUMBER_SHOW_DEFAULTS, ...(pageNumber.show || {}) },
      },
    },
  };
}
