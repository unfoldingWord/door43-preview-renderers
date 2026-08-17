import { useEffect, useMemo, useState } from 'react';
import { getResourceData } from './getResourceData';
import { renderHtmlData } from './renderHtmlData';
import { renderHTML } from './renderHTML';
import { htmlDataFixtures } from './fixtures';
import { PAGE_SIZES } from './renderers/printDocumentAssembler';

const PAGE_SIZE_OPTIONS = Object.entries(PAGE_SIZES).map(([key, size]) => ({
  key,
  label: `${size.label} — ${size.orientation}`,
}));

const card = { border: '1px solid #ddd', borderRadius: 6, padding: 12, background: '#fff' };

/**
 * Demo for renderHTML(): composes an HtmlData package into a self-contained
 * document for screen or print.
 *
 * The HtmlData comes either from a cached fixture (instant — no network, no
 * in-browser Proskomma) or live from DCS for any owner/repo/ref/book, matching
 * the source picker in the Render PDF demo. renderHTML() itself is pure and
 * synchronous either way; only fetching the resource data touches the network.
 */
export default function RenderHTMLDemo() {
  const [sourceMode, setSourceMode] = useState('fixture'); // 'fixture' | 'live'
  const [fixtureKey, setFixtureKey] = useState(htmlDataFixtures[0].key);
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_tn');
  const [ref, setRef] = useState('master');
  const [booksInput, setBooksInput] = useState('tit');

  const [htmlData, setHtmlData] = useState(() => htmlDataFixtures[0].data);
  const [loadStatus, setLoadStatus] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [loadedLabel, setLoadedLabel] = useState(htmlDataFixtures[0].label);

  const [media, setMedia] = useState('screen');
  const [pageSize, setPageSize] = useState('A4_PORTRAIT');
  const [show, setShow] = useState({ cover: true, copyright: true, toc: true, appendices: true });

  // Switching back to the fixture source restores the selected fixture, so the
  // preview never keeps showing live data under a "Cached fixture" selection.
  useEffect(() => {
    if (sourceMode !== 'fixture') return;
    const fixture = htmlDataFixtures.find((f) => f.key === fixtureKey);
    setHtmlData(fixture?.data || null);
    setLoadedLabel(fixture?.label || '');
    setLoadError(null);
  }, [sourceMode, fixtureKey]);

  const fetchLive = async () => {
    setLoadError(null);
    setLoadStatus('loading');
    try {
      const books = booksInput
        .split(',')
        .map((b) => b.trim().toLowerCase())
        .filter(Boolean);
      const resourceData = await getResourceData({ owner, repo, ref, books });
      if (!resourceData || resourceData.error) {
        throw new Error(resourceData?.error || 'No resource data');
      }
      setHtmlData(renderHtmlData(resourceData, { books }));
      setLoadedLabel(`${owner}/${repo}@${ref}${books.length ? ` — ${books.join(', ')}` : ''}`);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoadStatus('');
    }
  };

  const html = useMemo(() => {
    if (!htmlData) return '';
    return renderHTML(htmlData, { media, show, print: { pageSize } });
  }, [htmlData, media, show, pageSize]);

  const toggle = (key) => setShow((s) => ({ ...s, [key]: !s[key] }));

  const labelStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 14 };

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', maxWidth: '100vw' }}>
      <h2>renderHTML() Demo</h2>
      <p style={{ color: '#555', marginTop: 0 }}>
        Composes an <code>HtmlData</code> package into one self-contained document — from a cached
        fixture (<strong>instant, no network</strong>) or live from DCS for any resource.
      </p>

      {/* ─── Source ─── */}
      <div style={{ ...card, marginBottom: 14, background: '#fafafa' }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ marginRight: 16 }}>
            <input
              type="radio"
              checked={sourceMode === 'fixture'}
              onChange={() => setSourceMode('fixture')}
            />{' '}
            Cached fixture (instant)
          </label>
          <label>
            <input
              type="radio"
              checked={sourceMode === 'live'}
              onChange={() => setSourceMode('live')}
            />{' '}
            Live from DCS
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {sourceMode === 'fixture' ? (
            <select
              value={fixtureKey}
              onChange={(e) => setFixtureKey(e.target.value)}
              style={{ padding: 8 }}
            >
              {htmlDataFixtures.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="owner"
                style={{ padding: 8 }}
              />
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="repo"
                style={{ padding: 8 }}
              />
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="ref"
                style={{ padding: 8, width: 90 }}
              />
              <input
                value={booksInput}
                onChange={(e) => setBooksInput(e.target.value)}
                placeholder="books"
                style={{ padding: 8, width: 90 }}
              />
              <button
                type="button"
                onClick={fetchLive}
                disabled={loadStatus === 'loading'}
                style={{ padding: '8px 14px' }}
              >
                {loadStatus === 'loading' ? 'Loading…' : 'Load'}
              </button>
            </>
          )}

          <label>
            <span style={{ marginRight: 6, fontSize: 13, color: '#555' }}>Media</span>
            <select value={media} onChange={(e) => setMedia(e.target.value)} style={{ padding: 8 }}>
              <option value="screen">screen (web)</option>
              <option value="print">print (PagedJS/WeasyPrint-ready)</option>
            </select>
          </label>

          {media === 'print' && (
            <label>
              <span style={{ marginRight: 6, fontSize: 13, color: '#555' }}>Page size</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                style={{ padding: 8 }}
              >
                {PAGE_SIZE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {loadError && <div style={{ color: '#842029', marginTop: 8 }}>Error: {loadError}</div>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <strong style={{ marginRight: 10 }}>show:</strong>
        {['cover', 'copyright', 'toc', 'appendices'].map((key) => (
          <label key={key} style={labelStyle}>
            <input type="checkbox" checked={!!show[key]} onChange={() => toggle(key)} />
            {key}
          </label>
        ))}
        <span style={{ color: '#888', fontSize: 13 }}>
          (screen defaults hide cover/copyright/toc; body is always shown)
        </span>
      </div>

      <div style={{ marginBottom: 8, color: '#555', fontSize: 13 }}>
        {loadedLabel ? `${loadedLabel} · ` : ''}
        {(html.length / 1024).toFixed(0)} KB ·{' '}
        {media === 'print' ? 'paged document' : 'continuous web page'}
      </div>

      <iframe
        title="render-html-preview"
        srcDoc={html}
        style={{
          width: '100%',
          height: '78vh',
          border: '1px solid #ddd',
          borderRadius: 6,
          display: 'block',
        }}
      />
    </div>
  );
}
