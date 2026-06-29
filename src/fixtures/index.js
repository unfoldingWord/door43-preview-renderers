/**
 * Pre-fetched demo fixtures for the styleguide.
 *
 * Because the pure pipeline stages (renderHtmlData → renderHTML/renderPdf) take
 * data directly, the styleguide can render these cached intermediates instantly —
 * no DCS round-trip and no in-browser Proskomma. Each fixture is a snapshot
 * generated with the CLI, e.g.:
 *
 *   node src/cli.js getResourceData --owner unfoldingWord --repo en_ult --ref master \
 *     --book tit --quiet --output src/fixtures/en_ult_tit.resourceData.json
 *   node src/cli.js renderHtml --owner unfoldingWord --repo en_ult --ref master \
 *     --book tit --quiet --output src/fixtures/en_ult_tit.htmlData.json
 *
 * These are dev-only (imported by demos, not by the package entry point) so they
 * do not ship in the built library.
 */
import enUltTitResourceData from './en_ult_tit.resourceData.json';
import enUltTitHtmlData from './en_ult_tit.htmlData.json';
import enTn3jnHtmlData from './en_tn_3jn.htmlData.json';
import enObsHtmlData from './en_obs.htmlData.json';

/** ResourceData fixtures (input to renderHtmlData). */
export const resourceDataFixtures = [
  { key: 'en_ult_tit', label: 'Aligned Bible — ULT — Titus', data: enUltTitResourceData },
];

/** HtmlData fixtures (input to renderHTML / renderPdf). */
export const htmlDataFixtures = [
  { key: 'en_ult_tit', label: 'Aligned Bible — ULT — Titus', data: enUltTitHtmlData },
  { key: 'en_tn_3jn', label: 'Translation Notes — 3 John', data: enTn3jnHtmlData },
  { key: 'en_obs', label: 'Open Bible Stories', data: enObsHtmlData },
];
