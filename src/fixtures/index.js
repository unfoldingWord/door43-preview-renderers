/**
 * Pre-fetched demo fixtures for the styleguide.
 *
 * Because the pure pipeline stages (renderHtmlData → renderHTML/renderPdf) take
 * data directly, the styleguide can render these cached intermediates instantly —
 * no DCS round-trip and no in-browser Proskomma. Each fixture is a snapshot of
 * a release (not a moving branch), generated with the CLI from the built dist:
 *
 *   pnpm build
 *   node src/cli.js getResourceData --owner unfoldingWord --repo en_ult --ref v91 \
 *     --book tit --quiet --output src/fixtures/en_ult_tit.resourceData.json
 *   node src/cli.js renderHtml --owner unfoldingWord --repo en_ult --ref v91 \
 *     --book tit --quiet --output src/fixtures/en_ult_tit.htmlData.json
 *   node src/cli.js renderHtml --owner unfoldingWord --repo en_tn --ref v91 --book 3jn …
 *   node src/cli.js renderHtml --owner unfoldingWord --repo en_tq --ref v91 --book tit …
 *   node src/cli.js renderHtml --owner unfoldingWord --repo en_twl --ref v91 --book tit …
 *   node src/cli.js renderHtml --owner unfoldingWord --repo en_obs --ref v9 …
 *
 * Whole-resource markdown subjects (TA, TW) and OBS Translation Notes are not
 * snapshotted: their HtmlData runs 1.9–2.3 MB each. Use the live source for them.
 *
 * These are dev-only (imported by demos, not by the package entry point) so they
 * do not ship in the built library. The release tags are the ones in
 * ../demoExamples.js; regenerate the fixtures when EN_RELEASE moves.
 */
import enUltTitResourceData from './en_ult_tit.resourceData.json';
import enUltTitHtmlData from './en_ult_tit.htmlData.json';
import enTn3jnHtmlData from './en_tn_3jn.htmlData.json';
import enTqTitHtmlData from './en_tq_tit.htmlData.json';
import enObsHtmlData from './en_obs.htmlData.json';
import enTwlTitHtmlData from './en_twl_tit.htmlData.json';

/** ResourceData fixtures (input to renderHtmlData). */
export const resourceDataFixtures = [
  { key: 'en_ult_tit', label: 'Aligned Bible — ULT — Titus (v91)', data: enUltTitResourceData },
];

/** HtmlData fixtures (input to renderHTML / renderPdf). */
export const htmlDataFixtures = [
  { key: 'en_ult_tit', label: 'Aligned Bible — ULT — Titus (v91)', data: enUltTitHtmlData },
  { key: 'en_tn_3jn', label: 'Translation Notes — 3 John (v91)', data: enTn3jnHtmlData },
  { key: 'en_tq_tit', label: 'Translation Questions — Titus (v91)', data: enTqTitHtmlData },
  { key: 'en_twl_tit', label: 'Translation Words Links — Titus (v91)', data: enTwlTitHtmlData },
  { key: 'en_obs', label: 'Open Bible Stories (v9)', data: enObsHtmlData },
];
