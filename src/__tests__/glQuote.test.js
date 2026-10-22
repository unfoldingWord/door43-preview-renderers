import {
  indexUsfmBook,
  normalizeWord,
  tokenizeWords,
  expandVerseRange,
} from '../quotes/usfmBookIndex.js';
import {
  getGlQuote,
  parseReference,
  quoteGroups,
  dropUnbalancedBraces,
} from '../quotes/glQuote.js';
import { addGlQuotes } from '../quotes/addGlQuotes.js';

/**
 * Hand-built USFM: a two-verse Greek "original" and an aligned English
 * "target". Verse 1 renders Παῦλος → "Paul", δοῦλος → "a servant", Θεοῦ →
 * "of God" (twice, the second in verse 2), with a supplied word in braces and
 * a possessive apostrophe. Verse 3-4 is a bridge.
 */
const zaln = (content, occurrence, occurrences, inner) =>
  `\\zaln-s |x-strong="G1" x-lemma="${content}" x-morph="Gr" x-occurrence="${occurrence}" x-occurrences="${occurrences}" x-content="${content}"\\*${inner}\\zaln-e\\*`;
const w = (text, occurrence = 1, occurrences = 1) =>
  `\\w ${text}|x-occurrence="${occurrence}" x-occurrences="${occurrences}"\\w*`;

const SOURCE = [
  '\\id TIT',
  '\\c 1',
  '\\p',
  '\\v 1 \\w Παῦλος\\w*, \\w δοῦλος\\w* \\w Θεοῦ\\w*, \\w ἀπόστολος\\w* \\w Θεοῦ\\w*',
  '\\v 2 \\w χάρις\\w* \\w Θεοῦ\\w*',
  '\\v 3-4 \\w ἀλλ’\\w* \\w ἡμῖν\\w*',
  '',
].join('\n');

const TARGET = [
  '\\id TIT',
  '\\c 1',
  '\\p',
  `\\v 1 ${zaln('Παῦλος', 1, 1, w('Paul'))}, ${zaln('δοῦλος', 1, 1, `${w('a')} ${w('servant')}`)} ${zaln('Θεοῦ', 1, 2, `${w('of', 1, 2)} ${w('God', 1, 2)}`)}, {${zaln('ἀπόστολος', 1, 1, w('an') + ' ' + w('apostle'))}} ${zaln('Θεοῦ', 2, 2, `${w('of', 2, 2)} ${w('God', 2, 2)}`)}${w('’s', 1, 1)}`,
  `\\v 2 ${zaln('χάρις', 1, 1, w('Grace'))}`,
  '\\q1',
  `${zaln('Θεοῦ', 1, 1, `${w('of')} ${w('God')}`)}`,
  `\\v 3-4 ${zaln('ἀλλ’', 1, 1, w('but'))} ${zaln('ἡμῖν', 1, 1, `${w('to')} ${w('us')}`)}`,
  '',
].join('\n');

const source = indexUsfmBook(SOURCE);
const target = indexUsfmBook(TARGET);
const lookup = (quote, occurrence = 1, reference = '1:1') =>
  getGlQuote({ quote, occurrence, reference, source, target });

describe('indexUsfmBook', () => {
  test('tokenises words with per-verse occurrences and alignment', () => {
    const words = target.get('1:1').filter((t) => t.type === 'word');
    expect(words.map((t) => t.text)).toEqual([
      'Paul',
      'a',
      'servant',
      'of',
      'God',
      'an',
      'apostle',
      'of',
      'God',
      '’s',
    ]);
    expect(words[4]).toMatchObject({
      occurrence: 1,
      aligned: [{ content: 'Θεοῦ', occurrence: 1 }],
    });
    expect(words[8]).toMatchObject({
      occurrence: 2,
      aligned: [{ content: 'Θεοῦ', occurrence: 2 }],
    });
  });

  test('a verse bridge is reachable by every verse it covers', () => {
    expect(target.get('1:3')).toBe(target.get('1:4'));
    expect(
      target
        .get('1:3')
        .filter((t) => t.type === 'word')
        .map((t) => t.text)
    ).toEqual(['but', 'to', 'us']);
    expect(target.get('1:5')).toBeUndefined();
  });

  test('normalisation: NFC, no word joiner, no punctuation, maqaf splits', () => {
    expect(normalizeWord('ἀλλ’')).toBe('ἀλλ');
    expect(normalizeWord('בְּ⁠רֵאשִׁ֖ית')).toBe('בְּרֵאשִׁ֖ית');
    expect(normalizeWord('בְּרֵאשִׁ֖ית'.normalize('NFD'))).toBe('בְּרֵאשִׁ֖ית'.normalize('NFC'));
    expect(tokenizeWords('אֶת־הַ⁠שָּׁמַ֖יִם, וְ⁠אֵ֥ת')).toEqual(['אֶת', 'הַשָּׁמַ֖יִם', 'וְאֵ֥ת']);
    expect(expandVerseRange('11-13')).toEqual(['11', '12', '13']);
    expect(expandVerseRange('front')).toEqual(['front']);
  });
});

