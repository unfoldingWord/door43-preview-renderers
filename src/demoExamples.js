/**
 * The one list of example resources every styleguide demo offers.
 *
 * Each demo used to carry its own hand-written buttons, so they drifted from
 * each other and from the releases on DCS. This list covers every subject and
 * metadata type `renderHtmlData()` supports, pinned to the current releases
 * (unfoldingWord English resources are all at EN_RELEASE; the OBS family and
 * the original-language Bibles release on their own cadence).
 *
 * Dev-only: imported by the `*Demo.jsx` components, not by the package entry.
 *
 * @typedef {Object} DemoExample
 * @property {string} label - What the button says
 * @property {string} owner
 * @property {string} repo
 * @property {string} ref - Tag or branch
 * @property {string} books - Comma-separated book ids; '' for whole-resource subjects
 * @property {Object} [renderOptions] - `renderHtmlData` render options the example needs
 */

/** Release tag of the unfoldingWord English resources (ULT, UST, TN, TQ, TWL, TA, TW). */
export const EN_RELEASE = 'v91';

/** Releases of resources that are not on the English cadence. */
export const RELEASES = {
  obs: 'v9',
  'obs-tn': 'v13',
  'obs-tq': 'v10',
  'obs-sn': 'v5',
  'obs-sq': 'v4',
  uhb: 'v3.0.0',
  ugnt: 'v0.34',
};

const uw = (label, repo, ref, books = '', renderOptions) => ({
  label,
  owner: 'unfoldingWord',
  repo,
  ref,
  books,
  ...(renderOptions ? { renderOptions } : {}),
});

/** @type {Array<{ group: string, examples: DemoExample[] }>} */
export const EXAMPLE_GROUPS = [
  {
    group: 'Scripture (USFM)',
    examples: [
      uw(`RC: Aligned Bible — ULT — Titus (${EN_RELEASE})`, 'en_ult', EN_RELEASE, 'tit'),
      uw(`RC: Aligned Bible — UST — Romans (${EN_RELEASE})`, 'en_ust', EN_RELEASE, 'rom'),
      uw(`RC: Hebrew Old Testament — UHB — Ruth (${RELEASES.uhb})`, 'hbo_uhb', RELEASES.uhb, 'rut'),
      uw(
        `RC: Greek New Testament — UGNT — Titus (${RELEASES.ugnt})`,
        'el-x-koine_ugnt',
        RELEASES.ugnt,
        'tit'
      ),
      {
        label: 'TS: Bible — Ruth',
        owner: 'adipatealberto',
        repo: 'pid_rut_text_reg',
        ref: 'master',
        books: 'rut',
      },
      {
        label: 'TC: Aligned Bible — Daniel',
        owner: 'christopherrsmith',
        repo: 'en_ust_dan_book',
        ref: 'master',
        books: 'dan',
      },
    ],
  },
  {
    group: 'TSV Bible helps',
    examples: [
      uw(`Translation Notes — Titus (${EN_RELEASE})`, 'en_tn', EN_RELEASE, 'tit'),
      uw(`Translation Notes — Ruth + Titus, mixed OT/NT (${EN_RELEASE})`, 'en_tn', EN_RELEASE, 'rut,tit'),
      uw(`Translation Questions — Titus (${EN_RELEASE})`, 'en_tq', EN_RELEASE, 'tit'),
      uw(`Translation Words Links — Titus, by verse (${EN_RELEASE})`, 'en_twl', EN_RELEASE, 'tit'),
      uw(`Translation Words Links — Titus, glossary (${EN_RELEASE})`, 'en_twl', EN_RELEASE, 'tit', {
        layout: 'glossary',
      }),
      uw('Study Notes — Titus (master)', 'en_sn', 'master', 'tit'),
      uw('Study Questions — Titus (master)', 'en_sq', 'master', 'tit'),
    ],
  },
  {
    group: 'Manuals (markdown)',
    examples: [
      uw(`Translation Academy (${EN_RELEASE})`, 'en_ta', EN_RELEASE),
      uw(`Translation Words (${EN_RELEASE})`, 'en_tw', EN_RELEASE),
    ],
  },
  {
    group: 'Open Bible Stories',
    examples: [
      uw(`OBS (${RELEASES.obs})`, 'en_obs', RELEASES.obs),
      uw(`OBS Translation Notes (${RELEASES['obs-tn']})`, 'en_obs-tn', RELEASES['obs-tn']),
      uw(`OBS Translation Questions (${RELEASES['obs-tq']})`, 'en_obs-tq', RELEASES['obs-tq']),
      uw(`OBS Study Notes (${RELEASES['obs-sn']})`, 'en_obs-sn', RELEASES['obs-sn']),
      uw(`OBS Study Questions (${RELEASES['obs-sq']})`, 'en_obs-sq', RELEASES['obs-sq']),
      { label: 'TS: OBS — Malagasy', owner: 'Tot', repo: 'mdg_obs_text_obs', ref: 'master', books: '' },
      { label: 'SB: OBS — Chinese (simplified)', owner: 'shower', repo: 'zhs_obs', ref: 'master', books: '' },
    ],
  },
  {
    group: 'Other gateway languages',
    examples: [
      {
        label: 'Translation Notes — Spanish (es-419_gl, v66) — Titus',
        owner: 'es-419_gl',
        repo: 'es-419_tn',
        ref: 'v66',
        books: 'tit',
      },
      {
        label: 'Translation Notes — Arabic (BSOJ, v6.1, RTL) — Titus',
        owner: 'BSOJ',
        repo: 'ar_tn',
        ref: 'v6.1',
        books: 'tit',
      },
      {
        label: 'Translation Words — Spanish (es-419_gl, v37)',
        owner: 'es-419_gl',
        repo: 'es-419_tw',
        ref: 'v37',
        books: '',
      },
      { label: 'Translation Words — Arabic (BSOJ, RTL)', owner: 'BSOJ', repo: 'ar_tw', ref: 'master', books: '' },
      { label: 'Translation Academy — Arabic (BSOJ, RTL)', owner: 'BSOJ', repo: 'ar_ta', ref: 'master', books: '' },
    ],
  },
];

/** The example most demos start on: ULT Titus at the current English release. */
export const DEFAULT_EXAMPLE = EXAMPLE_GROUPS[0].examples[0];

/** Flat list, for a `<select>`. */
export const ALL_EXAMPLES = EXAMPLE_GROUPS.flatMap(({ group, examples }) =>
  examples.map((example) => ({ ...example, group }))
);

/** Stable key for an example (owner/repo/ref/books + layout). */
export function exampleKey(example) {
  const layout = example.renderOptions?.layout ? `#${example.renderOptions.layout}` : '';
  return `${example.owner}/${example.repo}/${example.ref}/${example.books}${layout}`;
}

/** Books as the array `getResourceData` takes. */
export function exampleBooks(example) {
  return String(example.books || '')
    .split(',')
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);
}
