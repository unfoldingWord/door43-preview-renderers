import { useMemo, useState } from 'react';
import { getResourceData } from './getResourceData';
import { renderHtmlData } from './renderHtmlData';
import { renderHTML } from './renderHTML';

/**
 * Example resources covering every supported subject + metadata type, so the
 * styleguide exercises each route in renderHtmlData(). Each entry is
 * [label, owner, repo, ref, books].
 */
const EXAMPLE_GROUPS = [
  {
    group: 'Scripture (USFM)',
    examples: [
      ['RC: Aligned Bible — ULT — Titus (v89)', 'unfoldingWord', 'en_ult', 'v89', 'tit'],
      ['RC: Aligned Bible — UST — Romans', 'unfoldingWord', 'en_ust', 'master', 'rom'],
      ['RC: Hebrew Old Testament — UHB — Ruth', 'unfoldingWord', 'hbo_uhb', 'master', 'rut'],
      [
        'RC: Greek New Testament — UGNT — Titus',
        'unfoldingWord',
        'el-x-koine_ugnt',
        'master',
        'tit',
      ],
      ['TS: Bible — Ruth', 'adipatealberto', 'pid_rut_text_reg', 'master', 'rut'],
      ['TC: Aligned Bible — Daniel', 'christopherrsmith', 'en_ust_dan_book', 'master', 'dan'],
    ],
  },
  {
    group: 'TSV Bible helps',
    examples: [
      ['Translation Notes — Titus (v89)', 'unfoldingWord', 'en_tn', 'v89', 'tit'],
      ['Translation Questions — Romans (v89)', 'unfoldingWord', 'en_tq', 'v89', 'rom'],
      ['Study Notes — Titus', 'unfoldingWord', 'en_sn', 'master', 'tit'],
      ['Study Questions — Titus', 'unfoldingWord', 'en_sq', 'master', 'tit'],
    ],
  },
  {
    group: 'Manuals (markdown)',
    examples: [
      ['Translation Academy', 'unfoldingWord', 'en_ta', 'master', ''],
      ['Translation Words', 'unfoldingWord', 'en_tw', 'master', ''],
    ],
  },
  {
    group: 'Open Bible Stories',
    examples: [
      ['OBS', 'unfoldingWord', 'en_obs', 'master', ''],
      ['OBS Translation Notes', 'unfoldingWord', 'en_obs-tn', 'master', ''],
      ['OBS Translation Questions', 'unfoldingWord', 'en_obs-tq', 'master', ''],
      ['OBS Study Notes', 'unfoldingWord', 'en_obs-sn', 'master', ''],
      ['OBS Study Questions', 'unfoldingWord', 'en_obs-sq', 'master', ''],
    ],
  },
];

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
    if (!result?.sections) {
      return '';
    }

    // Compose a screen document from the rendered sections (stage 4). Show the
    // cover + copyright here so the preview matches the full document.
    const fullHtml = renderHTML(result, {
      media: 'screen',
      show: { cover: true, copyright: true },
    });

    const wrapCss = `
      <style>
        html, body { max-width: 100%; overflow-x: hidden; }
        * { box-sizing: border-box; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
        pre { white-space: pre-wrap; word-break: break-word; }
      </style>
    `;

    if (fullHtml.includes('</head>')) {
      return fullHtml.replace('</head>', `${wrapCss}</head>`);
    }

    return fullHtml;
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
      // Stage 2: fetch + parse the resource data, then stage 3: render to HTML
      // sections. (renderHtmlData no longer fetches — feed it the data.)
      const resourceData = await getResourceData({ owner, repo, ref, books }, optionsJson);
      const data = renderHtmlData(resourceData, {
        books,
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
        <strong>Quick Examples (every supported subject &amp; metadata type):</strong>
        <div style={{ marginTop: '10px' }}>
          {EXAMPLE_GROUPS.map(({ group, examples }) => (
            <div key={group} style={{ marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>{group}</strong>
              <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {examples.map(([label, exOwner, exRepo, exRef, exBooks]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => loadExample(exOwner, exRepo, exRef, exBooks)}
                    title={`${exOwner}/${exRepo}/${exRef}${exBooks ? ` (${exBooks})` : ''}`}
                    style={{ padding: '6px 10px', cursor: 'pointer' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
