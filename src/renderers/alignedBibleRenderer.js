import { Proskomma } from 'proskomma-core';
import { SofriaRenderFromProskomma, render } from 'proskomma-json-tools';
import { renderers as sofriaRenderers } from './sofria2html.js';

const defaultFlags = {
  showWordAtts: false,
  showTitles: true,
  showHeadings: true,
  showIntroductions: true,
  showFootnotes: true,
  showXrefs: true,
  showParaStyles: true,
  showCharacterMarkup: true,
  showChapterLabels: true,
  showVersesLabels: true,
};

const renderFlags = {
  showWordAtts: false,
  showTitles: true,
  showHeadings: true,
  showFootnotes: true,
  showXrefs: true,
  showChapterLabels: true,
  showVersesLabels: true,
  showCharacterMarkup: true,
  showParaStyles: true,
  selectedBcvNotes: [],
};

const extraWebCss = `
.cover-book-title {
  margin: 0;
}

.section.bible-book {
  margin-bottom: 1.5rem;
}

.header-link {
  text-decoration: none;
  color: inherit;
}

.footnote {
  padding-left: 0.5em;
  padding-right: 0.5em;
  background-color: #ccc;
  margin-top: 1em;
  margin-bottom: 1em;
}

.paras_usfm_fq,
.paras_usfm_fqa {
  font-style: italic;
}

.implied-word-text {
  color: #999;
  font-weight: bold;
  font-size: 0.9em;
}

.license-text {
  white-space: pre-wrap;
}
`;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripHtml(value = '') {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decorateBibleBookHtml(html, bookId, showChapters = true) {
  const normalizedHtml = typeof html === 'string' ? html : '';
  const titleMatch = normalizedHtml.match(/<p [^>]*>(.*?)<\/p>/i);
  const titleHtml = titleMatch ? titleMatch[1] : '';
  const titleText = stripHtml(titleHtml) || bookId.toUpperCase();

  let content = normalizedHtml;
  content = content.replace(/<p /i, `<p id="nav-${bookId}" `);
  content = content.replaceAll(
    /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
    `<span id="nav-${bookId}-$1-$2"$3><a href="#nav-${bookId}-$1-$2" class="header-link">$4</a></span>`
  );

  content = content.replaceAll(
    /<span id="chapter-(\d+)"([^>]+)>([\d]+)<\/span>/gi,
    `<span id="nav-${bookId}-$1"${
      showChapters ? ` data-toc-title="${escapeHtml(titleText)} $1"` : ''
    }$2><a href="#nav-${bookId}-$1-1" class="header-link">$3</a></span>`
  );

  content = content.replace(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, '<span$1 class="footnote"');

  content = content.replace(/[\u00A0\u202F\u2009 ]+/g, ' ');
  content = content.replace(/(\d{1,3})(?:\s*,\s*\d{3})+\b/g, (match) =>
    match.replace(/\s*,\s*/g, ',')
  );

  let footnoteIndex = 0;
  content = content.replace(/<span class="footnote">/g, () => {
    footnoteIndex += 1;
    const footnoteId = `footnote-${bookId}-${footnoteIndex}`;
    return `<span class="footnote"><span id="${footnoteId}"><a href="#${footnoteId}">${footnoteIndex}.</a></span>`;
  });

  return {
    title: titleText,
    html: `<div class="section bible-book" id="nav-${bookId}" data-toc-title="${escapeHtml(
      titleText
    )}">${content}</div>`,
  };
}

function buildRawUsfmWebView(booksMap) {
  const taggedBooks = [];
  booksMap.forEach((usfm, bookId) => {
    const tagged = usfm
      .replace(
        /\\c (\d+)/g,
        `<span id="nav-${bookId}-$1" style="text-decoration: none; color: inherit;"></span>\\c $1`
      )
      .replace(
        /\\id (...) /g,
        `<span id="nav-${bookId}" style="text-decoration: none; color: inherit;"></span>\\id $1 `
      );
    taggedBooks.push(tagged);
  });

  return `<div>${taggedBooks.join('\n\n<hr/>\n\n').replace(/\n/g, '<br/>')}</div>`;
}

function buildBooksMap(resourceData, requestedBooks = []) {
  const sourceBooks = resourceData?.books || {};
  const requested = requestedBooks
    .map((bookId) => String(bookId || '').toLowerCase())
    .filter(Boolean);

  const output = new Map();
  if (requested.length) {
    for (const bookId of requested) {
      if (sourceBooks[bookId]) {
        output.set(bookId, sourceBooks[bookId]);
      }
    }
  } else {
    Object.entries(sourceBooks).forEach(([bookId, usfm]) => {
      output.set(bookId, usfm);
    });
  }

  return output;
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

/**
 * Render aligned Bible resource data into HTML sections and a full HTML document.
 *
 * @param {Object} resourceData - Output from getResourceData()
 * @param {Object} options - Rendering options
 * @param {Array<string>} options.requestedBooks - Optional explicit book list
 * @param {boolean} options.editorMode - Keep implied word brackets visible
 * @param {boolean} options.includeRawUsfmView - Include a raw USFM-as-HTML view
 * @returns {Object} Rendered HTML package
 */
export function renderAlignedBibleHtml(resourceData, options = {}) {
  const {
    requestedBooks = [],
    editorMode = false,
    includeRawUsfmView = false,
    showChaptersInToc,
  } = options;

  if (!resourceData || resourceData.type !== 'usfm' || typeof resourceData.books !== 'object') {
    throw new Error('Aligned Bible renderer expects USFM resource data from getResourceData().');
  }

  const booksMap = buildBooksMap(resourceData, requestedBooks);
  if (!booksMap.size) {
    throw new Error('No books available to render for this Aligned Bible resource.');
  }

  const showChapterAnchors =
    typeof showChaptersInToc === 'boolean' ? showChaptersInToc : booksMap.size < 3;

  const pk = new Proskomma();
  const renderer = new SofriaRenderFromProskomma({
    proskomma: pk,
    actions: render.sofria2web.renderActions.sofria2WebActions,
  });

  const config = {
    ...defaultFlags,
    ...renderFlags,
    selectedBcvNotes: [],
    renderers: sofriaRenderers,
  };

  const toc = [];
  const renderedBooks = {};
  const bodyParts = [];

  booksMap.forEach((usfm, bookId) => {
    const imported = pk.importDocument({ lang: 'xxx', abbr: bookId.toUpperCase() }, 'usfm', usfm);
    if (!imported || !imported.id) {
      throw new Error(`Failed to import USFM for book ${bookId}.`);
    }

    const output = {};
    renderer.renderDocument({
      config,
      docId: imported.id,
      output,
    });

    const parsed = decorateBibleBookHtml(output.paras || '', bookId, showChapterAnchors);
    renderedBooks[bookId] = parsed.html;
    toc.push({
      id: `nav-${bookId}`,
      title: parsed.title,
      book: bookId,
    });
    bodyParts.push(parsed.html);
  });

  const coverTitle = resourceData.title || 'Bible';
  const webCss = `${render.sofria2web.renderStyles.styleAsCSS(
    render.sofria2web.renderStyles.styles
  )}\n${extraWebCss}\n${editorMode ? '' : '.implied-word-start, .implied-word-end { display: none; }'}`;

  const cover = `<h3 class="cover-book-title">${escapeHtml(coverTitle)}</h3>`;
  const copyright = resourceData.license
    ? `<pre class="license-text">${escapeHtml(resourceData.license)}</pre>`
    : '';
  const body = bodyParts.join('\n');
  const pageBody = [cover, copyright, body].filter(Boolean).join('\n');

  return {
    subject: resourceData.subject,
    title: coverTitle,
    sections: {
      cover,
      copyright,
      body,
      toc,
      css: {
        web: webCss,
      },
      webView: includeRawUsfmView ? buildRawUsfmWebView(booksMap) : null,
    },
    renderedBooks,
    fullHtml: buildFullHtmlDocument(coverTitle, webCss, pageBody),
  };
}
