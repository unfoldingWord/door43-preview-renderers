/**
 * Trim a Translation Words Link GL quote down to the word that names its article.
 *
 * A TWL row pairs an original-language word with a TW article, and the GL quote
 * is reconstructed from the aligned Bible — so it is often wider than the term
 * itself. Matthew 5:27 links μοιχεύσεις to the "adultery" article, and the ULT
 * renders it "Do & commit adultery"; the list of Translation Words for that
 * verse wants to read "adultery".
 *
 * The article's first-line header enumerates the term's forms, e.g.
 * "adultery, adulterous, adulterer, adulteress", and one of those must appear in
 * the quote **exactly, on word boundaries** (case-insensitively, plus the
 * language's inflections) for the quote to be trimmed to it. Nothing fuzzy: a
 * prefix or stem rule would trim Matthew 1:8's "Asaph" to the unrelated "Asa"
 * article it is mistakenly linked to, silently hiding a TWL data error. When no
 * term is found the quote is returned untouched, which is the common case for
 * simplified translations that paraphrase the term rather than use it.
 *
 * Pure function: the caller passes the header line it already has, so this does
 * no fetching and no lookup of its own.
 */

/**
 * Inflected surface forms of an English word.
 *
 * Only English is supplied. Other Gateway Languages fall back to exact matching,
 * which still covers most rows because the headers themselves enumerate the
 * forms — add an entry to INFLECTORS to do better for a given language.
 */
function englishForms(word) {
  const w = word.toLowerCase();
  const forms = new Set([w]);
  const vowels = 'aeiou';
  const isConsonant = (c) => /[a-z]/.test(c) && !vowels.includes(c);
  const last = w.slice(-1);

  forms.add(w + 's');
  forms.add(w + 'es');
  if (last === 'y' && isConsonant(w.slice(-2, -1))) {
    const stem = w.slice(0, -1);
    forms.add(stem + 'ies');
    forms.add(stem + 'ied');
    forms.add(stem + 'ier');
    forms.add(stem + 'iest');
  }
  if (last === 'e') {
    forms.add(w.slice(0, -1) + 'ing');
    forms.add(w + 'd');
  } else {
    forms.add(w + 'ing');
    forms.add(w + 'ed');
  }
  // Doubled final consonant: sin -> sinning, sinned
  if (
    isConsonant(last) &&
    vowels.includes(w.slice(-2, -1)) &&
    !vowels.includes(w.slice(-3, -2) || '')
  ) {
    forms.add(w + last + 'ing');
    forms.add(w + last + 'ed');
  }
  forms.add(w + "'s");
  forms.add(w + '’s');
  return forms;
}

const INFLECTORS = { en: englishForms };

/** Whether two words are the same term, ignoring case and allowing inflections. */
function sameWord(a, b, lang) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return true;
  const inflect = INFLECTORS[lang];
  return inflect ? inflect(x).has(y) || inflect(y).has(x) : false;
}

/**
 * Split a TW article header into candidate terms, longest first.
 *
 * Parenthesised text is editorial disambiguation, never part of the term —
 * "Mary (the mother of Jesus)" must not let the word "of" count as a match.
 * Longest-first ordering makes "Jesus Christ" win over "Jesus".
 *
 * @param {string} headerTitle - The article's first line, with or without its `#`
 * @returns {{term: string, words: string[]}[]}
 */
