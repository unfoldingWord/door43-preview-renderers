import React, { useState } from 'react';
import { get_rendered_pages } from './getRenderedPages';

/**
 * Demo component for get_rendered_pages function
 */
export default function GetRenderedPagesDemo() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await get_rendered_pages('unfoldingWord', 'en_tn', 'master', {
        dcs_api_url: 'https://git.door43.org/api/v1',
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>get_rendered_pages() Demo</h2>
      <p>
        <strong>Owner:</strong> unfoldingWord
        <br />
        <strong>Repo:</strong> en_tn
        <br />
        <strong>Ref:</strong> master
        <br />
        <strong>DCS API URL:</strong> https://git.door43.org/api/v1
      </p>

      <button
        onClick={handleFetch}
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
