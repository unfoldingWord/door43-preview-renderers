import { tokenizeWords, expandVerseRange } from './usfmBookIndex.js';

/**
 * Original-language quote → Gateway Language quote.
 *
 * A Translation Notes / Words Links row names a span of the OL verse by its
 * words (`Quote`, groups separated by `&` when discontiguous) and which
 * occurrence of the first group it means (`Occurrence`). The GL Bible's
 * alignment says which GL words render each OL word, so the GL quote is the
 * GL words aligned to the matched OL words, in GL order, with the text
 * between them kept when they are adjacent and `&` put between them when they
 * are not.
 *
 * This is the one direction the renderer needs. The editor-facing
 * tsv-quote-converters package does the same job both ways with retries for
 * imperfect quotes; the published TSVs have already been through it, so the
 * quotes here are well-formed and a miss is reported as `null`, not retried.
 */

/**
 * Expand a reference ("1:1", "1:1-3", "1:1,3", "1:1-2;2:5", "3:front") into
 * `chapter:verse` keys in order. Mirrors the reference forms the TSVs use.
 */
export function parseReference(reference) {
  const refs = [];
  let chapter = null;
  for (const part of String(reference || '').split(/[;,]/)) {
    const piece = part.trim();
    if (!piece) continue;
    let verses = piece;
    if (piece.includes(':')) {
      const [ch, vs] = piece.split(':');
      chapter = ch.trim();
      verses = vs.trim();
    }
    if (!chapter) continue;
    for (const v of expandVerseRange(verses)) refs.push(`${chapter}:${v}`);
  }
  return refs;
}

/** Tokens of every verse a reference covers, each bridge counted once. */
function tokensFor(index, refs) {
  const seen = new Set();
  const out = [];
  for (const ref of refs) {
    const tokens = index.get(ref);
    if (!tokens || seen.has(tokens)) continue;
    seen.add(tokens);
    out.push(...tokens);
  }
  return out;
}

/** Whether two verse labels share a verse ("6" and "6-7" do). */
function versesOverlap(a, b) {
  if (a === b) return true;
  const bs = expandVerseRange(b);
  return expandVerseRange(a).some((v) => bs.includes(v));
}

/**
 * Split a quote into groups of normalised words: "a b & c" → [["a","b"],["c"]].
 * An ellipsis (`…` or `...`) is the same separator written for people.
 */
export function quoteGroups(quote) {
  return String(quote || '')
    .replace(/\\n/g, ' ')
    .replace(/\s*(?:…|\.\.\.)\s*/g, ' & ')
    .split(/\s*&\s*/)
    .map(tokenizeWords)
    .filter((g) => g.length);
}

/**
 * Find the quote's groups in the OL tokens, in order: the first group at its
 * `occurrence`, each later group at its first occurrence after the previous
 * match. Returns the matched word tokens, or null.
 */
