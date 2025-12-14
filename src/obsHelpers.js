import axios from 'axios';
import JSZip from 'jszip';
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
 * Extract OBS data from RC or SB format (markdown files)
 */
export async function extractRcSbObsData(catalogEntry, ingredient) {
  const zipUrl = catalogEntry.zipball_url;
  const path = ingredient.path || './content';

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

  // Extract title
  let title = catalogEntry.title;
  const titlePaths = [`${actualBasePath}/front/title.md`, `${basePath}/front/title.md`];
  for (const titlePath of titlePaths) {
    const titleFile = zip.file(titlePath);
    if (titleFile) {
      title = (await titleFile.async('string')).trim();
      break;
    }
  }

  // Extract front intro
  let front = '';
  const introPaths = [`${actualBasePath}/front/intro.md`, `${basePath}/front/intro.md`];
  for (const introPath of introPaths) {
    const introFile = zip.file(introPath);
    if (introFile) {
      front = (await introFile.async('string')).trim();
      break;
    }
  }

  // Extract license
  let license = '';
  const licensePaths = [`${actualRepoName}/LICENSE.md`, `${repoName}/LICENSE.md`];
  for (const licensePath of licensePaths) {
    const licenseFile = zip.file(licensePath);
    if (licenseFile) {
      license = (await licenseFile.async('string')).trim();
      break;
    }
  }

  // Extract stories
  const stories = {};
  const allFiles = Object.keys(zip.files);
  const storyFiles = allFiles
    .filter(
      (name) =>
        (name.startsWith(actualBasePath) || name.startsWith(basePath)) &&
        name.match(/\/(\d+)\.md$/) &&
        !name.includes('/front/')
    )
    .sort((a, b) => {
      const aNum = parseInt(a.match(/\/(\d+)\.md$/)[1], 10);
      const bNum = parseInt(b.match(/\/(\d+)\.md$/)[1], 10);
      return aNum - bNum;
    });

  for (const storyPath of storyFiles) {
    const match = storyPath.match(/\/(\d+)\.md$/);
    if (!match) continue;

    const storyNum = match[1];
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
 * Extract OBS data from TS format (text files in directories)
 */
export async function extractTsObsData(catalogEntry, ingredient) {
  const zipUrl = catalogEntry.zipball_url;
  const path = ingredient.path || './content';

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

  // Handle path - if it's "." use just the repo name, otherwise append the path
  const cleanPath = path.replace(/^\.\//, '').replace(/^\.$/, '');
  const actualBasePath = cleanPath ? `${actualRepoName}/${cleanPath}` : actualRepoName;
  const basePath = cleanPath ? `${repoName}/${cleanPath}` : repoName;

  // Extract title
  let title = catalogEntry.title;
  const titlePaths = [`${actualBasePath}/front/title.txt`, `${basePath}/front/title.txt`];
  for (const titlePath of titlePaths) {
    const titleFile = zip.file(titlePath);
    if (titleFile) {
      title = (await titleFile.async('string')).trim();
      break;
    }
  }

  // No front intro for TS
  const front = '';

  // Extract license
  let license = '';
  const licensePaths = [`${actualRepoName}/LICENSE.md`, `${repoName}/LICENSE.md`];
  for (const licensePath of licensePaths) {
    const licenseFile = zip.file(licensePath);
    if (licenseFile) {
      license = (await licenseFile.async('string')).trim();
      break;
    }
  }

  // Extract stories (directories with frame files)
  const stories = {};
  const storyDirs = new Set();

  // Find all story directories
  Object.keys(zip.files).forEach((name) => {
    const match = name.match(new RegExp(`(${actualBasePath}|${basePath})/(\\d+)/`));
    if (match) {
      storyDirs.add(match[2]);
    }
  });

  // Sort story directories numerically
  const sortedStoryDirs = Array.from(storyDirs).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const storyNum of sortedStoryDirs) {
    // Try both paths
    let storyPath = `${actualBasePath}/${storyNum}`;
    if (!zip.file(`${storyPath}/title.txt`)) {
      storyPath = `${basePath}/${storyNum}`;
    }

    // Get story title
    let storyTitle = '';
    const titleFile = zip.file(`${storyPath}/title.txt`);
    if (titleFile) {
      storyTitle = (await titleFile.async('string')).trim();
    }

    // Get reference
    let reference = '';
    const refFile = zip.file(`${storyPath}/reference.txt`);
    if (refFile) {
      reference = stripMarkdownEmphasis((await refFile.async('string')).trim());
    }

    // Get frames
    const frames = {};
    const frameFiles = Object.keys(zip.files)
      .filter((name) => name.startsWith(storyPath) && name.match(/\/(\d+)\.txt$/))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/\/(\d+)\.txt$/)[1], 10);
        const bNum = parseInt(b.match(/\/(\d+)\.txt$/)[1], 10);
        return aNum - bNum;
      });

    for (const framePath of frameFiles) {
      const match = framePath.match(/\/(\d+)\.txt$/);
      if (!match) continue;

      const frameNum = match[1];
      const text = await zip.file(framePath).async('string');

      // Generate image URL from frame number
      const imgUrl = `https://cdn.door43.org/obs/jpg/360px/obs-en-${storyNum}-${frameNum}.jpg`;

      frames[parseInt(frameNum, 10)] = {
        slug: `${storyNum}-${frameNum}`,
        img: imgUrl,
        text: text.trim(),
      };
    }

    stories[parseInt(storyNum, 10)] = { title: storyTitle, reference, frames };
  }

  return { title, front, license, stories };
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
    front: data.front,
    license: data.license,
    stories: sortedStories,
  };
}
