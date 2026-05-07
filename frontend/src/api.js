// Detect whether we're running inside Electron
const isElectron = typeof window !== "undefined" && !!window.api?.isElectron;

// ── Upload ────────────────────────────────────────────────────────────────────
export async function uploadPDFs(files) {
  if (isElectron) {
    // Electron sets file.path on File objects from both drag-drop and <input type="file">
    // Send paths only — main process reads files directly (no binary IPC transfer)
    const fileData = [...files].map(f => ({ name: f.name, path: f.path }));
    return window.api.uploadPDFs(fileData);
  }
  const form = new FormData();
  for (const f of files) form.append("pdfs", f);
  const res = await fetch("/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Search ────────────────────────────────────────────────────────────────────
export async function search(query) {
  if (isElectron) return window.api.search(query);
  const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Get PDF as ArrayBuffer ────────────────────────────────────────────────────
export async function getPdfBuffer(fileName) {
  if (isElectron) return window.api.getPdfBuffer(fileName);
  const res = await fetch(`/pdf/${encodeURIComponent(fileName)}`);
  if (!res.ok) throw new Error("PDF not found");
  return res.arrayBuffer();
}

// ── Web-only URL helper (unused in Electron) ──────────────────────────────────
export function pdfUrl(fileName) {
  return `/pdf/${encodeURIComponent(fileName)}`;
}

// ── File list ─────────────────────────────────────────────────────────────────
export async function listFiles() {
  if (isElectron) return window.api.listFiles();
  const res = await fetch("/files");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Delete file ───────────────────────────────────────────────────────────────
export async function deleteFile(fileName) {
  if (isElectron) return window.api.deleteFile(fileName);
  const res = await fetch(`/file/${encodeURIComponent(fileName)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
