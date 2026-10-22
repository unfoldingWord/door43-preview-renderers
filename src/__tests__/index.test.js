import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as lib from '../index.js';

describe('index exports', () => {
  test('exports public API functions', () => {
    expect(typeof lib.getResourceData).toBe('function');
    expect(typeof lib.getAllCatalogEntries).toBe('function');
    expect(typeof lib.renderHtmlData).toBe('function');
    expect(typeof lib.renderAlignedBibleHtml).toBe('function');
    expect(typeof lib.renderTranslationAcademyHtml).toBe('function');
    expect(typeof lib.renderTranslationWordsHtml).toBe('function');
    expect(typeof lib.renderHTML).toBe('function');
    expect(typeof lib.fetchResource).toBe('function');
    expect(typeof lib.convertMarkdown).toBe('function');
    expect(typeof lib.renderObsHtml).toBe('function');
    expect(typeof lib.generateCopyrightAndLicenseHtml).toBe('function');
    expect(typeof lib.convertNoteFromMD2HTML).toBe('function');
    expect(typeof lib.assemblePrintDocument).toBe('function');
    expect(typeof lib.generateTocHtml).toBe('function');
    expect(typeof lib.generateTocFromHtml).toBe('function');
    expect(typeof lib.buildCoverPage).toBe('function');
    expect(typeof lib.getPrintCss).toBe('function');
    expect(lib.PAGE_SIZES).toBeDefined();
    expect(lib.PAGE_SIZES.A4_PORTRAIT).toBeDefined();
  });
});

describe('index exports match the CI export guard', () => {
  // The guard in .github/workflows/ci.yml checks the built package against a
  // list of names. Comparing the source entry with the same list, both ways,
  // catches a new export missing from the guard, or a removed one, before CI.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const ci = fs.readFileSync(path.join(here, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  const block = ci.slice(
    ci.indexOf('const required = ['),
    ci.indexOf('];', ci.indexOf('const required = ['))
  );
  const guarded = [...block.matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]).sort();

  test('the guard list was found', () => {
    expect(guarded.length).toBeGreaterThan(40);
  });

  test('every guarded name is exported, and every export is guarded', () => {
    expect(Object.keys(lib).sort()).toEqual(guarded);
  });
});
