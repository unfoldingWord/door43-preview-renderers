import yaml from 'js-yaml';
import { contentSourceFor } from './contentSource.js';
import { archiveRoot, readArchiveLicense, readArchiveMetadata } from './burrito.js';
import { loggerFor } from './logger.js';

/**
 * The manuals of a Translation Academy burrito (`x-peripheralArticles`): the
 * folders under `ingredients/` that hold articles (`ingredients/translate/figs-metonymy/01.md`).
 * They are listed in the catalog entry's order, with its titles; a manual the
 * entry does not list follows, by name, titled by its id.
 */
function taManuals(metadata, catalogEntry) {
  const ids = new Set();
  for (const path of Object.keys(metadata.ingredients || {})) {
    const match = path.match(/^ingredients\/([^/]+)\/[^/]+\/01\.md$/);
    if (match) ids.add(match[1]);
  }
  const listed = (catalogEntry.ingredients || []).filter((i) => ids.has(i.identifier));
  const rest = [...ids].filter((id) => !listed.some((i) => i.identifier === id)).sort();
  return [
    ...listed.map((i) => ({ id: i.identifier, title: i.title || i.identifier })),
    ...rest.map((id) => ({ id, title: id })),
  ];
}

/**
 * Extract Translation Academy data from its burrito (markdown files in article directories)
 */
export async function extractRcTaData(catalogEntry, options = {}) {
  // The burrito: its DCS archive, or a folder on disk.
  const zip = await contentSourceFor(options).readArchive(catalogEntry);
  const metadata = await readArchiveMetadata(zip);
  const root = archiveRoot(zip);

  const manuals = {};

  for (const { id: manualId, title: manualTitle } of taManuals(metadata, catalogEntry)) {
    const basePath = `${root}ingredients/${manualId}`;

    // Load toc.yaml if it exists
    let toc = { title: 'Table of Contents', sections: [] };
    const tocFile = zip.file(`${basePath}/toc.yaml`);
    if (tocFile) {
      try {
        toc = yaml.load(await tocFile.async('string')) || toc;
      } catch (e) {
        loggerFor(options).warn(`Failed to parse toc.yaml at ${basePath}/toc.yaml: ${e.message}`);
      }
    }

    const manualData = {
      title: manualTitle,
      toc,
      articles: {},
    };

    // Load config.yaml if it exists
    let config = {};
    const configFile = zip.file(`${basePath}/config.yaml`);
    if (configFile) {
      try {
        config = yaml.load(await configFile.async('string')) || {};
      } catch (e) {
        loggerFor(options).warn(
          `Failed to parse config.yaml at ${basePath}/config.yaml: ${e.message}`
        );
      }
    }

    // Find all article directories (directories with 01.md files)
    const articleDirs = new Set();
    const prefix = `${basePath}/`;
    Object.keys(zip.files).forEach((name) => {
      if (!name.startsWith(prefix)) return;
      const match = name.slice(prefix.length).match(/^([^/]+)\/01\.md$/);
      if (match) {
        articleDirs.add(match[1]);
      }
    });

    // Process each article directory
    for (const articleId of Array.from(articleDirs)) {
      const articlePath = `${basePath}/${articleId}`;

      // Get title
      let title = '';
      const titleFile = zip.file(`${articlePath}/title.md`);
      if (titleFile) {
        title = (await titleFile.async('string')).trim();
      }

      // Get subtitle (optional)
      let subtitle = '';
      const subtitleFile = zip.file(`${articlePath}/sub-title.md`);
      if (subtitleFile) {
        subtitle = (await subtitleFile.async('string')).trim();
      }

      // Get article content from 01.md
      let text = '';
      const contentFile = zip.file(`${articlePath}/01.md`);
      if (contentFile) {
        text = await contentFile.async('string');
      }

      // Process the text content - replace rc://[a-z_-]+/ with rc://*/
      text = text.replace(/rc:\/\/[a-z_-]+\//g, 'rc://*/');

      // Get recommended and dependencies from config
      const articleConfig = config[articleId] || {};
      const recommended = articleConfig.recommended || [];
      const dependencies = articleConfig.dependencies || [];

      // Replace relative links with rc:// links
      // Pattern 1: Links going up two levels like ../../checking/acceptable/01.md
      text = text.replace(
        /\]\(\.\.\/\.\.\/([^/]+)\/([^/)+]+?)\/(01\.md|01)?\)/g,
        (match, otherSubdir, article) => `](rc://*/ta/man/${otherSubdir}/${article})`
      );

      // Pattern 2: Links going up one level like ../figs-metonymy/01.md
      text = text.replace(
        /\]\(\.\.\/([^/]+?)\/(01\.md|01)?\)/g,
        (match, article) => `](rc://*/ta/man/${manualId}/${article})`
      );

      // Pattern 3: Links within same directory like ./article/01.md or article/01.md
      text = text.replace(/\]\((?:\.\/)?([^/):]+?)\/(01\.md|01)?\)/g, (match, article) => {
        // Don't replace if it's an absolute URL (http/https) or already an rc:// link
        if (article.startsWith('http') || article.startsWith('rc://')) {
          return match;
        }
        return `](rc://*/ta/man/${manualId}/${article})`;
      });

      manualData.articles[articleId] = {
        title,
        subtitle,
        text,
        recommended,
        dependencies,
      };
    }

    // Only add the manual if it has articles
    if (Object.keys(manualData.articles).length > 0) {
      manuals[manualId] = manualData;
    }
  }

  return {
    type: 'ta',
    metadataType: catalogEntry.metadata_type,
    subject: catalogEntry.subject,
    flavorType: catalogEntry.flavor_type || '',
    flavor: catalogEntry.flavor || '',
    title: catalogEntry.title,
    abbreviation: catalogEntry.abbreviation || catalogEntry.repo?.abbreviation || '',
    version: catalogEntry.branch_or_tag_name || catalogEntry.ref || '',
    license: await readArchiveLicense(zip, metadata),
    manuals,
  };
}
