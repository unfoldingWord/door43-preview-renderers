import axios from 'axios';
import JSZip from 'jszip';

/**
 * Extract Translation Words data from RC format (markdown files in directories)
 */
export async function extractRcTwData(catalogEntry, _options) {
  const zipUrl = catalogEntry.zipball_url;
  const ingredient = catalogEntry.ingredients && catalogEntry.ingredients[0];

  if (!ingredient) {
    throw new Error('No ingredients found in catalog entry');
  }

  const path = ingredient.path || './bible';

  // Download and extract zip
  const response = await axios.get(zipUrl, { responseType: 'arraybuffer' });
  const zip = await JSZip.loadAsync(response.data);

  const repoName = catalogEntry.name;
  const basePath = `${repoName}/${path.replace(/^\.\//, '')}`;

  // Find the actual base directory in the zip (GitHub adds a hash to the folder name)
  const rootFolders = Object.keys(zip.files)
    .filter((name) => !name.includes('/') || name.endsWith('/'))
    .map((name) => name.split('/')[0]);
  const actualRepoName =
    rootFolders.find((name) => name.startsWith(repoName.split('/').pop())) || repoName;
  const actualBasePath = actualRepoName + '/' + path.replace(/^\.\//, '');

  // Define subdirectories and their titles
  const subdirs = {
    kt: 'Key Terms',
    names: 'Names',
    other: 'Other',
  };

  const articles = {};

  // Process each subdirectory
  for (const [subdir, subdirTitle] of Object.entries(subdirs)) {
    const subdirData = {
      title: subdirTitle,
    };

    // Find all markdown files in this subdirectory
    const mdFiles = Object.keys(zip.files).filter(
      (name) =>
        (name.startsWith(`${actualBasePath}/${subdir}/`) ||
          name.startsWith(`${basePath}/${subdir}/`)) &&
        name.endsWith('.md') &&
        !name.endsWith('/intro.md')
    );

    // Process each markdown file
    for (const filePath of mdFiles) {
      const fileName = filePath.split('/').pop();
      const articleId = fileName.replace(/\.md$/, '');

      const content = await zip.file(filePath).async('string');

      // Extract title from first line
      const lines = content.split('\n');
      let title = '';
      if (lines.length > 0) {
        title = lines[0]
          .replace(/^#+\s*/, '')
          .replace(/#+\s*$/, '')
          .trim();
      }

      // Remove first line (title) and any blank lines after it from the text
      let text = '';
      let startIndex = 1; // Skip first line (title)
      while (startIndex < lines.length && !lines[startIndex].trim()) {
        startIndex++; // Skip blank lines after title
      }
      text = lines.slice(startIndex).join('\n');

      // Replace rc://[a-z_-]+/ with rc://*/
      text = text.replace(/rc:\/\/[a-z_-]+\//g, 'rc://*/');

      // Replace relative links with rc:// links
      // Pattern 1: Links to other subdirectories like ../names/adam.md or ../names/adam
      text = text.replace(
        /\]\(\.\.\/([^/]+)\/([^/)]+?)(\.md)?\)/g,
        (match, otherSubdir, article) => `](rc://*/tw/dict/bible/${otherSubdir}/${article})`
      );

      // Pattern 2: Links within same directory like ./article.md or article.md or article
      text = text.replace(/\]\((?:\.\/)?([^/):]+?)(\.md)?\)/g, (match, article) => {
        // Don't replace if it's an absolute URL (http/https) or already an rc:// link
        if (article.startsWith('http') || article.startsWith('rc://')) {
          return match;
        }
        return `](rc://*/tw/dict/bible/${subdir}/${article})`;
      });

      subdirData[articleId] = {
        title,
        text,
      };
    }

    // Only add the subdirectory if it has articles
    if (Object.keys(subdirData).length > 1) {
      // More than just 'title'
      articles[subdir] = subdirData;
    }
  }

  return {
    type: 'tw',
    metadataType: catalogEntry.metadata_type,
    subject: catalogEntry.subject,
    flavorType: catalogEntry.flavor_type || '',
    flavor: catalogEntry.flavor || '',
    title: catalogEntry.title,
    articles,
  };
}
