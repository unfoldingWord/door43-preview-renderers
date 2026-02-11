import { convertMarkdown } from '../converters/markdownConverter.js';
import {
  buildFullHtmlDocument,
  buildManualToc,
  createTextAnchorId,
  escapeHtmlText,
  manualPrintCss,
  manualWebCss,
  renderManualsToHtml,
} from './manualResourceRenderer.js';

function convertTaMarkdownToHtml(markdown = '') {
  let html = convertMarkdown(markdown);

  html = html.replace(
    /href="rc:\/\/[^/"]+\/ta\/man\/([^/"?#]+)\/([^"?#]+)"/g,
    (_, manualId, articleId) =>
      `href="#nav-${String(manualId).replaceAll('/', '--')}--${String(articleId).replaceAll(
        '/',
        '--'
      )}"`
  );

  html = html.replace(/(href="https?:\/\/[^"]+")/g, '$1 target="_blank"');

  return html;
}

function buildTocSection(manualId, manualData, section = {}, index = 0) {
  const tocTitle = section.title || '';
  const inputLink = section.link || createTextAnchorId(tocTitle, `section-${manualId}-${index + 1}`);
  const articleData = manualData.articles?.[inputLink];

  const built = {
    id: inputLink,
    manual_id: manualId,
    link: `${manualId}--${inputLink}`,
    title: articleData?.title || section.title || '',
    toctitle: tocTitle || articleData?.title || section.title || '',
    body: articleData?.text ? convertTaMarkdownToHtml(articleData.text) : '',
    sections: [],
  };

  const children = Array.isArray(section.sections) ? section.sections : [];
  built.sections = children.map((child, childIndex) => buildTocSection(manualId, manualData, child, childIndex));

  return built;
}

function buildManualSections(manualId, manualData) {
  const manual = {
    id: manualId,
    manual_id: manualId,
    link: `${manualId}--${manualId}`,
    title: manualData.title || manualId,
    toctitle: manualData.title || manualId,
    sections: [],
  };

  const tocSections = manualData.toc?.sections;
  if (Array.isArray(tocSections) && tocSections.length) {
    manual.sections = tocSections.map((section, index) => buildTocSection(manualId, manualData, section, index));
    return manual;
  }

  const articles = Object.entries(manualData.articles || {})
    .map(([articleId, articleData]) => ({
      id: articleId,
      manual_id: manualId,
      link: `${manualId}--${articleId}`,
      title: articleData.title || articleId,
      toctitle: articleData.title || articleId,
      body: convertTaMarkdownToHtml(articleData.text || ''),
      sections: [],
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  manual.sections = articles;
  return manual;
}

/**
 * Render Translation Academy resource data into HTML sections and full HTML.
 *
 * @param {Object} resourceData - Output from getResourceData()
 * @param {Object} options - Rendering options (reserved for future use)
 * @returns {Object} Rendered HTML package
 */
export function renderTranslationAcademyHtml(resourceData, options = {}) {
  void options;
  if (!resourceData || resourceData.type !== 'ta' || typeof resourceData.manuals !== 'object') {
    throw new Error('Translation Academy renderer expects TA resource data from getResourceData().');
  }

  const manuals = Object.entries(resourceData.manuals).map(([manualId, manualData]) =>
    buildManualSections(manualId, manualData || {})
  );

  if (!manuals.length) {
    throw new Error('No manuals were found to render for this Translation Academy resource.');
  }

  const title = resourceData.title || 'Translation Academy';
  const cover = `<h3 class="cover-resource-title">${escapeHtmlText(title)}</h3>`;
  const body = renderManualsToHtml(manuals);
  const toc = buildManualToc(manuals);
  const copyright = resourceData.license
    ? `<pre class="license-text">${escapeHtmlText(resourceData.license)}</pre>`
    : '';
  const cssWeb = `${manualWebCss}\n.license-text { white-space: pre-wrap; }\n`;
  const pageBody = [cover, copyright, body].filter(Boolean).join('\n');

  return {
    subject: resourceData.subject,
    title,
    sections: {
      cover,
      copyright,
      body,
      toc,
      css: {
        web: cssWeb,
        print: manualPrintCss,
      },
    },
    manuals,
    fullHtml: buildFullHtmlDocument(title, cssWeb, pageBody),
  };
}
