const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { parsePDF } = require("./services/pdfService");
const { searchDocuments, listIndexedFiles, deleteByFilePath } = require("./services/db/database");

const app = express();
const PORT = 3001;

const UPLOADS_DIR = path.join(__dirname, "../uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

// --- multer storage: keep original filename ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// ── POST /upload ─────────────────────────────────────────────────────────────
app.post("/upload", (req, res, next) => {
  upload.array("pdfs")(req, res, (multerErr) => {
    if (multerErr) {
      console.error("[UPLOAD] Multer error:", multerErr);
      return res.status(400).json({ error: multerErr.message });
    }
    next();
  });
}, async (req, res) => {
  console.log("[UPLOAD] Files received:", req.files?.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })));

  if (!req.files || req.files.length === 0) {
    console.error("[UPLOAD] No files in request");
    return res.status(400).json({ error: "No PDF files uploaded" });
  }

  const results = [];

  for (const file of req.files) {
    console.log(`[UPLOAD] Processing: ${file.originalname} → ${file.path}`);
    try {
      const { pages, fileName } = await parsePDF(file.path);
      console.log(`[UPLOAD] OK: ${fileName}, ${pages} page(s) indexed`);
      results.push({ fileName, pages, status: "ok" });
    } catch (err) {
      console.error(`[UPLOAD] FAILED: ${file.originalname}`);
      console.error(`[UPLOAD] Error name: ${err.name}`);
      console.error(`[UPLOAD] Error message: ${err.message}`);
      console.error(`[UPLOAD] Stack:`, err.stack);
      results.push({ fileName: file.originalname, status: "error", message: err.message });
    }
  }

  res.json({ results });
});

// ── GET /search ───────────────────────────────────────────────────────────────
app.get("/search", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Query is required" });

  try {
    const results = searchDocuments(q);
    res.json({ query: q, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /pdf/:filename ────────────────────────────────────────────────────────
app.get("/pdf/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.sendFile(filePath);
});

// ── GET /files ────────────────────────────────────────────────────────────────
app.get("/files", (_req, res) => {
  const files = listIndexedFiles();
  res.json({ files });
});

// ── DELETE /file/:filename ────────────────────────────────────────────────────
app.delete("/file/:filename", (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, fileName);

  // Remove from DB
  deleteByFilePath(filePath);

  // Remove file from disk
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  console.log(`[DELETE] Removed: ${fileName}`);
  res.json({ ok: true, fileName });
});

// ── GET /debug/content — shows first 300 chars per page in DB (dev only) ─────
app.get("/debug/content", (_req, res) => {
  const { getDB } = require("./services/db/database");
  const rows = getDB()
    .prepare("SELECT file_name, page_number, substr(content,1,300) AS preview FROM documents ORDER BY file_name, page_number")
    .all();
  res.json(rows);
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`PDF Search backend running at http://localhost:${PORT}`);
});

module.exports = app;
