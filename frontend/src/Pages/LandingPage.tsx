import React, { useState } from 'react';

const LandingPage: React.FC = () => {

  const [url, setUrl] = useState('');
  const [urlList, setUrlList] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isAborting, setIsAborting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  const handleAdd = () => {
    if (url.trim() !== '') {
      setUrlList(prev => [...prev, url.trim()]);
      setUrl('');
    }
  };

  // Handler for checkbox click (multi-select)
  const handleCheckboxChange = (idx: number) => {
    setSelectedIdxs(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
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
    for (const idx of selectedIdxs) {
      if (localAbort.signal.aborted) break;
      try {
        const res = await fetch('http://localhost:4000/fetch-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlList[idx] }),
          signal: localAbort.signal
        });
        const data = await res.json();
        setResults(prev => [...prev, { ...data, url: urlList[idx] }]);
      } catch (e) {
        if (localAbort.signal.aborted) {
          setResults(prev => [...prev, { error: 'Aborted by user.', url: urlList[idx] }]);
          break;
        } else {
          setResults(prev => [...prev, { error: 'Failed to fetch details.', url: urlList[idx] }]);
        }
      }
    }
    setLoading(false);
    setAbortController(null);
    setIsAborting(false);
  };

  // Handler for Delete URL button
  const handleDeleteUrls = () => {
    if (selectedIdxs.length === 0) return;
    setUrlList(prev => prev.filter((_, idx) => !selectedIdxs.includes(idx)));
    setSelectedIdxs([]);
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
                  <th className="px-4 py-3 border-b-2 border-blue-200 border-r-4 border-blue-800 text-center font-bold">URLs</th>
                  <th className="px-4 py-3 border-b-2 border-blue-200 text-center font-bold">Process</th>
                </tr>
              </thead>
              <tbody>
                {urlList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-blue-50">
                    <td className="px-4 py-3 border-b border-blue-200 border-r-4 border-blue-800 break-all text-center">{item}</td>
                    <td className="px-4 py-3 border-b border-blue-200 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIdxs.includes(idx)}
                        onChange={() => handleCheckboxChange(idx)}
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
                  <th className="px-4 py-2 border-b-2 border-blue-300 border-r-4 border-blue-800 text-center font-bold">URL</th>
                  <th className="px-4 py-2 border-b-2 border-blue-300 border-r-4 border-blue-800 text-center font-bold">Title</th>
                  <th className="px-4 py-2 border-b-2 border-blue-300 border-r-4 border-blue-800 text-center font-bold">HTML Version</th>
                  {[1,2,3,4,5,6].map(h => (
                    <th key={h} className="px-4 py-2 border-b-2 border-blue-300 border-r-4 border-blue-800 text-center font-bold">&lt;h{h}&gt; count</th>
                  ))}
                  <th className="px-4 py-2 border-b-2 border-blue-300 border-r-4 border-blue-800 text-center font-bold">Internal Links</th>
                  <th className="px-4 py-2 border-b-2 border-blue-300 border-r-4 border-blue-800 text-center font-bold">External Links</th>
                  <th className="px-4 py-2 border-b-2 border-blue-300 border-r-4 border-blue-800 text-center font-bold">Inaccessible Links (4xx/5xx)</th>
                  <th className="px-4 py-2 border-b-2 border-blue-300 text-center font-bold">Login Form Present</th>
                </tr>
              </thead>
              <tbody>
                {results.map((details, i) => (
                  <tr key={i} className="hover:bg-blue-50">
                    <td className="px-4 py-3 border-b border-blue-200 border-r-4 border-blue-800 text-center">{details.url}</td>
                    <td className="px-4 py-3 border-b border-blue-200 border-r-4 border-blue-800 text-center">{details.title}</td>
                    <td className="px-4 py-3 border-b border-blue-200 border-r-4 border-blue-800 text-center">{details.htmlVersion || details.version}</td>
                    {[1,2,3,4,5,6].map(h => (
                      <td key={h} className="px-4 py-3 border-b border-blue-200 border-r-4 border-blue-800 text-center">{details[`h${h}`]}</td>
                    ))}
                    <td className="px-4 py-3 border-b border-blue-200 border-r-4 border-blue-800 text-center">{details.internalLinks}</td>
                    <td className="px-4 py-3 border-b border-blue-200 border-r-4 border-blue-800 text-center">{details.externalLinks}</td>
                    <td className="px-4 py-3 border-b border-blue-200 border-r-4 border-blue-800 text-center">{details.inaccessibleLinks}</td>
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
