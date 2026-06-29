import { useEffect, useMemo, useRef, useState } from 'react';
import { getResourceData } from './getResourceData';
import { renderHtmlData } from './renderHtmlData';
import { renderHTML } from './renderHTML';
import { htmlDataFixtures } from './fixtures';
import { PAGE_SIZES } from './renderers/printDocumentAssembler';

const PAGE_SIZE_OPTIONS = Object.entries(PAGE_SIZES).map(([key, size]) => ({
  key,
  label: `${size.label} — ${size.orientation}`,
}));

const isLocalhost =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

// Inject a tiny timing hook before PagedJS runs so the iframe can report how long
// pagination took and how many pages it produced (for the side-by-side comparison).
function buildPagedHtml(htmlData, pageSize) {
  const base = renderHTML(htmlData, { media: 'print', engine: 'pagedjs', print: { pageSize } });
  const timing =
    '<script>window.__t0=performance.now();window.PagedConfig={auto:true,' +
    'after:function(flow){try{parent.postMessage({type:"pagedjs-done",' +
    'ms:Math.round(performance.now()-window.__t0),pages:flow&&flow.total},"*");}catch(e){}}};</scr' + 'ipt>';
  return base.replace('<head>', '<head>' + timing);
}

const card = { border: '1px solid #ddd', borderRadius: 6, padding: 12, background: '#fff' };

/**
 * Render PDF demo comparing the two engines for the same document:
 *  - PagedJS — client-side pagination, works anywhere (incl. the static Netlify
 *    deploy); produce a PDF with the browser's Save-as-PDF.
 *  - WeasyPrint — native server engine via the styleguide dev endpoint; only
 *    available on localhost (`pnpm run styleguide`).
 */