export function parseTermsFromHeader(headerTitle) {
  if (!headerTitle) return [];
  return String(headerTitle)
    .replace(/^#+\s*/, '')
    .split(',')
    .map((term) =>
      term
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .map((term) => ({ term, words: term.split(' ') }))
    .sort((a, b) => b.words.length - a.words.length || b.term.length - a.term.length);
}

/** Words with their offsets, so a matched span keeps the quote's own casing. */
function tokenize(text) {
  const tokens = [];
  const re = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
  let match;
  while ((match = re.exec(text)) !== null) {
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

/**
 * @param {string} glQuote - The row's GL quote, e.g. `'Do & commit adultery'`
 * @param {string} twHeaderTitle - The TW article's header, e.g. `'adultery, adulterous'`
 * @param {object} [options]
 * @param {string} [options.lang='en'] - Gateway Language code, selects inflection rules
 * @param {string} [options.separator='&'] - Separator between the spans of a discontiguous quote
 * @returns {{quote: string, trimmed: boolean, term: string|null, segmentIndex: number,
 *   offset: number}} `quote` is the trimmed span in the quote's original casing, or
 *   the quote unchanged when no term matched; `term` is the header term that matched;
 *   `segmentIndex`/`offset` locate the span within the quote so its occurrence can be
 *   recomputed against the verse (see recalculateOccurrence).
 */
export function trimQuoteToTermWords(glQuote, twHeaderTitle, options = {}) {
  const { lang = 'en', separator = '&' } = options;
  const original = String(glQuote ?? '');
  const untouched = { quote: original, trimmed: false, term: null, segmentIndex: 0, offset: 0 };
  if (!original.trim() || original.includes('QUOTE_NOT_FOUND')) return untouched;

  const terms = parseTermsFromHeader(twHeaderTitle);
  if (terms.length === 0) return untouched;

  // A discontiguous quote is several separate spans of the verse. A term has to
  // sit inside one of them; matching across the gap would "find" it in text that
  // is not actually contiguous.
  const segments = original.split(separator);

  for (const { term, words } of terms) {
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      const tokens = tokenize(segment);
      for (let i = 0; i + words.length <= tokens.length; i++) {
        if (!words.every((word, k) => sameWord(word, tokens[i + k].word, lang))) continue;
        const start = tokens[i].start;
        const span = segment.slice(start, tokens[i + words.length - 1].end);
        return { quote: span, trimmed: span !== original, term, segmentIndex, offset: start };
      }
    }
  }

  return untouched;
}

/** Case-sensitive comparison of a run of verse words against a quote's words. */
function matchesAt(verseWords, index, words) {
  if (index + words.length > verseWords.length) return false;
  return words.every((word, k) => verseWords[index + k] === word);
}

/** Every token index where `words` occurs in `verseWords`. */
function matchIndexes(verseWords, words) {
  const found = [];
  if (words.length === 0) return found;
  for (let i = 0; i + words.length <= verseWords.length; i++) {
    if (matchesAt(verseWords, i, words)) found.push(i);
  }
  return found;
}

const wordsOf = (text) => tokenize(String(text ?? '')).map((t) => t.word);

/**
 * Find where the `occurrence`-th instance of a (possibly discontiguous) quote sits
 * in the verse, as one starting word index per segment.
 *
 * Matching is done over words rather than characters, so punctuation and the
 * {curly braces} that mark supplied words in ULT/UST cannot prevent a match — the
 * quote and the verse do not have to agree on them. Comparison is case-sensitive,
 * because occurrence numbers distinguish "You" from "you".
 *
 * @returns {number[]|null} Starting word index of each segment, or null if not found.
 */
export function locateQuoteInVerse(verseText, quote, occurrence = 1, separator = '&') {
  const verseWords = wordsOf(verseText);
  const segments = String(quote)
    .split(separator)
    .map(wordsOf)
    .filter((words) => words.length > 0);
  if (segments.length === 0) return null;

  let found = 0;
  for (const firstStart of matchIndexes(verseWords, segments[0])) {
    const starts = [firstStart];
    let searchFrom = firstStart + segments[0].length;
    let complete = true;
    for (let i = 1; i < segments.length; i++) {
      // Later segments follow the earlier ones, but not adjacently.
      let next = -1;
      for (let j = searchFrom; j + segments[i].length <= verseWords.length; j++) {
        if (matchesAt(verseWords, j, segments[i])) {
          next = j;
          break;
        }
      }
      if (next < 0) {
        complete = false;
        break;
      }
      starts.push(next);
      searchFrom = next + segments[i].length;
    }
    if (!complete) continue;
    found++;
    if (found === occurrence) return starts;
  }
  return null;
}

/**
 * Recompute a GL occurrence after the quote was trimmed.
 *
 * The occurrence says which instance of the quote in the verse a row means.
 * Trimming changes what is being counted — "commit adultery" may be the only
 * instance while "adultery" alone is the third word in the verse — so the number
 * has to be recomputed against the trimmed text.
 *
 * Returns the original occurrence when the verse is unavailable or the quote cannot
 * be placed and the term is ambiguous, keeping a stale value rather than inventing one.
 *
 * @param {string} verseText - Plain text of the verse(s) the row references
 * @param {object} trim - The result of trimQuoteToTermWords()
 * @param {string} fullQuote - The untrimmed GL quote
 * @param {number} fullOccurrence - The untrimmed GL occurrence
 * @param {string} [separator='&']
 * @returns {number} The occurrence of the trimmed quote in the verse
 */
export function recalculateOccurrence(verseText, trim, fullQuote, fullOccurrence, separator = '&') {
  const occurrence = Number(fullOccurrence) || 1;
  if (!trim?.trimmed || !verseText) return occurrence;

  const verseWords = wordsOf(verseText);
  const spans = matchIndexes(verseWords, wordsOf(trim.quote));
  if (spans.length === 0) return occurrence;

  const starts = locateQuoteInVerse(verseText, fullQuote, occurrence, separator);
  if (starts) {
    // Which word of its segment the trimmed span starts at, mapped into the verse.
    const segment = String(fullQuote).split(separator)[trim.segmentIndex] ?? '';
    const wordIndex = tokenize(segment).findIndex((token) => token.start === trim.offset);
    if (wordIndex >= 0) {
      const position = spans.indexOf(starts[trim.segmentIndex] + wordIndex);
      if (position >= 0) return position + 1;
    }
  }

  // The quote would not place. A term occurring exactly once is still unambiguous.
  if (spans.length === 1) return 1;
  return occurrence;
}
