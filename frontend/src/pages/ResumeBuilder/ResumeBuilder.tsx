import ResumeAssistant from "./ResumeAssistant";
import ResumeCoursesDialog from "./ResumeCoursesDialog";
import { resumeErrorMessage } from "@/features/resume/errors";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck, Sparkles, Trash2, Undo2, Upload } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { useAccount } from "@/components/account/useAccount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspacePresentation } from "@/components/layout/WorkspacePresentation";
import { createEditorHistory } from "@/features/resume/editorHistory";
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
import { applySections, documentYaml, entryText, parseResumeYaml, resumeRenderDocument } from "@/features/resume/document";
import { EXAMPLE_JOB_REQUIREMENTS, emptyResumeDocument, resumeGenerationAction } from "@/features/resume/onboarding";
import { importResume, RESUME_ACCEPT } from "@/features/resume/importResume";
import { evidenceFromText, redactResume } from "@/features/resume/redaction";
import { emptyContacts, type Generation, type ResumeDocument, type ResumeDraft, type SkillCandidate } from "@/features/resume/types";
import ResumeWorkbench from "./ResumeWorkbench";
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
  const [skillsLoading, setSkillsLoading] = useState(true), [skillRetry, setSkillRetry] = useState(0);
  const [showExample, setShowExample] = useState(false);
  const [capabilities, setCapabilities] = useState<ResumeCapabilities | null>(null);
  const [error, setError] = useState(""), [generating, setGenerating] = useState(false), [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showJob, setShowJob] = useState(false), [showClear, setShowClear] = useState(false), [showTarget, setShowTarget] = useState(false);
  const [showCourses, setShowCourses] = useState(false), [showOptions, setShowOptions] = useState(false);
  const history = useRef(createEditorHistory()), [, refreshHistory] = useState(0);
  const { setEditorActive } = useWorkspacePresentation();
  const hasDocument = Boolean(draft.document);
  useEffect(() => { setEditorActive(hasDocument); return () => setEditorActive(false); }, [hasDocument, setEditorActive]);
  const editDraft = (update: (value: ResumeDraft) => ResumeDraft, key: string | null = null) => change(old => { const next = update(old); if (old.document) history.current.record(old, next, key); refreshHistory(value => value + 1); return next; });
  const travelHistory = (direction: "undo" | "redo") => { if (!isCurrent()) return; const next = history.current[direction](); if (!next) return; abortRequests(); setGenerating(false); setImporting(false); setRenderRetry(value => value + 1); change(old => ({ ...old, ...next, proposal: null })); refreshHistory(value => value + 1); };
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
    return candidate ? parseResumeYaml(documentYaml(resumeRenderDocument(candidate))).document : null;
  }, [yaml.document, draft.previewDocument, draft.document]);
  const fingerprint = previewDocument ? JSON.stringify(previewDocument) : "";
  const freshPdf = Boolean(pdf && pdfKey === fingerprint && !yaml.error);
  const sections = Object.keys(draft.document?.cv.sections ?? {});
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
    const readCourses = () => { if (isCurrent()) try { setSavedCourses(readLibrary().saved); } catch (cause) { setCourseNotice(message(cause)); } };
    readCourses();
    window.addEventListener("workspace-change", readCourses);
    return () => { mounted.current = false; abortRequests(); window.removeEventListener("workspace-change", readCourses); };
    // Requests are scoped to this mounted account, not to individual form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  useEffect(() => {
    let active = true, sequence = 0;
    const readSkills = () => {
      const token = ++sequence;
      setSkillsLoading(true);
      void referenceService.wefSkills().then(reference => {
        if (active && isCurrent() && token === sequence) { setSkills(resumeSkillSnapshot(reference)); setSkillError(""); }
      }).catch(() => {
        if (active && isCurrent() && token === sequence) setSkillError("We couldn't load your saved skills. Retry before generating.");
      }).finally(() => {
        if (active && isCurrent() && token === sequence) setSkillsLoading(false);
      });
    };
    readSkills();
    window.addEventListener("workspace-change", readSkills);
    return () => { active = false; window.removeEventListener("workspace-change", readSkills); };
    // Guard each refresh so a stale result cannot enable the empty-draft path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, skillRetry]);
  useEffect(() => {
    if (!fingerprint) { setRendering(false); return; }
    const request = controller();
    setRendering(true); setRenderError("");
    const timer = setTimeout(() => {
      void resumeService.render(JSON.parse(fingerprint), request.signal).then(blob => {
        if (isCurrent() && !request.signal.aborted) { setPdf(blob); setPdfKey(fingerprint); setRenderError(""); change(old => { const next = { ...old, previewDocument: JSON.parse(fingerprint) }; history.current.sync(next); return next; }); }
      }).catch(cause => { if (isCurrent() && !request.signal.aborted) setRenderError(resumeErrorMessage(cause, JSON.parse(fingerprint))); })
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
  const editDocument = (next: ResumeDocument, key: string | null = null) => { if (!unappliedYaml) editDraft(old => ({ ...old, document: next, yamlText: documentYaml(next) }), key); };
  const editYaml = (text: string) => { const parsed = parseResumeYaml(text); editDraft(old => ({ ...old, yamlText: text, document: parsed.document ?? old.document }), "yaml"); };
  const getRecommendations = async (result: Generation, job: string, token: number) => {
    if (!result.gaps.length) return;
    const request = controller();
    try {
      const response = await resumeService.courses(result.gaps, request.signal);
      if (isCurrent() && token === run.current && !request.signal.aborted) change(old => { const next = old.jobRequirements === job ? { ...old, recommendations: response.courses } : old; history.current.sync(next); return next; });
    } catch { /* Optional, intentionally silent. */ }
    finally { controllers.current.delete(request); }
  };
  const generationAction = resumeGenerationAction({
    jobRequirements: draft.pendingJobRequirements, hasDocument: Boolean(draft.document),
    skillCount: candidates.length, factCount: reviewedFacts.length, skillsLoading, skillError,
    sourceReviewed: source ? source.reviewed : null, aiConfigured: capabilities?.ai_configured ?? null,
    busy: generating || importing,
  });
  const generate = async (targetConfirmed = false) => {
    if (!isCurrent() || busy.current || !generationAction) return;
    if (generationAction === "blank") { createEmpty(); return; }
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
        setShowJob(false); void getRecommendations(result, job, token);
      }
    } catch (cause) { if (isCurrent() && !request.signal.aborted) setError(resumeErrorMessage(cause)); }
    finally { controllers.current.delete(request); if (isCurrent() && token === run.current) { busy.current = false; setGenerating(false); } }
  };
  const applyProposal = () => {
    const proposal = draft.proposal;
    if (!proposal || !draft.document || !accepted.length) return;
    if (unappliedYaml) { setError("Correct the pending YAML before applying AI suggestions."); return; }
    const next = applySections(draft.document, proposal.sections.filter(section => accepted.includes(section.title)));
    editDraft(old => ({ ...old, previous: { document: old.document!, yamlText: old.yamlText, jobRequirements: old.jobRequirements }, document: next, yamlText: documentYaml(next), jobRequirements: proposal.jobRequirements, pendingJobRequirements: proposal.jobRequirements, gaps: proposal.gaps, recommendations: [], proposal: null }));
    void getRecommendations(proposal, proposal.jobRequirements, run.current); setShowJob(false);
  };
  const attach = async (file: File) => {
    if (busy.current) return;
    const request = controller(); busy.current = true; setImporting(true); setError("");
    try { const imported = await importResume(file, request.signal); if (isCurrent() && !request.signal.aborted) { change(old => ({ ...old, source: imported })); setShowJob(Boolean(draft.document)); } }
    catch (cause) { if (isCurrent() && !request.signal.aborted) setError(message(cause)); }
    finally { controllers.current.delete(request); if (isCurrent()) { busy.current = false; setImporting(false); } }
  };
  const courses = [...new Map(draft.recommendations.map(item => [item.course_id, item])).values()].flatMap(recommendation => { const course = directory.get(recommendation.course_id); return course ? [{ course, recommendation }] : []; });
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
    if (!isCurrent() || draft.document || !draft.pendingJobRequirements.trim() || busy.current) return;
    const document = emptyResumeDocument();
    change(old => old.document ? old : ({ ...old, document, yamlText: documentYaml(document), jobRequirements: old.pendingJobRequirements.trim(), gaps: [], recommendations: [], proposal: null }));
    setShowJob(false); setError("");
  };
  const fillExample = () => {
    if (!isCurrent() || draft.document || generating || importing) return;
    change(old => old.document ? old : ({ ...old, pendingJobRequirements: EXAMPLE_JOB_REQUIREMENTS }));
    setShowExample(false);
  };
  const undoAi = () => { if (!draft.previous || unappliedYaml) return; const previous = draft.previous; run.current++; editDraft(old => ({ ...old, document: previous.document, yamlText: previous.yamlText, jobRequirements: previous.jobRequirements, pendingJobRequirements: previous.jobRequirements, previous: null, gaps: [], recommendations: [], proposal: null })); };
  const jobCard = <Card className="rb-job-card">
      <div className="rb-job-heading"><div className="rb-step-mark"><Sparkles /></div><div><p className="rb-eyebrow">START WITH YOUR NEXT ROLE</p><h2>What is the job looking for?</h2></div></div>
      <fieldset disabled={generating || importing}><FormField label="Target job requirements · required"><Textarea value={draft.pendingJobRequirements} onChange={event => editDraft(old => ({ ...old, pendingJobRequirements: event.target.value }), "target")} maxLength={20000} rows={7} placeholder="Paste the role’s responsibilities, required skills and qualifications here…" /></FormField>
        {!draft.document && <div className="rb-example-action"><Button variant="link" size="sm" type="button" onClick={() => { if (draft.pendingJobRequirements.trim() && draft.pendingJobRequirements !== EXAMPLE_JOB_REQUIREMENTS) setShowExample(true); else fillExample(); }}>Use an example</Button></div>}
        {skillError && <div className="rb-warning" role="alert">{skillError} <Button variant="link" size="sm" type="button" onClick={() => setSkillRetry(value => value + 1)}>Retry skills</Button></div>}
        <div className="rb-source-heading"><div><h3>Bring your existing resume</h3><p>Optional · PDF/DOCX · Max 10 MB</p><p>Without a resume, only your skills are included.</p></div><Button variant="outline" onClick={() => fileInput.current?.click()} disabled={importing}><Upload />{source ? "Replace resume" : "Upload resume"}</Button></div>
        <input ref={fileInput} hidden type="file" accept={RESUME_ACCEPT} aria-label="Upload original resume PDF or DOCX" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void attach(file); }} />
        {!source && <Button variant="link" size="sm" onClick={() => change(old => ({ ...old, source: { file: new Blob([]), name: "Manually supplied details", text: "", redactedText: "", contacts: emptyContacts(), reviewed: false } }))}>Or enter your resume details manually</Button>}
        {source && <div className="rb-source-review"><div className="rb-inline"><strong><FileText size={16} />{source.name}</strong><Button variant="ghost" size="sm" onClick={() => change(old => ({ ...old, source: null }))}>Remove source</Button></div>
          <p>Review these suggested personal fields. Correct mistakes and redact any remaining names, addresses or confidential details below. Automatic redaction is not infallible.</p>
          <div className="rb-contact-grid">{Object.entries(source.contacts).map(([key, value]) => <FormField key={key} label={`${key.charAt(0).toUpperCase() + key.slice(1)} · local only`}><Input value={value} onChange={event => change(old => { if (!old.source) return old; const contacts = { ...old.source.contacts, [key]: event.target.value }; return { ...old, source: { ...old.source, contacts, redactedText: redactResume(old.source.redactedText, contacts), reviewed: false } }; })} /></FormField>)}</div>
          <FormField label="Skills explicitly listed in your original resume" hint="Review these local suggestions. Use commas between skill names; include only skills actually in your source. Confirmed names join your existing skill list."><Textarea rows={2} maxLength={13000} value={source.skillsText ?? (source.skills ?? []).join(", ")} onChange={event => change(old => old.source ? { ...old, source: { ...old.source, skillsText: event.target.value, reviewed: false } } : old)} /></FormField>
          <FormField label="Resume evidence that AI will receive" hint="Keep only factual background you want to share. Personal fields above are not sent to AI."><Textarea rows={8} maxLength={60000} value={source.redactedText} onChange={event => change(old => old.source ? { ...old, source: { ...old.source, redactedText: event.target.value, reviewed: false } } : old)} /></FormField>
          <label className="rb-check"><Checkbox checked={source.reviewed} onCheckedChange={checked => change(old => old.source ? { ...old, source: { ...old.source, redactedText: redactResume(old.source.redactedText, old.source.contacts), reviewed: checked === true } } : old)} />I have reviewed this text and removed personal or confidential information I do not want sent to AI.</label>
        </div>}
      </fieldset>
      <p className="rb-ai-summary">AI uses your job requirements, skills and any reviewed resume details.</p>
      {capabilities?.ai_configured === false && generationAction !== "blank" && <p className="rb-warning">AI generation is unavailable. You can still open an empty template.</p>}
      <div className="rb-job-footer"><Button disabled={!generationAction} onClick={() => { void generate(); }}><Sparkles />{generating ? "Tailoring your resume…" : draft.document ? "Generate new suggestions" : "Generate my resume"}</Button>{!draft.document && <Button variant="ghost" disabled={!draft.pendingJobRequirements.trim() || generating || importing} onClick={createEmpty}>Open an empty template</Button>}{draft.document && <Button variant="ghost" disabled={generating || importing} onClick={() => setShowJob(false)}>Back to editing</Button>}</div>
    </Card>;
  const privacy = <div className="rb-privacy">
      <p>Your draft stays in this browser. AI generation and PDF preview send data for processing.</p>
      <Accordion type="single" collapsible><AccordionItem value="privacy" className="rb-privacy-item"><AccordionTrigger>Privacy details</AccordionTrigger><AccordionContent>
        <p>Drafts are saved separately for your account in this browser and on this site, with no resume database or cross-device sync. Signing out keeps them. Clearing site data, ending private browsing or browser storage eviction can remove them. Account isolation is not device-level encryption; export a copy you want to keep.</p>
        <p>Original PDF/DOCX files are parsed locally and are not uploaded. Readable text is required; scanned files need manual details, not OCR. AI generation sends your job requirements, skills and only reviewed, redacted evidence. The editing assistant sends your instructions, reviewed redacted sections and skills, safe design settings and recent conversation context; chat is not saved after leaving this page. Personal-field mappings stay local. Third-party provider retention policies still apply; zero retention is not guaranteed. An empty draft does not use AI.</p>
        <p>PDF preview temporarily sends the complete document, including personal fields you add, to our backend renderer. Temporary files are deleted after rendering, including failures and timeouts; there is no server-side resume history.</p>
      </AccordionContent></AccordionItem></Accordion>
    </div>;
  if (local.loading || clearing) return <div className="rb-page" role="status">{clearing ? "Clearing your local resume…" : "Loading your local resume…"}</div>;
  const notices = <>{local.storageError && <div className="rb-warning" role="alert">{local.storageError} Your draft can still be exported; local recovery is not guaranteed.</div>}{error && <div className="rb-error" role="alert">{error}</div>}{draft.document?.cv.sections?.Skills?.length === 0 && <p className="rw-empty-skills" role="status">No skills yet. Add your skills to this draft.</p>}</>;
  return <>{draft.document ? <ResumeWorkbench document={draft.document} yamlText={draft.yamlText} yamlError={yaml.error} unappliedYaml={unappliedYaml} editDocument={editDocument} editYaml={editYaml} addSection={() => setAddingSection(true)} removeSection={setRemoveSection} undo={() => travelHistory("undo")} redo={() => travelHistory("redo")} canUndo={history.current.canUndo} canRedo={history.current.canRedo} saveStatus={local.saveStatus} notices={notices} pdf={pdf} freshPdf={freshPdf} rendering={rendering} renderError={renderError} retryRender={() => setRenderRetry(value => value + 1)} downloadPdf={() => { if (pdf && freshPdf) download(pdf, "resume.pdf"); }} downloadYaml={() => download(new Blob([draft.yamlText], { type: "text/yaml;charset=utf-8" }), "resume.yaml")} target={() => setShowJob(true)} courses={courses.length ? () => setShowCourses(true) : undefined} courseCount={courses.length} assistant={<ResumeAssistant key={owner} owner={owner} document={draft.document} documentVersion={local.editVersion} skills={candidates} jobRequirements={draft.jobRequirements} disabledReason={unappliedYaml || yaml.error ? "Fix the pending YAML before asking AI to edit." : generating || importing ? "Finish the current generation or import first." : skillError ? "Retry loading your saved skills before using AI." : skillsLoading ? "Loading your saved skills…" : capabilities?.ai_configured === false ? "AI is unavailable. You can still edit manually." : ""} apply={next => { if (!isCurrent() || unappliedYaml || yaml.error) return; editDraft(old => ({ ...old, previous: { document: old.document!, yamlText: old.yamlText, jobRequirements: old.jobRequirements }, document: next, yamlText: documentYaml(next), proposal: null })); }} />} more={() => setShowOptions(true)} /> : <div className="rb-page">
    <Link className="rb-back" to={ROUTES.possibilities}><ArrowLeft size={15} />Possibilities <span>/ Resume builder</span></Link>
    <PageHeader title="Make your next move." actions={<Button variant="ghost" size="icon" aria-label="Clear local resume data" onClick={() => setShowClear(true)}><Trash2 /></Button>} />
    <div className="rb-status-line"><span><ShieldCheck size={14} />Local draft</span><span role="status">{local.saveStatus || "Only this browser, on this device"}</span></div>
    {notices}{jobCard}{privacy}
  </div>}
    <Dialog open={Boolean(draft.document) && showJob} onOpenChange={setShowJob}><DialogContent className="rw-target-dialog"><DialogHeader><DialogTitle>Target & AI</DialogTitle><DialogDescription>Review your target and source before generating suggestions.</DialogDescription></DialogHeader>{error && <p className="rb-error" role="alert">{error}</p>}{jobCard}</DialogContent></Dialog>
    <ResumeCoursesDialog open={showCourses} onOpenChange={setShowCourses} courses={courses} saved={savedCourses} selected={selectedCourses} select={setSelectedCourses} saving={savingCourses} add={() => { void addCourses(); }} notice={courseNotice} />
    <Dialog open={showOptions} onOpenChange={setShowOptions}><DialogContent><DialogHeader><DialogTitle>Resume options</DialogTitle><DialogDescription>Manage this browser’s local draft.</DialogDescription></DialogHeader><div className="rw-options-actions"><Button variant="outline" onClick={() => download(new Blob([draft.yamlText], { type: "text/yaml;charset=utf-8" }), "resume.yaml")}>Download YAML</Button><Button variant="outline" disabled={!draft.previous || unappliedYaml} onClick={undoAi}><Undo2 />Undo AI changes</Button><Button variant="destructive" onClick={() => { setShowOptions(false); setShowClear(true); }}><Trash2 />Clear local resume data</Button></div>{privacy}</DialogContent></Dialog>
    <Dialog open={showExample} onOpenChange={setShowExample}><DialogContent><DialogHeader><DialogTitle>Replace your job requirements?</DialogTitle><DialogDescription>This replaces your current input with the Junior Data Analyst example. You can edit it before generating.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowExample(false)}>Cancel</Button><Button disabled={generating || importing} onClick={fillExample}>Use example</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(draft.proposal)} onOpenChange={open => { if (!open) change(old => ({ ...old, proposal: null })); }}><DialogContent className="rb-proposal-dialog"><DialogHeader><DialogTitle>Review AI suggestions</DialogTitle><DialogDescription>Your current resume is unchanged. Choose the chapters to apply. Personal information and unselected chapters are preserved.</DialogDescription></DialogHeader><div className="rb-proposals">{draft.proposal?.sections.map(section => <div key={section.title} className="rb-proposal"><label className="rb-check"><Checkbox checked={accepted.includes(section.title)} onCheckedChange={checked => setAccepted(old => checked ? [...old, section.title] : old.filter(title => title !== section.title))} /><strong>{section.title}</strong></label><div className="rb-compare"><div><small>CURRENT</small>{(draft.document?.cv.sections?.[section.title] ?? []).map((entry, i) => <p key={i}>{entryText(entry)}</p>)}</div><div><small>PROPOSED</small>{section.entries.map((entry, i) => <div key={i}><p>{entry.text}</p><details className="rb-citations"><summary>Evidence ({entry.skill_ids.length + entry.fact_ids.length})</summary><ul>{entry.skill_ids.map(id => <li key={id}>{candidates.find(skill => skill.id === id)?.name ?? id}</li>)}{entry.fact_ids.map(id => <li key={id}>{reviewedFacts.find(fact => fact.id === id)?.text ?? id}</li>)}</ul></details></div>)}</div></div></div>)}</div><DialogFooter><Button variant="outline" onClick={() => change(old => ({ ...old, proposal: null }))}>Keep current resume</Button><Button disabled={!accepted.length || unappliedYaml} onClick={applyProposal}>Apply selected chapters</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showTarget} onOpenChange={setShowTarget}><DialogContent><DialogHeader><DialogTitle>Tailor for another role?</DialogTitle><DialogDescription>Only one current draft is kept. Export your existing resume first if you want a separate copy. Your current draft is not replaced until you apply the new suggestions.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => download(new Blob([draft.yamlText], { type: "text/yaml" }), "resume.yaml")}>Export YAML</Button><Button variant="outline" onClick={() => setShowTarget(false)}>Cancel</Button><Button onClick={() => { void generate(true); }}>Generate suggestions</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showClear} onOpenChange={setShowClear}><DialogContent><DialogHeader><DialogTitle>Clear this account’s local resume?</DialogTitle><DialogDescription>This removes your job requirements, original file, personal-field mapping, draft and undo snapshot from this browser. It does not remove courses or account data.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowClear(false)}>Cancel</Button><Button variant="destructive" onClick={() => { setClearing(true); abortRequests(); setGenerating(false); setImporting(false); void local.clear().then(() => { if (isCurrent()) { history.current.clear(); refreshHistory(value => value + 1); setPdf(null); setPdfKey(""); setShowClear(false); setShowJob(false); setError(""); setRenderError(""); setSelectedCourses([]); } }).catch(cause => { if (isCurrent()) { setError(message(cause)); setRenderRetry(value => value + 1); } }).finally(() => { if (isCurrent()) setClearing(false); }); }}>Clear local resume</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={addingSection} onOpenChange={setAddingSection}><DialogContent><DialogHeader><DialogTitle>Add a resume chapter</DialogTitle><DialogDescription>Start with an empty chapter and enter only your own facts.</DialogDescription></DialogHeader><FormField label="Chapter title"><Input value={newSection} maxLength={100} onChange={event => setNewSection(event.target.value)} placeholder="Projects, Education, Experience…" /></FormField><DialogFooter><Button variant="outline" onClick={() => setAddingSection(false)}>Cancel</Button><Button disabled={!newSection.trim() || sections.includes(newSection.trim()) || newSection.trim().startsWith("@") || ["__proto__", "constructor", "prototype"].includes(newSection.trim())} onClick={() => { if (!draft.document) return; const title = newSection.trim(); editDocument({ ...draft.document, cv: { ...draft.document.cv, sections: { ...draft.document.cv.sections, [title]: [] } } }); setNewSection(""); setAddingSection(false); }}>Add chapter</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(removeSection)} onOpenChange={open => { if (!open) setRemoveSection(""); }}><DialogContent><DialogHeader><DialogTitle>Remove {removeSection}?</DialogTitle><DialogDescription>All entries in this chapter will be removed from the current draft. Export first if you need a copy.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRemoveSection("")}>Cancel</Button><Button variant="destructive" onClick={() => { if (!draft.document) return; const sections = { ...draft.document.cv.sections }; delete sections[removeSection]; editDocument({ ...draft.document, cv: { ...draft.document.cv, sections } }); setRemoveSection(""); }}>Remove chapter</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