export default function RenderPDFDemo() {
  const [sourceMode, setSourceMode] = useState('fixture'); // 'fixture' | 'live'
  const [fixtureKey, setFixtureKey] = useState(htmlDataFixtures[0].key);
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_tn');
  const [ref, setRef] = useState('master');
  const [booksInput, setBooksInput] = useState('tit');
  const [pageSize, setPageSize] = useState('A4_PORTRAIT');

  const [htmlData, setHtmlData] = useState(() => htmlDataFixtures[0].data);
  const [loadStatus, setLoadStatus] = useState('');
  const [loadError, setLoadError] = useState(null);

  // PagedJS timing reported from the iframe.
  const [pagedMeta, setPagedMeta] = useState(null); // { ms, pages }
  const pagedIframeRef = useRef(null);

  // WeasyPrint (server) result.
  const [wpUrl, setWpUrl] = useState(null);
  const [wpMeta, setWpMeta] = useState(null); // { bytes, ms }
  const [wpStatus, setWpStatus] = useState('');
  const [wpError, setWpError] = useState(null);

  const pagedHtml = useMemo(
    () => (htmlData ? buildPagedHtml(htmlData, pageSize) : ''),
    [htmlData, pageSize]
  );

  // Reset PagedJS timing whenever the preview is rebuilt, then listen for the hook.
  useEffect(() => {
    setPagedMeta(null);
    const onMessage = (e) => {
      if (e.data && e.data.type === 'pagedjs-done') {
        setPagedMeta({ ms: e.data.ms, pages: e.data.pages });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pagedHtml]);

  // Revoke the WeasyPrint object URL on change/unmount.
  useEffect(() => () => wpUrl && URL.revokeObjectURL(wpUrl), [wpUrl]);

  const loadFixture = (key) => {
    setFixtureKey(key);
    setLoadError(null);
    setHtmlData(htmlDataFixtures.find((f) => f.key === key)?.data || null);
  };

  const fetchLive = async () => {
    setLoadError(null);
    setLoadStatus('loading');
    try {
      const books = booksInput.split(',').map((b) => b.trim().toLowerCase()).filter(Boolean);
      const resourceData = await getResourceData({ owner, repo, ref, books });
      if (!resourceData || resourceData.error) throw new Error(resourceData?.error || 'No resource data');
      setHtmlData(renderHtmlData(resourceData, { books }));
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoadStatus('');
    }
  };

  const printPaged = () => {
    const win = pagedIframeRef.current?.contentWindow;
    if (win) win.print();
  };

  const renderWeasyPrint = async () => {
    if (!htmlData) return;
    setWpError(null);
    setWpStatus('rendering');
    if (wpUrl) {
      URL.revokeObjectURL(wpUrl);
      setWpUrl(null);
    }
    setWpMeta(null);
    const t0 = performance.now();
    try {
      const renderResult = {
        subject: htmlData.subject,
        title: htmlData.title,
        abbreviation: htmlData.abbreviation,
        version: htmlData.version,
        sections: htmlData.sections,
      };
      const res = await fetch('/api/render-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renderResult, options: { pageSize } }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(detail.error || `PDF request failed (${res.status})`);
      }
      const blob = await res.blob();
      setWpUrl(URL.createObjectURL(blob));
      setWpMeta({ bytes: blob.size, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      setWpError(e.message);
    } finally {
      setWpStatus('');
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', maxWidth: '100vw' }}>
      <h2>Render PDF Demo — PagedJS vs WeasyPrint</h2>
      <p style={{ color: '#555', marginTop: 0 }}>
        Same document, two engines: <strong>PagedJS</strong> paginates in the browser (works
        anywhere — use <em>Save as PDF</em>), while <strong>WeasyPrint</strong> renders a real PDF
        on the local dev server (only on <code>localhost</code>).
      </p>

      {/* ─── Source ─── */}
      <div style={{ ...card, marginBottom: 14, background: '#fafafa' }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ marginRight: 16 }}>
            <input type="radio" checked={sourceMode === 'fixture'} onChange={() => setSourceMode('fixture')} />{' '}
            Cached fixture (instant)
          </label>
          <label>
            <input type="radio" checked={sourceMode === 'live'} onChange={() => setSourceMode('live')} /> Live from DCS
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {sourceMode === 'fixture' ? (
            <select value={fixtureKey} onChange={(e) => loadFixture(e.target.value)} style={{ padding: 8 }}>
              {htmlDataFixtures.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="owner" style={{ padding: 8 }} />
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="repo" style={{ padding: 8 }} />
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ref" style={{ padding: 8, width: 90 }} />
              <input value={booksInput} onChange={(e) => setBooksInput(e.target.value)} placeholder="books" style={{ padding: 8, width: 90 }} />
              <button type="button" onClick={fetchLive} disabled={loadStatus === 'loading'} style={{ padding: '8px 14px' }}>
                {loadStatus === 'loading' ? 'Loading…' : 'Load'}
              </button>
            </>
          )}

          <label>
            <span style={{ marginRight: 6, fontSize: 13, color: '#555' }}>Page size</span>
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={{ padding: 8 }}>
              {PAGE_SIZE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loadError && <div style={{ color: '#842029', marginTop: 8 }}>Error: {loadError}</div>}
      </div>

      {/* ─── Side-by-side engines ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        {/* PagedJS */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>PagedJS</h3>
            <span style={{ fontSize: 12, color: '#0a7', fontWeight: 'bold' }}>works anywhere</span>
            <button type="button" onClick={printPaged} disabled={!htmlData} style={{ marginLeft: 'auto', padding: '6px 10px' }}>
              Save as PDF
            </button>
          </div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>
            {pagedMeta ? `paginated in ${pagedMeta.ms} ms · ${pagedMeta.pages ?? '?'} pages` : 'paginating…'}
          </div>
          <iframe
            ref={pagedIframeRef}
            title="pagedjs-preview"
            srcDoc={pagedHtml}
            style={{ width: '100%', height: '70vh', border: '1px solid #eee', borderRadius: 4, display: 'block' }}
          />
        </div>

        {/* WeasyPrint */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>WeasyPrint</h3>
            <span style={{ fontSize: 12, color: '#888', fontWeight: 'bold' }}>localhost only</span>
            {isLocalhost && (
              <button type="button" onClick={renderWeasyPrint} disabled={!htmlData || wpStatus === 'rendering'} style={{ marginLeft: 'auto', padding: '6px 10px' }}>
                {wpStatus === 'rendering' ? 'Rendering…' : 'Render PDF'}
              </button>
            )}
          </div>

          {!isLocalhost ? (
            <div style={{ fontSize: 13, color: '#555', padding: '8px 0' }}>
              WeasyPrint is a native (Python) engine that runs on the dev server — it can't run on a
              static deploy. Run the styleguide locally (<code>pnpm run styleguide</code>) to compare it
              here, or generate PDFs from the CLI: <code>node src/cli.js generatePdf …</code>.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>
                {wpMeta
                  ? `rendered in ${wpMeta.ms} ms · ${(wpMeta.bytes / 1024).toFixed(0)} KB`
                  : wpStatus === 'rendering'
                  ? 'rendering on the server…'
                  : 'click “Render PDF”'}
              </div>
              {wpError && <div style={{ color: '#842029', marginBottom: 6 }}>Error: {wpError}</div>}
              {wpUrl ? (
                <iframe
                  title="weasyprint-preview"
                  src={wpUrl}
                  style={{ width: '100%', height: '70vh', border: '1px solid #eee', borderRadius: 4, display: 'block' }}
                />
              ) : (
                <div style={{ height: '70vh', border: '1px dashed #ddd', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
                  no PDF yet
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
