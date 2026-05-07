const { contextBridge, ipcRenderer } = require("electron");

// Expose a safe, typed API to the renderer (window.api)
// The renderer has NO access to Node.js or ipcRenderer directly
contextBridge.exposeInMainWorld("api", {
  isElectron: true,

  // Upload PDFs: accepts [{ name, buffer }]
  uploadPDFs: (files) => ipcRenderer.invoke("pdf:upload", files),

  // Full-text search
  search: (query) => ipcRenderer.invoke("pdf:search", query),

  // Get PDF as ArrayBuffer for the in-app viewer
  getPdfBuffer: (fileName) => ipcRenderer.invoke("pdf:buffer", fileName),

  // File management
  listFiles: () => ipcRenderer.invoke("files:list"),
  deleteFile: (fileName) => ipcRenderer.invoke("files:delete", fileName),
});
