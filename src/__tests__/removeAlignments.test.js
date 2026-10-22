import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import usfmjs from 'usfm-js';
import {
  removeAlignments,
  removeMilestonesAndWordMarkers,
  getUsfmForVerseContent,
} from '../usfm/removeAlignments.js';

/**
 * removeAlignments() was inlined from usfm-alignment-remover 0.1.6 (issue #45).
 * The stored `*.stripped.usfm` fixtures are the ORIGINAL package's output for
 * the aligned v91 Titus 1:1–1:8 files next to them (headers + `\c 1` + eight
 * verses, cut before `\v 9` so the diff stays reviewable — a full chapter is
 * ~125 KB of alignment markup), recorded once with usfm-alignment-remover@0.1.6
 * installed in a throwaway folder; the port must keep reproducing them byte
 * for byte. The hand-written cases below were likewise checked against the
 * original package when they were written.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, '..', 'fixtures', 'usfm', name), 'utf8');

const W = (word) => `\\w ${word}|x-occurrence="1" x-occurrences="1"\\w*`;
const ZS = (content) =>
  `\\zaln-s |x-strong="G00000" x-lemma="${content}" x-morph="Gr,N,,,,,NMS," x-occurrence="1" x-occurrences="1" x-content="${content}"\\*`;
const ZE = '\\zaln-e\\*';

describe('removeAlignments — parity with usfm-alignment-remover 0.1.6', () => {
  test.each(['ult', 'ust'])('reproduces the recorded output for en_%s v91 Titus 1:1–8', (bible) => {
    const aligned = fixture(`57-TIT.${bible}.aligned.usfm`);
    const expected = fixture(`57-TIT.${bible}.stripped.usfm`);
    expect(aligned).toContain('\\zaln-s');
    expect(removeAlignments(aligned)).toBe(expected);
  });

  test.each(['ult', 'ust'])(
    'leaves no alignment markup in en_%s Titus 1:1–8 and keeps every verse',
    (bible) => {
      const aligned = fixture(`57-TIT.${bible}.aligned.usfm`);
      const out = removeAlignments(aligned);
      expect(out).not.toMatch(/\\zaln-[se]/);
      expect(out).not.toMatch(/\\w[ *]/);
      expect(out).not.toContain('x-occurrence');
      // Titus 1:1–1:8: eight verses, each `\v N ` present exactly once.
      expect(out.match(/\\v \d+ /g)).toHaveLength(8);
      expect((aligned.match(/\\v \d+ /g) || []).length).toBe(8);
      expect(out).toContain('\\c 1\n');
      expect(out).not.toContain('\\c 2');
      // Headers survive.
      expect(out.startsWith('\\id TIT ')).toBe(true);
      expect(out).toContain('\\h Titus\n');
      expect(out).toContain('\\toc1 The Letter of Paul to Titus\n');
    }
  );
});

describe('removeAlignments — hand-written cases', () => {
  test('flattens nested zaln milestones and words into running text', () => {
    const usfm =
      '\\id TIT\n\\c 1\n\\p\n\\v 1 ' +
      `${ZS('Παῦλος')}${W('Paul')}${ZE}, ` +
      `${ZS('δοῦλος')}${ZS('Θεοῦ')}${W('a')} ${W('servant')} ${W('of')} ${W('God')}${ZE}${ZE}.\n`;
    expect(removeAlignments(usfm)).toBe('\\id TIT\n\n\\c 1\n\\p\n\\v 1 Paul, a servant of God.\n');
  });

  test('keeps footnotes and verse numbers while stripping word markers', () => {
    const usfm =
      '\\id TIT\n\\c 1\n\\p\n\\v 1 ' +
      `${W('In')} ${W('the')} ${W('beginning')}\\f + \\ft Or \\fqa At first\\f*,\n` +
      `\\v 2 ${W('then')}.\n`;
    expect(removeAlignments(usfm)).toBe(
      '\\id TIT\n\n\\c 1\n\\p\n\\v 1 In the beginning\\f + \\ft Or \\fqa At first\\f*,\n\\v 2 then.\n'
    );
  });

  test('passes unaligned USFM through with the same serialisation (blank line before each chapter)', () => {
    const usfm =
      '\\id TIT\n\\h Titus\n\\c 1\n\\p\n\\v 1 Paul, a servant of God.\n\\v 2 Grace to you.\n\\c 2\n\\p\n\\v 1 But you.\n';
    expect(removeAlignments(usfm)).toBe(
      '\\id TIT\n\\h Titus\n\n\\c 1\n\\p\n\\v 1 Paul, a servant of God.\n\\v 2 Grace to you.\n\n\\c 2\n\\p\n\\v 1 But you.\n'
    );
  });

  test('keeps chapter front matter such as \\s5 and \\p before the first verse', () => {
    const usfm = `\\id TIT\n\\c 1\n\\s5\n\\p\n\\v 1 ${W('Hello')}\n`;
    expect(removeAlignments(usfm)).toBe('\\id TIT\n\n\\c 1\n\\s5\n\\p\n\\v 1 Hello\n');
  });

  test('gives the same output on repeated calls', () => {
    const usfm = `\\id TIT\n\\c 1\n\\p\n\\v 1 ${ZS('Παῦλος')}${W('Paul')}${ZE}.\n`;
    const first = removeAlignments(usfm);
    const second = removeAlignments(usfm);
    expect(second).toBe(first);
    expect(first).toBe('\\id TIT\n\n\\c 1\n\\p\n\\v 1 Paul.\n');
  });

  test('does not mutate the verse objects it is given (nested children are copied)', () => {
    const verseObjects = [
      { type: 'word', text: 'Paul' },
      {
        tag: 'add',
        type: 'character',
        endTag: 'add*',
        children: [
          { type: 'word', text: 'a' },
          { type: 'milestone', tag: 'zaln', children: [{ type: 'word', text: 'servant' }] },
        ],
      },
    ];
    const before = JSON.parse(JSON.stringify(verseObjects));
    const { verseObjects: out } = removeMilestonesAndWordMarkers({ verseObjects });
    expect(verseObjects).toEqual(before);
    expect(out[1].children).toEqual([
      { type: 'text', text: 'a' },
      { type: 'text', text: ' servant' },
    ]);
    expect(out[1]).not.toBe(verseObjects[1]);
  });
});

/**
 * Node 16 (still allowed by `engines`) has no global `structuredClone`; the
 * nested-children branch must not depend on it. Expected strings were checked
 * against usfm-alignment-remover 0.1.6 with `structuredClone` deleted.
 */
