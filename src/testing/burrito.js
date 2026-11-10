import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

/**
 * Test fixtures: a Scripture Burrito as DCS serves it (`/sb/raw/{path}`,
 * `/sb/{ref}.zip`), from a map of its files.
 *
 *   files   { 'ingredients/TIT.tsv': '…', 'ingredients/LICENSE.md': '…' }
 *
 * A file named for a book (`ingredients/TIT.usfm`, `ingredients/OBS.tsv`) gets
 * that book as its `scope`; `scopes` overrides it per path (`null` for none).
 */
export function burritoMetadata(
  repo,
  {
    files = {},
    scopes = {},
    owner = 'o',
    language = 'en',
    direction = 'ltr',
    name = repo,
    revision = 'c0ffee'.padEnd(40, '0'),
    flavorType = 'parascriptural',
    flavor = 'x-bcvnotes',
    localizedNames,
  } = {}
) {
  const ingredients = {};
  for (const [filePath, content] of Object.entries(files)) {
    const book = filePath.match(/(?:^|\/)([A-Z0-9]{3})\.(usfm|tsv)$/)?.[1];
    const scope = filePath in scopes ? scopes[filePath] : book ? { [book]: [] } : null;
    ingredients[filePath] = {
      mimeType: filePath.endsWith('.tsv') ? 'text/tab-separated-values' : 'text/plain',
      size: Buffer.byteLength(String(content)),
      ...(scope ? { scope } : {}),
    };
  }
  return {
    format: 'scripture burrito',
    meta: { version: '1.0.0' },
    identification: {
      primary: {
        dcs: { [`${owner}/${repo}`]: { revision, timestamp: '2025-01-01T00:00:00.000Z' } },
      },
      name: { [language]: name },
    },
    languages: [{ tag: language, name: { [language]: language }, scriptDirection: direction }],
    type: { flavorType: { name: flavorType, flavor: { name: flavor } } },
    ...(localizedNames ? { localizedNames } : {}),
    ingredients,
  };
}

/** Write the burrito unpacked to `<dir>/<repo>/`, as getResourceDataFromDirectory reads it. */
export function writeBurrito(dir, repo, options = {}) {
  const root = path.join(dir, repo);
  for (const [filePath, content] of Object.entries(options.files || {})) {
    fs.mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
    fs.writeFileSync(path.join(root, filePath), content);
  }
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'metadata.json'),
    JSON.stringify(burritoMetadata(repo, options), null, 2)
  );
  return root;
}

/** The burrito as DCS's `/sb/{ref}.zip`: everything under a `<repo>/` folder. */
export async function burritoZip(repo, options = {}) {
  const zip = new JSZip();
  zip.file(`${repo}/metadata.json`, JSON.stringify(burritoMetadata(repo, options)));
  for (const [filePath, content] of Object.entries(options.files || {})) {
    zip.file(`${repo}/${filePath}`, content);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}
