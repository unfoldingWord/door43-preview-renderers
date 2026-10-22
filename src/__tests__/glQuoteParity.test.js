import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { indexUsfmBook } from '../quotes/usfmBookIndex.js';
import { addGlQuotes } from '../quotes/addGlQuotes.js';

/**
 * Parity with tsv-quote-converters 1.2.0, the editor-facing library this
 * lookup replaces for rendering.
 *
 * The fixtures under src/fixtures/glquotes/ were produced once by running that
 * converter (`addGLQuoteCols`, ULT + UST v91, the blueprint-pinned UHB v3.0.0
 * / UGNT v0.34) over the published en_tn / en_twl v91 rows for Titus, Ruth,
 * Genesis 1–3 and Psalms 1–3: every GL quote and occurrence it emitted is the
 * expected value here. Where the converter itself found nothing it wrote a
 * `QUOTE_NOT_FOUND:` marker; the lookup must leave those rows without a GL
 * quote. The aligned USFM beside the TSVs is what both were run against.
 *
 * Regenerate with scripts/gen-glquote-fixtures.mjs (instructions in its header)
 * only when the converter's behaviour is meant to change; the generator slices
 * Genesis and Psalms before both writing and scoring, so these files are the
 * bytes the oracle saw. 3,540 quotes in all.
 */

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'glquotes');
const read = (name) => fs.readFileSync(path.join(DIR, name), 'utf8');

const BOOKS = [
  { id: 'tit', ol: 'ugnt', label: 'Titus (NT)' },
  { id: 'rut', ol: 'uhb', label: 'Ruth (OT)' },
  { id: 'gen', ol: 'uhb', label: 'Genesis 1–3 (verse ranges, discontiguous quotes)' },
  { id: 'psa', ol: 'uhb', label: 'Psalms 1–3 (poetry lines, superscriptions)' },
];
const BIBLES = ['en_ult', 'en_ust'];

// GL quotes compared per file (rows with a Quote × two Bibles), pinned so a
// fixture that shrinks or loses columns cannot pass by comparing less.
const COMPARED = {
  tn_tit: 404,
  twl_tit: 364,
  tn_rut: 576,
  twl_rut: 594,
  tn_gen: 738,
  twl_gen: 534,
  tn_psa: 158,
  twl_psa: 172,
};

function parseTsv(tsv) {
  const [header, ...lines] = tsv.split('\n').filter(Boolean);
  const keys = header.split('\t');
  return lines.map((line) => {
    const values = line.split('\t');
    const row = {};
    keys.forEach((k, i) => (row[k] = values[i] ?? ''));
    return row;
  });
}

describe.each(BOOKS)('GL quote parity with tsv-quote-converters: $label', ({ id, ol }) => {
  const source = indexUsfmBook(read(`usfm/${id}.${ol}.usfm`));
  const bibles = BIBLES.map((repo) => ({
    repo,
    index: indexUsfmBook(read(`usfm/${id}.${repo.replace('en_', '')}.usfm`)),
  }));

  test.each(['tn', 'twl'])('%s rows', (resource) => {
    const expected = parseTsv(read(`${resource}_${id}.expected.tsv`));
    const rows = expected.map((r) => ({
      Reference: r.Reference,
      ID: r.ID,
      Quote: r.Quote || r.OrigWords || '',
      Occurrence: r.Occurrence,
    }));

    addGlQuotes(rows, { source, bibles });

    const mismatches = [];
    let compared = 0;
    rows.forEach((row, i) => {
      if (!row.Quote) return;
      for (const repo of BIBLES) {
        const expQuote = expected[i][`GLQuote:${repo}`] ?? '';
        const expOcc = expected[i][`GLOccurrence:${repo}`] ?? '';
        const got = row.GLQuotes?.[repo];
        compared++;
        if (expQuote.startsWith('QUOTE_NOT_FOUND')) {
          if (got)
            mismatches.push(
              `${row.Reference} ${row.ID} ${repo}: converter found nothing, lookup gave "${got.Quote}"`
            );
          continue;
        }
        if (!got || got.Quote !== expQuote || String(got.Occurrence) !== String(expOcc)) {
          mismatches.push(
            `${row.Reference} ${row.ID} ${repo}: expected "${expQuote}" [${expOcc}], got ${got ? `"${got.Quote}" [${got.Occurrence}]` : 'nothing'}`
          );
        }
      }
    });

    expect(compared).toBe(COMPARED[`${resource}_${id}`]);
    expect(mismatches).toEqual([]);
  });
});
