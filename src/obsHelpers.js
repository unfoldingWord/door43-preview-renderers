import { contentSourceFor } from './contentSource.js';
import { archiveRoot, burritoName, readArchiveLicense, readArchiveMetadata } from './burrito.js';
/**
 * Strip markdown heading syntax from text
 */
function stripMarkdownHeading(text) {
  return text.replace(/^#+\s*/, '').trim();
}

/**
 * Strip markdown emphasis (italic/bold) from text
 */
function stripMarkdownEmphasis(text) {
  // Remove _text_ or __text__
  text = text.replace(/^_+(.+)_+$/, '$1');
  // Remove *text* or **text**
  text = text.replace(/^\*+(.+)\*+$/, '$1');
  return text.trim();
}

/**
 * The folder a burrito keeps its stories in: the one its story ingredients
 * (`NN.md`, `front.md`) are listed under. DCS's conversion uses
 * `ingredients/content`; a burrito made in SB may keep them in `ingredients/`.
 */
function obsContentFolder(metadata) {
  const story = Object.keys(metadata?.ingredients || {}).find((p) =>
    /^ingredients\/(?:.+\/)?(?:\d+|front)\.md$/.test(p)
  );
  return story ? story.slice(0, story.lastIndexOf('/')) : 'ingredients/content';
}

/**
 * Extract OBS data from its burrito (`textStories`): one markdown file per story
 * (`01.md` … `50.md`) and the front matter in `front.md`, in the folder its
 * ingredients name (see obsContentFolder). ts OBS repositories arrive as DCS
 * converts them.
 */
export async function extractObsData(catalogEntry, options = {}) {
  // The burrito: its DCS archive, or a folder on disk.
  const zip = await contentSourceFor(options).readArchive(catalogEntry);
  const metadata = await readArchiveMetadata(zip);
  const basePath = `${archiveRoot(zip)}${obsContentFolder(metadata)}`;

  const title = catalogEntry.title || burritoName(metadata);

  const frontFile = zip.file(`${basePath}/front.md`);
  const front = frontFile ? (await frontFile.async('string')).trim() : '';

  const license = await readArchiveLicense(zip, metadata);

  // Extract stories
  const stories = {};
  const storyFiles = Object.keys(zip.files)
    .filter(
      (name) => name.startsWith(`${basePath}/`) && /^\d+\.md$/.test(name.slice(basePath.length + 1))
    )
    .sort((a, b) => {
      const aNum = parseInt(a.match(/\/(\d+)\.md$/)[1], 10);
      const bNum = parseInt(b.match(/\/(\d+)\.md$/)[1], 10);
      return aNum - bNum;
    });

  for (const storyPath of storyFiles) {
    const storyNum = storyPath.match(/\/(\d+)\.md$/)[1];
    const content = await zip.file(storyPath).async('string');
    stories[parseInt(storyNum, 10)] = parseRcSbObsStory(content, storyNum);
  }

  return { title, front, license, stories };
}

/**
 * Parse RC/SB OBS story markdown file into frames
 */
function parseRcSbObsStory(content, storyNum) {
  const lines = content.split('\n');
  let storyTitle = '';
  let reference = '';
  const frames = {};

  let currentFrame = 1;
  let currentImageUrl = '';
  let currentText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // First line should be title
    if (i === 0 && line.startsWith('#')) {
      storyTitle = stripMarkdownHeading(line);
      continue;
    }

    // Check for image
    if (line.startsWith('![')) {
      // Save previous frame if exists
      if (currentImageUrl && currentText) {
        frames[currentFrame] = {
          slug: `${storyNum}-${String(currentFrame).padStart(2, '0')}`,
          img: currentImageUrl,
          text: currentText.trim(),
        };
        currentFrame++;
      }

      // Extract URL from markdown image syntax ![alt](url)
      const match = line.match(/!\[.*?\]\((.*?)\)/);
      currentImageUrl = match ? match[1].split('?')[0] : '';
      currentText = '';
    } else if (line.startsWith('_') && line.endsWith('_')) {
      // This is the reference line (last line)
      reference = stripMarkdownEmphasis(line);

      // Save last frame
      if (currentImageUrl && currentText) {
        frames[currentFrame] = {
          slug: `${storyNum}-${String(currentFrame).padStart(2, '0')}`,
          img: currentImageUrl,
          text: currentText.trim(),
        };
      }
    } else if (line && !line.startsWith('#')) {
      // Regular text (skip additional headers)
      currentText += (currentText ? ' ' : '') + line;
    }
  }

  return { title: storyTitle, reference, frames };
}

/**
 * Common function to format OBS pages
 */
export function formatObsData(data, catalogEntry) {
  // Sort stories and frames by numeric key value
  const sortedStories = {};
  Object.keys(data.stories)
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b)
    .forEach((storyKey) => {
      const story = data.stories[storyKey];
      const sortedFrames = {};
      Object.keys(story.frames)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b)
        .forEach((frameKey) => {
          sortedFrames[frameKey] = story.frames[frameKey];
        });
      sortedStories[storyKey] = {
        ...story,
        frames: sortedFrames,
      };
    });

  return {
    type: 'obs',
    metadataType: catalogEntry.metadata_type,
    subject: catalogEntry.subject,
    flavorType: catalogEntry.flavor_type || '',
    flavor: catalogEntry.flavor || '',
    title: data.title,
    abbreviation: catalogEntry.abbreviation || catalogEntry.repo?.abbreviation || '',
    version: catalogEntry.branch_or_tag_name || catalogEntry.ref || '',
    front: data.front,
    license: data.license,
    stories: sortedStories,
  };
}
