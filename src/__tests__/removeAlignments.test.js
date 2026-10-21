import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { removeAlignments } from '../usfm/removeAlignments.js';

/**
 * removeAlignments() was inlined from usfm-alignment-remover 0.1.6 (issue #45).
 * The stored `*.stripped.usfm` fixtures are the ORIGINAL package's output for
 * the aligned v91 Titus files next to them, recorded once; the port must keep
 * reproducing them byte for byte. The hand-written cases below were likewise
 * checked against the original package when they were written.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, '..', 'fixtures', 'usfm', name), 'utf8');

const W = (word) => `\\w ${word}|x-occurrence="1" x-occurrences="1"\\w*`;
const ZS = (content) =>
  `\\zaln-s |x-strong="G00000" x-lemma="${content}" x-morph="Gr,N,,,,,NMS," x-occurrence="1" x-occurrences="1" x-content="${content}"\\*`;
const ZE = '\\zaln-e\\*';

describe('removeAlignments — parity with usfm-alignment-remover 0.1.6', () => {
  test.each(['ult', 'ust'])('reproduces the recorded output for en_%s v91 Titus', (bible) => {
    const aligned = fixture(`57-TIT.${bible}.aligned.usfm`);
    const expected = fixture(`57-TIT.${bible}.stripped.usfm`);
    expect(aligned).toContain('\\zaln-s');
    expect(removeAlignments(aligned)).toBe(expected);
  });

  test.each(['ult', 'ust'])('leaves no alignment markup in en_%s Titus and keeps every verse', (bible) => {
    const aligned = fixture(`57-TIT.${bible}.aligned.usfm`);
    const out = removeAlignments(aligned);
    expect(out).not.toMatch(/\\zaln-[se]/);
    expect(out).not.toMatch(/\\w[ *]/);
    expect(out).not.toContain('x-occurrence');
    // Titus: 16 + 15 + 15 verses, each `\v N ` present exactly once.
    expect(out.match(/\\v \d+ /g)).toHaveLength(46);
    expect((aligned.match(/\\v \d+ /g) || []).length).toBe(46);
    expect(out).toContain('\\c 1\n');
    expect(out).toContain('\\c 3\n');
    // Headers survive.
    expect(out.startsWith('\\id TIT ')).toBe(true);
    expect(out).toContain('\\h Titus\n');
    expect(out).toContain('\\toc1 The Letter of Paul to Titus\n');
  });
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
    const usfm = '\\id TIT\n\\h Titus\n\\c 1\n\\p\n\\v 1 Paul, a servant of God.\n\\v 2 Grace to you.\n\\c 2\n\\p\n\\v 1 But you.\n';
    expect(removeAlignments(usfm)).toBe(
      '\\id TIT\n\\h Titus\n\n\\c 1\n\\p\n\\v 1 Paul, a servant of God.\n\\v 2 Grace to you.\n\n\\c 2\n\\p\n\\v 1 But you.\n'
    );
  });

  test('keeps chapter front matter such as \\s5 and \\p before the first verse', () => {
    const usfm = `\\id TIT\n\\c 1\n\\s5\n\\p\n\\v 1 ${W('Hello')}\n`;
    expect(removeAlignments(usfm)).toBe('\\id TIT\n\n\\c 1\n\\s5\n\\p\n\\v 1 Hello\n');
  });

  test('does not mutate the caller’s parsed structures between calls', () => {
    const usfm = `\\id TIT\n\\c 1\n\\p\n\\v 1 ${ZS('Παῦλος')}${W('Paul')}${ZE}.\n`;
    const first = removeAlignments(usfm);
    const second = removeAlignments(usfm);
    expect(second).toBe(first);
    expect(first).toBe('\\id TIT\n\n\\c 1\n\\p\n\\v 1 Paul.\n');
  });
});