describe('getGlQuote', () => {
  test('a single word', () => {
    expect(lookup('Παῦλος')).toEqual({ quote: 'Paul', occurrence: 1 });
  });

  test('a phrase keeps the text between its aligned words', () => {
    expect(lookup('Παῦλος, δοῦλος Θεοῦ')).toEqual({
      quote: 'Paul, a servant of God',
      occurrence: 1,
    });
  });

  test('the second occurrence of a word; an unaligned word after it is not part of the span', () => {
    expect(lookup('Θεοῦ', 2)).toEqual({ quote: 'of God', occurrence: 2 });
    expect(lookup('Θεοῦ', 1)).toEqual({ quote: 'of God', occurrence: 1 });
  });

  test('discontiguous groups are joined with &, each found in order', () => {
    expect(lookup('Παῦλος & ἀπόστολος')).toEqual({ quote: 'Paul & an apostle', occurrence: 1 });
    // "…" is the human spelling of the same separator.
    expect(lookup('Παῦλος … ἀπόστολος')).toEqual({ quote: 'Paul & an apostle', occurrence: 1 });
  });

  test('braces: only text between aligned words comes along; a stray brace is dropped, a pair kept', () => {
    // The braces sit outside the span's first and last aligned words → not included.
    expect(lookup('ἀπόστολος').quote).toBe('an apostle');
    // The span runs from "God" into the braces → the opening brace alone is dropped.
    expect(lookup('Θεοῦ, ἀπόστολος').quote).toBe('of God, an apostle');
    // The whole pair lies between aligned words of the span → kept.
    expect(lookup('Θεοῦ, ἀπόστολος Θεοῦ').quote).toBe('of God, {an apostle} of God');
    expect(dropUnbalancedBraces('a man named} Joseph')).toBe('a man named Joseph');
  });

  test('a reference range and a verse bridge', () => {
    expect(lookup('χάρις Θεοῦ', 1, '1:2')).toEqual({ quote: 'Grace of God', occurrence: 1 });
    expect(lookup('ἀλλ’ ἡμῖν', 1, '1:3')).toEqual({ quote: 'but to us', occurrence: 1 });
    expect(lookup('ἀλλ’ ἡμῖν', 1, '1:3-4')).toEqual({ quote: 'but to us', occurrence: 1 });
    expect(parseReference('1:1-2;2:5,7')).toEqual(['1:1', '1:2', '2:5', '2:7']);
    expect(parseReference('3:front')).toEqual(['3:front']);
  });

  test('over a range, the GL occurrence counts every verse of the range', () => {
    // 1:1-2 holds three "of God"; the third (in verse 2) is the one aligned
    // to the third Θεοῦ, so it is occurrence 3 of the range, not 1 of verse 2.
    expect(lookup('Θεοῦ', 3, '1:1-2')).toEqual({ quote: 'of God', occurrence: 3 });
    expect(lookup('χάρις Θεοῦ', 1, '1:1-2')).toEqual({ quote: 'Grace of God', occurrence: 1 });
    expect(lookup('Θεοῦ', 2, '1:1-2')).toEqual({ quote: 'of God', occurrence: 2 });
  });

  test('a GL bridge over unbridged OL verses: alignment occurrences count the whole bridge', () => {
    // OL verses 1 and 2 each hold one θεός (verse-local occurrence 1). The GL
    // bridges 1-2, so its alignment numbers them 1 and 2 across the bridge.
    const src = indexUsfmBook(
      ['\\id TIT', '\\c 1', '\\p', '\\v 1 \\w θεός\\w* \\w καὶ\\w*', '\\v 2 \\w θεός\\w*', ''].join(
        '\n'
      )
    );
    const tgt = indexUsfmBook(
      [
        '\\id TIT',
        '\\c 1',
        '\\p',
        `\\v 1-2 ${zaln('θεός', 1, 2, w('God'))} ${zaln('καὶ', 1, 1, w('and'))} ${zaln('θεός', 2, 2, w('deity'))}`,
        '',
      ].join('\n')
    );
    const gl = (reference) =>
      getGlQuote({ quote: 'θεός', occurrence: 1, reference, source: src, target: tgt });
    expect(gl('1:1')).toEqual({ quote: 'God', occurrence: 1 });
    expect(gl('1:2')).toEqual({ quote: 'deity', occurrence: 1 });
    expect(
      getGlQuote({ quote: 'θεός', occurrence: 2, reference: '1:1-2', source: src, target: tgt })
    ).toEqual({
      quote: 'deity',
      occurrence: 1,
    });
  });

  test('GL words that differ only by internal punctuation are counted apart', () => {
    // "son’s" and "sons" share a punctuation-free norm; the highlighter
    // (locateQuoteInVerse) treats them as different words, so must the count.
    const src = indexUsfmBook(
      ['\\id TIT', '\\c 1', '\\p', '\\v 1 \\w υἱοί\\w* \\w υἱοῦ\\w*', ''].join('\n')
    );
    const tgt = indexUsfmBook(
      [
        '\\id TIT',
        '\\c 1',
        '\\p',
        `\\v 1 ${zaln('υἱοί', 1, 1, w('sons'))} ${zaln('υἱοῦ', 1, 1, w('son’s'))}`,
        '',
      ].join('\n')
    );
    expect(
      getGlQuote({ quote: 'υἱοῦ', occurrence: 1, reference: '1:1', source: src, target: tgt })
    ).toEqual({
      quote: 'son’s',
      occurrence: 1,
    });
  });

  test('misses are null, not guesses', () => {
    expect(lookup('Θεοῦ', 3)).toBeNull(); // only two in the verse
    expect(lookup('οὐκ')).toBeNull(); // not in the verse
    expect(lookup('Παῦλος', 1, '9:9')).toBeNull(); // no such verse
    expect(lookup('', 1)).toBeNull();
    expect(lookup('Παῦλος', 0)).toBeNull();
    expect(quoteGroups(' & ')).toEqual([]);
  });

  test('occurrence -1 means the first match', () => {
    expect(lookup('Θεοῦ', -1)).toEqual({ quote: 'of God', occurrence: 1 });
  });
});

