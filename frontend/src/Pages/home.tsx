import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
const Home: React.FC = () => {
  const navigate = useNavigate();
  // URL input state
  const [url, setUrl] = useState('');
  // List of URLs to display in the URL table
  const [urlList, setUrlList] = useState<{ id: number; url: string }[]>([]);

  // Results state is now loaded from backend
  const [results, setResults] = useState<any[]>([]);
  // Selected processed result IDs (by id)
  const [selectedResultIds, setSelectedResultIds] = useState<number[]>([]);
  // Selected URL IDs (by id) for the URL list table
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
  // Table state for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  // Loading and aborting state for processing
  const [loading, setLoading] = useState(false);
  const [isAborting, setIsAborting] = useState(false);

  // Crawl status for each URL
  const [crawlStatus, setCrawlStatus] = useState<{ [id: number]: string }>({});

  // Fetch URLs from backend
  const fetchUrls = async () => {
    try {
      const res = await fetch('http://localhost:8080/urls', {
        headers: { 'X-API-Key': 'my-secret-key' }
      });
      if (res.ok) {
        const data = await res.json();
        setUrlList(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  // Fetch processed results from backend
  const fetchResults = async () => {
    try {
      const res = await fetch('http://localhost:8080/results', {
        headers: { 'X-API-Key': 'my-secret-key' }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  // On mount, fetch URLs and results
  React.useEffect(() => {
    fetchUrls();
    fetchResults();
  }, []);

  // Handler for input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  // Handler for Add button
  const handleAdd = async () => {
    if (!url.trim()) return;
    try {
      const res = await fetch('http://localhost:8080/add-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'my-secret-key' },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        setUrl('');
        fetchUrls();
      } else {
        alert('Failed to add URL');
      }
    } catch {
      alert('Failed to connect to backend');
    }
  };

  // Handler for checkbox change in URL table
  const handleCheckboxChange = (id: number) => {
    setSelectedIdxs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Handler for Start Processing button
  const handleStartProcessing = async () => {
    if (selectedIdxs.length === 0) return;
    setLoading(true);
    setIsAborting(false);
    let errorMsg = '';
    // Set all selected to queued
    setCrawlStatus(prev => {
      const updated = { ...prev };
      selectedIdxs.forEach(id => { updated[id] = 'queued'; });
      return updated;
    });
    for (const id of selectedIdxs) {
      const urlObj = urlList.find(item => item.id === id);
      if (!urlObj) continue;
      setCrawlStatus(prev => ({ ...prev, [id]: 'running' }));
      try {
        // Try both localhost and 127.0.0.1 for Puppeteer server
        let puppeteerRes;
        try {
          puppeteerRes = await fetch('http://localhost:4000/fetch-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlObj.url })
          });
        } catch {
          puppeteerRes = await fetch('http://127.0.0.1:4000/fetch-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlObj.url })
          });
        }
        if (!puppeteerRes.ok) {
          let errText = await puppeteerRes.text();
          errorMsg = `Failed to process URL: ${urlObj.url}\n${errText}`;
          setCrawlStatus(prev => ({ ...prev, [id]: 'error' }));
          console.error('Puppeteer error:', errText);
          continue;
        }
        const data = await puppeteerRes.json();
        let hostname = '';
        try {
          hostname = new URL(urlObj.url).hostname;
        } catch {}
        // Save result to backend
      const addResultRes = await fetch('http://localhost:8080/add-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'my-secret-key' },
        body: JSON.stringify({
            url: urlObj.url,
            hostname,
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
            error: data.error || '',
            inaccessibleLinksList: data.inaccessibleLinksList ? JSON.stringify(data.inaccessibleLinksList) : ''
          })
        });
        if (!addResultRes.ok) {
          const addResultErr = await addResultRes.text();
          errorMsg = `Failed to save result for URL: ${urlObj.url}\n${addResultErr}`;
          setCrawlStatus(prev => ({ ...prev, [id]: 'error' }));
          console.error('Add-result error:', addResultErr);
          continue;
        }
        setCrawlStatus(prev => ({ ...prev, [id]: 'done' }));
        // Refresh results after each processed URL
        await fetchResults();
      } catch (e) {
        let errMsg = '';
        if (e && typeof e === 'object' && 'message' in e) {
          errMsg = (e as any).message;
        } else {
          errMsg = String(e);
        }
        errorMsg = `Failed to process URL: ${urlObj.url}\n${errMsg}`;
        setCrawlStatus(prev => ({ ...prev, [id]: 'error' }));
        console.error('Fetch error:', e);
      }
    }
    setLoading(false);
    setIsAborting(false);
    setSelectedIdxs([]);
    if (errorMsg) {
      alert(errorMsg);
    }
  };


  // Global search state
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  // Sorting state for Processed Results table
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Columns to allow sorting on (up to Login Form)
  const sortableColumns = [
    'hostname',
    'htmlVersion',
    'title',
    'url',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'internalLinks', 'externalLinks', 'inaccessibleLinks',
    'hasLoginForm'
  ];

  // Global search filter (fuzzy or prefix match on all string fields)
  const globallyFilteredResults = useMemo(() => {
    if (!searchActive || !globalSearch.trim()) return results;
    const q = globalSearch.trim().toLowerCase();
    return results.filter(row => {
      // Check all string fields for prefix or fuzzy match
      return [
        row.url,
        row.hostname,
        row.title,
        row.htmlVersion || row.version
      ].some(val =>
        typeof val === 'string' && val.toLowerCase().includes(q)
      );
    });
  }, [results, globalSearch, searchActive]);

  // Sorted and filtered results
  const sortedFilteredResults = useMemo(() => {
    let filtered = globallyFilteredResults;
    if (sortConfig && sortableColumns.includes(sortConfig.key)) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        // For boolean, sort false < true
        if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          return (aVal === bVal ? 0 : aVal ? 1 : -1) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        // For number, sort numerically
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        // For string, sort lexicographically
        aVal = aVal === undefined || aVal === null ? '' : String(aVal);
        bVal = bVal === undefined || bVal === null ? '' : String(bVal);
        return aVal.localeCompare(bVal) * (sortConfig.direction === 'asc' ? 1 : -1);
      });
    }
    return filtered;
  }, [globallyFilteredResults, sortConfig, sortableColumns]);



  // Handler for deleting processed results
  const handleDeleteResults = async () => {
    if (selectedResultIds.length === 0) return;
    try {
      const res = await fetch('http://localhost:8080/delete-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'my-secret-key' },
        body: JSON.stringify({ ids: selectedResultIds })
      });
      if (res.ok) {
        // Refresh results
      const data = await fetch('http://localhost:8080/results', {
        headers: { 'X-API-Key': 'my-secret-key' }
      }).then(r => r.json());
        setResults(Array.isArray(data) ? data : []);
        setSelectedResultIds([]);
      } else {
        alert('Failed to delete processed results');
      }
    } catch (err) {
      alert('Failed to connect to backend');
    }
  };


  // Handler for Delete URL button
  const handleDeleteUrls = async () => {
    if (selectedIdxs.length === 0) return;
    try {
      const res = await fetch('http://localhost:8080/delete-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'my-secret-key' },
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

  // Handler for Analyze button
  const handleAnalyze = () => {
    if (selectedResultIds.length !== 1) {
      alert('Please select exactly one processed result to analyze.');
      return;
    }
    const selectedId = selectedResultIds[0];
    const selected = results.find(r => r.id === selectedId);
    if (!selected) {
      alert('Selected result not found.');
      return;
    }
    navigate('/details', { state: { result: selected } });
  };

  return (
    <div className="min-h-screen flex flex-col items-center relative px-2 sm:px-4 md:px-8 lg:px-16 xl:px-32 mt-[80px]" style={{ fontFamily: 'Roboto, Arial, sans-serif' }}>
      {/* Page header with violet to purple gradient and right-aligned title */}
      <div
        className="w-screen h-[80px] fixed top-0 left-0 z-20 flex items-center justify-end pr-8"
        style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
      >
        <span className="font-bold text-2xl text-white select-none" style={{ letterSpacing: '1px', userSelect: 'none' }}>
          The Web Crawler
        </span>
      </div>
      {/* Glassy purple-to-sky blue gradient background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-purple-800 to-sky-400" />
      {/* Glass effect overlay */}
      <div className="fixed inset-0 -z-10 backdrop-blur-md bg-white/10" />
      {/* Centered white instruction text */}
      <div className="w-full flex justify-center" style={{ marginTop: '90px' }}>
        <span className="text-white text-lg font-semibold text-center">Please enter the URL below</span>
      </div>
      <div className="mt-4 flex w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
        <input
          type="url"
          value={url}
          onChange={handleInputChange}
          placeholder="https://example.com"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-md"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-r hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-md"
        >
          ADD
        </button>
      </div>
      <div className="mt-[10px] w-full max-w-2xl sm:max-w-3xl md:max-w-4xl flex flex-col items-center">
        <div
          className="w-full overflow-x-auto border-4 border-blue-800 rounded-2xl shadow-xl shadow-black bg-white/80"
          style={{
            maxHeight: '132px', // header (about 36px) + 2 rows (about 48px each)
            overflowY: 'auto',
            minHeight: 'auto'
          }}
        >
          <table className="min-w-full bg-white border-separate border-spacing-0 rounded-2xl shadow-xl shadow-black overflow-hidden text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
            <thead>
              <tr className="bg-sky-300">
                <th className="px-4 py-3 border-b-2 border-blue-800 border-r-2 text-center font-bold">URLs</th>
                <th className="px-4 py-3 border-b-2 border-blue-800 border-r-2 text-center font-bold">Process</th>
              </tr>
            </thead>
            <tbody>
              {urlList.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-center py-4 text-gray-400">No URLs found. Add one above.</td>
                </tr>
              ) : (
                urlList.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={
                      idx % 2 === 0
                        ? 'bg-sky-100 hover:bg-sky-200'
                        : 'bg-amber-50 hover:bg-amber-100'
                    }
                  >
                    <td className="px-4 py-3 border-b border-blue-800 border-r-2 break-all text-center">{item.url}</td>
                    <td className="px-4 py-3 border-b border-blue-800 border-r-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIdxs.includes(item.id)}
                        onChange={() => handleCheckboxChange(item.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Buttons below the table, centered and spaced */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 mt-[10px] w-full">
          <button
            type="button"
            onClick={handleStartProcessing}
            disabled={selectedIdxs.length === 0 || isAborting}
            className={`min-w-[160px] px-6 py-2 ${loading ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-400' : 'bg-green-600 hover:bg-green-700 focus:ring-green-400'} text-white font-semibold rounded shadow-md focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (isAborting ? 'Stopping...' : 'Stop processing') : 'Start processing'}
          </button>
          <button
            type="button"
            onClick={handleDeleteUrls}
            disabled={selectedIdxs.length === 0 || loading}
            className="min-w-[160px] px-6 py-2 bg-red-600 text-white font-semibold rounded shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete URL
          </button>
        </div>
      </div>
      {/* Crawl status for each URL */}
      {urlList.length > 0 && (
        <div
          className="w-full max-w-2xl sm:max-w-3xl md:max-w-4xl mt-2 overflow-x-auto border-4 border-blue-800 rounded-2xl shadow-xl shadow-black bg-white/80"
          style={{
            maxHeight: '132px', // header (about 36px) + 2 rows (about 48px each)
            overflowY: 'auto',
            minHeight: 'auto'
          }}
        >
          <table className="min-w-full bg-white rounded-2xl shadow-xl shadow-black text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
            <thead>
              <tr className="bg-sky-300">
                <th className="px-4 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold">URL</th>
                <th className="px-4 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold">Crawl Status</th>
              </tr>
            </thead>
            <tbody>
              {urlList.map((item, idx) => (
                <tr
                  key={item.id}
                  className={
                    idx % 2 === 0
                      ? 'bg-sky-100 hover:bg-sky-200'
                      : 'bg-amber-50 hover:bg-amber-100'
                  }
                >
                  <td className="px-4 py-2 border-b border-blue-800 border-r-2 break-all text-center">{item.url}</td>
                  <td className="px-4 py-2 border-b border-blue-800 border-r-2 text-center">
                    {crawlStatus[item.id] === 'running' && <span className="text-yellow-600 font-semibold">Running</span>}
                    {crawlStatus[item.id] === 'done' && <span className="text-green-600 font-semibold">Done</span>}
                    {crawlStatus[item.id] === 'error' && <span className="text-red-600 font-semibold">Error</span>}
                    {crawlStatus[item.id] === 'queued' && <span className="text-blue-600 font-semibold">Queued</span>}
                    {!crawlStatus[item.id] && <span className="text-gray-400">Idle</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Details Table */}

      {/* Always show the results table, even if empty */}
      <div className="mt-8 w-full flex flex-col items-center">
        <div className="w-full flex justify-center items-center mb-2 px-2 sm:px-4 md:px-8 lg:px-16 xl:px-32">
          <span className="font-bold text-lg text-center text-base sm:text-lg text-white">Processed Results</span>
        </div>
        {/* Responsive Processed Results: Table for lg+, cards for md and below */}
        {/* Table for 2xl to lg: fixed row heights, horizontal scroll */}
        <div className="hidden lg:flex justify-center w-full overflow-x-auto 2xl:max-w-none xl:max-w-none" style={{ width: '100vw', maxHeight: '520px', overflowY: 'auto' }}>
          <table className="w-full bg-white border-separate border-spacing-0 rounded-2xl shadow-xl shadow-black overflow-hidden border-2 border-blue-800 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl" style={{ minWidth: '600px', maxWidth: '100vw', margin: '0 auto', background: 'white', borderRadius: 8, border: '4px solid #1e40af' }}>
            <thead>
              <tr className="bg-sky-300">
                <th className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold">Select</th>
                <th
                  className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold cursor-pointer select-none"
                  onClick={() => setSortConfig(sortConfig && sortConfig.key === 'url' ? { key: 'url', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'url', direction: 'asc' })}
                >
                  URL {sortConfig?.key === 'url' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold cursor-pointer select-none"
                  onClick={() => setSortConfig(sortConfig && sortConfig.key === 'hostname' ? { key: 'hostname', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'hostname', direction: 'asc' })}
                >
                  Host name {sortConfig?.key === 'hostname' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold cursor-pointer select-none"
                  onClick={() => setSortConfig(sortConfig && sortConfig.key === 'title' ? { key: 'title', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'title', direction: 'asc' })}
                >
                  Title {sortConfig?.key === 'title' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold cursor-pointer select-none"
                  onClick={() => setSortConfig(sortConfig && sortConfig.key === 'htmlVersion' ? { key: 'htmlVersion', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'htmlVersion', direction: 'asc' })}
                >
                  HTML Version {sortConfig?.key === 'htmlVersion' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                {[1,2,3,4,5,6].map(h => (
                  <th
                    key={h}
                    className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold cursor-pointer select-none"
                    onClick={() => setSortConfig(sortConfig && sortConfig.key === `h${h}` ? { key: `h${h}`, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: `h${h}`, direction: 'asc' })}
                  >
                    {`<h${h}>`} {sortConfig?.key === `h${h}` ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                ))}
                <th
                  className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold cursor-pointer select-none"
                  onClick={() => setSortConfig(sortConfig && sortConfig.key === 'internalLinks' ? { key: 'internalLinks', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'internalLinks', direction: 'asc' })}
                >
                  Internal Links {sortConfig?.key === 'internalLinks' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold cursor-pointer select-none"
                  onClick={() => setSortConfig(sortConfig && sortConfig.key === 'externalLinks' ? { key: 'externalLinks', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'externalLinks', direction: 'asc' })}
                >
                  External Links {sortConfig?.key === 'externalLinks' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-2 py-2 border-b-2 border-blue-800 border-r-2 text-center font-bold cursor-pointer select-none"
                  onClick={() => setSortConfig(sortConfig && sortConfig.key === 'inaccessibleLinks' ? { key: 'inaccessibleLinks', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'inaccessibleLinks', direction: 'asc' })}
                >
                  Inaccessible Links {sortConfig?.key === 'inaccessibleLinks' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-2 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none"
                  onClick={() => setSortConfig(sortConfig && sortConfig.key === 'hasLoginForm' ? { key: 'hasLoginForm', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'hasLoginForm', direction: 'asc' })}
                >
                  Login Form {sortConfig?.key === 'hasLoginForm' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const pageRows = sortedFilteredResults.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage);
                const rowsToShow = 5;
                const emptyRows = rowsToShow - pageRows.length;
                const tableRows = [];
                if (pageRows.length === 0) {
                  tableRows.push(
                    <tr key="no-data">
                      <td colSpan={15} className="text-center py-4 text-gray-400">No processed results found.</td>
                    </tr>
                  );
                } else {
                  pageRows.forEach((row, idx) => {
                    tableRows.push(
                      <tr
                        key={row.id}
                        className={
                          idx % 2 === 0
                            ? 'bg-sky-100 hover:bg-sky-200'
                            : 'bg-amber-50 hover:bg-amber-100'
                        }
                      >
                        <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedResultIds.includes(row.id)}
                            onChange={() => {
                              setSelectedResultIds(prev => prev.includes(row.id)
                                ? prev.filter(id => id !== row.id)
                                : [...prev, row.id]);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row.url}</td>
                        <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row.hostname}</td>
                        <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row.title}</td>
                        <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row.htmlVersion || row.version}</td>
                        {[1,2,3,4,5,6].map(h => (
                          <td key={h} className="px-2 py-2 border-b border-blue-800 border-r-2 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row[`h${h}`]}</td>
                        ))}
                        <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row.internalLinks}</td>
                        <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row.externalLinks}</td>
                        <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row.inaccessibleLinks}</td>
                        <td className="px-2 py-2 border-b border-blue-800 text-center" style={{whiteSpace:'normal',wordBreak:'break-all'}}>{row.hasLoginForm === true ? 'Yes' : row.hasLoginForm === false ? 'No' : '-'}</td>
                      </tr>
                    );
                  });
                }
                for (let i = 0; i < emptyRows; i++) {
                  tableRows.push(
                    <tr key={`empty-${i}`} className={((pageRows.length + i) % 2 === 0) ? 'bg-sky-100' : 'bg-amber-50'}>
                      <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      {[1,2,3,4,5,6].map(h => (
                        <td key={h} className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      ))}
                      <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      <td className="px-2 py-2 border-b border-blue-800 border-r-2 text-center">&nbsp;</td>
                      <td className="px-2 py-2 border-b border-blue-800 text-center">&nbsp;</td>
                    </tr>
                  );
                }
                return tableRows;
              })()}
            </tbody>
          </table>
        </div>
        {/* Card layout for below lg */}
        <div className="flex flex-col gap-4 lg:hidden w-full px-1">
          {globallyFilteredResults.length === 0 ? (
            <div className="text-center py-4 text-gray-400 bg-white rounded-2xl shadow-xl shadow-black border-2 border-blue-800">No processed results found.</div>
          ) : (
            globallyFilteredResults.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage).map((row, idx) => (
              <div key={row.id} className={`bg-white rounded-2xl shadow-xl shadow-black border-2 border-blue-800 p-4 flex flex-col gap-2 ${idx % 2 === 0 ? 'bg-blue-50' : 'bg-blue-200'}`}>
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="font-bold">Select</span>
                  <input
                    type="checkbox"
                    checked={selectedResultIds.includes(row.id)}
                    onChange={() => {
                      setSelectedResultIds(prev => prev.includes(row.id)
                        ? prev.filter(id => id !== row.id)
                        : [...prev, row.id]);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span><span className="font-bold">URL:</span> <span className="break-all">{row.url}</span></span>
                  <span><span className="font-bold">Host name:</span> {row.hostname}</span>
                  <span><span className="font-bold">Title:</span> {row.title}</span>
                  <span><span className="font-bold">HTML Version:</span> {row.htmlVersion || row.version}</span>
                  {[1,2,3,4,5,6].map(h => (
                    <span key={h}><span className="font-bold">{`<h${h}>`}:</span> {row[`h${h}`]}</span>
                  ))}
                  <span><span className="font-bold">Internal Links:</span> {row.internalLinks}</span>
                  <span><span className="font-bold">External Links:</span> {row.externalLinks}</span>
                  <span><span className="font-bold">Inaccessible Links:</span> {row.inaccessibleLinks}</span>
                  <span><span className="font-bold">Login Form:</span> {row.hasLoginForm === true ? 'Yes' : row.hasLoginForm === false ? 'No' : '-'}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Card layout for md and up to lg (md <= screen < lg) */}
        <div className="hidden md:flex flex-col gap-4 lg:hidden w-full px-1">
          {globallyFilteredResults.length === 0 ? (
            <div className="text-center py-4 text-gray-400 bg-white rounded-2xl shadow-xl shadow-black border-2 border-blue-800">No processed results found.</div>
          ) : (
            globallyFilteredResults.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage).map((row, idx) => (
              <div key={row.id} className={`bg-white rounded-2xl shadow-xl shadow-black border-2 border-blue-800 p-4 flex flex-col gap-2 ${idx % 2 === 0 ? 'bg-blue-50' : 'bg-blue-200'}`}>
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="font-bold">Select</span>
                  <input
                    type="checkbox"
                    checked={selectedResultIds.includes(row.id)}
                    onChange={() => {
                      setSelectedResultIds(prev => prev.includes(row.id)
                        ? prev.filter(id => id !== row.id)
                        : [...prev, row.id]);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span><span className="font-bold">URL:</span> <span className="break-all">{row.url}</span></span>
                  <span><span className="font-bold">Host name:</span> {row.hostname}</span>
                  <span><span className="font-bold">Title:</span> {row.title}</span>
                  <span><span className="font-bold">HTML Version:</span> {row.htmlVersion || row.version}</span>
                  {[1,2,3,4,5,6].map(h => (
                    <span key={h}><span className="font-bold">{`<h${h}>`}:</span> {row[`h${h}`]}</span>
                  ))}
                  <span><span className="font-bold">Internal Links:</span> {row.internalLinks}</span>
                  <span><span className="font-bold">External Links:</span> {row.externalLinks}</span>
                  <span><span className="font-bold">Inaccessible Links:</span> {row.inaccessibleLinks}</span>
                  <span><span className="font-bold">Login Form:</span> {row.hasLoginForm === true ? 'Yes' : row.hasLoginForm === false ? 'No' : '-'}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Table action buttons and search */}
        <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-2 sm:gap-4 mt-4 w-full px-2 sm:px-4 md:px-8 lg:px-16 xl:px-32">
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Search processed data..."
            className="w-full sm:w-auto flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            onKeyDown={e => { if (e.key === 'Enter') { setSearchActive(true); } }}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-md"
            onClick={() => setSearchActive(true)}
          >
            Search
          </button>
          {searchActive && (
            <button
              className="px-2 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 shadow-md"
              onClick={() => { setGlobalSearch(''); setSearchActive(false); }}
              title="Clear search"
            >
              ✕
            </button>
          )}
          <button
            className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            onClick={handleDeleteResults}
            disabled={selectedResultIds.length === 0}
          >
            Delete
          </button>
          <button
            className="px-4 py-2 bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            onClick={handleAnalyze}
            disabled={selectedResultIds.length !== 1}
          >
            Analyze
          </button>
        </div>
        {/* Pagination controls */}
        <div className="flex flex-row flex-wrap justify-center items-center gap-2 mt-4 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span>Page {currentPage} of {Math.max(1, Math.ceil(sortedFilteredResults.length / rowsPerPage))}</span>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedFilteredResults.length / rowsPerPage), p + 1))}
            disabled={currentPage === Math.ceil(sortedFilteredResults.length / rowsPerPage) || sortedFilteredResults.length === 0}
          >
            Next
          </button>
        </div>
      </div>
      
    </div>
  );


}
export default Home;
