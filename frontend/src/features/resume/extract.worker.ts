import { localPdfAssets } from "./pdfOptions";
import { getDocument, GlobalWorkerOptions, PDFWorker } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { checkDocx } from "./docxArchive";
import { extractRawText } from "mammoth/mammoth.browser.js";
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; kind: "pdf" | "docx" }>) => {
  const { buffer, kind } = event.data;
  try {
    let text = "";
    if (kind === "pdf") {
      // PDF.js's automatic browser worker setup expects window/document.
      // Supply an explicit nested worker port so extraction remains off-thread.
      const port = new Worker(pdfWorkerUrl, { type: "module" });
      const worker = PDFWorker.create({ port });
      const task = getDocument({ ...localPdfAssets(), data: new Uint8Array(buffer), worker,
        useSystemFonts: false, useWorkerFetch: true, disableFontFace: true });
      try {
        const pdf = await task.promise;
        if (pdf.numPages > 20) throw new Error("Resume PDFs must have at most 20 pages.");
        for (let page = 1; page <= pdf.numPages; page++) {
          const content = await (await pdf.getPage(page)).getTextContent();
          let y: number | null = null;
          for (const item of content.items) {
            if (!("str" in item)) continue;
            const nextY = item.transform[5];
            if (y !== null && Math.abs(nextY - y) > 2 && !text.endsWith("\n")) text += "\n";
            text += item.str + (item.hasEOL ? "\n" : " ");
            y = nextY;
          }
          text += "\n";
          if (text.length > 60000) throw new Error("Resume text must be at most 60,000 characters.");
        }
      } finally { await task.destroy(); worker.destroy(); port.terminate(); }
    } else {
      await checkDocx(buffer);
      text = (await extractRawText({ arrayBuffer: buffer })).value;
    }
    if (!text.trim()) throw new Error("No readable text was found. Scanned documents need a text-based export; OCR is not included.");
    if (text.length > 60000) throw new Error("Resume text must be at most 60,000 characters.");
    self.postMessage({ text });
  } catch (cause) {
    const error = cause as Error;
    const message = error.name === "PasswordException" ? "This PDF is encrypted. Upload an unlocked copy; passwords are not collected." :
      /^(Resume |This |No readable)/.test(error.message) ? error.message : "This document could not be read. Upload a valid PDF/DOCX or enter your details manually.";
    self.postMessage({ error: message });
  }
};
