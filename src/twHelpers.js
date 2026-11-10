import { contentSourceFor } from './contentSource.js';
import { archiveRoot, readArchiveLicense, readArchiveMetadata } from './burrito.js';

/**
 * Extract Translation Words data from its burrito. A Translation Words burrito
 * (`x-bcvarticles`, shared with Translation Words Links) keeps the articles
 * under `ingredients/payload/`, one folder per category (`kt/god.md`).
 */
export async function extractRcTwData(catalogEntry, options = {}) {
  // The burrito: its DCS archive, or a folder on disk.
  const zip = await contentSourceFor(options).readArchive(catalogEntry);
  const metadata = await readArchiveMetadata(zip);
  const basePath = `${archiveRoot(zip)}ingredients/payload`;

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
        name.startsWith(`${basePath}/${subdir}/`) &&
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
    abbreviation: catalogEntry.abbreviation || catalogEntry.repo?.abbreviation || '',
    version: catalogEntry.branch_or_tag_name || catalogEntry.ref || '',
    license: await readArchiveLicense(zip, metadata),
    articles,
  };
}
