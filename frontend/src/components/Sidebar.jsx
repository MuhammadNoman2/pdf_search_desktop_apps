import { useState } from "react";
import { uploadPDFs, deleteFile } from "../api";

export default function Sidebar({ files, onUploaded, activeFilter, onFilterChange }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function handleFiles(fileList) {
    const pdfs = [...fileList].filter(f => f.type === "application/pdf");
    if (!pdfs.length) { setStatus({ type: "error", text: "PDF files only." }); return; }

    setLoading(true);
    setStatus({ type: "ok", text: "Indexing… this may take a moment for scanned PDFs." });
    try {
      const data = await uploadPDFs(pdfs);
      const ok   = data.results.filter(r => r.status === "ok");
      const fail = data.results.filter(r => r.status === "error");
      const ocrUsed = data.results.some(r => r.ocr);
      setStatus({
        type: fail.length ? "warn" : "ok",
        text: `${ok.length} indexed${ocrUsed ? " (OCR)" : ""}${fail.length ? `, ${fail.length} failed` : ""}`,
      });
      onUploaded();
    } catch (e) {
      setStatus({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e, file) {
    e.stopPropagation();
    if (!confirm(`Remove "${file.file_name}" from the index?`)) return;
    setDeleting(file.file_name);
    try {
      await deleteFile(file.file_name);
      if (activeFilter === file.file_name) onFilterChange(null);
      onUploaded();
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <circle cx="11" cy="15" r="3"/>
            <line x1="13.5" y1="17.5" x2="16" y2="20"/>
          </svg>
          <h1>PDF Search</h1>
        </div>
        <p className="sidebar-subtitle">100% offline · no cloud</p>
      </div>

      {/* Upload zone */}
      <div
        className={`upload-zone ${dragging ? "dragging" : ""}`}
        style={{ margin: "16px 12px 0" }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <div className="upload-zone-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
        </div>
        <p>Drop PDFs here or browse<br/><span style={{fontSize:10,opacity:.7}}>Scanned PDFs auto-OCR'd</span></p>
        <label className="upload-btn" style={{ pointerEvents: loading ? "none" : "auto" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {loading ? "Indexing…" : "Add PDFs"}
          <input type="file" accept=".pdf" multiple hidden
            onChange={e => handleFiles(e.target.files)} disabled={loading} />
        </label>
      </div>

      {status && (
        <div className={`upload-status ${status.type}`}>
          {status.type === "ok" && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          )}
          {status.text}
        </div>
      )}

      {/* File list */}
      <div className="sidebar-section">
        <p className="sidebar-section-title">Indexed Files · {files.length}</p>

        {files.length === 0 ? (
          <p className="sidebar-empty">No files yet</p>
        ) : (
          <>
            {activeFilter && (
              <button className="filter-clear-btn" onClick={() => onFilterChange(null)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Clear filter
              </button>
            )}
            {files.map((f, i) => (
              <div
                key={i}
                className={`file-item ${activeFilter === f.file_name ? "active" : ""}`}
                onClick={() => onFilterChange(activeFilter === f.file_name ? null : f.file_name)}
                title={`Click to filter results by ${f.file_name}`}
              >
                <div className="file-item-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                  </svg>
                </div>
                <span className="file-item-name">{f.file_name}</span>
                <button
                  className="file-delete-btn"
                  onClick={e => handleDelete(e, f)}
                  disabled={deleting === f.file_name}
                  title="Remove file"
                >
                  {deleting === f.file_name
                    ? "…"
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  }
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
