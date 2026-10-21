/**
 * Regenerate the GL-quote parity fixtures under src/fixtures/glquotes/.
 *
 * The fixtures record what tsv-quote-converters 1.2.0 (the editor-facing
 * converter this library no longer depends on) produced for the published
 * en_tn / en_twl v91 rows of Titus, Ruth, Genesis 1-3 and Psalms 1-3, against
 * ULT/UST v91 and the blueprint-pinned UGNT v0.34 / UHB v3.0.0. The parity test
 * (src/__tests__/glQuoteParity.test.js) holds src/quotes/ to that output.
 *
 * Run only when the converter's behaviour is meant to change:
 *
 *   npm install --no-save tsv-quote-converters@1.2.0
 *   node scripts/gen-glquote-fixtures.mjs
 *   git checkout package.json pnpm-lock.yaml   # if the install touched them
 */
import fs from 'fs';
import { addGLQuoteCols } from 'tsv-quote-converters';
const OUT = 'src/fixtures/glquotes';
const raw = async (o, r, p, ref) => { const res = await fetch(`https://git.door43.org/api/v1/repos/${o}/${r}/raw/${p}?ref=${ref}`); if (!res.ok) throw new Error(`${res.status} ${o}/${r}/${p}@${ref}`); return res.text(); };
const books = [
  { id: 'tit', usfm: '57-TIT', ol: ['el-x-koine_ugnt', 'v0.34'], chapters: null },
  { id: 'rut', usfm: '08-RUT', ol: ['hbo_uhb', 'v3.0.0'], chapters: null },
  { id: 'gen', usfm: '01-GEN', ol: ['hbo_uhb', 'v3.0.0'], chapters: [1, 2, 3] },
  { id: 'psa', usfm: '19-PSA', ol: ['hbo_uhb', 'v3.0.0'], chapters: [1, 2, 3] },
];
const sliceUsfm = (usfm, chapters) => {
  if (!chapters) return usfm;
  const parts = usfm.split(/(?=\\c )/);
  const head = parts[0];
  const keep = parts.filter((p) => { const m = p.match(/^\\c (\d+)/); return m && chapters.includes(parseInt(m[1], 10)); });
  return head + keep.join('');
};
const sliceTsv = (tsv, chapters) => {
  if (!chapters) return tsv;
  const lines = tsv.split('\n');
  return [lines[0], ...lines.slice(1).filter((l) => { const ch = parseInt(l.split('\t')[0], 10); return chapters.includes(ch) || /^front:/.test(l); })].join('\n');
};
for (const b of books) {
  const B = b.usfm.split('-')[1];
  const [ult, ust, ol] = await Promise.all([
    raw('unfoldingWord', 'en_ult', `${b.usfm}.usfm`, 'v91'),
    raw('unfoldingWord', 'en_ust', `${b.usfm}.usfm`, 'v91'),
    raw('unfoldingWord', b.ol[0], `${b.usfm}.usfm`, b.ol[1]),
  ]);
  fs.writeFileSync(`${OUT}/usfm/${b.id}.ult.usfm`, sliceUsfm(ult, b.chapters));
  fs.writeFileSync(`${OUT}/usfm/${b.id}.ust.usfm`, sliceUsfm(ust, b.chapters));
  fs.writeFileSync(`${OUT}/usfm/${b.id}.${b.ol[0] === 'hbo_uhb' ? 'uhb' : 'ugnt'}.usfm`, sliceUsfm(ol, b.chapters));
  for (const res of ['tn', 'twl']) {
    const tsv = sliceTsv(await raw('unfoldingWord', `en_${res}`, `${res}_${B}.tsv`, 'v91'), b.chapters);
    const t0 = Date.now();
    const result = await addGLQuoteCols({
      bibleLinks: ['unfoldingWord/en_ult/v91', 'unfoldingWord/en_ust/v91'],
      bookCode: b.id, tsvContent: tsv, trySeparatorsAndOccurrences: true, usePreviousGLQuotes: true, quiet: true,
      bibleContents: { 'unfoldingWord/en_ult/v91': ult, 'unfoldingWord/en_ust/v91': ust },
      olBibleLink: `unfoldingWord/${b.ol[0]}/${b.ol[1]}`, olBibleContent: ol,
    });
    fs.writeFileSync(`${OUT}/${res}_${b.id}.expected.tsv`, result.output);
    const rows = result.output.split('\n').length - 1;
    console.log(`${res}_${b.id}: ${rows} rows, ${result.errors.length} converter errors, ${((Date.now()-t0)/1000).toFixed(1)}s`);
    if (result.errors.length) fs.writeFileSync(`${OUT}/${res}_${b.id}.converter-errors.txt`, result.errors.join('\n'));
  }
}
console.log('done'); 
