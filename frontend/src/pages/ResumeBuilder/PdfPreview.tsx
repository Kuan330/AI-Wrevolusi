import { localPdfAssets } from "@/features/resume/pdfOptions";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
export default function PdfPreview({ blob }: { blob: Blob | null }) {
  const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1), [zoom, setZoom] = useState(1), [width, setWidth] = useState(460), [error, setError] = useState("");
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width - 32)));
    observer.observe(container.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    setPdf(null); setError(""); setPage(1);
    if (blob) void (async () => {
      const module = await import("pdfjs-dist");
      module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const data = new Uint8Array(await blob.arrayBuffer());
      if (!active) return;
      const task = module.getDocument({ ...localPdfAssets(), data });
      dispose = () => { void task.destroy(); };
      try { const doc = await task.promise; if (active) setPdf(doc); }
      catch { if (active) setError("The PDF preview could not be opened. You can still download the generated PDF."); }
    })().catch(() => { if (active) setError("The PDF preview could not start. Reload to try again."); });
    return () => { active = false; dispose?.(); };
  }, [blob]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    const target = canvas.current;
    let active = true;
    let cancel: (() => void) | undefined;
    void pdf.getPage(page).then(item => {
      if (!active) return;
      const context = target.getContext("2d"); if (!context) return;
      const base = item.getViewport({ scale: 1 });
      const viewport = item.getViewport({ scale: Math.min(1, width / base.width) * zoom });
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.floor(viewport.width * scale); target.height = Math.floor(viewport.height * scale);
      target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
      const render = item.render({ canvas: target, canvasContext: context, viewport, transform: [scale, 0, 0, scale, 0, 0] });
      cancel = () => render.cancel();
      return render.promise;
    }).catch(error => { if (active && error.name !== "RenderingCancelledException") setError("This preview page could not be displayed."); });
    return () => { active = false; cancel?.(); };
  }, [pdf, page, width, zoom]);
  return <div className="rb-pdf"><div className="rb-preview-controls"><div><Button size="icon" variant="ghost" disabled={!pdf || page === 1} aria-label="Previous PDF page" onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{pdf ? `${page} / ${pdf.numPages}` : "PDF preview"}</span><Button size="icon" variant="ghost" disabled={!pdf || page === pdf.numPages} aria-label="Next PDF page" onClick={() => setPage(page + 1)}><ChevronRight /></Button></div><div><Button size="icon" variant="ghost" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}><Minus /></Button><span>{Math.round(zoom * 100)}%</span><Button size="icon" variant="ghost" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(Math.min(2, zoom + 0.1))}><Plus /></Button></div></div><div ref={container} className="rb-preview-scroll">{error ? <p role="alert">{error}</p> : !pdf ? <div className="rb-preview-empty"><div className="rb-paper-icon">CV</div><h3>Your resume, beautifully typeset</h3><p>{blob ? "Opening PDF…" : "Generate a draft or add your details. Your actual RenderCV PDF will appear here."}</p></div> : <canvas ref={canvas} role="img" aria-label={`Resume PDF, page ${page} of ${pdf.numPages}. Download the PDF for accessible document text.`} />}</div></div>;
}
