/**
 * Anchor scheme for rendered resources.
 *
 * Renderers emit internally-consistent `nav-…` anchors (element `id`s,
 * `href="#nav-…"` cross-references, and TOC data ids all match). For the final
 * HtmlData we rewrite that generic `nav-` prefix to the resource's abbreviation
 * so anchors are unique per resource and the app can deep-link/scroll to them:
 *
 *   resource : `<res>`                              e.g. `tn`
 *   book     : `<res>-<book>`                       e.g. `tn-rut`
 *   chapter  : `<res>-<book>-<chap|front>`          e.g. `tn-rut-4`, `tn-rut-front`
 *   verse    : `<res>-<book>-<chap|front>-<verse|intro>`   e.g. `tn-rut-4-1`
 *   note     : `<res>-<book>-<chap>-<verse>-<noteId>`      e.g. `tn-rut-4-1-e2fa`
 *
 * Centralizing the rewrite here keeps the scheme in one place and leaves the
 * individual renderers (and the markdown converter's cross-references) untouched.
 */

// Match the `nav-` token only where it begins an anchor: an `id="…"`/`id='…'`
// attribute, or an `href="#…"`/`href='#…'` target. Avoids touching any literal
// "nav-" that might appear in content text.
const ANCHOR_RE = /(\bid=["']|\bhref=["']#)nav-/g;

/**
 * Rewrite anchor `nav-` prefixes in an HTML string to `${prefix}-`.
 * @param {string} html
 * @param {string} prefix - Resource abbreviation (e.g. 'tn')
 * @returns {string}
 */
export function applyAnchorPrefix(html, prefix) {
  if (typeof html !== 'string' || !prefix) return html;
  return html.replace(ANCHOR_RE, `$1${prefix}-`);
}

function rewriteTocIds(toc, prefix) {
  if (!Array.isArray(toc)) return toc;
  return toc.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const id =
      typeof entry.id === 'string' && entry.id.startsWith('nav-')
        ? `${prefix}-${entry.id.slice('nav-'.length)}`
        : entry.id;
    const next = { ...entry, id };
    if (Array.isArray(entry.sections)) {
      next.sections = rewriteTocIds(entry.sections, prefix);
    }
    return next;
  });
}

/**
 * Return a copy of a renderer's `sections` with the anchor scheme applied:
 * `nav-` → `${prefix}-` across the HTML strings, the TOC data ids, and any
 * keyed appendix article HTML. CSS is left untouched.
 *
 * Returns the original object unchanged when `prefix` is falsy.
 *
 * @param {Object} sections - Renderer sections { cover, copyright, body, toc, css, webView?, appendices? }
 * @param {string} prefix - Resource abbreviation
 * @returns {Object}
 */
export function rewriteSectionAnchors(sections, prefix) {
  if (!sections || !prefix) return sections;

  const next = { ...sections };

  for (const key of ['cover', 'copyright', 'body', 'webView']) {
    if (typeof next[key] === 'string') {
      next[key] = applyAnchorPrefix(next[key], prefix);
    }
  }

  if (Array.isArray(next.toc)) {
    next.toc = rewriteTocIds(next.toc, prefix);
  }

  // Appendices keyed by kind ({ ta: { id: { title, html } }, tw: {…} }).
  if (next.appendices && typeof next.appendices === 'object') {
    const rewritten = {};
    for (const kind of Object.keys(next.appendices)) {
      const articles = next.appendices[kind] || {};
      const out = {};
      for (const id of Object.keys(articles)) {
        const article = articles[id] || {};
        out[id] = { ...article, html: applyAnchorPrefix(article.html, prefix) };
      }
      rewritten[kind] = out;
    }
    next.appendices = rewritten;
  }

  return next;
}
