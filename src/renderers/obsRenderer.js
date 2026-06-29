import { convertMarkdown } from '../converters/markdownConverter.js';
import { buildCoverPage, coverCss } from './printDocumentAssembler.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const DEFAULT_RESOLUTION = '360px';
const OBS_CDN_BASE = 'https://cdn.door43.org/obs/jpg';

/**
 * Resolve the image URL for an OBS frame.
 *
 * @param {Object} frame - Frame object with img property
 * @param {number} storyNum - Story number
 * @param {number} frameNum - Frame number
 * @param {string} resolution - Image resolution ('none', '360px', '2160px')
 * @returns {string} Resolved image URL or empty string
 */
function resolveImageUrl(frame, storyNum, frameNum, resolution) {
  if (resolution === 'none') return '';

  // If frame already has an image URL, use it
  if (frame.img) return frame.img;

  // Fall back to CDN URL
  const sn = String(storyNum).padStart(2, '0');
  const fn = String(frameNum).padStart(2, '0');
  return `${OBS_CDN_BASE}/${resolution}/obs-en-${sn}-${fn}.jpg`;
}

const obsWebCss = `
.obs-story-title {
  text-align: center;
}

.article img {
  display: block;
  margin: 0 auto;
  width: 100%;
  max-width: 640px;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: '#';
  padding-left: 5px;
  color: blue;
  display: inline-block;
}
`;

const obsPrintCss = `
.obs-story-title {
  text-align: center;
}

#pagedjs-print .obs-story-title {
  break-after: page !important;
  padding-top: 300px;
}

.article {
  break-before: auto !important;
  break-after: auto !important;
}
`;

/**
 * Render OBS resource data into HTML sections.
 *
 * @param {Object} resourceData - Output from getResourceData() with type 'obs'
 * @param {Object} [options] - Rendering options
 * @param {string} [options.resolution] - Image resolution: 'none', '360px', '2160px'
 * @param {Array<number>} [options.chapters] - Story numbers to include (empty = all)
 * @returns {Object} Rendered HTML package
 */
export function renderObsHtml(resourceData, options = {}) {
  const {
    resolution = DEFAULT_RESOLUTION,
    chapters = [],
  } = options;

  if (!resourceData || resourceData.type !== 'obs' || !resourceData.stories) {
    throw new Error('OBS renderer expects OBS resource data from getResourceData().');
  }

  const stories = resourceData.stories;
  const title = resourceData.title || 'Open Bible Stories';

  // Build TOC and body
  const toc = [];
  const bodyParts = [];

  // Front matter
  if (resourceData.front) {
    const frontHtml = convertMarkdown(resourceData.front);
    bodyParts.push(`<div class="obs-front-matter">${frontHtml}</div>`);
  }

  // Stories
  const storyNums = Object.keys(stories)
    .map(Number)
    .sort((a, b) => a - b);

  const filteredStories = chapters.length
    ? storyNums.filter((n) => chapters.includes(n))
    : storyNums;

  for (const storyNum of filteredStories) {
    const story = stories[storyNum];
    if (!story) continue;

    const storyId = `nav-obs-${storyNum}`;
    const storyTitle = story.title || `Story ${storyNum}`;

    toc.push({
      id: storyId,
      title: storyTitle,
      story: storyNum,
    });

    let storyHtml = '';
    storyHtml += `<section class="section story" id="${storyId}" data-toc-title="${escapeHtml(storyTitle)}">\n`;
    storyHtml += `  <h1 class="obs-story-title title"><a href="#${storyId}" class="header-link">${escapeHtml(storyTitle)}</a></h1>\n`;

    // Frames
    const frameNums = Object.keys(story.frames || {})
      .map(Number)
      .sort((a, b) => a - b);

    for (const frameNum of frameNums) {
      const frame = story.frames[frameNum];
      const frameId = `obs-${storyNum}-${frameNum}`;
      const imgUrl = resolveImageUrl(frame, storyNum, frameNum, resolution);

      storyHtml += `  <div class="article obs-story-frame" id="${frameId}">\n`;
      if (imgUrl) {
        storyHtml += `    <img src="${escapeHtml(imgUrl)}" alt="Frame ${storyNum}-${frameNum}">\n`;
      }
      storyHtml += `    <div class="obs-frame-content"><p>${escapeHtml(frame.text || '')}</p></div>\n`;
      storyHtml += `  </div>\n`;
    }

    // Bible reference
    if (story.reference) {
      storyHtml += `  <div class="article obs-story-bible-ref" id="obs-story-bible-ref-${storyNum}"><em>${escapeHtml(story.reference)}</em></div>\n`;
    }

    storyHtml += `</section>\n`;
    bodyParts.push(storyHtml);
  }

  // Back matter
  if (resourceData.back) {
    const backHtml = convertMarkdown(resourceData.back);
    bodyParts.push(
      `<section class="section obs-back-section" data-toc-title="Back Matter">\n` +
      `  <div class="article obs-back-article" id="obs-back-article">${backHtml}</div>\n` +
      `</section>`
    );
  }

  const cover = buildCoverPage({
    title,
    version: resourceData.version,
    abbreviation: resourceData.abbreviation,
  });
  const body = `<div class="section" id="obs" data-toc-title="${escapeHtml(title)}">\n${bodyParts.join('\n')}\n</div>`;
  const css = {
    web: obsWebCss + coverCss,
    print: obsPrintCss,
  };

  const fullHtml = buildFullHtmlDocument(
    title,
    obsWebCss + obsPrintCss + coverCss,
    `<div class="section cover-page">${cover}</div>\n${body}`
  );

  return {
    subject: resourceData.subject,
    title,
    sections: {
      cover,
      copyright: '',
      body,
      toc,
      css,
      webView: null,
    },
    renderedBooks: {},
    fullHtml,
  };
}

function buildFullHtmlDocument(title, css, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  ${content}
</body>
</html>`;
}
