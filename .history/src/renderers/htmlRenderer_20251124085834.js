/**
 * Renders HTML from content
 * 
 * @param {string|Object} content - Content to render
 * @param {Object} [options] - Rendering options
 * @param {string} [options.className] - CSS class name for the container
 * @param {Object} [options.styles] - Inline styles
 * @returns {string} HTML string
 */
export function renderHTML(content, options = {}) {
  const { className = 'door43-preview', styles = {} } = options;
  
  let htmlContent = '';
  
  if (typeof content === 'string') {
    htmlContent = content;
  } else if (typeof content === 'object') {
    htmlContent = JSON.stringify(content, null, 2);
  }
  
  const styleStr = Object.entries(styles)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
  
  return `<div class="${className}" ${styleStr ? `style="${styleStr}"` : ''}>
  ${htmlContent}
</div>`;
}

/**
 * Creates an HTML snippet with metadata
 * 
 * @param {Object} options - Snippet options
 * @param {string} options.content - Main content
 * @param {string} [options.title] - Title
 * @param {Object} [options.metadata] - Additional metadata
 * @returns {string} HTML snippet
 */
export function createHTMLSnippet({ content, title, metadata = {} }) {
  const metaTags = Object.entries(metadata)
    .map(([key, value]) => `<meta name="${key}" content="${value}">`)
    .join('\n  ');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${title ? `<title>${title}</title>` : ''}
  ${metaTags}
</head>
<body>
  ${content}
</body>
</html>`;
}
