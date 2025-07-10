import React, { useState, useEffect } from 'react';

const LandingPage: React.FC = () => {

  const [url, setUrl] = useState('');
  const [urlList, setUrlList] = useState<{id: number, url: string}[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isAborting, setIsAborting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  const fetchUrls = async () => {
    try {
      const res = await fetch('http://localhost:8080/urls');
      if (res.ok) {
        const data = await res.json();
        setUrlList(Array.isArray(data) ? data : []);
      } else {
        setUrlList([]);
      }
    } catch (err) {
      setUrlList([]);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, []);

  const handleAdd = async () => {
    if (url.trim() !== '') {
      try {
        const res = await fetch('http://localhost:8080/add-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() })
        });
        const data = await res.json();
        if (res.ok) {
          setUrl('');
          fetchUrls();
        } else {
          alert(data.error || 'Failed to save URL');
        }
      } catch (err) {
        alert('Failed to connect to backend');
      }
    }
  };

  // Handler for checkbox click (multi-select)
  const handleCheckboxChange = (id: number) => {
    setSelectedIdxs(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Handler for Start Processing button
  const handleStartProcessing = async () => {
    if (loading) {
      // Abort requested
      setIsAborting(true);
      if (abortController) abortController.abort();
      return;
    }
    setLoading(true);
    setIsAborting(false);
    setResults([]);
    let localAbort = new AbortController();
    setAbortController(localAbort);
    for (const id of selectedIdxs) {
      if (localAbort.signal.aborted) break;
      const urlObj = urlList.find(item => item.id === id);
      if (!urlObj) continue;
      try {
        const res = await fetch('http://localhost:4000/fetch-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlObj.url }),
          signal: localAbort.signal
        });
        const data = await res.json();
        // Debug: log the backend response
        console.log('Fetched details for', urlObj.url, data);
        // Defensive mapping: ensure all fields are present and fallback to 0 or ''
        setResults(prev => [
          ...prev,
          {
            url: urlObj.url,
            title: data.title || '',
            htmlVersion: data.htmlVersion || data.version || '',
            h1: typeof data.h1 === 'number' ? data.h1 : (data.headingCounts && typeof data.headingCounts.h1 === 'number' ? data.headingCounts.h1 : 0),
            h2: typeof data.h2 === 'number' ? data.h2 : (data.headingCounts && typeof data.headingCounts.h2 === 'number' ? data.headingCounts.h2 : 0),
            h3: typeof data.h3 === 'number' ? data.h3 : (data.headingCounts && typeof data.headingCounts.h3 === 'number' ? data.headingCounts.h3 : 0),
            h4: typeof data.h4 === 'number' ? data.h4 : (data.headingCounts && typeof data.headingCounts.h4 === 'number' ? data.headingCounts.h4 : 0),
            h5: typeof data.h5 === 'number' ? data.h5 : (data.headingCounts && typeof data.headingCounts.h5 === 'number' ? data.headingCounts.h5 : 0),
            h6: typeof data.h6 === 'number' ? data.h6 : (data.headingCounts && typeof data.headingCounts.h6 === 'number' ? data.headingCounts.h6 : 0),
            internalLinks: typeof data.internalLinks === 'number' ? data.internalLinks : 0,
            externalLinks: typeof data.externalLinks === 'number' ? data.externalLinks : 0,
            inaccessibleLinks: typeof data.inaccessibleLinks === 'number' ? data.inaccessibleLinks : 0,
            hasLoginForm: typeof data.hasLoginForm === 'boolean' ? data.hasLoginForm : false,
            error: data.error || ''
          }
        ]);
      } catch (e) {
        if (localAbort.signal.aborted) {
          setResults(prev => [...prev, { error: 'Aborted by user.', url: urlObj.url }]);
          break;
        } else {
          setResults(prev => [...prev, { error: 'Failed to fetch details.', url: urlObj.url }]);
        }
      }
    }
    setLoading(false);
    setAbortController(null);
    setIsAborting(false);
  };

  // Handler for Delete URL button
  const handleDeleteUrls = async () => {
    if (selectedIdxs.length === 0) return;
    try {
      const res = await fetch('http://localhost:8080/delete-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIdxs })
      });
      if (res.ok) {
        fetchUrls();
        setSelectedIdxs([]);
      } else {
        alert('Failed to delete URLs');
      }
    } catch (err) {
      alert('Failed to connect to backend');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-white" style={{ fontFamily: 'Roboto, Arial, sans-serif' }}>
      <div className="mt-8 flex w-96">
        <input
          type="url"
          value={url}
          onChange={handleInputChange}
          placeholder="https://example.com"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-r hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          ADD
        </button>
      </div>
      {urlList.length > 0 && (
        <div className="mt-10 w-full max-w-2xl flex flex-row items-start">
          <div style={{ flex: 1, maxHeight: '520px', overflowY: urlList.length > 10 ? 'auto' : 'visible' }}>
            <table className="min-w-full bg-white border-separate border-spacing-0 rounded-lg shadow-lg overflow-hidden border-4 border-blue-800">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-4 py-3 border-b-2 border-blue-800 text-center font-bold">URLs</th>
                  <th className="px-4 py-3 border-b-2 border-blue-800 text-center font-bold">Process</th>
                </tr>
              </thead>
              <tbody>
                {urlList.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50">
                    <td className="px-4 py-3 border-b border-blue-800 break-all text-center">{item.url}</td>
                    <td className="px-4 py-3 border-b border-blue-200 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIdxs.includes(item.id)}
                        onChange={() => handleCheckboxChange(item.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-6 flex flex-col items-end justify-start w-44 gap-4">
            <button
              type="button"
              onClick={handleStartProcessing}
              disabled={selectedIdxs.length === 0 || isAborting}
              className={`w-full min-w-[160px] px-6 py-2 ${loading ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-400' : 'bg-green-600 hover:bg-green-700 focus:ring-green-400'} text-white font-semibold rounded shadow focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (isAborting ? 'Stopping...' : 'Stop processing') : 'Start processing'}
            </button>
            <button
              type="button"
              onClick={handleDeleteUrls}
              disabled={selectedIdxs.length === 0 || loading}
              className={`w-full min-w-[160px] px-6 py-2 bg-red-600 text-white font-semibold rounded shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Delete URL
            </button>
          </div>
        </div>
      )}
      {/* Details Table */}
      {results.length > 0 && (
        <div className="mt-8 w-full max-w-xl flex justify-center items-center">
          {loading ? (
            <div className="py-4 text-gray-500">Loading...</div>
          ) : (
            <table className="min-w-full bg-white border-separate border-spacing-0 rounded-lg shadow-lg overflow-hidden border-4 border-blue-800">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">URL</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">Title</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">HTML Version</th>
                  {[1,2,3,4,5,6].map(h => (
                    <th key={h} className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">&lt;h{h}&gt; count</th>
                  ))}
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">Internal Links</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">External Links</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">Inaccessible Links (4xx/5xx)</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">Login Form Present</th>
                </tr>
              </thead>
              <tbody>
                {results.map((details, i) => (
                  <tr key={i} className="hover:bg-blue-50">
                    <td className="px-4 py-3 border-b border-blue-800 text-center">{details.url}</td>
                    <td className="px-4 py-3 border-b border-blue-800 text-center">{details.title}</td>
                    <td className="px-4 py-3 border-b border-blue-800 text-center">{details.htmlVersion || details.version}</td>
                    {[1,2,3,4,5,6].map(h => (
                      <td key={h} className="px-4 py-3 border-b border-blue-800 text-center">{details[`h${h}`]}</td>
                    ))}
                    <td className="px-4 py-3 border-b border-blue-800 text-center">{details.internalLinks}</td>
                    <td className="px-4 py-3 border-b border-blue-800 text-center">{details.externalLinks}</td>
                    <td className="px-4 py-3 border-b border-blue-800 text-center">{details.inaccessibleLinks}</td>
                    <td className="px-4 py-3 border-b border-blue-200 text-center">{details.hasLoginForm ? 'Yes' : details.hasLoginForm === false ? 'No' : (details.error ? '-' : '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
    </div>
  );
};

export default LandingPage;
