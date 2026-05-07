export default function ResultsList({ results, query, onOpen }) {
  if (results === null) {
    return (
      <div className="results-area">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <h3>Search your PDF library</h3>
          <p>Upload PDFs using the sidebar, then search by name, role, department, or any keyword in the documents.</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="results-area">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>No results for "{query}"</h3>
          <p>Try different keywords or shorter terms. Note: scanned (image-based) PDFs cannot be searched without OCR.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-area">
      {results.map((r, i) => (
        <div key={i} className="result-card" onClick={() => onOpen(r)}>
          <div className="result-card-header">
            <div className="result-card-meta">
              <div className="result-file-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
              </div>
              <div className="result-file-info">
                <div className="result-file-name" title={r.file_name}>{r.file_name}</div>
              </div>
            </div>
            <div className="result-badges">
              <span className="badge badge-page">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                </svg>
                Page {r.page_number}
              </span>
              <span className="badge badge-open">Open →</span>
            </div>
          </div>
          <p className="result-snippet" dangerouslySetInnerHTML={{ __html: r.snippet }} />
        </div>
      ))}
    </div>
  );
}
