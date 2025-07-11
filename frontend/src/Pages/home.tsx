import React, { useState, useEffect, useMemo } from 'react';
const Home: React.FC = () => {
  // Pagination, sorting, and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [filterConfig, setFilterConfig] = useState<any>({});

  // Results state is now loaded from backend
  const [results, setResults] = useState<any[]>([]);
  // Selected processed result IDs
  const [selectedResultIds, setSelectedResultIds] = useState<number[]>([]);

  // Load results from backend on mount
  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch('http://localhost:8080/results');
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
        } else {
          setResults([]);
        }
      } catch (err) {
        setResults([]);
      }
    };
    fetchResults();
  }, []);

  // Sorting handler
  const handleSort = (key: string) => {
    if (key === 'url') return; // URL column not sortable
    setSortConfig(prev => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
    setCurrentPage(1);
  };


  // Filtering
  const filteredResults = useMemo(() => {
    let filtered = [...results];
    Object.entries(filterConfig).forEach(([key, value]) => {
      if (value === '' || value === undefined || value === null) return;
      if (key === 'hasLoginForm') {
        if (value === 'yes') filtered = filtered.filter(r => r.hasLoginForm === true);
        else if (value === 'no') filtered = filtered.filter(r => r.hasLoginForm === false);
      } else if (key === 'title' || key === 'hostname' || key === 'htmlVersion') {
        filtered = filtered.filter(r => (r[key] || '').toLowerCase().includes(String(value).toLowerCase()));
      } else {
        // Numeric columns
        filtered = filtered.filter(r => String(r[key]) === String(value));
      }
    });
    return filtered;
  }, [results, filterConfig]);

  // Sorting
  const sortedResults = useMemo(() => {
    let sortable = [...filteredResults];
    if (sortConfig) {
      sortable.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortConfig.direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    return sortable;
  }, [filteredResults, sortConfig]);

  // Global search state
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  // Global search filter (fuzzy or prefix match on all string fields)
  const globallyFilteredResults = useMemo(() => {
    if (!searchActive || !globalSearch.trim()) return sortedResults;
    const q = globalSearch.trim().toLowerCase();
    return sortedResults.filter(row => {
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
  }, [sortedResults, globalSearch, searchActive]);

  // Handler for checkbox click in processed results
  const handleResultCheckboxChange = (id: number) => {
    setSelectedResultIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Handler for deleting processed results
  const handleDeleteResults = async () => {
    if (selectedResultIds.length === 0) return;
    try {
      const res = await fetch('http://localhost:8080/delete-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedResultIds })
      });
      if (res.ok) {
        // Refresh results
        const data = await fetch('http://localhost:8080/results').then(r => r.json());
        setResults(Array.isArray(data) ? data : []);
        setSelectedResultIds([]);
      } else {
        alert('Failed to delete processed results');
      }
    } catch (err) {
      alert('Failed to connect to backend');
    }
  };

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return globallyFilteredResults.slice(start, start + rowsPerPage);
  }, [globallyFilteredResults, currentPage]);

  const totalPages = Math.ceil(filteredResults.length / rowsPerPage);
  const [url, setUrl] = useState('');
  const [urlList, setUrlList] = useState<{id: number, url: string}[]>([]);
  // Removed unused selectedIdx and setSelectedIdx
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
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
      setIsAborting(true);
      if (abortController) abortController.abort();
      return;
    }
    setLoading(true);
    setIsAborting(false);
    let localAbort = new AbortController();
    setAbortController(localAbort);
    let errorMsg = '';
    for (const id of selectedIdxs) {
      if (localAbort.signal.aborted) break;
      const urlObj = urlList.find(item => item.id === id);
      if (!urlObj) continue;
      try {
        // Try both localhost and 127.0.0.1 for Puppeteer server
        let puppeteerRes;
        try {
          puppeteerRes = await fetch('http://localhost:4000/fetch-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlObj.url }),
            signal: localAbort.signal
          });
        } catch {
          puppeteerRes = await fetch('http://127.0.0.1:4000/fetch-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlObj.url }),
            signal: localAbort.signal
          });
        }
        if (!puppeteerRes.ok) {
          let errText = await puppeteerRes.text();
          errorMsg = `Failed to process URL: ${urlObj.url}\n${errText}`;
          console.error('Puppeteer error:', errText);
          continue;
        }
        const data = await puppeteerRes.json();
        console.log('Puppeteer response for', urlObj.url, data);
        let hostname = '';
        try {
          hostname = new URL(urlObj.url).hostname;
        } catch {}
        // Save result to backend
        const addResultRes = await fetch('http://localhost:8080/add-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            error: data.error || ''
          })
        });
        if (!addResultRes.ok) {
          const addResultErr = await addResultRes.text();
          errorMsg = `Failed to save result for URL: ${urlObj.url}\n${addResultErr}`;
          console.error('Add-result error:', addResultErr);
          continue;
        }
        // Refresh results after each processed URL
        try {
          const res = await fetch('http://localhost:8080/results');
          if (res.ok) {
            const data = await res.json();
            setResults(Array.isArray(data) ? data : []);
          }
        } catch {}
      } catch (e) {
        let errMsg = '';
        if (e && typeof e === 'object' && 'message' in e) {
          errMsg = (e as any).message;
        } else {
          errMsg = String(e);
        }
        errorMsg = `Failed to process URL: ${urlObj.url}\n${errMsg}`;
        console.error('Fetch error:', e);
        if (localAbort.signal.aborted) {
          break;
        }
      }
    }
    setLoading(false);
    setAbortController(null);
    setIsAborting(false);
    setSelectedIdxs([]);
    if (errorMsg) {
      alert(errorMsg);
    }
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
              {urlList.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-center py-4 text-gray-400">No URLs found. Add one above.</td>
                </tr>
              ) : (
                urlList.map((item) => (
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
                ))
              )}
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
      {/* Details Table */}

      {/* Always show the results table, even if empty */}
      <div className="mt-8 w-full max-w-xl flex flex-col items-center">
        <div className="w-full flex justify-center items-center mb-2">
          <span className="font-bold text-lg text-center">Processed Results</span>
        </div>
        {loading ? (
          <div className="py-4 text-gray-500">Loading...</div>
        ) : (
          <>
            <table className="min-w-full bg-white border-separate border-spacing-0 rounded-lg shadow-lg overflow-hidden border-4 border-blue-800">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-2 py-2 border-b-2 border-blue-800 text-center font-bold">Select</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold">URL</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none" onClick={() => handleSort('hostname')}>Host name {sortConfig?.key === 'hostname' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none" onClick={() => handleSort('title')}>Title {sortConfig?.key === 'title' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none" onClick={() => handleSort('htmlVersion')}>HTML Version {sortConfig?.key === 'htmlVersion' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                  {[1,2,3,4,5,6].map(h => (
                    <th key={h} className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none" onClick={() => handleSort(`h${h}`)}>&lt;h{h}&gt; count {sortConfig?.key === `h${h}` ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                  ))}
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none" onClick={() => handleSort('internalLinks')}>Internal Links {sortConfig?.key === 'internalLinks' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none" onClick={() => handleSort('externalLinks')}>External Links {sortConfig?.key === 'externalLinks' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none" onClick={() => handleSort('inaccessibleLinks')}>Inaccessible Links {sortConfig?.key === 'inaccessibleLinks' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                  <th className="px-4 py-2 border-b-2 border-blue-800 text-center font-bold cursor-pointer select-none" onClick={() => handleSort('hasLoginForm')}>Login Form Present {sortConfig?.key === 'hasLoginForm' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                </tr>
                {/* Filter row */}
                <tr>
                  <th></th>
                  {/* Hostname filter */}
                  <th className="px-2 py-1 border-b border-blue-200 text-center">
                    <input
                      type="text"
                      placeholder="Filter"
                      className="w-24 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      value={filterConfig.hostname || ''}
                      onChange={e => { setFilterConfig((prev: any) => ({ ...prev, hostname: e.target.value })); setCurrentPage(1); }}
                    />
                  </th>
                  {/* Title filter */}
                  <th className="px-2 py-1 border-b border-blue-200 text-center">
                    <input
                      type="text"
                      placeholder="Filter"
                      className="w-24 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      value={filterConfig.title || ''}
                      onChange={e => { setFilterConfig((prev: any) => ({ ...prev, title: e.target.value })); setCurrentPage(1); }}
                    />
                  </th>
                  {/* HTML Version filter */}
                  <th className="px-2 py-1 border-b border-blue-200 text-center">
                    <input
                      type="text"
                      placeholder="Filter"
                      className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      value={filterConfig.htmlVersion || ''}
                      onChange={e => { setFilterConfig((prev: any) => ({ ...prev, htmlVersion: e.target.value })); setCurrentPage(1); }}
                    />
                  </th>
                  {/* h1-h6 filters */}
                  {[1,2,3,4,5,6].map(h => (
                    <th key={h} className="px-2 py-1 border-b border-blue-200 text-center">
                      <input
                        type="number"
                        min="0"
                        placeholder="#"
                        className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                        value={filterConfig[`h${h}`] ?? ''}
                        onChange={e => { setFilterConfig((prev: any) => ({ ...prev, [`h${h}`]: e.target.value })); setCurrentPage(1); }}
                      />
                    </th>
                  ))}
                  {/* Internal Links filter */}
                  <th className="px-2 py-1 border-b border-blue-200 text-center">
                    <input
                      type="number"
                      min="0"
                      placeholder="#"
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      value={filterConfig.internalLinks ?? ''}
                      onChange={e => { setFilterConfig((prev: any) => ({ ...prev, internalLinks: e.target.value })); setCurrentPage(1); }}
                    />
                  </th>
                  {/* External Links filter */}
                  <th className="px-2 py-1 border-b border-blue-200 text-center">
                    <input
                      type="number"
                      min="0"
                      placeholder="#"
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      value={filterConfig.externalLinks ?? ''}
                      onChange={e => { setFilterConfig((prev: any) => ({ ...prev, externalLinks: e.target.value })); setCurrentPage(1); }}
                    />
                  </th>
                  {/* Inaccessible Links filter */}
                  <th className="px-2 py-1 border-b border-blue-200 text-center">
                    <input
                      type="number"
                      min="0"
                      placeholder="#"
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      value={filterConfig.inaccessibleLinks ?? ''}
                      onChange={e => { setFilterConfig((prev: any) => ({ ...prev, inaccessibleLinks: e.target.value })); setCurrentPage(1); }}
                    />
                  </th>
                  {/* Login Form filter */}
                  <th className="px-2 py-1 border-b border-blue-200 text-center">
                    <select
                      className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      value={filterConfig.hasLoginForm ?? ''}
                      onChange={e => { setFilterConfig((prev: any) => ({ ...prev, hasLoginForm: e.target.value })); setCurrentPage(1); }}
                    >
                      <option value="">All</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center py-4 text-gray-400">No processed results found.</td>
                  </tr>
                ) : (
                  paginatedResults.map((details, i) => (
                    <tr key={i} className="hover:bg-blue-50">
                      <td className="px-2 py-3 border-b border-blue-800 text-center">
                        <input
                          type="checkbox"
                          checked={selectedResultIds.includes(details.id)}
                          onChange={() => handleResultCheckboxChange(details.id)}
                        />
                      </td>
                      <td className="px-4 py-3 border-b border-blue-800 text-center">{details.url}</td>
                      <td className="px-4 py-3 border-b border-blue-800 text-center">{details.hostname}</td>
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
                  ))
                )}
              </tbody>
            </table>
            {/* Pagination controls */}
            <div className="flex justify-center items-center gap-4 mt-4">
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
              <button
                type="button"
                onClick={handleDeleteResults}
                disabled={selectedResultIds.length === 0}
                className="ml-6 px-6 py-2 bg-red-600 text-white font-semibold rounded shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
            {/* Global search box */}
            <div className="flex flex-col items-center mt-4 w-full">
              <div className="flex gap-2 w-full max-w-xs">
                <input
                  type="text"
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  placeholder="Search processed data..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onKeyDown={e => { if (e.key === 'Enter') { setSearchActive(true); setCurrentPage(1); } }}
                />
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onClick={() => { setSearchActive(true); setCurrentPage(1); }}
                >
                  Search Processed Data
                </button>
                {searchActive && (
                  <button
                    className="px-2 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
                    onClick={() => { setGlobalSearch(''); setSearchActive(false); setCurrentPage(1); }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      
    </div>
  );
};

export default Home;
