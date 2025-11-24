import axios from 'axios';

/**
 * Get rendered pages from a DCS catalog entry
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} ref - Git reference (branch, tag, or commit)
 * @param {Object} options - Options object
 * @param {string} options.dcs_api_url - DCS API base URL (default: https://git.door43.org/api/v1)
 * @returns {Promise<Object>} Catalog entry JSON object
 *
 * @example
 * const result = await get_rendered_pages(
 *   'unfoldingWord',
 *   'en_tn',
 *   'master',
 *   { dcs_api_url: 'https://git.door43.org/api/v1' }
 * );
 * console.log(result);
 */
export async function get_rendered_pages(owner, repo, ref, options = {}) {
  const { dcs_api_url = 'https://git.door43.org/api/v1' } = options;

  try {
    const url = `${dcs_api_url}/catalog/entry/${owner}/${repo}/${ref}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get rendered pages: ${error.message}`);
  }
}
