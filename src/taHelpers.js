import axios from 'axios';
import JSZip from 'jszip';
import yaml from 'js-yaml';

/**
 * Extract Translation Academy data from RC format (markdown files in article directories)
 */
export async function extractRcTaData(catalogEntry, _options) {
  const zipUrl = catalogEntry.zipball_url;
  const ingredients = catalogEntry.ingredients;

  if (!ingredients || ingredients.length === 0) {
    throw new Error('No ingredients found in catalog entry');
  }

  // Download and extract zip
  const response = await axios.get(zipUrl, { responseType: 'arraybuffer' });
  const zip = await JSZip.loadAsync(response.data);

  const repoName = catalogEntry.name;

  // Find the actual base directory in the zip (GitHub adds a hash to the folder name)
  const rootFolders = Object.keys(zip.files)
    .filter((name) => !name.includes('/') || name.endsWith('/'))
    .map((name) => name.split('/')[0]);
  const actualRepoName =
    rootFolders.find((name) => name.startsWith(repoName.split('/').pop())) || repoName;

  const manuals = {};

  // Process each ingredient (subdirectory/manual)
  for (const ingredient of ingredients) {
    const manualId = ingredient.identifier;
    const path = ingredient.path.replace(/^\.\//, '');
    const manualTitle = ingredient.title;

    const actualBasePath = `${actualRepoName}/${path}`;
    const basePath = `${repoName}/${path}`;

    // Load toc.yaml if it exists
    let toc = { title: 'Table of Contents', sections: [] };
    const tocPaths = [`${actualBasePath}/toc.yaml`, `${basePath}/toc.yaml`];
    for (const tocPath of tocPaths) {
      const tocFile = zip.file(tocPath);
      if (tocFile) {
        const tocContent = await tocFile.async('string');
        try {
          toc = yaml.load(tocContent) || toc;
        } catch (e) {
          console.warn(`Failed to parse toc.yaml at ${tocPath}:`, e);
        }
        break;
      }
    }

    const manualData = {
      title: manualTitle,
      toc,
      articles: {},
    };

    // Load config.yaml if it exists
    let config = {};
    const configPaths = [`${actualBasePath}/config.yaml`, `${basePath}/config.yaml`];
    for (const configPath of configPaths) {
      const configFile = zip.file(configPath);
      if (configFile) {
        const configContent = await configFile.async('string');
        try {
          config = yaml.load(configContent) || {};
        } catch (e) {
          console.warn(`Failed to parse config.yaml at ${configPath}:`, e);
        }
        break;
      }
    }

    // Find all article directories (directories with 01.md files)
    const articleDirs = new Set();
    Object.keys(zip.files).forEach((name) => {
      const match = name.match(new RegExp(`^(${actualBasePath}|${basePath})/([^/]+)/01\\.md$`));
      if (match) {
        articleDirs.add(match[2]);
      }
    });

    // Process each article directory
    for (const articleId of Array.from(articleDirs)) {
      let articlePath = `${actualBasePath}/${articleId}`;

      // Check which base path exists
      if (!zip.file(`${articlePath}/01.md`)) {
        articlePath = `${basePath}/${articleId}`;
      }

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
    manuals,
  };
}
