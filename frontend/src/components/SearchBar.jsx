import { useState } from "react";

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState("");

  function submit(e) {
    e.preventDefault();
    const q = query.trim();
    if (q) onSearch(q);
  }

  return (
    <div className="topbar">
      <form className="search-wrap" onSubmit={submit} style={{ flex: 1 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="search-input"
          type="text"
          placeholder='Search employees, roles, names… e.g. "sales manager" or "Ali"'
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={loading}
        />
        {query && (
          <button type="button" onClick={() => setQuery("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "0 4px", fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        )}
      </form>
      <button className="search-btn" onClick={submit} disabled={loading || !query.trim()}>
        {loading ? "Searching…" : "Search"}
      </button>
    </div>
  );
}