describe('removeAlignments — nested character formatting without structuredClone (Node 16)', () => {
  let saved;
  beforeEach(() => {
    saved = globalThis.structuredClone;
    delete globalThis.structuredClone;
    // Pin the precondition: on a host where the global is non-configurable the
    // delete would fail quietly and these tests would exercise nothing.
    expect(globalThis.structuredClone).toBeUndefined();
  });
  afterEach(() => {
    globalThis.structuredClone = saved;
  });
  afterAll(() => {
    globalThis.structuredClone = saved;
  });

  test('keeps \\bd with nested \\+it', () => {
    const usfm = '\\id TIT\n\\c 1\n\\p\n\\v 1 \\bd bold \\+it italic\\+it*\\bd* end.\n';
    expect(removeAlignments(usfm)).toBe(
      '\\id TIT\n\n\\c 1\n\\p\n\\v 1 \\bd bold \\+it italic\\+it*\\bd* end.\n'
    );
  });

  test('strips word markers inside \\add', () => {
    const usfm = `\\id TIT\n\\c 1\n\\p\n\\v 1 ${W('Paul')} \\add ${W('a')} ${W('servant')}\\add* ${W('of')} ${W('God')}.\n`;
    expect(removeAlignments(usfm)).toBe(
      '\\id TIT\n\n\\c 1\n\\p\n\\v 1 Paul \\add a servant\\add* of God.\n'
    );
  });
});

/**
 * #55: upstream cut the serialised verse with `split('\\v 1')`, keeping only
 * the piece after the first marker, and returned '' when there was none.
 */
describe('removeAlignments — the verse marker is cut off exactly once (#55)', () => {
  test('a verse whose text contains "\\v 1" or "\\v 10" keeps all of it', () => {
    for (const text of ['see \\v 1 here', 'up to \\v 10 and on']) {
      expect(getUsfmForVerseContent({ verseObjects: [{ type: 'text', text }] })).toBe(text);
    }
  });

  test('an empty verse is empty, and the verses after it are kept', () => {
    // No verse objects: usfm-js writes just "\\v 1".
    expect(getUsfmForVerseContent({ verseObjects: [] })).toBe('');
    // A verse whose line ends at its marker holds one "\n" text object, which
    // usfm-js writes as "\\v 1\n"; the newline is the verse's and stays.
    expect(removeAlignments(`\\id TIT\n\\c 1\n\\p\n\\v 1\n\\v 2 ${W('Paul')}.\n`)).toBe(
      '\\id TIT\n\n\\c 1\n\\p\n\\v 1 \n\\v 2 Paul.\n'
    );
  });

  test('only the marker and one space are cut: a newline after the marker stays', () => {
    const spy = jest.spyOn(usfmjs, 'toUSFM');
    try {
      spy.mockReturnValue('\\v 1\n\\q line');
      expect(getUsfmForVerseContent({ verseObjects: [] })).toBe('\n\\q line');
      spy.mockReturnValue('\\v 1  two spaces');
      expect(getUsfmForVerseContent({ verseObjects: [] })).toBe(' two spaces');
    } finally {
      spy.mockRestore();
    }
  });

  test('a serialised verse without its marker throws instead of vanishing', () => {
    const spy = jest.spyOn(usfmjs, 'toUSFM').mockReturnValue('Paul, a servant');
    try {
      expect(() => getUsfmForVerseContent({ verseObjects: [{ type: 'text', text: 'x' }] })).toThrow(
        'expected "\\v 1" at the start'
      );
    } finally {
      spy.mockRestore();
    }
  });
});
