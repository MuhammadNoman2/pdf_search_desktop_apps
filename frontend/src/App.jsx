import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import SearchBar from "./components/SearchBar";
import ResultsList from "./components/ResultsList";
import PdfViewer from "./components/PdfViewer";
import { search, listFiles } from "./api";
import { printMatchedPages } from "./utils/printPages";

export default function App() {
  const [files, setFiles]         = useState([]);
  const [results, setResults]     = useState(null);
  const [query, setQuery]         = useState("");
  const [searching, setSearching] = useState(false);
  const [viewer, setViewer]       = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [printStatus, setPrintStatus]   = useState(null); // null | "string message"
  const [printing, setPrinting]         = useState(false);

  const refreshFiles = useCallback(async () => {
    try { setFiles((await listFiles()).files); } catch (_) {}
  }, []);

  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  async function handleSearch(q) {
    setQuery(q);
    setActiveFilter(null);
    setPrintStatus(null);
    setSearching(true);
    try {
      const data = await search(q);
      setResults(data.results);
    } catch (e) {
      alert("Search error: " + e.message);
    } finally {
      setSearching(false);
    }
  }

  function handleClear() {
    setResults(null);
    setQuery("");
    setActiveFilter(null);
    setPrintStatus(null);
  }

  async function handlePrint() {
    const target = displayResults;
    if (!target || target.length === 0) return;

    setPrinting(true);
    setPrintStatus("Starting…");
    try {
      await printMatchedPages(target, msg => setPrintStatus(msg));
      setPrintStatus(null);
    } catch (e) {
      setPrintStatus("Print failed: " + e.message);
      setTimeout(() => setPrintStatus(null), 4000);
    } finally {
      setPrinting(false);
    }
  }

  const displayResults = activeFilter && results
    ? results.filter(r => r.file_name === activeFilter)
    : results;

  const uniquePageCount = displayResults
    ? new Set(displayResults.map(r => `${r.file_name}::${r.page_number}`)).size
    : 0;

  return (
    <div className="app">
      <Sidebar
        files={files}
        onUploaded={refreshFiles}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="main">
        <SearchBar onSearch={handleSearch} loading={searching} />

        <div className="stats-bar">
          <div className="stats-left">
            <span className="stat-chip">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              <strong>{files.length}</strong> file{files.length !== 1 ? "s" : ""} indexed
            </span>

            {results !== null && (
              <span className="stat-chip">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <strong>{displayResults?.length ?? 0}</strong> result{displayResults?.length !== 1 ? "s" : ""}
                {query && <> for "<em>{query}</em>"</>}
                {activeFilter && <span className="filter-pill">in {activeFilter}</span>}
              </span>
            )}

            {printStatus && (
              <span className="stat-chip print-status">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                {printStatus}
              </span>
            )}
          </div>

          {results !== null && (
            <div className="stats-actions">
              {uniquePageCount > 0 && (
                <button
                  className="action-btn print-btn"
                  onClick={handlePrint}
                  disabled={printing}
                  title={`Print ${uniquePageCount} unique matched page(s)`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  {printing ? "Preparing…" : `Print ${uniquePageCount} page${uniquePageCount !== 1 ? "s" : ""}`}
                </button>
              )}

              <button
                className="action-btn clear-btn"
                onClick={handleClear}
                title="Clear search results"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear
              </button>
            </div>
          )}
        </div>

        <ResultsList results={displayResults} query={query} onOpen={setViewer} />
      </div>

      {viewer && <PdfViewer result={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
