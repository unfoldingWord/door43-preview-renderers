import {
  trimQuoteToTermWords,
  parseTermsFromHeader,
  locateQuoteInVerse,
  recalculateOccurrence,
} from '../twQuoteTrim.js';

/**
 * A TWL row's GL quote comes from the Bible alignment, so it is often wider than
 * the Translation Words term it links to. These tests lock the rule for cutting
 * it down: the article header's term (or an inflection of it) must appear in the
 * quote exactly, on word boundaries, or the quote is left alone.
 */
describe('parseTermsFromHeader', () => {
  test('splits the header on commas, longest term first', () => {
    expect(parseTermsFromHeader('# Jesus, Jesus Christ, Christ Jesus').map((t) => t.term)).toEqual([
      'Jesus Christ',
      'Christ Jesus',
      'Jesus',
    ]);
  });

  test('drops parenthesised disambiguation so its words cannot match', () => {
    expect(parseTermsFromHeader('Mary (the mother of Jesus)').map((t) => t.term)).toEqual(['Mary']);
  });

  test('returns nothing for an empty or missing header', () => {
    expect(parseTermsFromHeader('')).toEqual([]);
    expect(parseTermsFromHeader(undefined)).toEqual([]);
  });
});

describe('trimQuoteToTermWords', () => {
  const adultery = 'adultery, adulterous, adulterer, adulteress';

  test('trims a wider quote down to the term', () => {
    expect(trimQuoteToTermWords('Do & commit adultery', adultery)).toMatchObject({
      quote: 'adultery',
      trimmed: true,
      term: 'adultery',
    });
  });

  test('matches case-insensitively but keeps the quote’s own casing', () => {
    expect(trimQuoteToTermWords('Do & commit Adultery', adultery).quote).toBe('Adultery');
    expect(trimQuoteToTermWords('ADULTERY is wrong', adultery).quote).toBe('ADULTERY');
  });

  test('leaves a paraphrase that never uses the term untouched', () => {
    const quote = 'Married people must remain sexually faithful to their spouses';
    expect(trimQuoteToTermWords(quote, adultery)).toMatchObject({
      quote,
      trimmed: false,
      term: null,
    });
  });

  test('picks the segment holding the term, not the longest one', () => {
    // Choosing by size would give "splended"; only the term match gives "stag".
    expect(
      trimQuoteToTermWords('a & splended & stag', 'deer, doe, fawn, roebuck, stag').quote
    ).toBe('stag');
  });

  test('never matches across a discontiguous gap', () => {
    // "sons of God" cannot be assembled from "sons of" + "Father".
    expect(trimQuoteToTermWords('sons of & Father', 'sons of God, children of God')).toMatchObject({
      quote: 'sons of & Father',
      trimmed: false,
      term: null,
    });
  });

  test('requires a whole-word match, so a mistaken TWL link is left visible', () => {
    // Matthew 1:8 links "Asaph" to the "Asa" article. A prefix or stem rule would
    // trim it and hide the data error; the quote must survive intact.
    expect(trimQuoteToTermWords('Asaph', 'Asa')).toMatchObject({
      quote: 'Asaph',
      trimmed: false,
      term: null,
    });
  });

  test('accepts English inflections of a header term', () => {
    expect(trimQuoteToTermWords('were & generations', 'generation').quote).toBe('generations');
    expect(trimQuoteToTermWords('they were sinning greatly', 'sin, sinful, sinner').quote).toBe(
      'sinning'
    );
  });

  test('prefers the longest matching term', () => {
    expect(
      trimQuoteToTermWords('the birth of Jesus Christ', 'Jesus, Jesus Christ, Christ Jesus').quote
    ).toBe('Jesus Christ');
  });

  test('reports no trim when the quote already is exactly the term', () => {
    expect(trimQuoteToTermWords('Holy Spirit', 'Holy Spirit, Spirit of God')).toMatchObject({
      quote: 'Holy Spirit',
      trimmed: false,
      term: 'Holy Spirit',
    });
  });

  test('falls back to exact matching for a language with no inflection rules', () => {
    // No es rules are defined, so an inflected form must not match.
    expect(trimQuoteToTermWords('las generaciones', 'generación', { lang: 'es' }).quote).toBe(
      'las generaciones'
    );
    expect(trimQuoteToTermWords('la generación de', 'generación', { lang: 'es' }).quote).toBe(
      'generación'
    );
  });

  test('leaves unresolved and empty quotes alone', () => {
    expect(trimQuoteToTermWords('QUOTE_NOT_FOUND: μοιχεύσεις', adultery).trimmed).toBe(false);
    expect(trimQuoteToTermWords('', adultery).quote).toBe('');
    expect(trimQuoteToTermWords('adultery', '').quote).toBe('adultery');
  });
});

