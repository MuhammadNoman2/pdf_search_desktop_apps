const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { insertPageChunks, deleteByFilePath } = require("./db/database");
const { ocrPDF, isScanned } = require("./ocrService");

async function parsePDF(filePath) {
  console.log(`[PDF] Reading: ${filePath}`);
  const dataBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const pageTexts = [];

  // Step 1: extract text with pdf-parse
  await pdfParse(dataBuffer, {
    pagerender: (pageData) =>
      pageData.getTextContent().then((tc) => {
        const text = tc.items.map((item) => item.str).join(" ");
        pageTexts.push(text);
        return text;
      }),
  });

  console.log(`[PDF] Extracted ${pageTexts.length} page(s) via pdf-parse`);

  let finalPages = pageTexts;
  let usedOCR = false;

  // Step 2: if text is too sparse, fall back to OCR
  if (isScanned(pageTexts)) {
    console.log(`[PDF] Sparse text detected — running OCR…`);
    finalPages = await ocrPDF(filePath);
    usedOCR = true;
  }

  const chunks = finalPages
    .map((content, i) => ({
      content: content.trim(),
      file_path: filePath,
      page_number: i + 1,
      file_name: fileName,
    }))
    .filter((c) => c.content.length > 10);

  console.log(`[PDF] Indexable chunks: ${chunks.length} (OCR: ${usedOCR})`);

  if (chunks.length === 0) {
    throw new Error("No text could be extracted, even with OCR");
  }

  deleteByFilePath(filePath);
  insertPageChunks(chunks);
  console.log(`[PDF] Saved to DB`);

  return { pages: chunks.length, fileName, ocr: usedOCR };
}

module.exports = { parsePDF };
