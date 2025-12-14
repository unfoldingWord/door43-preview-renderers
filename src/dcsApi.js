import axios from 'axios';

/**
 * Fetch and decode base64 file content from DCS
 */
export async function fetchContent(owner, repo, ref, filePath, dcs_api_url) {
  const url = `${dcs_api_url}/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;
  const response = await axios.get(url);
  const base64Content = response.data.content;

  // Decode base64 - works in both browser and Node.js
  let decodedContent;
  if (typeof window !== 'undefined' && window.atob) {
    // Browser environment
    decodedContent = decodeURIComponent(
      atob(base64Content)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } else {
    // Node.js environment
    decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
  }

  return decodedContent;
}
