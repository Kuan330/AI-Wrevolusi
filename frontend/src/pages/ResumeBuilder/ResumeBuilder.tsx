import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUp, ArrowDown, Check, Download, FileText, Plus, ShieldCheck, Sparkles, Trash2, Undo2, Upload } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { useAccount } from "@/components/account/useAccount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { referenceService } from "@/services/referenceService";
import { loadCourseDirectory } from "@/features/learning-planning/courseDirectory";
import { readLibrary } from "@/features/learning-planning/libraryStorage";
import { changeSavedCourses } from "@/features/learning-planning/courseOperations";
import type { Course } from "@/features/learning-planning/types";
import { resumeService, type ResumeCapabilities } from "@/features/resume/service";
import { useResumeDraft } from "@/features/resume/useResumeDraft";
import { mergeResumeSkills, resumeSkillSnapshot } from "@/features/resume/skills";
import { applySections, documentYaml, entryText, moveSection, parseResumeYaml, THEMES } from "@/features/resume/document";
import { importResume, RESUME_ACCEPT } from "@/features/resume/importResume";
import { evidenceFromText, redactResume } from "@/features/resume/redaction";
import { emptyContacts, type Generation, type ResumeDocument, type SkillCandidate } from "@/features/resume/types";
import { ResumeForm, DesignControls } from "./ResumeForm";
import PdfPreview from "./PdfPreview";
import YamlEditor from "./YamlEditor";
import "./resume-builder.css";
const message = (cause: unknown) => cause instanceof Error ? cause.message : "Something went wrong. Your local draft is unchanged.";
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function ResumeBuilder() {
  const { user } = useAccount();
  return user ? <ResumeWorkspace key={user.id} owner={user.id} /> : null;
}
function ResumeWorkspace({ owner }: { owner: string }) {
  const local = useResumeDraft(owner), { draft, change } = local;
  const [skills, setSkills] = useState<SkillCandidate[]>([]), [skillError, setSkillError] = useState("");
  const [capabilities, setCapabilities] = useState<ResumeCapabilities | null>(null);
  const [error, setError] = useState(""), [generating, setGenerating] = useState(false), [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showJob, setShowJob] = useState(false), [showClear, setShowClear] = useState(false), [showTarget, setShowTarget] = useState(false);
  const [selectedKey, setSelected] = useState("Skills"), [tool, setTool] = useState("sections"), [mode, setMode] = useState("form"), [mobile, setMobile] = useState("edit");
  const [newSection, setNewSection] = useState(""), [addingSection, setAddingSection] = useState(false), [removeSection, setRemoveSection] = useState("");
  const [accepted, setAccepted] = useState<string[]>([]);
  const [pdf, setPdf] = useState<Blob | null>(null), [pdfKey, setPdfKey] = useState(""), [rendering, setRendering] = useState(false), [renderError, setRenderError] = useState(""), [renderRetry, setRenderRetry] = useState(0);
  const [directory, setDirectory] = useState<Map<string, Course>>(new Map()), [selectedCourses, setSelectedCourses] = useState<string[]>([]), [savedCourses, setSavedCourses] = useState<string[]>([]), [courseNotice, setCourseNotice] = useState(""), [savingCourses, setSavingCourses] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null), controllers = useRef(new Set<AbortController>()), mounted = useRef(true), run = useRef(0), busy = useRef(false);
  const session = useRef(currentWorkspaceSession());
  const isCurrent = () => mounted.current && session.current === currentWorkspaceSession();
  const controller = () => { const next = new AbortController(); controllers.current.add(next); return next; };
  const abortRequests = () => { run.current++; for (const item of controllers.current) item.abort(); controllers.current.clear(); busy.current = false; };
  const yaml = useMemo(() => parseResumeYaml(draft.yamlText), [draft.yamlText]);
  const unappliedYaml = Boolean(draft.document && yaml.error && draft.yamlText !== documentYaml(draft.document));
  const previewDocument = useMemo(() => {
    const candidate = yaml.document ?? draft.previewDocument ?? draft.document;
    return candidate ? parseResumeYaml(documentYaml(candidate)).document : null;
  }, [yaml.document, draft.previewDocument, draft.document]);
  const fingerprint = previewDocument ? JSON.stringify(previewDocument) : "";
  const freshPdf = Boolean(pdf && pdfKey === fingerprint && !yaml.error);
  const sections = Object.keys(draft.document?.cv.sections ?? {});
  const selected = selectedKey === "@personal" || sections.includes(selectedKey) ? selectedKey : sections[0] ?? "@personal";
  const source = draft.source;
  const reviewedFacts = useMemo(() => {
    try { return source?.reviewed ? evidenceFromText(redactResume(source.redactedText, source.contacts)) : []; }
    catch { return []; }
  }, [source]);
  const candidates = useMemo(() => mergeResumeSkills([skills,
    source?.reviewed ? (source.skillsText ?? (source.skills ?? []).join(", ")).split(/[,;\n]/).flatMap(name => {
      const safe = redactResume(name, source.contacts).trim();
      return safe && !safe.includes("[REDACTED]") ? [{ id: safe, name: safe }] : [];
    }) : [],
  ]), [skills, source]);
  useEffect(() => {
    mounted.current = true;
    const request = controller();
    void resumeService.capabilities(request.signal).then(result => { if (isCurrent()) setCapabilities(result); }).catch(() => undefined);
    const readSkills = () => { void referenceService.wefSkills().then(reference => {
      if (!isCurrent()) return;
      try { setSkills(resumeSkillSnapshot(reference)); setSkillError(""); }
      catch (cause) { setSkillError(message(cause)); }
    }); };
    const readCourses = () => { if (isCurrent()) try { setSavedCourses(readLibrary().saved); } catch (cause) { setCourseNotice(message(cause)); } };
    readSkills(); readCourses();
    window.addEventListener("workspace-change", readSkills); window.addEventListener("workspace-change", readCourses);
    return () => { mounted.current = false; abortRequests(); window.removeEventListener("workspace-change", readSkills); window.removeEventListener("workspace-change", readCourses); };
    // Requests are scoped to this mounted account, not to individual form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  useEffect(() => {
    if (!fingerprint) { setRendering(false); return; }
    const request = controller();
    setRendering(true); setRenderError("");
    const timer = setTimeout(() => {
      void resumeService.render(JSON.parse(fingerprint), request.signal).then(blob => {
        if (isCurrent() && !request.signal.aborted) { setPdf(blob); setPdfKey(fingerprint); setRenderError(""); change(old => ({ ...old, previewDocument: JSON.parse(fingerprint) })); }
      }).catch(cause => { if (isCurrent() && !request.signal.aborted) setRenderError(message(cause)); })
        .finally(() => { controllers.current.delete(request); if (isCurrent() && !request.signal.aborted) setRendering(false); });
    }, 700);
    return () => { clearTimeout(timer); request.abort(); controllers.current.delete(request); };
    // fingerprint owns the exact document version sent for preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, renderRetry]);
  useEffect(() => {
    if (!draft.recommendations.length) { setDirectory(new Map()); return; }
    let active = true;
    void loadCourseDirectory().then(result => { if (active && isCurrent()) setDirectory(result); }).catch(() => { if (active) setDirectory(new Map()); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.recommendations]);
  const editDocument = (next: ResumeDocument) => change(old => ({ ...old, document: next, yamlText: documentYaml(next) }));
  const getRecommendations = async (result: Generation, job: string, token: number) => {
    if (!result.gaps.length) return;
    const request = controller();
    try {
      const response = await resumeService.courses(result.gaps, request.signal);
      if (isCurrent() && token === run.current && !request.signal.aborted) change(old => old.jobRequirements === job ? { ...old, recommendations: response.courses } : old);
    } catch { /* Optional, intentionally silent. */ }
    finally { controllers.current.delete(request); }
  };
  const generate = async (targetConfirmed = false) => {
    if (busy.current || !draft.pendingJobRequirements.trim()) return;
    if (draft.document && draft.jobRequirements !== draft.pendingJobRequirements.trim() && !targetConfirmed) { setShowTarget(true); return; }
    if (candidates.length > 250 || candidates.some(skill => skill.name.length > 160 || skill.id.length > 160)) { setError("Use at most 250 skill names, each at most 160 characters."); return; }
    if (skillError) { setError(skillError); return; }
    if (source && !source.reviewed) { setError("Review and redact the resume text, then confirm it before sending anything to AI."); return; }
    const job = draft.pendingJobRequirements.trim(), token = ++run.current;
    const request = controller(); busy.current = true; setGenerating(true); setError(""); setShowTarget(false);
    try {
      const evidence = source ? evidenceFromText(redactResume(source.redactedText, source.contacts)) : [];
      const result = await resumeService.generate(job, candidates, evidence, Boolean(source?.reviewed), request.signal);
      if (!isCurrent() || request.signal.aborted || token !== run.current) return;
      if (draft.document) {
        setAccepted([]); change(old => ({ ...old, proposal: { ...result, jobRequirements: job } }));
      } else {
        const document = applySections(null, result.sections, source?.contacts);
        change(old => ({ ...old, document, yamlText: documentYaml(document), jobRequirements: job, pendingJobRequirements: job, gaps: result.gaps, recommendations: [], proposal: null }));
        setShowJob(false); setSelected("Skills"); void getRecommendations(result, job, token);
      }
    } catch (cause) { if (isCurrent() && !request.signal.aborted) setError(message(cause)); }
    finally { controllers.current.delete(request); if (isCurrent() && token === run.current) { busy.current = false; setGenerating(false); } }
  };
  const applyProposal = () => {
    const proposal = draft.proposal;
    if (!proposal || !draft.document || !accepted.length) return;
    if (unappliedYaml) { setError("Correct the pending YAML before applying AI suggestions."); return; }
    const next = applySections(draft.document, proposal.sections.filter(section => accepted.includes(section.title)));
    change(old => ({ ...old, previous: { document: old.document!, yamlText: old.yamlText, jobRequirements: old.jobRequirements }, document: next, yamlText: documentYaml(next), jobRequirements: proposal.jobRequirements, pendingJobRequirements: proposal.jobRequirements, gaps: proposal.gaps, recommendations: [], proposal: null }));
    void getRecommendations(proposal, proposal.jobRequirements, run.current); setShowJob(false);
  };
  const attach = async (file: File) => {
    if (busy.current) return;
    const request = controller(); busy.current = true; setImporting(true); setError("");
    try { const imported = await importResume(file, request.signal); if (isCurrent() && !request.signal.aborted) { change(old => ({ ...old, source: imported })); setShowJob(true); } }
    catch (cause) { if (isCurrent() && !request.signal.aborted) setError(message(cause)); }
    finally { controllers.current.delete(request); if (isCurrent()) { busy.current = false; setImporting(false); } }
  };
  const courses = draft.recommendations.flatMap(recommendation => { const course = directory.get(recommendation.course_id); return course ? [{ course, recommendation }] : []; });
  const availableCourseIds = courses.filter(({ course }) => !savedCourses.includes(course.id)).map(({ course }) => course.id);
  const addCourses = async () => {
    const ids = selectedCourses.filter(id => availableCourseIds.includes(id));
    if (!ids.length || savingCourses) return;
    setSavingCourses(true); setCourseNotice("");
    try {
      const result = await changeSavedCourses({ add: ids });
      if (isCurrent()) { setSavedCourses(result.library.saved); setSelectedCourses([]); setCourseNotice("Added to My courses. Account sync may still be pending."); }
    } catch (cause) { if (isCurrent()) setCourseNotice(message(cause)); }
    finally { if (isCurrent()) setSavingCourses(false); }
  };
  const createEmpty = () => {
    if (!draft.pendingJobRequirements.trim() || busy.current) return;
    const document: ResumeDocument = { cv: { sections: { Skills: [] } }, design: { theme: "engineeringresumes" } };
    change(old => ({ ...old, document, yamlText: documentYaml(document), jobRequirements: old.pendingJobRequirements.trim() })); setShowJob(false);
  };
  if (local.loading || clearing) return <div className="rb-page" role="status">{clearing ? "Clearing your local resume…" : "Loading your local resume…"}</div>;
  return <div className="rb-page">
    <Link className="rb-back" to={ROUTES.possibilities}><ArrowLeft size={15} />Possibilities <span>/ Resume builder</span></Link>
    <PageHeader title="Make your next move." description="A resume grounded in your skills. Tailored to the role you want." actions={<div className="rb-header-actions">{draft.document && <Button variant="outline" onClick={() => setShowJob(!showJob)}><Sparkles />Target & AI</Button>}<Button variant="ghost" size="icon" aria-label="Clear local resume data" onClick={() => setShowClear(true)}><Trash2 /></Button></div>} />
    <div className="rb-status-line"><span><ShieldCheck size={14} />Local-first · no resume database</span><span role="status">{local.saveStatus || "Only this browser, on this device"}</span></div>
    {local.storageError && <div className="rb-warning" role="alert">{local.storageError} Your draft can still be exported; local recovery is not guaranteed.</div>}
    {error && <div className="rb-error" role="alert">{error}</div>}
    {(!draft.document || !draft.jobRequirements.trim() || showJob) && <Card className="rb-job-card">
      <div className="rb-job-heading"><div className="rb-step-mark"><Sparkles /></div><div><p className="rb-eyebrow">START WITH YOUR NEXT ROLE</p><h2>What is the job looking for?</h2><p>Paste the requirements from a job listing. We’ll connect them to your existing skills.</p></div></div>
      <fieldset disabled={generating || importing}><FormField label="Target job requirements · required"><Textarea value={draft.pendingJobRequirements} onChange={event => change(old => ({ ...old, pendingJobRequirements: event.target.value }))} maxLength={20000} rows={7} placeholder="Paste the role’s responsibilities, required skills and qualifications here…" /></FormField>
        <div className="rb-job-meta"><span>{draft.pendingJobRequirements.length.toLocaleString()} / 20,000 characters</span><span>{candidates.length} available skills</span></div>
        {skillError ? <p className="rb-warning">{skillError} <Link to={ROUTES.skills}>Review skills</Link></p> : candidates.length > 0 ? <div className="rb-skill-chips" aria-label="Skills available for tailoring">{candidates.slice(0, 12).map(skill => <span key={skill.id}>{skill.name}</span>)}{candidates.length > 12 && <span>+{candidates.length - 12} more</span>}</div> : <p className="rb-hint">No saved skills yet. <Link to={ROUTES.skills}>Add or confirm your skills</Link>, or provide your own resume details.</p>}
        <div className="rb-source-heading"><div><h3>Bring your existing resume <span>Optional</span></h3><p>Without one, AI generates only your Skills section. It never guesses your background.</p></div><Button variant="outline" onClick={() => fileInput.current?.click()} disabled={importing}><Upload />{source ? "Replace resume" : "Upload resume"}</Button></div>
        <input ref={fileInput} hidden type="file" accept={RESUME_ACCEPT} aria-label="Upload original resume PDF or DOCX" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void attach(file); }} />
        <p className="rb-hint">PDF or DOCX · up to 10 MB · parsed on this device · text PDFs only, no OCR.</p>
        {!source && <Button variant="link" size="sm" onClick={() => change(old => ({ ...old, source: { file: new Blob([]), name: "Manually supplied details", text: "", redactedText: "", contacts: emptyContacts(), reviewed: false } }))}>Or enter your resume details manually</Button>}
        {source && <div className="rb-source-review"><div className="rb-inline"><strong><FileText size={16} />{source.name}</strong><Button variant="ghost" size="sm" onClick={() => change(old => ({ ...old, source: null }))}>Remove source</Button></div>
          <p>Review these suggested personal fields. Correct mistakes and redact any remaining names, addresses or confidential details below. Automatic redaction is not infallible.</p>
          <div className="rb-contact-grid">{Object.entries(source.contacts).map(([key, value]) => <FormField key={key} label={`${key.charAt(0).toUpperCase() + key.slice(1)} · local only`}><Input value={value} onChange={event => change(old => { if (!old.source) return old; const contacts = { ...old.source.contacts, [key]: event.target.value }; return { ...old, source: { ...old.source, contacts, redactedText: redactResume(old.source.redactedText, contacts), reviewed: false } }; })} /></FormField>)}</div>
          <FormField label="Skills explicitly listed in your original resume" hint="Review these local suggestions. Use commas between skill names; include only skills actually in your source. Confirmed names join your existing skill list."><Textarea rows={2} maxLength={13000} value={source.skillsText ?? (source.skills ?? []).join(", ")} onChange={event => change(old => old.source ? { ...old, source: { ...old.source, skillsText: event.target.value, reviewed: false } } : old)} /></FormField>
          <FormField label="Resume evidence that AI will receive" hint="Keep only factual background you want to share. Personal fields above are not sent to AI."><Textarea rows={8} maxLength={60000} value={source.redactedText} onChange={event => change(old => old.source ? { ...old, source: { ...old.source, redactedText: event.target.value, reviewed: false } } : old)} /></FormField>
          <label className="rb-check"><Checkbox checked={source.reviewed} onCheckedChange={checked => change(old => old.source ? { ...old, source: { ...old.source, redactedText: redactResume(old.source.redactedText, old.source.contacts), reviewed: checked === true } } : old)} />I have reviewed this text and removed personal or confidential information I do not want sent to AI.</label>
        </div>}
      </fieldset>
      <div className="rb-ai-disclosure"><ShieldCheck size={17} /><p>Generating sends your job requirements, skills and reviewed evidence to {capabilities ? <strong>{capabilities.ai_provider_host} · {capabilities.ai_model}</strong> : "our explicitly configured AI provider"}. Original files and personal-field mappings stay here. Provider retention policies still apply. Separately, previewing a template temporarily sends the complete resume, including personal fields you choose to include, to our PDF renderer.</p></div>
      {capabilities && !capabilities.ai_configured && <p className="rb-warning">Resume AI is not configured. You can still open an empty template and edit it yourself.</p>}
      <div className="rb-job-footer"><Button disabled={!draft.pendingJobRequirements.trim() || generating || importing || Boolean(skillError) || Boolean(source && !source.reviewed) || (!candidates.length && !reviewedFacts.length) || capabilities?.ai_configured === false} onClick={() => { void generate(); }}><Sparkles />{generating ? "Tailoring your resume…" : draft.document ? "Generate new suggestions" : "Generate my resume"}</Button>{!draft.document && <Button variant="ghost" disabled={!draft.pendingJobRequirements.trim() || generating || importing} onClick={createEmpty}>Open an empty template</Button>}{draft.document && <Button variant="ghost" disabled={generating || importing} onClick={() => setShowJob(false)}>Back to editing</Button>}</div>
    </Card>}
    {draft.document && <>
      <div className="rb-toolbar"><Tabs value={mode} onValueChange={setMode}><TabsList aria-label="Resume editing mode"><TabsTrigger value="form">Form editor</TabsTrigger><TabsTrigger value="yaml">YAML</TabsTrigger></TabsList></Tabs><div><Button variant="ghost" size="sm" disabled={!draft.previous || unappliedYaml} onClick={() => { if (!draft.previous) return; const previous = draft.previous; run.current++; change(old => ({ ...old, document: previous.document, yamlText: previous.yamlText, jobRequirements: previous.jobRequirements, pendingJobRequirements: previous.jobRequirements, previous: null, gaps: [], recommendations: [] })); }}><Undo2 />Undo AI changes</Button><Button variant="outline" size="sm" onClick={() => download(new Blob([draft.yamlText], { type: "text/yaml;charset=utf-8" }), "resume.yaml")}><Download />YAML</Button><Button size="sm" disabled={!freshPdf} onClick={() => { if (pdf && freshPdf) download(pdf, "resume.pdf"); }}><Download />PDF</Button></div></div>
      <Tabs value={mobile} onValueChange={setMobile} className="rb-mobile-tabs"><TabsList aria-label="Mobile resume workspace"><TabsTrigger value="edit">Edit resume</TabsTrigger><TabsTrigger value="preview">PDF preview</TabsTrigger></TabsList></Tabs>
      <div className={`rb-workspace rb-mobile-${mobile}`}>
        <Card className="rb-tools"><fieldset disabled={unappliedYaml}><Tabs value={tool} onValueChange={setTool}><TabsList className="rb-tools-tabs" aria-label="Resume tools"><TabsTrigger value="sections">Sections</TabsTrigger><TabsTrigger value="design">Design</TabsTrigger></TabsList><TabsContent value="sections"><Button className="rb-nav-item" variant={selected === "@personal" ? "secondary" : "ghost"} onClick={() => { setSelected("@personal"); setMode("form"); }}>Personal information</Button>{sections.map((title, index) => <div className="rb-section-nav" key={title}><Button variant={selected === title ? "secondary" : "ghost"} className="rb-nav-item" onClick={() => { setSelected(title); setMode("form"); }}>{title}</Button><div><Button variant="ghost" size="icon" aria-label={`Move ${title} section up`} disabled={index === 0} onClick={() => editDocument(moveSection(draft.document!, title, -1))}><ArrowUp /></Button><Button variant="ghost" size="icon" aria-label={`Move ${title} section down`} disabled={index === sections.length - 1} onClick={() => editDocument(moveSection(draft.document!, title, 1))}><ArrowDown /></Button></div></div>)}<Button variant="outline" className="rb-add-section" onClick={() => setAddingSection(true)}><Plus />Add section</Button></TabsContent><TabsContent value="design"><DesignControls document={draft.document} themes={THEMES} change={editDocument} /></TabsContent></Tabs></fieldset><p className="rb-tools-note">Add only information that is true for you. Your resume is not a claim of verified proficiency.</p></Card>
        <Card className="rb-editor">{mode === "yaml" ? <><div className="rb-editor-caption">RenderCV 2.8 · safe YAML editing</div><YamlEditor value={draft.yamlText} onChange={value => { const parsed = parseResumeYaml(value); change(old => ({ ...old, yamlText: value, document: parsed.document ?? old.document })); }} /></> : <fieldset disabled={unappliedYaml}><ResumeForm key={selected} document={draft.document} selected={selected} change={editDocument} remove={setRemoveSection} /></fieldset>}{yaml.error && <p role="alert" className="rb-error rb-validation">{yaml.error} Last valid PDF is retained. Use YAML to correct unsupported fields; nothing is silently removed.</p>}</Card>
        <Card className="rb-preview"><div className="rb-preview-heading"><strong>Live PDF</strong><span role="status">{rendering ? "Rendering…" : freshPdf ? "Up to date" : pdf ? "Last valid preview" : "RenderCV preview"}</span></div>{renderError && <div className="rb-error" role="alert">{renderError}<Button variant="link" size="sm" onClick={() => setRenderRetry(value => value + 1)}>Retry rendering</Button></div>}<PdfPreview blob={pdf} /><p className="rb-preview-notice">Previewing temporarily sends the complete document to our backend. Rendered files are deleted after each request; there is no server-side resume history.</p></Card>
      </div>
    </>}
    {courses.length > 0 && <Card className="rb-courses"><div className="rb-course-heading"><div><p className="rb-eyebrow">BUILD TOWARDS THIS ROLE</p><h2>A few courses to close the gaps</h2><p>Optional recommendations from our verified catalogue. They are not part of your resume.</p></div><label className="rb-check"><Checkbox checked={availableCourseIds.length > 0 && availableCourseIds.every(id => selectedCourses.includes(id))} disabled={!availableCourseIds.length || savingCourses} onCheckedChange={checked => setSelectedCourses(checked ? availableCourseIds : [])} />Select all</label></div><div className="rb-course-grid">{courses.map(({ course, recommendation }) => <label className="rb-course" key={course.id}><Checkbox checked={savedCourses.includes(course.id) || selectedCourses.includes(course.id)} disabled={savedCourses.includes(course.id) || savingCourses} onCheckedChange={checked => setSelectedCourses(old => checked ? [...new Set([...old, course.id])] : old.filter(id => id !== course.id))} /><div><span>{course.provider} · {course.level}</span><h3>{course.title}</h3><p>{recommendation.reason}</p>{savedCourses.includes(course.id) && <strong className="rb-added"><Check size={13} />Already in My courses</strong>}</div></label>)}</div><div className="rb-inline"><Button disabled={!selectedCourses.some(id => availableCourseIds.includes(id)) || savingCourses} onClick={() => { void addCourses(); }}>{savingCourses ? "Adding…" : "Add selected to My courses"}</Button><Link to={ROUTES.plan}>Open My courses →</Link></div>{courseNotice && <p role="status">{courseNotice}</p>}</Card>}
    <p className="rb-device-note">Saved only in this browser on this device, separately for your account. Signing out keeps local drafts. Clearing site data, private browsing or browser storage eviction can remove them. Local storage is not device-level encryption; export a copy you want to keep.</p>
    <Dialog open={Boolean(draft.proposal)} onOpenChange={open => { if (!open) change(old => ({ ...old, proposal: null })); }}><DialogContent className="rb-proposal-dialog"><DialogHeader><DialogTitle>Review AI suggestions</DialogTitle><DialogDescription>Your current resume is unchanged. Choose the chapters to apply. Personal information and unselected chapters are preserved.</DialogDescription></DialogHeader><div className="rb-proposals">{draft.proposal?.sections.map(section => <div key={section.title} className="rb-proposal"><label className="rb-check"><Checkbox checked={accepted.includes(section.title)} onCheckedChange={checked => setAccepted(old => checked ? [...old, section.title] : old.filter(title => title !== section.title))} /><strong>{section.title}</strong></label><div className="rb-compare"><div><small>CURRENT</small>{(draft.document?.cv.sections?.[section.title] ?? []).map((entry, i) => <p key={i}>{entryText(entry)}</p>)}</div><div><small>PROPOSED</small>{section.entries.map((entry, i) => <div key={i}><p>{entry.text}</p><details className="rb-citations"><summary>Evidence ({entry.skill_ids.length + entry.fact_ids.length})</summary><ul>{entry.skill_ids.map(id => <li key={id}>{candidates.find(skill => skill.id === id)?.name ?? id}</li>)}{entry.fact_ids.map(id => <li key={id}>{reviewedFacts.find(fact => fact.id === id)?.text ?? id}</li>)}</ul></details></div>)}</div></div></div>)}</div><DialogFooter><Button variant="outline" onClick={() => change(old => ({ ...old, proposal: null }))}>Keep current resume</Button><Button disabled={!accepted.length || unappliedYaml} onClick={applyProposal}>Apply selected chapters</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showTarget} onOpenChange={setShowTarget}><DialogContent><DialogHeader><DialogTitle>Tailor for another role?</DialogTitle><DialogDescription>Only one current draft is kept. Export your existing resume first if you want a separate copy. Your current draft is not replaced until you apply the new suggestions.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => download(new Blob([draft.yamlText], { type: "text/yaml" }), "resume.yaml")}>Export YAML</Button><Button variant="outline" onClick={() => setShowTarget(false)}>Cancel</Button><Button onClick={() => { void generate(true); }}>Generate suggestions</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showClear} onOpenChange={setShowClear}><DialogContent><DialogHeader><DialogTitle>Clear this account’s local resume?</DialogTitle><DialogDescription>This removes your job requirements, original file, personal-field mapping, draft and undo snapshot from this browser. It does not remove courses or account data.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowClear(false)}>Cancel</Button><Button variant="destructive" onClick={() => { setClearing(true); abortRequests(); setGenerating(false); setImporting(false); void local.clear().then(() => { if (isCurrent()) { setPdf(null); setPdfKey(""); setShowClear(false); setShowJob(false); setError(""); setRenderError(""); setSelectedCourses([]); } }).catch(cause => { if (isCurrent()) { setError(message(cause)); setRenderRetry(value => value + 1); } }).finally(() => { if (isCurrent()) setClearing(false); }); }}>Clear local resume</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={addingSection} onOpenChange={setAddingSection}><DialogContent><DialogHeader><DialogTitle>Add a resume chapter</DialogTitle><DialogDescription>Start with an empty chapter and enter only your own facts.</DialogDescription></DialogHeader><FormField label="Chapter title"><Input value={newSection} maxLength={100} onChange={event => setNewSection(event.target.value)} placeholder="Projects, Education, Experience…" /></FormField><DialogFooter><Button variant="outline" onClick={() => setAddingSection(false)}>Cancel</Button><Button disabled={!newSection.trim() || sections.includes(newSection.trim()) || newSection.trim().startsWith("@") || ["__proto__", "constructor", "prototype"].includes(newSection.trim())} onClick={() => { if (!draft.document) return; const title = newSection.trim(); editDocument({ ...draft.document, cv: { ...draft.document.cv, sections: { ...draft.document.cv.sections, [title]: [] } } }); setSelected(title); setNewSection(""); setAddingSection(false); }}>Add chapter</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(removeSection)} onOpenChange={open => { if (!open) setRemoveSection(""); }}><DialogContent><DialogHeader><DialogTitle>Remove {removeSection}?</DialogTitle><DialogDescription>All entries in this chapter will be removed from the current draft. Export first if you need a copy.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRemoveSection("")}>Cancel</Button><Button variant="destructive" onClick={() => { if (!draft.document) return; const sections = { ...draft.document.cv.sections }; delete sections[removeSection]; editDocument({ ...draft.document, cv: { ...draft.document.cv, sections } }); setSelected("@personal"); setRemoveSection(""); }}>Remove chapter</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
