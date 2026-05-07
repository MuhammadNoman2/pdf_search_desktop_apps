const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// In Electron, main.js sets PDF_DB_DIR before requiring this module
const dbDir  = process.env.PDF_DB_DIR || path.join(__dirname, "../../data");
const DB_PATH = path.join(dbDir, "search.db");

fs.mkdirSync(dbDir, { recursive: true });

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS documents USING fts5(
      content,
      file_path,
      page_number UNINDEXED,
      file_name UNINDEXED,
      tokenize = "porter ascii"
    );
  `);
}

function insertPageChunks(chunks) {
  const insert = getDB().prepare(`
    INSERT INTO documents (content, file_path, page_number, file_name)
    VALUES (@content, @file_path, @page_number, @file_name)
  `);

  const insertMany = getDB().transaction((items) => {
    for (const item of items) insert.run(item);
  });

  insertMany(chunks);
}

// Common English words that add noise but don't help FTS matching
const STOP_WORDS = new Set([
  "find","show","get","give","list","display","search","look","tell","me",
  "the","a","an","is","are","was","were","be","been","being",
  "in","on","at","to","for","of","and","or","with","by","from","named","called"
]);

function buildFtsQuery(query) {
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  if (!words.length) return null;

  // Each word as a prefix search (word*) joined with OR for broad recall
  return words.map((w) => `"${w.replace(/"/g, '""')}"*`).join(" OR ");
}

function searchDocuments(query) {
  const ftsQuery = buildFtsQuery(query);
  console.log(`[SEARCH] query="${query}" → fts="${ftsQuery}"`);

  if (!ftsQuery) return [];

  try {
    return getDB()
      .prepare(
        `SELECT file_name, file_path, page_number,
                snippet(documents, 0, '<mark>', '</mark>', '...', 32) AS snippet
         FROM documents
         WHERE documents MATCH ?
         ORDER BY rank
         LIMIT 50`
      )
      .all(ftsQuery);
  } catch (err) {
    console.error("[SEARCH] FTS error:", err.message);
    return [];
  }
}

function deleteByFilePath(filePath) {
  getDB()
    .prepare("DELETE FROM documents WHERE file_path = ?")
    .run(filePath);
}

function listIndexedFiles() {
  return getDB()
    .prepare("SELECT DISTINCT file_name, file_path FROM documents")
    .all();
}

module.exports = { getDB, insertPageChunks, searchDocuments, deleteByFilePath, listIndexedFiles };
