import axios from 'axios';

/**
 * Fetches resource content from a repository
 * 
 * @param {Object} options - Fetch options
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @param {string} options.ref - Git reference (branch, tag, or commit)
 * @param {string} [options.path] - Path to specific file or directory
 * @returns {Promise<Object>} The fetched content
 */
export async function fetchResource({ owner, repo, ref, path = '' }) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await axios.get(url, {
      params: { ref },
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch resource: ${error.message}`);
  }
}

/**
 * Fetches raw file content from a repository
 * 
 * @param {Object} options - Fetch options
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @param {string} options.ref - Git reference
 * @param {string} options.path - Path to the file
 * @returns {Promise<string>} The raw file content
 */
export async function fetchRawContent({ owner, repo, ref, path }) {
  try {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch raw content: ${error.message}`);
  }
}
