import { localPdfAssets } from "@/features/resume/pdfOptions";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form-field";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
function PdfPage({ pdf, page, scale, width, height, active }: { pdf: PDFDocumentProxy; page: number; scale: number; width: number; height: number; active: boolean }) {
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const canvas = useRef<HTMLCanvasElement>(null), [error, setError] = useState("");
  useEffect(() => {
    const target = canvas.current;
    if (!active || !target) return;
    target.dataset.renderState = "loading";
    target.setAttribute("aria-busy", "true");
    let live = true, cancel: (() => void) | undefined;
    pending.current = pending.current.catch(() => undefined).then(() => pdf.getPage(page)).then(item => {
      if (!live) return;
      const context = target.getContext("2d"); if (!context) return;
      const viewport = item.getViewport({ scale });
      const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4000000 / (viewport.width * viewport.height)));
      target.width = Math.ceil(viewport.width * density); target.height = Math.ceil(viewport.height * density);
      target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
      const task = item.render({ canvas: target, canvasContext: context, viewport, transform: [density, 0, 0, density, 0, 0] });
      cancel = () => task.cancel(); return task.promise.then(() => { if (live) { target.dataset.renderState = "ready"; target.setAttribute("aria-busy", "false"); setError(""); } });
    }).catch(cause => { if (live && cause.name !== "RenderingCancelledException") setError("This PDF page could not be displayed."); });
    return () => { live = false; cancel?.(); delete target.dataset.renderState; target.width = 0; target.height = 0; };
  }, [pdf, page, scale, active]);
  return <div className="rw-pdf-page" data-pdf-page={page} style={{ width, height }}>{error ? <p role="alert">{error}</p> : active ? <canvas ref={canvas} role="img" aria-label={`Resume PDF, page ${page} of ${pdf.numPages}. Download the PDF for accessible document text.`} /> : <span className="rw-page-placeholder">Page {page}</span>}</div>;
}
export default function PdfPreview({ blob, controlsTarget }: { blob: Blob | null; controlsTarget?: HTMLElement | null }) {
  const container = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null), [base, setBase] = useState({ width: 595, height: 842 });
  const [page, setPage] = useState(1), [zoom, setZoom] = useState<number | null>(null), [width, setWidth] = useState(460), [error, setError] = useState("");
  const [visible, setVisible] = useState<Set<number>>(new Set([1]));
  useEffect(() => {
    const root = container.current; if (!root) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width - 40)));
    observer.observe(root); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true, dispose: (() => void) | undefined;
    setPdf(null); setError(""); setPage(1); setVisible(new Set([1]));
    if (blob) void (async () => {
      const module = await import("pdfjs-dist"); module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const data = new Uint8Array(await blob.arrayBuffer()); if (!active) return;
      const task = module.getDocument({ data, ...localPdfAssets(), useSystemFonts: false });
      dispose = () => { void task.destroy().catch(() => undefined); };
      const document = await task.promise;
      const first = await document.getPage(1), size = first.getViewport({ scale: 1 });
      if (active) { setBase({ width: size.width, height: size.height }); setPdf(document); }
    })().catch(() => { if (active) setError("The PDF preview could not be opened. Your draft is unchanged."); });
    return () => { active = false; dispose?.(); };
  }, [blob]);
  useEffect(() => {
    const root = container.current; if (!root || !pdf) return;
    const shown = new Set<number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) { const index = Number((entry.target as HTMLElement).dataset.pdfPage); if (entry.isIntersecting) shown.add(index); else shown.delete(index); }
      setVisible(new Set(shown));
    }, { root, threshold: 0 });
    root.querySelectorAll("[data-pdf-page]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [pdf]);
  const scale = zoom ?? width / base.width, pageWidth = base.width * scale, pageHeight = base.height * scale;
  const rendered = new Set([...visible].flatMap(index => [index - 1, index, index + 1]));
  const jump = (next: number) => { if (!pdf || !Number.isFinite(next)) return; const index = Math.max(1, Math.min(pdf.numPages, next)); setPage(index); container.current?.querySelector(`[data-pdf-page="${index}"]`)?.scrollIntoView({ block: "start" }); };
  const toolbar = <div className="rw-pdf-controls"><Button size="icon" variant="ghost" disabled={!pdf || page === 1} aria-label="Previous PDF page" onClick={() => jump(page - 1)}><ChevronLeft /></Button><Input className="rw-page-input" aria-label="PDF page" type="number" min={1} max={pdf?.numPages ?? 1} value={page} onChange={event => jump(Number(event.target.value))} /><span>/ {pdf?.numPages ?? "–"}</span><Button size="icon" variant="ghost" disabled={!pdf || page === pdf.numPages} aria-label="Next PDF page" onClick={() => jump(page + 1)}><ChevronRight /></Button><Button size="icon" variant="ghost" aria-label="Zoom out" disabled={!pdf || scale <= 0.25} onClick={() => setZoom(Math.max(0.25, scale - 0.1))}><Minus /></Button><NativeSelect aria-label="PDF zoom" value={zoom === null ? "fit" : String(zoom)} onChange={event => setZoom(event.target.value === "fit" ? null : Number(event.target.value))}><option value="fit">Fit width</option>{zoom !== null && ![0.5, 0.75, 1, 1.25, 1.5, 2].includes(zoom) && <option value={zoom}>{Math.round(zoom * 100)}%</option>}{[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option value={value} key={value}>{value * 100}%</option>)}</NativeSelect><Button size="icon" variant="ghost" aria-label="Zoom in" disabled={!pdf || scale >= 2} onClick={() => setZoom(Math.min(2, scale + 0.1))}><Plus /></Button></div>;
  return <div className="rw-pdf">{controlsTarget ? createPortal(toolbar, controlsTarget) : toolbar}<div ref={container} className="rb-preview-scroll rw-pdf-scroll" onScroll={event => { if (pdf) setPage(Math.max(1, Math.min(pdf.numPages, Math.floor((event.currentTarget.scrollTop + 30) / (pageHeight + 24)) + 1))); }}>{error ? <p role="alert">{error}</p> : !pdf ? <p className="rw-preview-empty">{blob ? "Opening PDF…" : "Your RenderCV PDF will appear here."}</p> : <div className="rw-pdf-pages" style={{ minWidth: pageWidth + 40 }}>{Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={index + 1} pdf={pdf} page={index + 1} width={pageWidth} height={pageHeight} scale={scale} active={rendered.has(index + 1)} />)}</div>}</div></div>;
}