describe('locateQuoteInVerse', () => {
  // Word indices: You0 have1 heard2 that3 it4 was5 said6 You7 shall8 not9 commit10 adultery11
  const verse = 'You have heard that it was said, You shall not commit adultery.';

  test('finds a contiguous quote, as word indices', () => {
    expect(locateQuoteInVerse(verse, 'commit adultery', 1)).toEqual([10]);
  });

  test('counts occurrences case-sensitively', () => {
    // "You" appears twice; "you" never does.
    expect(locateQuoteInVerse(verse, 'You', 2)).toEqual([7]);
    expect(locateQuoteInVerse(verse, 'you', 1)).toBeNull();
  });

  test('places each segment of a discontiguous quote after the previous one', () => {
    expect(locateQuoteInVerse(verse, 'You have & said', 1)).toEqual([0, 6]);
  });

  test('ignores braces and punctuation on either side', () => {
    // ULT marks supplied words with {braces}; a quote need not agree with the verse
    // about them, nor about the comma after "said".
    const braced = 'You have heard that it was {said}, You shall not commit adultery.';
    expect(locateQuoteInVerse(braced, 'was said', 1)).toEqual([5]);
    expect(locateQuoteInVerse(verse, 'was {said}', 1)).toEqual([5]);
  });

  test('returns null when the quote is not in the verse', () => {
    expect(locateQuoteInVerse(verse, 'no such words', 1)).toBeNull();
  });
});

describe('recalculateOccurrence', () => {
  test('renumbers a trimmed quote to its own occurrence in the verse', () => {
    // "commit adultery" is the only such phrase, but the trimmed "adultery" is the
    // second word-occurrence of adultery in the verse.
    const verse = 'Anyone guilty of adultery must not commit adultery again.';
    const trim = trimQuoteToTermWords('commit adultery', 'adultery, adulterous');
    expect(trim.quote).toBe('adultery');
    expect(recalculateOccurrence(verse, trim, 'commit adultery', 1)).toBe(2);
  });

  test('renumbers from within the right segment of a discontiguous quote', () => {
    const verse = 'There were generations, and there were generations after them.';
    const trim = trimQuoteToTermWords('were & generations after', 'generation');
    expect(trim.quote).toBe('generations');
    expect(recalculateOccurrence(verse, trim, 'were & generations after', 1)).toBe(2);
  });

  test('is case-sensitive when counting', () => {
    const verse = 'you are here, and You are the one, you see.';
    const trim = trimQuoteToTermWords('the You', 'You');
    expect(trim.quote).toBe('You');
    expect(recalculateOccurrence(verse, trim, 'the You', 1)).toBe(1);
  });

  test('keeps the occurrence when nothing was trimmed', () => {
    const trim = trimQuoteToTermWords('adultery', 'adultery');
    expect(recalculateOccurrence('some verse', trim, 'adultery', 3)).toBe(3);
  });

  test('keeps the occurrence when the verse text is unavailable', () => {
    const trim = trimQuoteToTermWords('commit adultery', 'adultery');
    expect(recalculateOccurrence('', trim, 'commit adultery', 2)).toBe(2);
  });

  test('falls back to 1 when the term is unambiguous but the quote will not place', () => {
    // The GL quote is not in the verse verbatim, but "adultery" occurs once.
    const trim = trimQuoteToTermWords('Do & commit adultery', 'adultery');
    expect(
      recalculateOccurrence('They commit adultery here.', trim, 'Do & commit adultery', 1)
    ).toBe(1);
  });
});
