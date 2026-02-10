import React, { useState } from 'react';
import { getResourceData } from './getResourceData';

/**
 * Demo component for getResourceData function
 */
export default function GetResourceDataDemo() {
  const [owner, setOwner] = useState('unfoldingWord');
  const [repo, setRepo] = useState('en_obs');
  const [ref, setRef] = useState('v9');
  const [books, setBooks] = useState([]);
  const [options, setOptions] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadExample = (exampleOwner, exampleRepo, exampleRef) => {
    setOwner(exampleOwner);
    setRepo(exampleRepo);
    setRef(exampleRef);
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

    try {
      const data = await getResourceData(owner, repo, ref, books, optionsJSON);
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

      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
        }}
      >
        <strong>Quick Examples:</strong>
        <div style={{ marginTop: '10px' }}>
          <div style={{ marginBottom: '10px' }}>
            <strong>OBS:</strong>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_obs', 'v9');
                  setBooks([]);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                RC: unfoldingWord/en_obs/v9
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('Tot', 'mdg_obs_text_obs', 'master');
                  setBooks([]);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                TS: Tot/mdg_obs_text_obs/master
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('shower', 'zhs_obs', 'master');
                  setBooks([]);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                SB: shower/zhs_obs/master
              </button>
            </div>
          </div>
          <div>
            <strong>TSV (Translation Notes/Questions/TWLs):</strong>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_tn', 'v87');
                  setBooks(['gen']);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                TN v87: unfoldingWord/en_tn/v87 (gen)
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_tn', 'v66');
                  setBooks(['gen']);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                TN v66: unfoldingWord/en_tn/v66 (gen)
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_twl', 'v87');
                  setBooks(['gen']);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                TWL: unfoldingWord/en_twl/v87 (gen)
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_tq', 'v87');
                  setBooks(['gen']);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                TQ: unfoldingWord/en_tq/v87 (gen)
              </button>
            </div>
          </div>
          <div>
            <strong>Translation Words:</strong>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_tw', 'v87');
                  setBooks([]);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                unfoldingWord/en_tw/v87
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('es-419_gl', 'es-419_tw', 'v37');
                  setBooks([]);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                es-419_gl/es-419_tw/v37
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('BSOJ', 'ar_tw', 'master');
                  setBooks([]);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                BSOJ/ar_tw/master
              </button>
            </div>
          </div>
          <div>
            <strong>Aligned Bible:</strong>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_ult', 'v88');
                  setBooks(['tit']);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                unfoldingWord/en_ult/v88 (tit)
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_ust', 'master');
                  setBooks(['mat', 'mrk', 'luk', 'jhn']);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                unfoldingWord/en_ust/master (mat,mrk,luk,jhn)
              </button>
            </div>
          </div>
          <div>
            <strong>Translation Academy:</strong>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
              <button
                type="button"
                onClick={() => {
                  loadExample('unfoldingWord', 'en_ta', 'v87');
                  setBooks([]);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                unfoldingWord/en_ta/v87
              </button>
              <button
                type="button"
                onClick={() => {
                  loadExample('BSOJ', 'ar_ta', 'master');
                  setBooks([]);
                }}
                style={{ padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
              >
                BSOJ/ar_ta/master
              </button>
            </div>
          </div>
        </div>
      </div>

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
          {loading ? 'Fetching...' : 'Fetch Catalog Entry'}
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
