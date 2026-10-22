import { useState } from 'react';
import { getResourceData } from './getResourceData';
import { EN_RELEASE, exampleBooks } from './demoExamples';
import ExamplePicker from './ExamplePicker';

/**
 * Demo component for getResourceData function
 */
export default function GetResourceDataDemo() {
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_ult');
  const [ref, setRef] = useState(EN_RELEASE);
  const [books, setBooks] = useState(['tit']);
  const [options, setOptions] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadExample = (example) => {
    setOwner(example.owner);
    setRepo(example.repo);
    setRef(example.ref);
    setBooks(exampleBooks(example));
    // An example's own getResourceData options (e.g. extraSubjects), or none.
    setOptions(example.options ? JSON.stringify(example.options, null, 2) : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    let optionsJSON = {
      dcsApiUrl: 'https://git.door43.org/api/v1',
    };

    try {
      optionsJSON = JSON.parse(options || '{}');
    } catch (err) {
      setError(`Invalid JSON in options: ${err.message}`);
      setLoading(false);
      return;
    }

    try {
      const data = await getResourceData({ owner, repo, ref, books }, optionsJSON);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>getResourceData() Demo</h2>

      {ExamplePicker({ onPick: loadExample })}

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Owner:
          </label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            required
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Repo:</label>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            required
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Ref:</label>
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            required
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Books (optional):
          </label>
          <input
            type="text"
            value={books}
            onChange={(e) => setBooks(e.target.value.split(',').map((b) => b.trim()))}
            placeholder="e.g., 'GEN,EXO'"
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Options (optional):
          </label>
          <input
            type="text"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder='e.g., {"someOption": true}'
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#1978c8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Fetching...' : 'Fetch Resource Data'}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#fee',
            border: '1px solid #c00',
            borderRadius: '4px',
            color: '#c00',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h3>Result:</h3>
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '500px',
              fontSize: '14px',
              border: '1px solid #ddd',
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
