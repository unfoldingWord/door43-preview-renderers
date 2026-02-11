import { useState } from 'react';
import { getAllCatalogEntriesForRendering } from './getAllCatalogEntriesForRendering';

/**
 * Demo component for getAllCatalogEntriesForRendering function
 *
 * @example
 * <GetAllCatalogEntriesForRenderingDemo />
 */
export default function GetAllCatalogEntriesForRenderingDemo() {
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_tn');
  const [ref, setRef] = useState('v87');
  const [books, setBooks] = useState('1th');
  const [options, setOptions] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadExample = (exampleOwner, exampleRepo, exampleRef, exampleBooks) => {
    setOwner(exampleOwner);
    setRepo(exampleRepo);
    setRef(exampleRef);
    setBooks(exampleBooks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    let optionsJSON = {
      dcs_api_url: 'https://git.door43.org/api/v1',
    };

    try {
      optionsJSON = JSON.parse(options || '{}');
    } catch (err) {
      setError(`Invalid JSON in options: ${err.message}`);
      setLoading(false);
      return;
    }

    const booksArray = books
      ? books
          .split(',')
          .map((b) => b.trim())
          .filter((b) => b)
      : [];

    try {
      const data = await getAllCatalogEntriesForRendering(
        owner,
        repo,
        ref,
        booksArray,
        optionsJSON
      );
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>getAllCatalogEntriesForRendering() Demo</h2>

      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
        }}
      >
        <h3>Quick Examples</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadExample('unfoldingWord', 'en_tn', 'v87', '1th')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0366d6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            unfoldingWord/en_tn/v87 [1th]
          </button>
          <button
            onClick={() => loadExample('BSOJ', 'ar_tn', 'master', 'tit')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0366d6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            BSOJ/ar_tn/master [tit]
          </button>
          <button
            onClick={() => loadExample('unfoldingWord', 'en_tn', 'v66', 'mat,mrk')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0366d6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            unfoldingWord/en_tn/v66 [mat,mrk]
          </button>
          <button
            onClick={() => loadExample('unfoldingWord', 'en_tn', 'v87', 'rut,tit')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0366d6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            unfoldingWord/en_tn/v87 [rut,tit - Mixed OT/NT]
          </button>
          <button
            onClick={() => loadExample('unfoldingWord', 'en_obs-tn', 'v11', '')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0366d6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            unfoldingWord/en_obs-tn/v11
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Owner:
          </label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Repository:
          </label>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Reference (branch/tag):
          </label>
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Books (comma-separated, e.g., "1th" or "mat,mrk"):
          </label>
          <input
            type="text"
            value={books}
            onChange={(e) => setBooks(e.target.value)}
            placeholder="Optional: 1th, mat,mrk, etc."
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Options (JSON):
          </label>
          <textarea
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder='{"dcs_api_url": "https://git.door43.org/api/v1"}'
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
          }}
        >
          {loading ? 'Fetching...' : 'Get All Catalog Entries'}
        </button>
      </form>

      {error && (
        <div
          style={{
            padding: '15px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div>
          <h3>Result:</h3>
          <div style={{ marginBottom: '15px' }}>
            <p>
              <strong>Version:</strong> {result.version}
            </p>
            <p>
              <strong>Found {result.catalogEntries.length} catalog entries:</strong>
            </p>
            {result.catalogEntries.map((entry, index) => (
              <div
                key={index}
                style={{
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: index === 0 ? '#d4edda' : '#e7f3ff',
                  border: `1px solid ${index === 0 ? '#c3e6cb' : '#b8daff'}`,
                  borderRadius: '4px',
                }}
              >
                <h4 style={{ margin: '0 0 10px 0' }}>
                  {index === 0 ? '📘 Main Entry' : `🔗 Required Entry ${index}`}: {entry.title}
                </h4>
                <p style={{ margin: '5px 0' }}>
                  <strong>Subject:</strong> {entry.subject}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Owner:</strong> {entry.owner}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Repo:</strong> {entry.name}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Stage:</strong> {entry.stage}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Ref:</strong> {entry.branch_or_tag_name}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Released:</strong> {entry.released}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Language:</strong> {entry.language}
                </p>
                {entry.ingredients && entry.ingredients.length > 0 && (
                  <p style={{ margin: '5px 0' }}>
                    <strong>Books:</strong> {entry.ingredients.map((i) => i.identifier).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
              Show Full JSON
            </summary>
            <pre
              style={{
                backgroundColor: '#f6f8fa',
                padding: '15px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '600px',
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
