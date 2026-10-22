import { getGlQuote } from './glQuote.js';

/**
 * Fill each TSV row's `GLQuotes` from its original-language `Quote`.
 *
 * `GLQuotes` is keyed by the GL Bible's repo name (e.g. `en_ult`) and holds
 * `{ Quote, Occurrence }`, the shape the renderers and the TWL quote trimming
 * read. A row that already carries a GL quote for a Bible (from GLQuote
 * columns in the published TSV) keeps it. A quote that cannot be matched
 * leaves that Bible out of the row's `GLQuotes`; the renderers then fall back
 * to the original-language quote.
 *
 * @param {Array<Object>} rows - Normalised rows (`Reference`, `Quote`, `Occurrence`)
 * @param {Object} params
 * @param {Object} params.source - OL book index (indexUsfmBook of UHB / UGNT)
 * @param {Array<{repo: string, index: Object}>} params.bibles - GL Bibles, each with its book index
 * @returns {{ converted: number, missed: Array<{reference: string, quote: string, repo: string}> }}
 */
export function addGlQuotes(rows, { source, bibles }) {
  const missed = [];
  let converted = 0;
  if (!source || !Array.isArray(bibles) || !bibles.length) return { converted, missed };

  for (const row of rows) {
    const quote = row.Quote;
    if (!quote || !String(quote).trim()) continue;
    for (const bible of bibles) {
      if (row.GLQuotes?.[bible.repo]?.Quote) continue;
      const result = getGlQuote({
        quote,
        occurrence: row.Occurrence,
        reference: row.Reference,
        source,
        target: bible.index,
      });
      if (!result) {
        missed.push({ reference: row.Reference, quote, repo: bible.repo });
        continue;
      }
      if (!row.GLQuotes) row.GLQuotes = {};
      row.GLQuotes[bible.repo] = { Quote: result.quote, Occurrence: result.occurrence };
      converted++;
    }
  }
  return { converted, missed };
}
