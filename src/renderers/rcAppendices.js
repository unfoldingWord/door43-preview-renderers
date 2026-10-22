import { convertMarkdown } from '../converters/markdownConverter.js';
import { shortenForHeader } from './printDocumentAssembler.js';
import { BibleBookData } from '../constants.js';
import { escapeHtml } from './scriptureColumns.js';

/**
 * Shared rc:// link + appendix helpers for the TSV renderers (Translation Notes,
 * Translation Words Links). A renderer collects the TA/TW article references its
 * body cites (`extractRcLinks` / `twKey`), turns them into appendix articles keyed
 * by kind (`collectAppendices`), and rewrites every rc:// reference in the body and
 * the articles to the matching internal anchor (`resolveRcLinks`).
 *
 * Anchor scheme (before the resource prefix is applied in renderHtmlData):
 *   TA article: `nav-<book>--ta-<manual>-<article>`
 *   TW article: `nav-<book>--tw-<category>-<slug>`
 */

/**
 * Normalize a Translation Words reference to a canonical "category/slug" key.
 * Accepts rc links ("rc://*\/tw/dict/bible/names/paul"), already-stripped paths
 * ("bible/names/paul" or "names/paul"). The leading "bible/" container is dropped.
 */
export function twKey(ref) {
  if (!ref) return '';
  let p = String(ref)
    .replace(/^rc:\/\/[^/]+\/tw\/dict\//, '')
    .replace(/^rc:\/\/[^/]+\/tw\//, '');
  p = p.replace(/^bible\//, '');
  return p.replace(/\.md$/, '');
}

/**
 * Search note HTML for rc:// links to TA and TW articles.
 * Returns found links categorized by resource type.
 */
export function extractRcLinks(html) {
  const links = { ta: new Set(), tw: new Set() };
  const regex = /rc:\/\/[^/]+\/([^/]+)\/[^/]+\/([A-Za-z0-9/_-]+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const resourceType = match[1];
    const articlePath = match[2];
    if (resourceType === 'ta' || resourceType === 'tw') {
      links[resourceType].add(articlePath);
    }
  }
  return links;
}

/**
 * Render a single appendix article block (markdown body -> HTML).
 */
export function renderAppendixArticle(anchorId, article, backRefList, bookId, headerWords) {
  const bodyHtml = convertMarkdown(article.text || article.body || '');
  let html = `<article class="appendix-article" id="${anchorId}" data-toc-title="${escapeHtml(article.title)}">\n`;
  // The running header follows the article. Translation Words titles list every
  // sense of a term, so they are shortened to fit the margin.
  html += `  <span class="running-ref">${escapeHtml(
    headerWords ? shortenForHeader(article.title, headerWords) : article.title
  )}</span>\n`;
  html += `  <h3 class="appendix-article-header"><a href="#${anchorId}" class="header-link">${escapeHtml(article.title)}</a></h3>\n`;
  html += `  <div class="appendix-article-body">${bodyHtml}</div>\n`;
  if (backRefList && backRefList.length > 0) {
    html += `  <div class="back-refs"><h4>${escapeHtml(BibleBookData[bookId]?.title || bookId)} References:</h4>\n`;
    html += backRefList
      .map(
        (ref) => `    <a href="#${ref.anchor}" class="internal-link">${escapeHtml(ref.label)}</a>`
      )
      .join('\n');
    html += `\n  </div>\n`;
  }
  html += `</article>\n`;
  return html;
}

/**
 * Collect TA and TW appendix articles referenced in notes / TWL lists into a
 * keyed-by-kind object: `{ ta: { articlePath: { title, html } }, tw: {…} }`.
 *
 * The body is scanned for TA/TW article references (see the main loop); this
 * turns each referenced article into its rendered HTML, keyed by its rc path.
 * The keyed shape lets the composer (renderHTML / assemblePrintDocument) render,
 * toggle, or link to appendices independently — see renderAppendicesHtml().
 */
export function collectAppendices(rcLinks, extras, bookId, backRefs) {
  const appendices = {};

  const taResource = extras?.ta;
  if (taResource?.manuals && rcLinks.ta.size > 0) {
    const ta = {};
    for (const articlePath of Array.from(rcLinks.ta).sort()) {
      const article = findTaArticle(taResource, articlePath);
      if (!article) continue;
      const anchorId = `nav-${bookId}--ta-${articlePath.replace(/\//g, '-')}`;
      ta[articlePath] = {
        id: anchorId,
        title: article.title,
        html: renderAppendixArticle(anchorId, article, backRefs.ta[articlePath], bookId),
      };
    }
    if (Object.keys(ta).length) appendices.ta = ta;
  }

  const twResource = extras?.tw;
  if (twResource?.articles && rcLinks.tw.size > 0) {
    const tw = {};
    for (const articlePath of Array.from(rcLinks.tw).sort()) {
      const article = findTwArticle(twResource, articlePath);
      if (!article) continue;
      const anchorId = `nav-${bookId}--tw-${articlePath.replace(/\//g, '-')}`;
      tw[articlePath] = {
        id: anchorId,
        title: article.title,
        html: renderAppendixArticle(anchorId, article, backRefs.tw[articlePath], bookId, 4),
      };
    }
    if (Object.keys(tw).length) appendices.tw = tw;
  }

  return appendices;
}

/**
 * Look up a TA article by "manual/article" path, e.g. "translate/figs-abstractnouns".
 * Returns { title, text } or null.
 */
export function findTaArticle(taResource, articlePath) {
  const [manualId, articleId] = String(articlePath).split('/');
  const article = taResource?.manuals?.[manualId]?.articles?.[articleId];
  return article && article.title ? article : null;
}

/**
 * Look up a TW article by canonical "category/slug" key, e.g. "names/paul".
 * twResource.articles[category] is an object keyed by slug (with a stray "title"
 * meta key for the category name). Returns { title, text } or null.
 */
export function findTwArticle(twResource, articlePath) {
  const [category, slug] = twKey(articlePath).split('/');
  const article = twResource?.articles?.[category]?.[slug];
  return article && typeof article === 'object' && article.title ? article : null;
}

/**
 * Resolve rc:// links (and relative Translation Words links) to internal anchors.
 * Handles three rc:// forms:
 *   - markdown-link hrefs:  <a href="rc://*\/ta/man/translate/figs-x">text</a>
 *   - double-bracket refs:  [[rc://*\/ta/man/translate/figs-x]]   (becomes a titled link)
 *   - bare references:      rc://*\/ta/man/translate/figs-x        (e.g. SupportReference)
 * Bracket/bare forms are replaced with a link whose text is the article title.
 * `opts.twBookFor(key)` names the book whose anchor holds a TW article when it is
 * not `bookId` (e.g. a glossary entry that only another book has).
 */
export function resolveRcLinks(html, bookId, rcLinks, extras, bookIdSet = new Set(), opts = {}) {
  const taAnchor = (path) => `nav-${bookId}--ta-${path.replace(/\//g, '-')}`;
  const twAnchor = (key) =>
    `nav-${(opts.twBookFor && opts.twBookFor(key)) || bookId}--tw-${key.replace(/\//g, '-')}`;
  const twHref = (key) =>
    rcLinks.tw.has(key)
      ? `href="#${twAnchor(key)}" class="internal-link"`
      : 'href="#" class="unresolved-link"';

  // Relative links between Translation Words articles, as the markdown source
  // writes them: `../kt/god.md` from another category, `./god.md` or `god.md`
  // from the same one (the caller names that category in `opts.twCategory`).
  html = html.replace(/href="(?:\.\.\/)+(kt|names|other)\/([A-Za-z0-9_-]+)\.md"/g, (m, cat, slug) =>
    twHref(`${cat}/${slug}`)
  );
  if (opts.twCategory) {
    html = html.replace(/href="(?:\.\/)?([A-Za-z0-9_-]+)\.md"/g, (m, slug) =>
      twHref(`${opts.twCategory}/${slug}`)
    );
  }

  // Pass 1: rewrite hrefs of existing markdown links, keeping their visible text.
  html = html.replace(/href="rc:\/\/[^"]*\/ta\/[^/]+\/([A-Za-z0-9/_-]+)"/g, (m, path) =>
    rcLinks.ta.has(path)
      ? `href="#${taAnchor(path)}" class="internal-link"`
      : 'href="#" class="unresolved-link"'
  );
  html = html.replace(/href="(rc:\/\/[^"]*\/tw\/[^"]+)"/g, (m, rc) => {
    const key = twKey(rc);
    return rcLinks.tw.has(key)
      ? `href="#${twAnchor(key)}" class="internal-link"`
      : 'href="#" class="unresolved-link"';
  });
  // Scripture/TN cross-references (e.g. rc://*\/tn/help/jud/01/17 inside TW/TA articles).
  // Link internally when the target book is in this document; otherwise neutralize —
  // a single-book TN doc cannot anchor verses in books it does not contain.
  html = html.replace(
    /href="rc:\/\/[^"]*\/(?:tn\/help|bible\/[^/]+)\/([a-z0-9-]{3})\/0*(\d+)\/0*(\d+)"/g,
    (m, bk, ch, v) =>
      bookIdSet.has(bk)
        ? `href="#nav-${bk}-${parseInt(ch, 10)}-${parseInt(v, 10)}" class="internal-link"`
        : 'href="#" class="external-ref"'
  );
  // Final href catch-all: never leave a raw rc:// in a link target.
  html = html.replace(/href="rc:\/\/[^"]+"/g, 'href="#" class="unresolved-link"');

  // Pass 2: bracket refs and bare refs -> titled links. Negative lookbehind keeps us
  // out of attribute values (those were handled in pass 1).
  html = html.replace(
    /\[\[\s*(rc:\/\/[^\]\s]+)\s*\]\]|(?<!["'(=>])(rc:\/\/[^\s"'<>)\]]+)/g,
    (match, bracketed, bare) => {
      const rc = bracketed || bare;
      const taMatch = rc.match(/\/ta\/[^/]+\/([A-Za-z0-9/_-]+)/);
      if (taMatch) {
        const path = taMatch[1];
        if (rcLinks.ta.has(path)) {
          const title = findTaArticle(extras?.ta, path)?.title || path;
          return `<a href="#${taAnchor(path)}" class="internal-link">${escapeHtml(title)}</a>`;
        }
        return `<span class="unresolved-link">${escapeHtml(path)}</span>`;
      }
      if (/\/tw\//.test(rc)) {
        const key = twKey(rc);
        if (key && rcLinks.tw.has(key)) {
          const title = findTwArticle(extras?.tw, key)?.title || key;
          return `<a href="#${twAnchor(key)}" class="internal-link">${escapeHtml(title)}</a>`;
        }
        return `<span class="unresolved-link">${escapeHtml(key)}</span>`;
      }
      // Non TA/TW rc:// link (e.g. obs) — leave untouched.
      return match;
    }
  );

  return html;
}

/**
 * Rewrite `href="#nav-…"` links whose target id is in neither the body nor the
 * appendices to the inert `external-ref` form. Returns { body, appendices }.
 */
export function neutralizeDanglingAnchors(body, appendices) {
  const ids = new Set();
  const collect = (html) => {
    for (const m of String(html || '').matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  };
  collect(body);
  for (const kind of Object.keys(appendices)) {
    for (const id of Object.keys(appendices[kind])) collect(appendices[kind][id].html);
  }
  const fix = (html) =>
    // The link's own class (internal-link) goes too, so it carries one class attribute.
    String(html || '').replace(/href="#(nav-[^"]+)"(?: class="[^"]*")?/g, (m, id) =>
      ids.has(id) ? m : 'href="#" class="external-ref"'
    );
  const out = {};
  for (const kind of Object.keys(appendices)) {
    out[kind] = {};
    for (const id of Object.keys(appendices[kind])) {
      out[kind][id] = { ...appendices[kind][id], html: fix(appendices[kind][id].html) };
    }
  }
  return { body: fix(body), appendices: out };
}