function matchSourceGroups(sourceTokens, groups, occurrence) {
  const words = sourceTokens.filter((t) => t.type === 'word');
  const matched = [];
  let from = 0;
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const wanted = g === 0 && occurrence > 0 ? occurrence : 1;
    let seen = 0;
    let found = null;
    for (let i = from; i + group.length <= words.length; i++) {
      let ok = true;
      for (let k = 0; k < group.length; k++) {
        if (words[i + k].norm !== group[k]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      seen++;
      if (seen === wanted) {
        found = words.slice(i, i + group.length);
        from = i + group.length;
        break;
      }
      // A later occurrence may start before this match ends; keep scanning
      // from the next word, as the converter does.
    }
    if (!found) return null;
    matched.push(...found);
  }
  return matched;
}

/** Whether a GL word is aligned to one of the matched OL words. */
function isAlignedTo(targetToken, matchedSource) {
  for (const a of targetToken.aligned || []) {
    for (const s of matchedSource) {
      if (
        a.content === s.norm &&
        a.occurrence === s.occurrence &&
        s.chapter === targetToken.chapter &&
        versesOverlap(s.verse, targetToken.verse)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Drop `{` / `}` that are not paired within one quote group. ULT/UST wrap
 * supplied words in braces as plain text outside the alignment, so a quote
 * can pick up one half of a pair. A complete pair is kept.
 */
export function dropUnbalancedBraces(text) {
  if (!text.includes('{') && !text.includes('}')) return text;
  const drop = new Set();
  const opened = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') opened.push(i);
    else if (text[i] === '}') {
      if (opened.length) opened.pop();
      else drop.add(i);
    }
  }
  for (const i of opened) drop.add(i);
  if (!drop.size) return text;
  let out = '';
  for (let i = 0; i < text.length; i++) if (!drop.has(i)) out += text[i];
  return out.replace(/ {2,}/g, ' ').trim();
}

/**
 * Which occurrence of the first group's words, as a phrase, the match is in
 * the target verse(s): counted over the GL word sequence, by the occurrence
 * of the phrase's first word.
 */
function phraseOccurrence(targetWords, phraseWords, firstWordOccurrence) {
  if (!phraseWords.length) return firstWordOccurrence;
  let starts = 0;
  let phrases = 0;
  const byStart = {};
  for (let i = 0; i < targetWords.length; i++) {
    if (targetWords[i].norm === phraseWords[0]) starts++;
    let ok = i + phraseWords.length <= targetWords.length;
    for (let k = 0; ok && k < phraseWords.length; k++) {
      if (targetWords[i + k].norm !== phraseWords[k]) ok = false;
    }
    if (ok) {
      phrases++;
      byStart[starts] = phrases;
    }
  }
  return byStart[firstWordOccurrence] || firstWordOccurrence;
}

/**
 * Convert one OL quote to a GL quote.
 *
 * @param {Object} params
 * @param {string} params.quote - OL quote (`&` between discontiguous groups)
 * @param {number|string} [params.occurrence=1] - Occurrence of the first group in the verse(s); -1 = first
 * @param {string} params.reference - "chapter:verse" (ranges/lists allowed)
 * @param {Object} params.source - OL book index from indexUsfmBook()
 * @param {Object} params.target - GL (aligned) book index from indexUsfmBook()
 * @returns {{ quote: string, occurrence: number } | null}
 */
export function getGlQuote({ quote, occurrence = 1, reference, source, target }) {
  const groups = quoteGroups(quote);
  if (!groups.length) return null;
  const occ = parseInt(occurrence, 10);
  if (occ === 0) return null;

  const refs = parseReference(reference);
  if (!refs.length) return null;
  const sourceTokens = tokensFor(source, refs);
  const targetTokens = tokensFor(target, refs);
  if (!sourceTokens.length || !targetTokens.length) return null;

  const matched = matchSourceGroups(sourceTokens, groups, Number.isNaN(occ) ? 1 : occ);
  if (!matched) return null;

  // Collect the aligned GL words in GL order. Text between two aligned words
  // is kept (punctuation, spaces, braces); a gap closes the group.
  const glGroups = [];
  let current = '';
  let between = '';
  let firstWordOccurrence = 0;
  let firstGroupWords = [];
  let inFirstGroup = true;
  for (const token of targetTokens) {
    if (token.type !== 'word') {
      if (current) between += token.text;
      continue;
    }
    if (isAlignedTo(token, matched)) {
      if (!current && glGroups.length === 0) firstWordOccurrence = token.occurrence;
      // Whatever sat between two aligned words comes along, with runs of
      // whitespace (a poetry line break, a marker's trailing space) collapsed.
      if (current) current += between.replace(/\s+/g, ' ');
      between = '';
      current += token.text;
      if (inFirstGroup) firstGroupWords.push(token);
    } else if (current) {
      glGroups.push(current);
      current = '';
      between = '';
      inFirstGroup = false;
    }
  }
  if (current) glGroups.push(current);
  if (!glGroups.length) return null;

  const targetWords = targetTokens.filter((t) => t.type === 'word');
  const glOccurrence = phraseOccurrence(
    targetWords,
    firstGroupWords.map((t) => t.norm),
    firstWordOccurrence
  );

  return {
    quote: glGroups.map(dropUnbalancedBraces).join(' & '),
    occurrence: glOccurrence,
  };
}
