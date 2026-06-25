import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
});

/**
 * Converts Markdown content to HTML using markdown-it.
 *
 * @param {string} markdown - Markdown content
 * @param {Object} [options] - Conversion options
 * @param {boolean} [options.inline] - Render inline only (no wrapping <p> tags)
 * @returns {string} HTML string
 */
export function convertMarkdown(markdown, options = {}) {
  if (!markdown) return '';
  const { inline = false } = options;
  if (inline) {
    return md.renderInline(String(markdown));
  }
  return md.render(String(markdown));
}

/**
 * Convert a translation note from Markdown to HTML, with link transformations
 * for cross-references to other books/chapters/verses.
 *
 * @param {string} note - Markdown note text from TSV
 * @param {string} bookId - Current book identifier (e.g., 'gen')
 * @param {string} chapterStr - Current chapter number as string
 * @returns {string} HTML string with transformed links
 */
export function convertNoteFromMD2HTML(note, bookId, chapterStr) {
  if (!note) return '';

  let text = String(note);

  // Normalize escaped newlines and HTML breaks to real newlines
  text = text.replace(/\\n/g, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n\n');

  // Protect rc:// links from being parsed as markdown italic
  text = text.replace(/rc:\/\/\*/g, 'rc://STAR');

  // Render markdown
  let html = md.render(text);

  // Transform relative book/chapter/verse links: ../../../{book}/0*{ch}/0*{verse}.md
  html = html.replace(
    /href="(?:\.\.\/)+([a-z1-3]{3})\/0*(\d+)\/0*(\d+)\.md"/gi,
    (_, book, ch, verse) =>
      `href="#nav-${book.toLowerCase()}-${parseInt(ch, 10)}-${parseInt(verse, 10)}" class="internal-link"`
  );

  // Transform relative chapter links: ../../../{book}/0*{ch}.md
  html = html.replace(
    /href="(?:\.\.\/)+([a-z1-3]{3})\/0*(\d+)\.md"/gi,
    (_, book, ch) =>
      `href="#nav-${book.toLowerCase()}-${parseInt(ch, 10)}" class="internal-link"`
  );

  // Transform same-book verse links: ../01.md or 01.md or ./10
  html = html.replace(
    /href="(?:\.\/)?(?:\.\.\/)?0*(\d+)(?:\.md)?"/gi,
    (_, verse) =>
      `href="#nav-${bookId}-${chapterStr}-${parseInt(verse, 10)}" class="internal-link"`
  );

  // Restore rc:// links
  html = html.replace(/rc:\/\/STAR/g, 'rc://*');

  // Add target="_blank" to external links
  html = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    'href="$1" target="_blank" rel="noopener noreferrer"'
  );

  return html;
}

/**
 * Parses USFM content (placeholder)
 *
 * @param {string} usfm - USFM content
 * @returns {Object} Parsed USFM structure
 */
export function parseUSFM(usfm) {
  return {
    markers: [],
    content: usfm,
    metadata: {},
  };
}