describe('addGlQuotes', () => {
  test('fills GLQuotes per Bible, keeps existing ones, reports misses', () => {
    const rows = [
      { Reference: '1:1', ID: 'a', Quote: 'Παῦλος', Occurrence: '1' },
      {
        Reference: '1:1',
        ID: 'b',
        Quote: 'Θεοῦ',
        Occurrence: '2',
        GLQuotes: { en_ult: { Quote: 'kept', Occurrence: 9 } },
      },
      { Reference: '1:1', ID: 'c', Quote: 'οὐκ', Occurrence: '1' },
      { Reference: '1:1', ID: 'd', Quote: '', Occurrence: '0' },
    ];
    const result = addGlQuotes(rows, {
      source,
      bibles: [
        { repo: 'en_ult', index: target },
        { repo: 'en_ust', index: target },
      ],
    });
    expect(rows[0].GLQuotes).toEqual({
      en_ult: { Quote: 'Paul', Occurrence: 1 },
      en_ust: { Quote: 'Paul', Occurrence: 1 },
    });
    expect(rows[1].GLQuotes.en_ult).toEqual({ Quote: 'kept', Occurrence: 9 });
    expect(rows[1].GLQuotes.en_ust).toEqual({ Quote: 'of God', Occurrence: 2 });
    expect(rows[2].GLQuotes).toBeUndefined();
    expect(rows[3].GLQuotes).toBeUndefined();
    expect(result.converted).toBe(3);
    expect(result.missed).toEqual([
      { reference: '1:1', quote: 'οὐκ', repo: 'en_ult' },
      { reference: '1:1', quote: 'οὐκ', repo: 'en_ust' },
    ]);
  });
});
