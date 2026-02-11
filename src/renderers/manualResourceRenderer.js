function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const manualWebCss = `
.section > section:nth-child(1),
.section > article:nth-child(1) {
  break-before: avoid;
}

.article + .section,
.section + .article {
  break-after: page;
}

h5,
h6 {
  font-size: 1em !important;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: "#";
  padding-left: 5px;
  color: blue;
  display: inline-block;
}

.article-body h1,
.article-body h2,
.article-body h3,
.article-body h4 {
  font-size: 1em;
}

hr.divider {
  width: 100%;
}

hr.divider.depth-1 {
  width: 90%;
}

hr.divider.depth-2 {
  width: 80%;
}

hr.divider.depth-3 {
  width: 70%;
}

hr.divider.depth-4 {
  width: 60%;
}

hr.divider.depth-5 {
  width: 40%;
}

hr.article-divider {
  width: 50%;
}

.manual > h1 {
  text-align: center;
}

.header-title {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.85em;
}
`;

export const manualPrintCss = `
#pagedjs-print .section-header a {
  border-bottom: none;
}

#pagedjs-print .article-header a {
  border-bottom: none;
}

#pagedjs-print hr.article-divider {
  display: none;
}

#pagedjs-print a,
#pagedjs-print a:hover,
#pagedjs-print a:visited {
  color: inherit;
}
`;

function flattenSectionToHtml(manual, section, index, total, depth = 1, subtitles = []) {
  const normalizedDepth = Math.max(1, Math.min(depth, 6));
  const title = section.title || 'NO TITLE FOUND!';
  const tocTitle = section.toctitle || title;
  const safeTitle = escapeHtml(title);
  const sectionLink = section.link;
  const sectionBody = section.body || '';
  const sectionChildren = Array.isArray(section.sections) ? section.sections : [];

  const mySubtitles = [...subtitles];
  if (mySubtitles[mySubtitles.length - 1] !== tocTitle) {
    mySubtitles.push(tocTitle);
  }

  let html = '';

  if (sectionBody) {
    html += `
<div class="article ${index === 0 ? 'first-article' : index + 1 === total ? 'last-article' : ''}" id="nav-${sectionLink}" data-toc-title="${escapeHtml(
      tocTitle
    )}">
  ${
    title !== manual.title
      ? `
  <h${normalizedDepth} class="header article-header">
    <a href="#nav-${sectionLink}" class="header-link">${safeTitle}</a>
  </h${normalizedDepth}>
`
      : ''
  }
  <span class="header-title">${mySubtitles.map(escapeHtml).join(' :: ')}</span>
  <div class="article-body">
    ${sectionBody}
  </div>
</div>
`;

    if (index < total - 1) {
      html += `
<hr class="article-divider divider"></hr>
`;
    }
  }

  if (sectionChildren.length) {
    const childrenHtml = sectionChildren
      .map((child, childIndex) =>
        flattenSectionToHtml(manual, child, childIndex, sectionChildren.length, normalizedDepth + 1, mySubtitles)
      )
      .join('');

    html += `
<div class="section ${
      index === 0 ? 'first-section ' : index === total - 1 ? 'last-section ' : ''
    }${normalizedDepth === 1 ? 'manual' : 'subsection'}" id="nav-${sectionLink}" data-toc-title="${escapeHtml(
      tocTitle
    )}">
  <h${normalizedDepth} class="header section-header">
    <a href="#nav-${sectionLink}" class="header-link">${safeTitle}</a>
  </h${normalizedDepth}>
  <span class="header-title">${mySubtitles.map(escapeHtml).join(' :: ')}</span>
  ${childrenHtml}
</div>
`;
  }

  return html;
}

export function renderManualsToHtml(manuals = []) {
  return manuals
    .map((manual, manualIndex) => flattenSectionToHtml(manual, manual, manualIndex, manuals.length))
    .join('');
}

function toTocNode(section) {
  const sectionTitle = section.toctitle || section.title || '';
  return {
    id: `nav-${section.link}`,
    title: sectionTitle,
    sections: (section.sections || []).map(toTocNode),
  };
}

export function buildManualToc(manuals = []) {
  return manuals.map((manual) => ({
    id: `nav-${manual.link}`,
    title: manual.title || manual.id,
    manual: manual.id,
    sections: (manual.sections || []).map(toTocNode),
  }));
}

export function buildFullHtmlDocument(title, css, content) {
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

export function createTextAnchorId(title, fallback = 'section') {
  const normalizedTitle = String(title || '')
    .replace(/\W+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return normalizedTitle ? `section-${normalizedTitle}` : String(fallback);
}

export function escapeHtmlText(value) {
  return escapeHtml(value);
}
