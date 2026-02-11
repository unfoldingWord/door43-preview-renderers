import { useMemo, useState } from 'react';
import { renderHtmlData } from './renderHtmlData';

/**
 * Demo component for renderHtmlData function.
 */
export default function RenderHtmlDataDemo() {
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_ult');
  const [ref, setRef] = useState('v88');
  const [booksInput, setBooksInput] = useState('tit');
  const [options, setOptions] = useState(
    JSON.stringify(
      {
        dcs_api_url: 'https://git.door43.org/api/v1',
      },
      null,
      2
    )
  );
  const [renderOptions, setRenderOptions] = useState(
    JSON.stringify(
      {
        includeRawUsfmView: false,
        editorMode: false,
      },
      null,
      2
    )
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const previewData = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      subject: result.subject,
      title: result.title,
      sections: result.sections,
    };
  }, [result]);

  const previewFullHtml = useMemo(() => {
    if (!result?.fullHtml) {
      return '';
    }

    const wrapCss = `
      <style>
        html, body { max-width: 100%; overflow-x: hidden; }
        * { box-sizing: border-box; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
        pre { white-space: pre-wrap; word-break: break-word; }
      </style>
    `;

    if (result.fullHtml.includes('</head>')) {
      return result.fullHtml.replace('</head>', `${wrapCss}</head>`);
    }

    return result.fullHtml;
  }, [result]);

  const loadExample = (nextOwner, nextRepo, nextRef, nextBooksInput) => {
    setOwner(nextOwner);
    setRepo(nextRepo);
    setRef(nextRef);
    setBooksInput(nextBooksInput);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    let optionsJson;
    let renderOptionsJson;

    try {
      optionsJson = JSON.parse(options || '{}');
    } catch (parseError) {
      setError(`Invalid options JSON: ${parseError.message}`);
      setLoading(false);
      return;
    }

    try {
      renderOptionsJson = JSON.parse(renderOptions || '{}');
    } catch (parseError) {
      setError(`Invalid renderOptions JSON: ${parseError.message}`);
      setLoading(false);
      return;
    }

    const books = booksInput
      .split(',')
      .map((bookId) => bookId.trim().toLowerCase())
      .filter(Boolean);

    try {
      const data = await renderHtmlData(owner, repo, ref, books, {
        ...optionsJson,
        renderOptions: renderOptionsJson,
      });
      setResult(data);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', maxWidth: '100vw' }}>
      <h2>renderHtmlData() Demo</h2>

      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
        }}
      >
        <strong>Quick Examples:</strong>
        <div style={{ marginTop: '10px' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong style={{ fontSize: '13px' }}>Aligned Bible</strong>
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => loadExample('unfoldingWord', 'en_ult', 'v88', 'tit')}
                style={{ padding: '6px 10px', cursor: 'pointer' }}
              >
                unfoldingWord/en_ult/v88 (tit)
              </button>
              <button
                type="button"
                onClick={() => loadExample('unfoldingWord', 'en_ust', 'master', 'mat,mrk')}
                style={{ padding: '6px 10px', cursor: 'pointer' }}
              >
                unfoldingWord/en_ust/master (mat,mrk)
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <strong style={{ fontSize: '13px' }}>Translation Academy</strong>
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => loadExample('unfoldingWord', 'en_ta', 'v87', '')}
                style={{ padding: '6px 10px', cursor: 'pointer' }}
              >
                unfoldingWord/en_ta/v87
              </button>
              <button
                type="button"
                onClick={() => loadExample('BSOJ', 'ar_ta', 'master', '')}
                style={{ padding: '6px 10px', cursor: 'pointer' }}
              >
                BSOJ/ar_ta/master
              </button>
            </div>
          </div>

          <div>
            <strong style={{ fontSize: '13px' }}>Translation Words</strong>
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => loadExample('unfoldingWord', 'en_tw', 'v87', '')}
                style={{ padding: '6px 10px', cursor: 'pointer' }}
              >
                unfoldingWord/en_tw/v87
              </button>
              <button
                type="button"
                onClick={() => loadExample('BSOJ', 'ar_tw', 'master', '')}
                style={{ padding: '6px 10px', cursor: 'pointer' }}
              >
                BSOJ/ar_tw/master
              </button>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Owner</div>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </label>
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Repo</div>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </label>
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Ref</div>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </label>
          <label>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Books (comma-separated)</div>
            <input
              value={booksInput}
              onChange={(e) => setBooksInput(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              placeholder="gen,exo"
            />
          </label>
        </div>

        <div style={{ marginTop: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Options JSON</div>
          <textarea
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            rows={5}
            style={{ width: '100%', fontFamily: 'monospace', padding: '8px' }}
          />
        </div>

        <div style={{ marginTop: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Render Options JSON</div>
          <textarea
            value={renderOptions}
            onChange={(e) => setRenderOptions(e.target.value)}
            rows={6}
            style={{ width: '100%', fontFamily: 'monospace', padding: '8px' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '12px',
            padding: '10px 16px',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Rendering...' : 'Render HTML'}
        </button>
      </form>

      {error && (
        <div
          style={{
            color: '#842029',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c2c7',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '16px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div style={{ maxWidth: '100vw', overflowX: 'auto' }}>
            <h3>Packaged HTML/CSS Data</h3>
            <pre
              style={{
                backgroundColor: '#111827',
                color: '#e5e7eb',
                padding: '12px',
                borderRadius: '6px',
                overflowX: 'auto',
                maxHeight: '400px',
                minWidth: 'max-content',
                whiteSpace: 'pre',
              }}
            >
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </div>

          <div style={{ width: '100%', maxWidth: '100vw' }}>
            <h3>Full Rendered Preview</h3>
            <iframe
              title="render-html-preview"
              srcDoc={previewFullHtml}
              style={{
                width: '100%',
                height: '80vh',
                border: '1px solid #ddd',
                borderRadius: '6px',
                display: 'block',
              }}
            />
          </div>

          {result.sections?.webView && (
            <div>
              <h3>Raw USFM HTML View</h3>
              <div
                style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '12px' }}
                dangerouslySetInnerHTML={{ __html: result.sections.webView }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
