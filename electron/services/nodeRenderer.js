/**
 * Pure Node.js PDF-page renderer using pdfjs-dist (ESM) + canvas npm package.
 * Replaces the pdftoppm binary dependency for a self-contained packaged app.
 */

const { createCanvas } = require("canvas");
const fs   = require("fs");
const path = require("path");

// ── DOMMatrix polyfill required by pdfjs-dist in Node.js ─────────────────────
class DOMMatrix {
  constructor(init) {
    this.a=1; this.b=0; this.c=0; this.d=1; this.e=0; this.f=0;
    this.m11=1; this.m12=0; this.m13=0; this.m14=0;
    this.m21=0; this.m22=1; this.m23=0; this.m24=0;
    this.m31=0; this.m32=0; this.m33=1; this.m34=0;
    this.m41=0; this.m42=0; this.m43=0; this.m44=1;
    this.is2D = true; this.isIdentity = true;
    if (Array.isArray(init) && init.length === 6) {
      [this.a,this.b,this.c,this.d,this.e,this.f] = init;
      this.m11=this.a; this.m12=this.b;
      this.m21=this.c; this.m22=this.d;
      this.m41=this.e; this.m42=this.f;
      this.isIdentity = false;
    }
  }
  multiply(o) {
    return new DOMMatrix([
      this.a*o.a + this.b*o.c,
      this.a*o.b + this.b*o.d,
      this.c*o.a + this.d*o.c,
      this.c*o.b + this.d*o.d,
      this.e*o.a + this.f*o.c + o.e,
      this.e*o.b + this.f*o.d + o.f,
    ]);
  }
  translate(tx, ty) {
    return new DOMMatrix([this.a,this.b,this.c,this.d,
      this.e + tx*this.a + ty*this.c,
      this.f + tx*this.b + ty*this.d]);
  }
  scale(sx, sy=sx) {
    return new DOMMatrix([this.a*sx,this.b*sx,this.c*sy,this.d*sy,this.e,this.f]);
  }
  transformPoint(p) {
    return { x: p.x*this.a + p.y*this.c + this.e,
             y: p.x*this.b + p.y*this.d + this.f };
  }
  toString() {
    return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`;
  }
}

// Promise.withResolvers — added in Node.js v22, polyfill for v20
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

// Promise.try — added in Node.js v22, polyfill for v20
if (!Promise.try) {
  Promise.try = function (fn, ...args) {
    return new Promise((resolve, reject) => {
      try { resolve(fn(...args)); } catch (e) { reject(e); }
    });
  };
}

// Install polyfills into global scope for pdfjs-dist
if (!globalThis.DOMMatrix)  globalThis.DOMMatrix = DOMMatrix;
if (!globalThis.ImageData)  globalThis.ImageData  = class ImageData { constructor(d,w,h){ this.data=d;this.width=w;this.height=h; } };
if (!globalThis.document)   globalThis.document   = { createElement: (tag) => tag === "canvas" ? createCanvas(1,1) : {} };
if (!globalThis.window)     globalThis.window     = globalThis;
if (!globalThis.navigator)  globalThis.navigator  = { userAgent: "node" };
if (!globalThis.Path2D)     globalThis.Path2D     = class Path2D { constructor(d){ this._d=d||""; } };
if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
if (!globalThis.cancelAnimationFrame)  globalThis.cancelAnimationFrame  = clearTimeout;

// ── Canvas factory for pdfjs-dist ─────────────────────────────────────────────
class NodeCanvasFactory {
  create(width, height) {
    const canvas  = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(pair, width, height) {
    pair.canvas.width  = width;
    pair.canvas.height = height;
  }
  destroy(pair) {
    pair.canvas.width  = 0;
    pair.canvas.height = 0;
  }
}

// pdfjs-dist v3 has proper CJS support via the legacy build
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
pdfjsLib.GlobalWorkerOptions.workerSrc = false; // disable worker in Node.js

/**
 * Render every page of a PDF buffer to PNG Buffers.
 * @param {Buffer} pdfBuffer
 * @param {number} scale  e.g. 2.0 for good OCR quality
 * @returns {Promise<Buffer[]>} array of PNG buffers, one per page
 */
async function renderPdfToImages(pdfBuffer, scale = 2.0) {
  const factory = new NodeCanvasFactory();

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    canvasFactory: factory,
    verbosity: 0,
  }).promise;

  const images = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const pair     = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));

    await page.render({
      canvasContext: pair.context,
      viewport,
      canvasFactory: factory,
    }).promise;

    images.push(pair.canvas.toBuffer("image/png"));
    factory.destroy(pair);
  }

  return images;
}

module.exports = { renderPdfToImages };
