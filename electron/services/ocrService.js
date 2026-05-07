const fs = require("fs");
const os = require("os");
const path = require("path");
const Tesseract = require("tesseract.js");
const { renderPdfToImages } = require("./nodeRenderer");

// Returns the path where Tesseract language data lives.
// In a packaged Electron app it lives in resources/tessdata.
function getLangPath() {
  try {
    const { app } = require("electron");
    if (app && app.isPackaged) {
      return path.join(process.resourcesPath, "tessdata");
    }
  } catch (_) { /* not running in Electron */ }
  return undefined; // Tesseract.js downloads on first run in dev mode
}

async function ocrPDF(filePath) {
  console.log(`[OCR] Reading PDF: ${filePath}`);
  const pdfBuffer = fs.readFileSync(filePath);

  console.log(`[OCR] Rendering pages to images (pure Node.js)…`);
  const images = await renderPdfToImages(pdfBuffer, 2.0);
  console.log(`[OCR] Rendered ${images.length} page image(s)`);

  const langPath = getLangPath();
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: () => {},
    ...(langPath ? { langPath } : {}),
  });

  const pageTexts = [];
  for (let i = 0; i < images.length; i++) {
    console.log(`[OCR] Processing page ${i + 1}/${images.length}…`);
    const { data } = await worker.recognize(images[i]);
    pageTexts.push(data.text.trim());
  }

  await worker.terminate();
  console.log(`[OCR] Done. Total chars: ${pageTexts.reduce((s, t) => s + t.length, 0)}`);
  return pageTexts;
}

function isScanned(pageTexts) {
  if (!pageTexts.length) return true;
  const avg = pageTexts.reduce((s, t) => s + t.length, 0) / pageTexts.length;
  return avg < 50;
}

module.exports = { ocrPDF, isScanned };
