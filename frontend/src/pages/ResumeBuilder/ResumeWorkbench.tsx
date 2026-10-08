import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bold, ChevronsDownUp, ChevronsUpDown, Download, Italic, Link2, Menu, MoreHorizontal, Redo2, Sparkles, Undo2, BookOpen } from "lucide-react";
import AccountMenu from "@/components/account/AccountMenu";
import { useWorkspacePresentation } from "@/components/layout/WorkspacePresentation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormField, Input } from "@/components/ui/form-field";
import { ROUTES } from "@/constants/routes";
import { formatSelection } from "@/features/resume/editorModel";
import type { ResumeDocument } from "@/features/resume/types";
import { MarkdownContext, type MarkdownSelection } from "./MarkdownSelection";
import { ResumeForm, type DocumentChange } from "./ResumeForm";
import ResumeControls from "./ResumeControls";
import YamlEditor from "./YamlEditor";
import PdfPreview from "./PdfPreview";
type Props = {
  document: ResumeDocument; yamlText: string; yamlError: string | null; unappliedYaml: boolean;
  editDocument: DocumentChange; editYaml: (value: string) => void; addSection: () => void; removeSection: (title: string) => void;
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
  saveStatus: string; notices: React.ReactNode; pdf: Blob | null; freshPdf: boolean; rendering: boolean;
  renderError: string; retryRender: () => void; downloadPdf: () => void; downloadYaml: () => void;
  target: () => void; courses?: () => void; more: () => void;
};
export default function ResumeWorkbench(props: Props) {
  const workspace = useWorkspacePresentation();
  const root = useRef<HTMLDivElement>(null), split = useRef<HTMLDivElement>(null), divider = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState("cv"), [yamlMode, setYamlMode] = useState(false), [mobile, setMobile] = useState("edit");
  const [workspaceWidth, setWorkspaceWidth] = useState(1000), [ratio, setRatio] = useState(50), [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pdfControls, setPdfControls] = useState<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<(MarkdownSelection & { document: ResumeDocument }) | null>(null), [linkOpen, setLinkOpen] = useState(false), [url, setUrl] = useState(""), [linkError, setLinkError] = useState("");
  const linkSelection = useRef<MarkdownSelection | null>(null);
  useEffect(() => {
    const element = root.current; if (!element) return;
    const observer = new ResizeObserver(entries => setWorkspaceWidth(entries[0].contentRect.width));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const narrow = workspaceWidth < 900;
  const effectiveRatio = narrow ? 50 : Math.min(100 - 327 / workspaceWidth * 100, Math.max(360 / workspaceWidth * 100, ratio));
  const canFormat = tab === "cv" && !yamlMode && !props.unappliedYaml && Boolean(selection && selection.document === props.document && selection.start < selection.end && selection.element.isConnected);
  const applyFormat = (kind: "bold" | "italic" | "link", target: MarkdownSelection | null = selection, address = "") => {
    if (!target || !target.element.isConnected) return;
    const result = formatSelection(target.text, target.start, target.end, kind, address);
    target.commit(result.text);
    requestAnimationFrame(() => { target.element.focus(); target.element.setSelectionRange(result.start, result.end); });
  };
  const adjust = (value: number) => {
    const width = workspaceWidth;
    setRatio(Math.min(100 - 327 / width * 100, Math.max(360 / width * 100, value)));
  };
  const allTitles = ["@personal", ...Object.keys(props.document.cv.sections ?? {})];
  const allCollapsed = allTitles.every(title => collapsed.has(title));
  return <div ref={root} className={`rw-workbench ${narrow ? `rw-narrow rw-show-${mobile}` : ""}`} onKeyDownCapture={event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y") { event.preventDefault(); event.stopPropagation(); if (event.shiftKey || event.key.toLowerCase() === "y") props.redo(); else props.undo(); }
    else if (canFormat && ["b", "i"].includes(event.key.toLowerCase())) { event.preventDefault(); applyFormat(event.key.toLowerCase() === "b" ? "bold" : "italic"); }
  }}>
    <header className="rw-toolbar">
      <div className="rw-toolbar-brand"><Button variant="ghost" size="icon" aria-label="Open workspace menu" aria-expanded={workspace.menuOpen} onClick={workspace.toggleMenu}><Menu /></Button><Link to={ROUTES.possibilities} className="rw-return" aria-label="Return to Possibilities"><ArrowLeft size={16} /><span>Possibilities</span></Link><span className="rw-toolbar-title">Resume</span></div>
      <div className="rw-toolbar-tools" role="group" aria-label="Resume editor tools">
        <Button variant="ghost" size="icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!props.canUndo} onClick={props.undo}><Undo2 /></Button><Button variant="ghost" size="icon" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!props.canRedo} onClick={props.redo}><Redo2 /></Button>
        <Button variant="ghost" size="icon" aria-label={allCollapsed ? "Expand all sections" : "Collapse all sections"} disabled={yamlMode || tab !== "cv"} onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allTitles))}>{allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}</Button>
        <span className="rw-tool-divider" />
        <Button variant="ghost" size="icon" aria-label="Bold selection" disabled={!canFormat} onMouseDown={event => event.preventDefault()} onClick={() => applyFormat("bold")}><Bold /></Button><Button variant="ghost" size="icon" aria-label="Italic selection" disabled={!canFormat} onMouseDown={event => event.preventDefault()} onClick={() => applyFormat("italic")}><Italic /></Button><Button variant="ghost" size="icon" aria-label="Insert link" disabled={!canFormat} onMouseDown={event => event.preventDefault()} onClick={() => { linkSelection.current = selection; setUrl(""); setLinkError(""); setLinkOpen(true); }}><Link2 /></Button>
        <Button variant={yamlMode ? "secondary" : "ghost"} size="sm" aria-pressed={yamlMode} onClick={() => { setYamlMode(value => !value); setSelection(null); }}>YAML</Button>
      </div>
      <div className="rw-toolbar-actions"><span className="rw-save" role="status">{props.saveStatus || "Local draft"}</span><Button variant="ghost" size="sm" onClick={props.target}><Sparkles /><span>Target & AI</span></Button>{props.courses && <Button variant="ghost" size="sm" onClick={props.courses}><BookOpen />Courses</Button>}<Button variant="outline" size="sm" disabled={!props.freshPdf} onClick={props.downloadPdf}><Download />PDF</Button><Button variant="ghost" size="icon" aria-label="Resume options" onClick={props.more}><MoreHorizontal /></Button><AccountMenu iconOnly /></div>
    </header>
    {props.notices && <div className="rw-notices">{props.notices}</div>}
    <div className="rw-pane-toolbar">
      <Tabs value={tab} onValueChange={value => { setTab(value); setSelection(null); }}><TabsList aria-label="Resume tools">{["cv", "design", "settings"].map(value => <TabsTrigger key={value} value={value}>{value === "cv" ? "CV" : value[0].toUpperCase() + value.slice(1)}</TabsTrigger>)}</TabsList></Tabs>
      {narrow && <Tabs value={mobile} onValueChange={setMobile}><TabsList aria-label="Mobile resume workspace"><TabsTrigger value="edit">Edit</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList></Tabs>}
      <div className="rw-pdf-toolbar-slot" ref={setPdfControls} />
    </div>
    <div className="rw-split" ref={split} style={{ "--editor-width": `${effectiveRatio}%` } as React.CSSProperties}>
      <section className="rw-edit-pane" aria-label="Resume editing"><div className="rw-edit-scroll">
        {yamlMode ? <><YamlEditor value={props.yamlText} onChange={props.editYaml} />{props.yamlError && <div className="rb-error rw-yaml-error" role="alert">{props.yamlError}</div>}</> : <><fieldset disabled={props.unappliedYaml}>{props.yamlError && !props.unappliedYaml && <div className="rb-error" role="alert">{props.yamlError}</div>}{props.unappliedYaml && <div className="rb-warning" role="alert">Fix the pending YAML before editing the form. Your text and last valid PDF are retained.</div>}<MarkdownContext.Provider value={next => setSelection(next ? { ...next, document: props.document } : null)}>{tab === "cv" ? <ResumeForm document={props.document} change={props.editDocument} add={props.addSection} remove={props.removeSection} collapsed={collapsed} toggle={title => setCollapsed(old => { const next = new Set(old); if (next.has(title)) next.delete(title); else next.add(title); return next; })} /> : <ResumeControls document={props.document} section={tab as "design" | "settings"} change={props.editDocument} />}</MarkdownContext.Provider></fieldset></>}
      </div></section>
      <div ref={divider} role="separator" tabIndex={narrow ? -1 : 0} aria-label="Resize editor and preview" aria-orientation="vertical" aria-valuemin={Math.ceil(360 / workspaceWidth * 100)} aria-valuemax={Math.floor(100 - 327 / workspaceWidth * 100)} aria-valuenow={Math.round(effectiveRatio)} className="rw-separator" onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) { event.preventDefault(); adjust(event.key === "Home" ? 50 : effectiveRatio + (event.key === "ArrowLeft" ? -2 : 2)); } }} onPointerDown={event => { if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const bounds = split.current?.getBoundingClientRect(); if (bounds) adjust((event.clientX - bounds.left) / bounds.width * 100); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
      <section className="rw-preview-pane" aria-label="Resume PDF preview"><div className="rw-preview-status"><span role="status">{props.rendering ? "Rendering…" : props.freshPdf ? "Up to date" : props.pdf ? "Last valid preview" : "RenderCV preview"}</span><Button variant="link" size="sm" onClick={props.downloadYaml}>Download YAML</Button></div>{props.renderError && <div className="rb-error" role="alert">{props.renderError}<Button variant="link" size="sm" onClick={props.retryRender}>Retry rendering</Button></div>}<PdfPreview blob={props.pdf} controlsTarget={pdfControls} /></section>
    </div>
    <Dialog open={linkOpen} onOpenChange={setLinkOpen}><DialogContent><DialogHeader><DialogTitle>Insert link</DialogTitle><DialogDescription>Link the selected text to a web address, email or phone number.</DialogDescription></DialogHeader><FormField label="Link URL"><Input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" /></FormField>{linkError && <p role="alert" className="rb-error">{linkError}</p>}<DialogFooter><Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button><Button onClick={() => { try { applyFormat("link", linkSelection.current, url.trim()); setLinkOpen(false); } catch (cause) { setLinkError(cause instanceof Error ? cause.message : "Enter a safe link."); } }}>Insert link</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
