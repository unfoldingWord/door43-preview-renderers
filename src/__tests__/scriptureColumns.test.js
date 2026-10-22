import {
  parseScriptureExtras,
  renderScriptureColumns,
  getBibleColumns,
} from '../renderers/scriptureColumns.js';
import { renderTranslationNotesHtml } from '../renderers/translationNotesRenderer.js';
import { renderTsvQuestionsHtml } from '../renderers/tsvQuestionsRenderer.js';
import { renderTranslationWordsLinksHtml } from '../renderers/translationWordsLinksRenderer.js';

/**
 * ULT/UST wrap supplied words in {curly braces}. The Aligned Bible renderer
 * hides them unless `editorMode`; the parallel scripture columns of the TSV
 * renderers must do the same (issue #43), while the TWL quote trimming, which
 * reads verse text through bibleHelpers directly, is unaffected.
 */
const extras = {
  ult: {
    type: 'usfm',
    subject: 'Aligned Bible',
    books: { tit: '\\id TIT\n\\c 1\n\\v 1 Paul, a servant {of God}\n\\v 2 {the} hope of life\n' },
  },
  ust: {
    type: 'usfm',
    subject: 'Aligned Bible',
    books: {
      tit: '\\id TIT\n\\c 1\n\\v 1 I, Paul, {write this letter to you, Titus. I} serve God\n',
    },
  },
  ugnt: {
    type: 'usfm',
    subject: 'Greek New Testament',
    books: { tit: '\\id TIT\n\\c 1\n\\v 1 Παῦλος δοῦλος {Θεοῦ}\n' },
  },
};

describe('parseScriptureExtras and the supplied-word braces', () => {
  test('drops the braces by default, keeping the words and single spacing', () => {
    const parsed = parseScriptureExtras(extras);
    expect(parsed.ult.chapters.tit['1']['1']).toBe('Paul, a servant of God');
    expect(parsed.ult.chapters.tit['1']['2']).toBe('the hope of life');
    expect(parsed.ust.chapters.tit['1']['1']).toBe(
      'I, Paul, write this letter to you, Titus. I serve God'
    );
    // Greek originals are never scripture columns.
    expect(parsed.ugnt).toBeUndefined();
  });

  test('keeps the braces under editorMode', () => {
    const parsed = parseScriptureExtras(extras, { editorMode: true });
    expect(parsed.ult.chapters.tit['1']['1']).toBe('Paul, a servant {of God}');
    expect(parsed.ust.chapters.tit['1']['1']).toBe(
      'I, Paul, {write this letter to you, Titus. I} serve God'
    );
  });

  test('the rendered columns follow the parsed text', () => {
    const bibles = getBibleColumns(extras);
    const plain = renderScriptureColumns(bibles, parseScriptureExtras(extras), 'tit', '1', '1');
    expect(plain).toContain('>Paul, a servant of God<');
    expect(plain).not.toContain('{');
    const editing = renderScriptureColumns(
      bibles,
      parseScriptureExtras(extras, { editorMode: true }),
      'tit',
      '1',
      '1'
    );
    expect(editing).toContain('>Paul, a servant {of God}<');
  });
});

function tsvData(subject, rows) {
  return {
    type: 'tsv',
    subject,
    title: subject,
    books: {
      tit: {
        title: 'Titus',
        identifier: 'tit',
        sort: 57,
        chapters: { 1: { verses: { 1: rows } } },
      },
    },
    extras,
  };
}

describe('the TSV renderers thread editorMode into their scripture columns', () => {
  const noteRow = [
    { ID: 'n1', Reference: '1:1', Quote: 'Παῦλος', Occurrence: '1', Note: 'A note.' },
  ];
  const questionRow = [{ ID: 'q1', Reference: '1:1', Question: 'Who?', Response: 'Paul.' }];
  const twlRow = [
    {
      ID: 'w1',
      Reference: '1:1',
      Quote: 'Παῦλος',
      Occurrence: '1',
      TWLink: 'rc://*/tw/dict/bible/names/paul',
    },
  ];

  test.each([
    [
      'Translation Notes',
      () => renderTranslationNotesHtml(tsvData('TSV Translation Notes', noteRow)),
      (o) => renderTranslationNotesHtml(tsvData('TSV Translation Notes', noteRow), o),
    ],
    [
      'Translation Questions',
      () => renderTsvQuestionsHtml(tsvData('TSV Translation Questions', questionRow)),
      (o) => renderTsvQuestionsHtml(tsvData('TSV Translation Questions', questionRow), o),
    ],
    [
      'Translation Words Links',
      () => renderTranslationWordsLinksHtml(tsvData('TSV Translation Words Links', twlRow)),
      (o) => renderTranslationWordsLinksHtml(tsvData('TSV Translation Words Links', twlRow), o),
    ],
  ])('%s: no braces by default, braces under editorMode', (label, renderDefault, renderWith) => {
    const plain = renderDefault().sections.body;
    expect(plain).toContain('Paul, a servant of God');
    expect(plain).toContain('write this letter to you, Titus. I serve God');
    expect(plain).not.toContain('{of God}');
    expect(plain).not.toContain('{write this letter');

    const editing = renderWith({ editorMode: true }).sections.body;
    expect(editing).toContain('Paul, a servant {of God}');
    expect(editing).toContain('{write this letter to you, Titus. I}');
  });
});
