import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { getPdfBuffer } from "../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

function extractMatchWords(snippet) {
  const matches = [...snippet.matchAll(/<mark>(.*?)<\/mark>/gi)];
  return [...new Set(
    matches.map(m => m[1].trim().toLowerCase()).filter(w => w.length > 1)
  )];
}

function applyHighlights(container, words) {
  if (!words.length) return;
  container.querySelectorAll("span").forEach(span => {
    if (words.some(w => span.textContent.toLowerCase().includes(w))) {
      span.classList.add("pdf-hl");
    }
  });
}

export default function PdfViewer({ result, onClose }) {
  const canvasRef    = useRef(null);
  const textLayerRef = useRef(null);
  const wrapRef      = useRef(null);
  const pdfRef       = useRef(null);

  const [totalPages, setTotalPages]   = useState(0);
  const [currentPage, setCurrentPage] = useState(result.page_number || 1);
  const [scale, setScale]             = useState(1.4);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const matchWords = extractMatchWords(result.snippet || "");

  // Load PDF from buffer (works in both Electron and web)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPdfBuffer(result.file_name)
      .then(buffer => {
        if (cancelled) return;
        return pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      })
      .then(pdf => {
        if (cancelled || !pdf) return;
        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);
        return renderPage(pdf, result.page_number || 1);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [result.file_name]);

  useEffect(() => {
    if (pdfRef.current) renderPage(pdfRef.current, currentPage);
  }, [currentPage, scale]);

  async function renderPage(pdf, pageNum) {
    setLoading(true);
    try {
      const page     = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Canvas
      const canvas = canvasRef.current;
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

      // Size wrapper
      if (wrapRef.current) {
        wrapRef.current.style.width  = `${viewport.width}px`;
        wrapRef.current.style.height = `${viewport.height}px`;
      }

      // Text layer
      const tlDiv = textLayerRef.current;
      if (tlDiv) {
        tlDiv.innerHTML = "";
        tlDiv.style.width  = `${viewport.width}px`;
        tlDiv.style.height = `${viewport.height}px`;
        try {
          const tl = new pdfjsLib.TextLayer({
            textContentSource: await page.getTextContent(),
            container: tlDiv,
            viewport,
          });
          await tl.render();
          applyHighlights(tlDiv, matchWords);
        } catch (_) {
          // scanned PDF — no embedded text layer
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const prev   = () => setCurrentPage(p => Math.max(1, p - 1));
  const next   = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const zoomIn  = () => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)));
  const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)));

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-modal" onClick={e => e.stopPropagation()}>

        <div className="viewer-toolbar">
          <div className="viewer-file-info">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            <span className="viewer-file-name" title={result.file_name}>{result.file_name}</span>
          </div>
          <div className="viewer-controls">
            <button className="viewer-ctrl-btn" onClick={zoomOut}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span className="viewer-page-info">{Math.round(scale * 100)}%</span>
            <button className="viewer-ctrl-btn" onClick={zoomIn}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <div className="viewer-divider"/>
            <button className="viewer-ctrl-btn" onClick={prev} disabled={currentPage <= 1}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="viewer-page-info">Page {currentPage} / {totalPages}</span>
            <button className="viewer-ctrl-btn" onClick={next} disabled={currentPage >= totalPages}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div className="viewer-divider"/>
            <button className="viewer-ctrl-btn danger" onClick={onClose}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Close
            </button>
          </div>
        </div>

        <div className="viewer-match-bar">
          <span className="viewer-match-label">Match</span>
          <span className="viewer-match-text" dangerouslySetInnerHTML={{ __html: result.snippet }} />
          {matchWords.length > 0 && (
            <span className="viewer-hl-note">
              <span className="viewer-hl-swatch"/> highlighted on page
            </span>
          )}
        </div>

        <div className="viewer-canvas-area">
          {loading && !error && (
            <div className="viewer-loading">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              Loading PDF…
            </div>
          )}
          {error && <div className="viewer-loading" style={{color:"#f87171"}}>Error: {error}</div>}
          <div ref={wrapRef} style={{ position: "relative", display: loading || error ? "none" : "inline-block" }}>
            <canvas ref={canvasRef} style={{ display: "block" }} />
            <div ref={textLayerRef} className="pdf-text-layer" />
          </div>
        </div>
      </div>
    </div>
  );
}
