import { getResourceData } from './getResourceData.js';
import { renderAlignedBibleHtml } from './renderers/alignedBibleRenderer.js';

const alignedBibleSubjects = new Set([
  'Aligned Bible',
  'Bible',
  'Greek New Testament',
  'Hebrew Old Testament',
]);

/**
 * Fetch resource data and render it into HTML data sections.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git ref (tag/branch/commit)
 * @param {Array<string>} books - Optional book identifiers
 * @param {Object} options - Options
 * @param {Object} options.renderOptions - Subject-specific rendering options
 * @returns {Promise<Object>} Rendered HTML data package
 */
export async function renderHtmlData(owner, repo, ref, books = [], options = {}) {
  const { renderOptions = {}, ...resourceOptions } = options;

  const resourceData = await getResourceData(owner, repo, ref, books, resourceOptions);
  if (!resourceData) {
    throw new Error('No resource data was returned from getResourceData().');
  }

  if (resourceData.error) {
    throw new Error(resourceData.error);
  }

  if (alignedBibleSubjects.has(resourceData.subject)) {
    const rendered = renderAlignedBibleHtml(resourceData, {
      requestedBooks: books,
      ...renderOptions,
    });

    return {
      ...rendered,
      resourceData,
    };
  }

  throw new Error(`HTML rendering is not implemented yet for subject \`${resourceData.subject}\`.`);
}
