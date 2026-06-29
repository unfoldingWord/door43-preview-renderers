import { useEffect, useState } from 'react';
import { getResourceData } from './getResourceData';
import { renderHtmlData } from './renderHtmlData';
import { PAGE_SIZES } from './renderers/printDocumentAssembler';

/**
 * A few PDF-worthy examples (one per major subject). Each entry is
 * [label, owner, repo, ref, books].
 */
const EXAMPLES = [
  ['Aligned Bible — ULT — Titus (v89)', 'unfoldingWord', 'en_ult', 'v89', 'tit'],
  ['Translation Notes — Titus (v89)', 'unfoldingWord', 'en_tn', 'v89', 'tit'],
  ['Translation Questions — Romans (v89)', 'unfoldingWord', 'en_tq', 'v89', 'rom'],
  ['Study Questions — Titus', 'unfoldingWord', 'en_sq', 'master', 'tit'],
  ['Translation Words', 'unfoldingWord', 'en_tw', 'master', ''],
  ['Open Bible Stories', 'unfoldingWord', 'en_obs', 'master', ''],
  ['OBS Translation Questions', 'unfoldingWord', 'en_obs-tq', 'master', ''],
];

const PAGE_SIZE_OPTIONS = Object.entries(PAGE_SIZES).map(([key, size]) => ({
  key,
  label: `${size.label} — ${size.orientation} (${size.width} × ${size.height})`,
}));

/**
 * Demo for renderPdf(): renders HTML in the browser, then asks the styleguide dev
 * server to turn it into a PDF with WeasyPrint and embeds the result.
 */
export default function RenderPDFDemo() {
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_tn');
  const [ref, setRef] = useState('v89');
  const [booksInput, setBooksInput] = useState('tit');
  const [pageSize, setPageSize] = useState('A4_PORTRAIT');

  const [status, setStatus] = useState(''); // '', 'rendering', 'generating'
  const [error, setError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfMeta, setPdfMeta] = useState(null); // { bytes, title }

  // Revoke the previous object URL when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const loadExample = (o, r, rf, b) => {
    setOwner(o);
    setRepo(r);
    setRef(rf);
    setBooksInput(b);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setPdfMeta(null);

    const books = booksInput
      .split(',')
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean);

    try {
      // 1) Fetch + parse the resource data, then render the HTML sections in the
      //    browser (stages 2–3; same pipeline as the renderHtmlData demo).
      setStatus('rendering');
      const resourceData = await getResourceData(owner, repo, ref, books, {
        dcs_api_url: 'https://git.door43.org/api/v1',
      });
      const data = renderHtmlData(resourceData, { books });

      // 2) Hand the rendered sections to the dev-server endpoint, which runs
      //    renderPdf() (assemble + WeasyPrint) and returns the PDF bytes.
      setStatus('generating');
      const renderResult = {
        subject: data.subject,
        title: data.title,
        abbreviation: data.abbreviation,
        version: data.version,
        sections: data.sections,
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
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfMeta({ bytes: blob.size, title: data.title || `${repo}` });
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus('');
    }
  };

  const busy = status !== '';
  const downloadName = `${(repo || 'document').replace(/[^a-z0-9_-]+/gi, '-')}.pdf`;

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', maxWidth: '100vw' }}>
      <h2>renderPdf() Demo</h2>
      <p style={{ color: '#555', marginTop: 0 }}>
        Renders the HTML in your browser, then uses <strong>WeasyPrint</strong> on the dev server to
        produce a real PDF and embeds it below. Requires the <code>weasyprint</code> binary on the
        machine running the styleguide (<code>pipx install weasyprint</code> or{' '}
        <code>brew install weasyprint</code>).
      </p>

      <div
        style={{ marginBottom: 20, padding: 15, backgroundColor: '#f5f5f5', borderRadius: 4 }}
      >
        <strong>Quick Examples:</strong>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EXAMPLES.map(([label, o, r, rf, b]) => (
            <button
              key={label}
              type="button"
              onClick={() => loadExample(o, r, rf, b)}
              title={`${o}/${r}/${rf}${b ? ` (${b})` : ''}`}
              style={{ padding: '6px 10px', cursor: 'pointer' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Owner</div>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} style={{ width: '100%', padding: 8 }} required />
          </label>
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Repo</div>
            <input value={repo} onChange={(e) => setRepo(e.target.value)} style={{ width: '100%', padding: 8 }} required />
          </label>
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Ref</div>
            <input value={ref} onChange={(e) => setRef(e.target.value)} style={{ width: '100%', padding: 8 }} required />
          </label>
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Books (comma-separated)</div>
            <input value={booksInput} onChange={(e) => setBooksInput(e.target.value)} style={{ width: '100%', padding: 8 }} placeholder="tit,rom" />
          </label>
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Page size</div>
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={{ width: '100%', padding: 8 }}>
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{ marginTop: 12, padding: '10px 16px', cursor: busy ? 'default' : 'pointer' }}
        >
          {status === 'rendering'
            ? 'Rendering HTML…'
            : status === 'generating'
            ? 'Generating PDF…'
            : 'Render PDF'}
        </button>
      </form>

      {error && (
        <div
          style={{
            color: '#842029',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c2c7',
            borderRadius: 4,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <strong>Error:</strong> {error}
          {/weasyprint/i.test(error) && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Install WeasyPrint and restart the styleguide:{' '}
              <code>pipx install weasyprint</code> or <code>brew install weasyprint</code>.
            </div>
          )}
        </div>
      )}

      {pdfUrl && (
        <div style={{ width: '100%', maxWidth: '100vw' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>PDF Preview</h3>
            {pdfMeta && (
              <span style={{ color: '#555', fontSize: 13 }}>
                {(pdfMeta.bytes / 1024).toFixed(0)} KB
              </span>
            )}
            <a href={pdfUrl} download={downloadName} style={{ fontSize: 13 }}>
              Download PDF
            </a>
            <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
              Open in new tab
            </a>
          </div>
          <iframe
            title="render-pdf-preview"
            src={pdfUrl}
            style={{ width: '100%', height: '85vh', border: '1px solid #ddd', borderRadius: 6, display: 'block' }}
          />
        </div>
      )}
    </div>
  );
}
