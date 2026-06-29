import { useMemo, useState } from 'react';
import { getResourceData } from './getResourceData';
import { renderHtmlData } from './renderHtmlData';
import { renderHTML } from './renderHTML';
import { resourceDataFixtures } from './fixtures';

const card = {
  border: '1px solid #ddd',
  borderRadius: 6,
  padding: 12,
  marginBottom: 12,
  background: '#fafafa',
};

/**
 * Full-pipeline demo: shows the chain
 *   getResourceData → renderHtmlData → renderHTML (web | print)
 * Use a cached fixture (instant, no network) or fetch live from DCS. The pure
 * stages (renderHtmlData / renderHTML) re-run instantly as you flip the view,
 * demonstrating "render one ResourceData many ways" without re-fetching.
 */
export default function PipelineDemo() {
  const [mode, setMode] = useState('fixture'); // 'fixture' | 'live'
  const [fixtureKey, setFixtureKey] = useState(resourceDataFixtures[0].key);
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_ult');
  const [ref, setRef] = useState('master');
  const [booksInput, setBooksInput] = useState('tit');
  const [view, setView] = useState('screen'); // 'screen' | 'print'

  const [resourceData, setResourceData] = useState(
    () => resourceDataFixtures[0].data
  );
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);

  const loadFixture = (key) => {
    setFixtureKey(key);
    setError(null);
    setResourceData(resourceDataFixtures.find((f) => f.key === key)?.data || null);
  };

  const fetchLive = async () => {
    setError(null);
    setStatus('fetching');
    try {
      const books = booksInput.split(',').map((b) => b.trim().toLowerCase()).filter(Boolean);
      const data = await getResourceData({ owner, repo, ref, books });
      if (!data || data.error) throw new Error(data?.error || 'No resource data');
      setResourceData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setStatus('');
    }
  };

  // Stage 3 (pure): ResourceData → HtmlData. Re-runs only when the data changes.
  const htmlData = useMemo(() => {
    if (!resourceData) return null;
    try {
      return renderHtmlData(resourceData);
    } catch (e) {
      return { __error: e.message };
    }
  }, [resourceData]);

  // Stage 4 (pure): HtmlData → HTML. Re-runs instantly when you flip the view.
  const html = useMemo(() => {
    if (!htmlData || htmlData.__error) return '';
    return renderHTML(htmlData, { media: view, show: { cover: true, copyright: true } });
  }, [htmlData, view]);

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', maxWidth: '100vw' }}>
      <h2>Full Pipeline Demo</h2>
      <p style={{ color: '#555', marginTop: 0 }}>
        <code>getResourceData → renderHtmlData → renderHTML</code>. Pick a cached fixture
        (instant) or fetch live, then flip the view — the pure stages re-render with no re-fetch.
      </p>

      <div style={card}>
        <strong>Source</strong>
        <div style={{ marginTop: 8 }}>
          <label style={{ marginRight: 16 }}>
            <input type="radio" checked={mode === 'fixture'} onChange={() => setMode('fixture')} /> Cached
            fixture (instant)
          </label>
          <label>
            <input type="radio" checked={mode === 'live'} onChange={() => setMode('live')} /> Live from DCS
          </label>
        </div>

        {mode === 'fixture' ? (
          <div style={{ marginTop: 8 }}>
            <select value={fixtureKey} onChange={(e) => loadFixture(e.target.value)} style={{ padding: 8 }}>
              {resourceDataFixtures.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="owner" style={{ padding: 8 }} />
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="repo" style={{ padding: 8 }} />
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ref" style={{ padding: 8, width: 90 }} />
            <input value={booksInput} onChange={(e) => setBooksInput(e.target.value)} placeholder="books" style={{ padding: 8, width: 90 }} />
            <button type="button" onClick={fetchLive} disabled={status === 'fetching'} style={{ padding: '8px 14px' }}>
              {status === 'fetching' ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
        )}
        {error && <div style={{ color: '#842029', marginTop: 8 }}>Error: {error}</div>}
      </div>

      <div style={card}>
        <strong>Stage 2 · ResourceData</strong>
        {resourceData ? (
          <div style={{ fontSize: 13, color: '#333', marginTop: 6 }}>
            subject: <code>{resourceData.subject}</code> · type: <code>{resourceData.type}</code> ·{' '}
            books: <code>{Object.keys(resourceData.books || {}).join(', ') || '—'}</code> ·{' '}
            extras: <code>{Object.keys(resourceData.extras || {}).join(', ') || 'none'}</code>
          </div>
        ) : (
          <div style={{ color: '#888' }}>—</div>
        )}
      </div>

      <div style={card}>
        <strong>Stage 3 · HtmlData</strong>
        {htmlData && !htmlData.__error ? (
          <div style={{ fontSize: 13, color: '#333', marginTop: 6 }}>
            title: <code>{htmlData.title}</code> · abbreviation: <code>{htmlData.abbreviation}</code> ·{' '}
            sections: <code>{Object.keys(htmlData.sections || {}).join(', ')}</code> ·{' '}
            toc entries: <code>{htmlData.sections?.toc?.length ?? 0}</code>
          </div>
        ) : (
          <div style={{ color: htmlData?.__error ? '#842029' : '#888' }}>{htmlData?.__error || '—'}</div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong>Stage 4 · renderHTML</strong>
          <label>
            <input type="radio" checked={view === 'screen'} onChange={() => setView('screen')} /> web
          </label>
          <label>
            <input type="radio" checked={view === 'print'} onChange={() => setView('print')} /> print
          </label>
          <span style={{ color: '#888', fontSize: 13 }}>{(html.length / 1024).toFixed(0)} KB</span>
        </div>
        <iframe
          title="pipeline-preview"
          srcDoc={html}
          style={{ width: '100%', height: '70vh', border: '1px solid #ddd', borderRadius: 6, marginTop: 8, display: 'block' }}
        />
      </div>
    </div>
  );
}
