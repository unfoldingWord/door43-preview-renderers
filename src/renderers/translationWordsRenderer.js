import { convertMarkdown } from '../converters/markdownConverter.js';
import { buildCoverPage, coverCss } from './printDocumentAssembler.js';
import {
  buildFullHtmlDocument,
  buildManualToc,
  manualPrintCss,
  manualWebCss,
  renderManualsToHtml,
} from './manualResourceRenderer.js';

const defaultManualTitles = {
  kt: 'Key Terms',
  names: 'Names',
  other: 'Other',
};

function convertTwMarkdownToHtml(markdown = '') {
  let html = convertMarkdown(markdown);

  html = html.replace(
    /href="rc:\/\/[^/"]+\/tw\/dict\/bible\/([^/"?#]+)\/([^"?#]+)"/g,
    (_, categoryId, articleId) =>
      `href="#nav-${String(categoryId).replaceAll('/', '--')}--${String(articleId).replaceAll(
        '/',
        '--'
      )}"`
  );

  html = html.replace(/(href="https?:\/\/[^"]+")/g, '$1 target="_blank"');

  return html;
}

function buildManualOrder(inputCategories) {
  const preferredOrder = ['kt', 'names', 'other'];
  const seen = new Set();
  const ordered = [];

  preferredOrder.forEach((id) => {
    if (inputCategories[id]) {
      ordered.push(id);
      seen.add(id);
    }
  });

  Object.keys(inputCategories).forEach((id) => {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  });

  return ordered;
}

function buildManualSections(categoryId, categoryData, index) {
  const sections = Object.entries(categoryData || {})
    .filter(([key]) => key !== 'title')
    .map(([articleId, articleData]) => ({
      id: articleId,
      manual_id: categoryId,
      link: `${categoryId}--${articleId}`,
      title: articleData?.title || articleId,
      toctitle: articleData?.title || articleId,
      body: convertTwMarkdownToHtml(articleData?.text || ''),
      sections: [],
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    id: categoryId,
    manual_id: categoryId,
    sort: index,
    link: `${categoryId}--${categoryId}`,
    title: categoryData?.title || defaultManualTitles[categoryId] || categoryId,
    toctitle: categoryData?.title || defaultManualTitles[categoryId] || categoryId,
    sections,
  };
}

/**
 * Render Translation Words resource data into HTML sections and full HTML.
 *
 * @param {Object} resourceData - Output from getResourceData()
 * @param {Object} options - Rendering options (reserved for future use)
 * @returns {Object} Rendered HTML package
 */
export function renderTranslationWordsHtml(resourceData, options = {}) {
  void options;
  if (!resourceData || resourceData.type !== 'tw' || typeof resourceData.articles !== 'object') {
    throw new Error('Translation Words renderer expects TW resource data from getResourceData().');
  }

  const manualOrder = buildManualOrder(resourceData.articles);
  const manuals = manualOrder
    .map((categoryId, index) => buildManualSections(categoryId, resourceData.articles[categoryId], index))
    .filter((manual) => manual.sections.length > 0);

  if (!manuals.length) {
    throw new Error('No articles were found to render for this Translation Words resource.');
  }

  const title = resourceData.title || 'Translation Words';
  const cover = buildCoverPage({
    title,
    version: resourceData.version,
    abbreviation: resourceData.abbreviation,
  });
  const body = renderManualsToHtml(manuals);
  const toc = buildManualToc(manuals);
  const copyright = resourceData.license
    ? `<div class="license-text">${convertMarkdown(resourceData.license)}</div>`
    : '';
  const cssWeb = `${manualWebCss}\n.license-text { font-size: 0.9em; }\n${coverCss}\n`;
  const pageBody = [`<div class="section cover-page">${cover}</div>`, copyright, body]
    .filter(Boolean)
    .join('\n');

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
