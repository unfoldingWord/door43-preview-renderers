import { useMemo, useState } from 'react';
import { renderHTML } from './renderHTML';
import { htmlDataFixtures } from './fixtures';
import { PAGE_SIZES } from './renderers/printDocumentAssembler';

const PAGE_SIZE_OPTIONS = Object.entries(PAGE_SIZES).map(([key, size]) => ({
  key,
  label: `${size.label} — ${size.orientation}`,
}));

/**
 * Demo for renderHTML(): composes a cached HtmlData fixture into a self-contained
 * document for screen or print. Pure + synchronous — renders instantly with no
 * network and no in-browser Proskomma.
 */
export default function RenderHTMLDemo() {
  const [fixtureKey, setFixtureKey] = useState(htmlDataFixtures[0].key);
  const [media, setMedia] = useState('screen');
  const [pageSize, setPageSize] = useState('A4_PORTRAIT');
  const [show, setShow] = useState({ cover: true, copyright: true, toc: true, appendices: true });

  const htmlData = useMemo(
    () => htmlDataFixtures.find((f) => f.key === fixtureKey)?.data,
    [fixtureKey]
  );

  const html = useMemo(() => {
    if (!htmlData) return '';
    return renderHTML(htmlData, {
      media,
      show,
      print: { pageSize },
    });
  }, [htmlData, media, show, pageSize]);

  const toggle = (key) => setShow((s) => ({ ...s, [key]: !s[key] }));

  const labelStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 14 };

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', maxWidth: '100vw' }}>
      <h2>renderHTML() Demo</h2>
      <p style={{ color: '#555', marginTop: 0 }}>
        Composes a cached <code>HtmlData</code> fixture into one self-contained document.
        Pure &amp; synchronous — <strong>instant, no network</strong>.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <label>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Fixture (HtmlData)</div>
          <select value={fixtureKey} onChange={(e) => setFixtureKey(e.target.value)} style={{ padding: 8 }}>
            {htmlDataFixtures.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Media</div>
          <select value={media} onChange={(e) => setMedia(e.target.value)} style={{ padding: 8 }}>
            <option value="screen">screen (web)</option>
            <option value="print">print (PagedJS/WeasyPrint-ready)</option>
          </select>
        </label>

        {media === 'print' && (
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Page size</div>
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={{ padding: 8 }}>
              {PAGE_SIZE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
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
        {(html.length / 1024).toFixed(0)} KB · {media === 'print' ? 'paged document' : 'continuous web page'}
      </div>

      <iframe
        title="render-html-preview"
        srcDoc={html}
        style={{ width: '100%', height: '78vh', border: '1px solid #ddd', borderRadius: 6, display: 'block' }}
      />
    </div>
  );
}
