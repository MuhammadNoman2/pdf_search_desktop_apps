const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs   = require("fs");

const isDev = process.env.ELECTRON_DEV === "true";

// ── Data paths (OS-appropriate, writable in production) ──────────────────────
const DATA_DIR    = isDev
  ? path.join(__dirname, "..")          // dev: project root
  : app.getPath("userData");            // prod: ~/Library/Application Support/…

const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DB_DIR      = path.join(DATA_DIR, "data");

// Set env vars BEFORE requiring services so database.js picks them up
process.env.PDF_UPLOADS_DIR = UPLOADS_DIR;
process.env.PDF_DB_DIR      = DB_DIR;

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DB_DIR,      { recursive: true });

// Require services after env vars are set
const { parsePDF }                                         = require("./services/pdfService");
const { searchDocuments, listIndexedFiles, deleteByFilePath } = require("./services/db/database");

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",   // sleek on macOS
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,               // needed for preload to require node modules
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // process.resourcesPath = Contents/Resources; frontend is at Contents/frontend/dist
    win.loadFile(path.join(process.resourcesPath, "../frontend/dist/index.html"));
  }

  // Open external links in the system browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC: Upload PDFs ──────────────────────────────────────────────────────────
// Receives: [{ name: string, path: string }]  — paths set by Electron on File objects
ipcMain.handle("pdf:upload", async (_event, files) => {
  const results = [];

  for (const { name, path: srcPath } of files) {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const destPath = path.join(UPLOADS_DIR, safeName);

    try {
      // Copy from wherever the user picked/dropped it into our managed uploads folder
      if (srcPath !== destPath) fs.copyFileSync(srcPath, destPath);
      const result = await parsePDF(destPath);
      results.push({ fileName: result.fileName, pages: result.pages, ocr: result.ocr, status: "ok" });
    } catch (err) {
      console.error(`[UPLOAD] ${name}:`, err);
      results.push({ fileName: name, status: "error", message: err.message });
    }
  }

  return { results };
});

// ── IPC: Search ───────────────────────────────────────────────────────────────
ipcMain.handle("pdf:search", (_event, query) => {
  const results = searchDocuments(query);
  return { query, count: results.length, results };
});

// ── IPC: Get PDF as ArrayBuffer (for viewer) ──────────────────────────────────
ipcMain.handle("pdf:buffer", (_event, fileName) => {
  const filePath = path.join(UPLOADS_DIR, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${fileName}`);
  const buf = fs.readFileSync(filePath);
  // Transfer as ArrayBuffer — Electron serializes this efficiently
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

// ── IPC: List indexed files ───────────────────────────────────────────────────
ipcMain.handle("files:list", () => {
  return { files: listIndexedFiles() };
});

// ── IPC: Delete file ──────────────────────────────────────────────────────────
ipcMain.handle("files:delete", (_event, fileName) => {
  const filePath = path.join(UPLOADS_DIR, fileName);
  deleteByFilePath(filePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return { ok: true, fileName };
});
