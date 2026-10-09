import { reviewedSourceSkills, SKILLS_PARSER_VERSION } from "@/features/resume/sourceSkills";
import { appliedSkillFilter, invalidateEditedSkills } from "@/features/resume/skillFilter";
import { ApiError } from "@/services/api";
import { SKILL_FILTER_VERSION } from "@/features/resume/types";
import { generationNotice } from "@/features/resume/generationNotice";
import ResumeAssistant from "./ResumeAssistant";
import ResumeCoursesDialog from "./ResumeCoursesDialog";
import ResumeReview from "./ResumeReview";
import ResumeGenerationProgress from "./ResumeGenerationProgress";
import { applyInterviewSuggestion, dismissInterviewSuggestion } from "@/features/resume/interviewSuggestions";
import { reviewedMark } from "@/features/resume/review";
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
import { useResumeTarget } from "@/features/resume/useResumeTarget";
import { targetRequirements, withTargetRole } from "@/features/resume/targetRole";
import { readCareerDirection } from "@/services/careerDirection";
import { useResumeDraft } from "@/features/resume/useResumeDraft";
import { mergeResumeSkills, resumeSkillSnapshot, selectedResumeCourseIds } from "@/features/resume/skills";
import { applySections, documentYaml, entryText, parseResumeYaml, resumeRenderDocument } from "@/features/resume/document";
import { emptyResumeDocument, resumeGenerationAction } from "@/features/resume/onboarding";
import { importResume, RESUME_ACCEPT } from "@/features/resume/importResume";
import { reviewedResumeInput } from "@/features/resume/projects";
import { redactResume } from "@/features/resume/redaction";
import { emptyContacts, type Generation, type InterviewSuggestion, type ResumeDocument, type ResumeDraft, type SkillCandidate } from "@/features/resume/types";
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
  const target = useResumeTarget(owner);
  const targetText = targetRequirements(target.role);
  const targetReady = target.status === "ready" && Boolean(targetText);
  const targetKey = targetReady ? `${target.role!.occupation_code}:${targetText}` : "";
  const targetVersion = useRef(targetKey); targetVersion.current = targetKey;
  const generationRequest = useRef<AbortController | null>(null);
  const [capabilities, setCapabilities] = useState<ResumeCapabilities | null>(null);
  const [error, setError] = useState(""), [generating, setGenerating] = useState(false), [importing, setImporting] = useState(false);
  const [roleNeedsRefresh, setRoleNeedsRefresh] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generationSeconds, setGenerationSeconds] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const started = Date.now();
    setGenerationSeconds(0);
    const timer = setInterval(() => setGenerationSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [generating]);
  const [clearing, setClearing] = useState(false);
  const [showJob, setShowJob] = useState(false), [showClear, setShowClear] = useState(false), [showTarget, setShowTarget] = useState(false);
  const [showCourses, setShowCourses] = useState(false), [showOptions, setShowOptions] = useState(false);
  const history = useRef(createEditorHistory()), [, refreshHistory] = useState(0);
  const { setEditorActive } = useWorkspacePresentation();
  const hasDocument = Boolean(draft.document);
  useEffect(() => { setEditorActive(hasDocument); return () => setEditorActive(false); }, [hasDocument, setEditorActive]);
  const editDraft = (update: (value: ResumeDraft) => ResumeDraft, key: string | null = null, preserveSkillFilter = false) => change(old => { const updated = update(old); const next = preserveSkillFilter ? updated : invalidateEditedSkills(old, updated); if (old.document) history.current.record(old, next, key); refreshHistory(value => value + 1); return next; });
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
  const cancelGeneration = () => {
    const request = generationRequest.current;
    if (!request) return;
    run.current++; request.abort(); controllers.current.delete(request); generationRequest.current = null; busy.current = false; setGenerating(false);
  };
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
  const sourceSkillReview = useMemo(() => source ? reviewedSourceSkills({ ...source, redactedText: redactResume(source.redactedText, source.contacts) }) : { names: [], rejected: [], text: "" }, [source]);
  const sourceInput = useMemo(() => {
    if (sourceSkillReview.rejected.length) return { evidence: [], projects: [], sections: [], error: "Some skill entries are work history, locations or achievements. Correct the Skills field before confirming your source." };
    try { return { ...reviewedResumeInput(source ? redactResume(source.redactedText, source.contacts) : ""), error: "" }; }
    catch (cause) { return { evidence: [], projects: [], sections: [], error: message(cause) }; }
  }, [source, sourceSkillReview]);
  const reviewedFacts = source?.reviewed ? sourceInput.evidence : [];
  const candidates = useMemo(() => mergeResumeSkills([skills,
    source?.reviewed ? sourceSkillReview.names.flatMap(name => {
      const safe = redactResume(name, source.contacts).trim();
      return safe && !safe.includes("[REDACTED]") ? [{ id: safe, name: safe }] : [];
    }) : [],
  ]), [skills, source, sourceSkillReview]);
  const inputFingerprint = JSON.stringify([SKILL_FILTER_VERSION, targetKey, candidates, source?.reviewed ?? null, sourceInput.evidence, sourceInput.projects, sourceInput.sections]);
  const inputVersion = useRef(inputFingerprint); inputVersion.current = skillsLoading || skillError || sourceInput.error ? "loading" : inputFingerprint;
  useEffect(() => {
    if (local.loading || !isCurrent()) return;
    cancelGeneration();
    if (draft.proposal && draft.proposal.inputFingerprint !== inputFingerprint) {
      change(old => ({ ...old, proposal: null })); setAccepted([]);
    }
    // Input changes invalidate suggestions, never the existing resume or applied interview target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputFingerprint, local.loading]);
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
      // Immediately invalidate in-flight results, even before the async catalogue reload finishes.
      inputVersion.current = "loading";
      cancelGeneration();
      void (async () => {
        const reference = await referenceService.wefSkills();
        if (!active || !isCurrent() || token !== sequence) return;
        const courseIds = selectedResumeCourseIds();
        const catalogue = courseIds.length ? await loadCourseDirectory(skillRetry > 0) : new Map<string, Course>();
        if (active && isCurrent() && token === sequence) { setSkills(resumeSkillSnapshot(reference, catalogue)); setSkillError(""); }
      })().catch(cause => {
        if (active && isCurrent() && token === sequence) setSkillError("We couldn't load your saved skills. " + (cause instanceof SyntaxError ? "Saved selections could not be read. Your data has been kept." : message(cause)));
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
    run.current++;
    if (generationRequest.current) {
      generationRequest.current.abort(); controllers.current.delete(generationRequest.current);
      generationRequest.current = null; busy.current = false; setGenerating(false);
    }
    setShowTarget(false);
    // A target switch invalidates generation, but not imports or PDF previews.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);
  const targetMetadata = JSON.stringify(target.role);
  const savedTargetMetadata = JSON.stringify(draft.targetRole ?? null);
  useEffect(() => {
    if (local.loading || target.status === "loading" || !isCurrent()) return;
    const next = withTargetRole(draft, target.role);
    if (next === draft) return;
    change(old => { const updated = withTargetRole(old, target.role); history.current.sync(updated); return updated; });
    setAccepted([]);
    // Only target/loaded-draft transitions sync the pending requirements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.loading, target.status, targetMetadata, savedTargetMetadata, draft.pendingJobRequirements]);
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
  const targetIsCurrent = () => {
    try { return targetReady && readCareerDirection()?.occupation_code === target.role?.occupation_code; }
    catch { return false; }
  };
  const generationAction = candidates.length <= 250 && !candidates.some(skill => skill.name.length > 160 || skill.id.length > 160) && targetReady && draft.pendingJobRequirements === targetText ? resumeGenerationAction({
    jobRequirements: draft.pendingJobRequirements, hasDocument: Boolean(draft.document),
    skillCount: candidates.length, factCount: reviewedFacts.length, skillsLoading, skillError: skillError || sourceInput.error,
    sourceReviewed: source ? source.reviewed : null, aiConfigured: capabilities?.ai_configured ?? null,
    busy: generating || importing,
  }) : null;
  const generate = async (targetConfirmed = false) => {
    if (!isCurrent() || !targetIsCurrent() || busy.current || !generationAction) return;
    if (draft.document && draft.jobRequirements !== draft.pendingJobRequirements.trim() && !targetConfirmed) { setShowTarget(true); return; }
    if (candidates.length > 250 || candidates.some(skill => skill.name.length > 160 || skill.id.length > 160)) { setError("Use at most 250 skill names, each at most 160 characters."); return; }
    if (skillError || sourceInput.error) { setError(skillError || sourceInput.error); return; }
    if (source && !source.reviewed) { setError("Review and redact the resume text, then confirm it before sending anything to AI."); return; }
    const job = targetText, capturedTarget = targetKey, capturedInput = inputFingerprint, token = ++run.current;
    const request = controller(); generationRequest.current = request; busy.current = true; setGenerating(true); setRoleNeedsRefresh(false); setGenerationStatus(""); setError(""); setShowTarget(false);
    try {
      const result = await resumeService.generate(job, candidates, reviewedFacts, Boolean(source?.reviewed), request.signal, sourceInput.projects, sourceInput.sections, target.role!.occupation_code);
      if (!isCurrent() || request.signal.aborted || token !== run.current || targetVersion.current !== capturedTarget || inputVersion.current !== capturedInput) return;
      if (readCareerDirection()?.occupation_code !== target.role?.occupation_code) return;
      if (result.skill_filter_version !== SKILL_FILTER_VERSION) throw new Error("The server did not verify role-related Skills. Restart or refresh the project, then retry.");
      if (draft.document) {
        setAccepted([]); change(old => ({ ...old, proposal: { ...result, jobRequirements: job, inputFingerprint: capturedInput } }));
      } else {
        const document = applySections(null, result.sections, source?.contacts, result.skill_filter_version);
        change(old => ({ ...old, ...appliedSkillFilter(result, capturedInput), generationInputFingerprint: capturedInput, document, yamlText: documentYaml(document), generationOutcome: result.outcome, generationNotices: result.notices, jobRequirements: result.outcome === "source_preserved" ? old.jobRequirements : job, pendingJobRequirements: job, gaps: result.gaps, recommendations: [], proposal: null }));
        setShowJob(false); if (result.outcome !== "source_preserved") void getRecommendations(result, job, token);
      }
    } catch (cause) { if (isCurrent() && !request.signal.aborted) {
      setError(resumeErrorMessage(cause));
      setRoleNeedsRefresh(cause instanceof ApiError && ["target_role_changed", "role_reference_unavailable", "target_role_not_found", "role_has_no_skills"].includes(cause.code ?? ""));
    } }
    finally { controllers.current.delete(request); if (generationRequest.current === request) generationRequest.current = null; if (isCurrent() && token === run.current) { busy.current = false; setGenerating(false); } }
  };
  const applyProposal = () => {
    const proposal = draft.proposal;
    if (!proposal || !draft.document || !accepted.length || !targetIsCurrent() || proposal.jobRequirements !== targetText || proposal.inputFingerprint !== inputVersion.current || skillsLoading || skillError || sourceInput.error) return;
    if (unappliedYaml) { setError("Correct the pending YAML before applying AI suggestions."); return; }
    const next = applySections(draft.document, proposal.sections.filter(section => accepted.includes(section.title)), undefined, proposal.skill_filter_version);
    editDraft(old => ({ ...old, generationInputFingerprint: proposal.inputFingerprint, ...(accepted.includes("Skills") ? appliedSkillFilter(proposal, proposal.inputFingerprint) : {}), previous: { document: old.document!, yamlText: old.yamlText, jobRequirements: old.jobRequirements, skillFilterVersion: old.skillFilterVersion, skillFilterInputFingerprint: old.skillFilterInputFingerprint, generationInputFingerprint: old.generationInputFingerprint, generationOutcome: old.generationOutcome, generationNotices: old.generationNotices }, document: next, yamlText: documentYaml(next), generationOutcome: proposal.outcome, generationNotices: proposal.notices, jobRequirements: proposal.outcome === "source_preserved" ? old.jobRequirements : proposal.jobRequirements, pendingJobRequirements: proposal.jobRequirements, gaps: proposal.gaps, recommendations: [], proposal: null }), null, true);
    if (proposal.outcome !== "source_preserved") void getRecommendations(proposal, proposal.jobRequirements, run.current); setShowJob(false);
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
    if (!isCurrent() || draft.document || !targetIsCurrent() || draft.pendingJobRequirements !== targetText || busy.current) return;
    const document = emptyResumeDocument();
    change(old => old.document ? old : ({ ...old, document, yamlText: documentYaml(document), jobRequirements: old.pendingJobRequirements.trim(), gaps: [], recommendations: [], proposal: null }));
    setShowJob(false); setError("");
  };
  const undoAi = () => { if (!draft.previous || unappliedYaml) return; const previous = draft.previous; run.current++; editDraft(old => ({ ...old, document: previous.document, yamlText: previous.yamlText, jobRequirements: previous.jobRequirements, generationInputFingerprint: previous.generationInputFingerprint, skillFilterVersion: previous.skillFilterVersion, skillFilterInputFingerprint: previous.skillFilterInputFingerprint, generationOutcome: previous.generationOutcome, generationNotices: previous.generationNotices, previous: null, gaps: [], recommendations: [], proposal: null }), null, true); };
  const jobCard = <Card className="rb-job-card">
      <div className="rb-job-heading"><div className="rb-step-mark"><Sparkles /></div><div><p className="rb-eyebrow">START WITH YOUR NEXT ROLE</p><h2>What is the job looking for?</h2></div></div>
      <div className="rb-target-role" aria-label="Selected target role">
        {roleNeedsRefresh && <Button variant="outline" onClick={() => { setRoleNeedsRefresh(false); setError(""); target.retry(); }}>Retry role requirements</Button>}
        {target.status === "loading" && <p role="status">Loading your target role's required skills…</p>}
        {target.status === "missing" && <p role="status">Select a career direction to continue. Choose your target role in Explore possibilities before generating a resume.</p>}
        {target.status === "error" && <p className="rb-warning" role="alert">{target.error} <Button variant="link" size="sm" onClick={target.retry}>Retry role requirements</Button></p>}
        {target.role && <><h3>{target.role.title}</h3>{target.status === "empty" ? <p role="status">No required skills are available for this role. Choose another career direction before generating.</p> : <><p>Required skills · from your selected career direction</p><ul className="rb-target-skills">{target.role.skills.map(skill => <li key={skill.skill_id}>{skill.name}</li>)}</ul><p className="rb-target-hint">These are role requirements, not claims about your existing skills.</p></>}</>}
        <Button asChild variant="outline" size="sm"><Link to={ROUTES.possibilities}>{target.code ? "Change target role" : "Explore possibilities"}</Link></Button>
        {draft.document && targetReady && draft.jobRequirements !== targetText && <p className="rb-warning" role="status">Your existing resume has not yet been tailored to this target role. Generate new suggestions, then review and apply them.</p>}
      </div>
      {skillsLoading && <p role="status">Loading your saved skills…</p>}
      {candidates.length > 250 || candidates.some(skill => skill.name.length > 160 || skill.id.length > 160) ? <p className="rb-warning" role="alert">Use at most 250 skill names, each at most 160 characters. No skills will be silently dropped.</p> : null}
      <fieldset disabled={generating || importing}>
        {skillError && <div className="rb-warning" role="alert">{skillError} <Button variant="link" size="sm" type="button" onClick={() => setSkillRetry(value => value + 1)}>Retry skills</Button></div>}
        <div className="rb-source-heading"><div><h3>Bring your existing resume</h3><p>Optional · PDF/DOCX · Max 10 MB</p><p>Without a resume, only your skills are included.</p></div><Button variant="outline" onClick={() => fileInput.current?.click()} disabled={importing}><Upload />{source ? "Replace resume" : "Upload resume"}</Button></div>
        <input ref={fileInput} hidden type="file" accept={RESUME_ACCEPT} aria-label="Upload original resume PDF or DOCX" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void attach(file); }} />
        {!source && <Button variant="link" size="sm" onClick={() => change(old => ({ ...old, source: { file: new Blob([]), name: "Manually supplied details", text: "", redactedText: "", contacts: emptyContacts(), reviewed: false } }))}>Or enter your resume details manually</Button>}
        {source && <div className="rb-source-review"><div className="rb-inline"><strong><FileText size={16} />{source.name}</strong><Button variant="ghost" size="sm" onClick={() => change(old => ({ ...old, source: null }))}>Remove source</Button></div>
          <p>Review these suggested personal fields. Correct mistakes and redact any remaining names, addresses or confidential details below. Automatic redaction is not infallible.</p>
          <div className="rb-contact-grid">{Object.entries(source.contacts).map(([key, value]) => <FormField key={key} label={`${key.charAt(0).toUpperCase() + key.slice(1)} · local only`}><Input value={value} onChange={event => change(old => { if (!old.source) return old; const contacts = { ...old.source.contacts, [key]: event.target.value }; return { ...old, source: { ...old.source, contacts, redactedText: redactResume(old.source.redactedText, contacts), reviewed: false } }; })} /></FormField>)}</div>
          <FormField label="Skills explicitly listed in your original resume" hint="Review these local suggestions. Use one skill per line; include only skills actually in your source. Confirmed names join your existing skill list."><Textarea rows={2} maxLength={13000} value={sourceSkillReview.text} onChange={event => change(old => old.source ? { ...old, source: { ...old.source, skillsText: event.target.value, skillsOrigin: "manual", skillsParserVersion: SKILLS_PARSER_VERSION, reviewed: false } } : old)} /></FormField>
          <FormField label="Resume evidence that AI will receive" hint="Keep only factual background you want to share. Personal fields above are not sent to AI."><Textarea rows={8} maxLength={60000} value={source.redactedText} onChange={event => change(old => old.source ? { ...old, source: { ...old.source, redactedText: event.target.value, reviewed: false } } : old)} /></FormField>
          {sourceInput.error && <p className="rb-warning" role="alert">{sourceInput.error}</p>}
          {sourceInput.projects.length > 0 && <div className="rb-source-projects" aria-label="Projects from your reviewed source"><h4>Projects from your source</h4>{sourceInput.projects.map(project => <div key={project.id}>
            {project.mode === "structured" ? <><strong>{project.name}</strong>{project.date && <p>{project.date}</p>}<ul>{project.highlight_fact_ids.map(id => <li key={id}>{sourceInput.evidence.find(f => f.id === id)?.text.replace(/^[•●▪*-]\s+/, "")}</li>)}</ul></> : <><p>Project boundaries are unclear. These paragraphs will be kept unchanged, without AI rewriting.</p>{project.fact_ids.map(id => <p key={id}>{sourceInput.evidence.find(f => f.id === id)?.text}</p>)}</>}
          </div>)}</div>}
          <label className="rb-check"><Checkbox disabled={Boolean(sourceInput.error)} checked={source.reviewed} onCheckedChange={checked => change(old => old.source ? { ...old, source: { ...old.source, redactedText: redactResume(old.source.redactedText, old.source.contacts), projects: sourceInput.projects, skills: sourceSkillReview.names, ...(old.source.skillsText !== undefined ? { skillsText: sourceSkillReview.names.join("\n") } : {}), skillsParserVersion: SKILLS_PARSER_VERSION, reviewed: checked === true } } : old)} />I have reviewed this text and removed personal or confidential information I do not want sent to AI.</label>
        </div>}
      </fieldset>
      <p className="rb-ai-summary">AI uses your job requirements, skills and any reviewed resume details.</p>
      {!skillsLoading && !skillError && !sourceInput.error && !candidates.length && !reviewedFacts.length && <p className="rb-warning" role="status">Add reviewed resume details or selected user skills before generating. Target role requirements are not evidence of your abilities.</p>}
      {capabilities?.ai_configured === false && <p className="rb-warning">AI generation is unavailable. You can still open an empty template.</p>}
      {generationStatus && <p role="status">{generationStatus}</p>}
      {generating && <ResumeGenerationProgress seconds={generationSeconds} />}
      <div className="rb-job-footer">{generating && <Button variant="outline" onClick={() => { cancelGeneration(); setGenerationStatus("Generation cancelled. Your existing resume is unchanged."); }}>Cancel generation</Button>}<Button disabled={!generationAction} onClick={() => { void generate(); }}><Sparkles />{generating ? "Polishing your resume…" : draft.document ? "Generate new suggestions" : "Generate my resume"}</Button>{!draft.document && <Button variant="ghost" disabled={!targetReady || draft.pendingJobRequirements !== targetText || generating || importing} onClick={createEmpty}>Open an empty template</Button>}{draft.document && <Button variant="ghost" disabled={generating || importing} onClick={() => setShowJob(false)}>Back to editing</Button>}</div>
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
  const reviewLocked = unappliedYaml || Boolean(yaml.error);
  const acceptSuggestion = (suggestion: InterviewSuggestion) => {
    if (!isCurrent() || reviewLocked) return;
    try {
      editDraft(old => {
        if (!old.document) return old;
        const next = applyInterviewSuggestion(old.document, suggestion);
        return dismissInterviewSuggestion({ ...old, previous: { document: old.document, yamlText: old.yamlText, jobRequirements: old.jobRequirements, skillFilterVersion: old.skillFilterVersion, skillFilterInputFingerprint: old.skillFilterInputFingerprint, generationInputFingerprint: old.generationInputFingerprint, generationOutcome: old.generationOutcome, generationNotices: old.generationNotices }, document: next, yamlText: documentYaml(next) }, suggestion.id);
      });
    } catch (cause) { setError(message(cause)); }
  };
  const notices = <>{generationNotice(draft.generationOutcome, draft.generationNotices, draft.skillFilterVersion) && <p className="rb-warning" role="status">{generationNotice(draft.generationOutcome, draft.generationNotices, draft.skillFilterVersion)}</p>}{draft.document && <div className="rb-workbench-target" role="status">{targetReady ? <><strong>Target: {target.role!.title}</strong>{draft.jobRequirements !== targetText && <p>Your existing resume has not yet been tailored to this target role. Review new suggestions in Target &amp; AI.</p>}</> : <p>{target.status === "loading" ? "Loading your target role…" : target.status === "error" ? target.error : target.status === "empty" ? "This role has no required skills. Choose another career direction before generating." : "Select a career direction to continue. Your existing resume is still available."}</p>}{targetReady && (draft.skillFilterVersion !== SKILL_FILTER_VERSION || draft.skillFilterInputFingerprint !== inputFingerprint) && <p>Skills have not been filtered for the current target and inputs. Generate suggestions and apply the Skills chapter to update them.</p>}<Link to={ROUTES.possibilities}>Change target role</Link></div>}{draft.document && <ResumeReview draft={draft} locked={reviewLocked} onReview={() => change(old => ({ ...old, reviewed: reviewedMark(old) }))} onAccept={acceptSuggestion} onDismiss={id => change(old => dismissInterviewSuggestion(old, id))} />}{local.storageError && <div className="rb-warning" role="alert">{local.storageError} Your draft can still be exported; local recovery is not guaranteed.</div>}{error && <div className="rb-error" role="alert">{error}</div>}{draft.document?.cv.sections?.Skills?.length === 0 && <p className="rw-empty-skills" role="status">No skills yet. Add your skills to this draft.</p>}</>;
  return <>
    {draft.document ? <ResumeWorkbench document={draft.document} yamlText={draft.yamlText} yamlError={yaml.error} unappliedYaml={unappliedYaml} editDocument={editDocument} editYaml={editYaml} addSection={() => setAddingSection(true)} removeSection={setRemoveSection} undo={() => travelHistory("undo")} redo={() => travelHistory("redo")} canUndo={history.current.canUndo} canRedo={history.current.canRedo} saveStatus={local.saveStatus} notices={notices} pdf={pdf} freshPdf={freshPdf} rendering={rendering} renderError={renderError} retryRender={() => setRenderRetry(value => value + 1)} downloadPdf={() => { if (pdf && freshPdf) download(pdf, "resume.pdf"); }} downloadYaml={() => download(new Blob([draft.yamlText], { type: "text/yaml;charset=utf-8" }), "resume.yaml")} target={() => setShowJob(true)} courses={courses.length ? () => setShowCourses(true) : undefined} courseCount={courses.length} assistant={<ResumeAssistant key={owner} owner={owner} document={draft.document} documentVersion={local.editVersion} skills={candidates} jobRequirements={draft.jobRequirements} disabledReason={unappliedYaml || yaml.error ? "Fix the pending YAML before asking AI to edit." : generating || importing ? "Finish the current generation or import first." : skillError ? "Retry loading your saved skills before using AI." : skillsLoading ? "Loading your saved skills…" : capabilities?.ai_configured === false ? "AI is unavailable. You can still edit manually." : ""} apply={next => { if (!isCurrent() || unappliedYaml || yaml.error) return; editDraft(old => ({ ...old, previous: { document: old.document!, yamlText: old.yamlText, jobRequirements: old.jobRequirements, skillFilterVersion: old.skillFilterVersion, skillFilterInputFingerprint: old.skillFilterInputFingerprint, generationInputFingerprint: old.generationInputFingerprint, generationOutcome: old.generationOutcome, generationNotices: old.generationNotices }, document: next, yamlText: documentYaml(next), proposal: null })); }} />} more={() => setShowOptions(true)} /> : <div className="rb-page">
    <Link className="rb-back" to={ROUTES.possibilities}><ArrowLeft size={15} />Possibilities <span>/ Resume builder</span></Link>
    <PageHeader title="Make your next move." actions={<Button variant="ghost" size="icon" aria-label="Clear local resume data" onClick={() => setShowClear(true)}><Trash2 /></Button>} />
    <div className="rb-status-line"><span><ShieldCheck size={14} />Local draft</span><span role="status">{local.saveStatus || "Only this browser, on this device"}</span></div>
    {notices}{jobCard}{privacy}
  </div>}
    <Dialog open={Boolean(draft.document) && showJob} onOpenChange={setShowJob}><DialogContent className="rw-target-dialog"><DialogHeader><DialogTitle>Target & AI</DialogTitle><DialogDescription>Review your target and source before generating suggestions.</DialogDescription></DialogHeader>{error && <p className="rb-error" role="alert">{error}</p>}{jobCard}</DialogContent></Dialog>
    <ResumeCoursesDialog open={showCourses} onOpenChange={setShowCourses} courses={courses} saved={savedCourses} selected={selectedCourses} select={setSelectedCourses} saving={savingCourses} add={() => { void addCourses(); }} notice={courseNotice} />
    <Dialog open={showOptions} onOpenChange={setShowOptions}><DialogContent><DialogHeader><DialogTitle>Resume options</DialogTitle><DialogDescription>Manage this browser’s local draft.</DialogDescription></DialogHeader><div className="rw-options-actions"><Button variant="outline" onClick={() => download(new Blob([draft.yamlText], { type: "text/yaml;charset=utf-8" }), "resume.yaml")}>Download YAML</Button><Button variant="outline" disabled={!draft.previous || unappliedYaml} onClick={undoAi}><Undo2 />Undo AI changes</Button><Button variant="destructive" onClick={() => { setShowOptions(false); setShowClear(true); }}><Trash2 />Clear local resume data</Button></div>{privacy}</DialogContent></Dialog>

    <Dialog open={Boolean(draft.proposal)} onOpenChange={open => { if (!open) change(old => ({ ...old, proposal: null })); }}><DialogContent className="rb-proposal-dialog"><DialogHeader><DialogTitle>Review AI suggestions</DialogTitle><DialogDescription>Your current resume is unchanged. Choose the chapters to apply. Skills use standard matches plus AI relevance judgments; review them before applying. Learning choices do not claim proficiency. Personal information and unselected chapters are preserved.</DialogDescription></DialogHeader><div className="rb-proposals">{generationNotice(draft.proposal?.outcome, draft.proposal?.notices, draft.proposal?.skill_filter_version) && <p className="rb-warning" role="status">{generationNotice(draft.proposal?.outcome, draft.proposal?.notices, draft.proposal?.skill_filter_version)}</p>}{draft.proposal?.sections.map(section => <div key={section.title} className="rb-proposal"><label className="rb-check"><Checkbox checked={accepted.includes(section.title)} onCheckedChange={checked => setAccepted(old => checked ? [...old, section.title] : old.filter(title => title !== section.title))} /><strong>{section.title}</strong></label><div className="rb-compare"><div><small>CURRENT</small>{(draft.document?.cv.sections?.[section.title] ?? []).map((entry, i) => <p key={i}>{entryText(entry)}</p>)}</div><div><small>PROPOSED</small>{section.title === "Skills" && section.entries.length === 0 && draft.proposal?.skill_filter_version === SKILL_FILTER_VERSION && <p>No role-related skills were identified. Apply this chapter to remove the current Skills list.</p>}{section.entries.map((entry, i) => <div key={i}><p>{entry.project?.name ?? entry.text}</p>{entry.project && <><p>{entry.project.date}</p><ul>{entry.project.highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}</ul></>}<details className="rb-citations"><summary>Evidence ({entry.skill_ids.length + entry.fact_ids.length})</summary><ul>{entry.skill_ids.map(id => <li key={id}>{candidates.find(skill => skill.id === id)?.name ?? id}</li>)}{entry.fact_ids.map(id => <li key={id}>{reviewedFacts.find(fact => fact.id === id)?.text ?? id}</li>)}</ul></details></div>)}</div></div></div>)}</div><DialogFooter><Button variant="outline" onClick={() => change(old => ({ ...old, proposal: null }))}>Keep current resume</Button><Button disabled={!accepted.length || unappliedYaml || !targetReady || draft.proposal?.jobRequirements !== targetText || draft.proposal?.inputFingerprint !== inputFingerprint || skillsLoading || Boolean(skillError || sourceInput.error)} onClick={applyProposal}>Apply selected chapters</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showTarget} onOpenChange={setShowTarget}><DialogContent><DialogHeader><DialogTitle>Tailor for another role?</DialogTitle><DialogDescription>Only one current draft is kept. Export your existing resume first if you want a separate copy. Your current draft is not replaced until you apply the new suggestions.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => download(new Blob([draft.yamlText], { type: "text/yaml" }), "resume.yaml")}>Export YAML</Button><Button variant="outline" onClick={() => setShowTarget(false)}>Cancel</Button><Button onClick={() => { void generate(true); }}>Generate suggestions</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showClear} onOpenChange={setShowClear}><DialogContent><DialogHeader><DialogTitle>Clear this account’s local resume?</DialogTitle><DialogDescription>This removes your original file, personal-field mapping, draft and undo snapshot from this browser. Your selected career direction is kept, and its required skills will be loaded again. It does not remove courses or account data.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowClear(false)}>Cancel</Button><Button variant="destructive" onClick={() => { setClearing(true); abortRequests(); setGenerating(false); setImporting(false); void local.clear().then(() => { if (isCurrent()) { history.current.clear(); refreshHistory(value => value + 1); setPdf(null); setPdfKey(""); setShowClear(false); setShowJob(false); setError(""); setRenderError(""); setSelectedCourses([]); } }).catch(cause => { if (isCurrent()) { setError(message(cause)); setRenderRetry(value => value + 1); } }).finally(() => { if (isCurrent()) setClearing(false); }); }}>Clear local resume</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={addingSection} onOpenChange={setAddingSection}><DialogContent><DialogHeader><DialogTitle>Add a resume chapter</DialogTitle><DialogDescription>Start with an empty chapter and enter only your own facts.</DialogDescription></DialogHeader><FormField label="Chapter title"><Input value={newSection} maxLength={100} onChange={event => setNewSection(event.target.value)} placeholder="Projects, Education, Experience…" /></FormField><DialogFooter><Button variant="outline" onClick={() => setAddingSection(false)}>Cancel</Button><Button disabled={!newSection.trim() || sections.includes(newSection.trim()) || newSection.trim().startsWith("@") || ["__proto__", "constructor", "prototype"].includes(newSection.trim())} onClick={() => { if (!draft.document) return; const title = newSection.trim(); editDocument({ ...draft.document, cv: { ...draft.document.cv, sections: { ...draft.document.cv.sections, [title]: [] } } }); setNewSection(""); setAddingSection(false); }}>Add chapter</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(removeSection)} onOpenChange={open => { if (!open) setRemoveSection(""); }}><DialogContent><DialogHeader><DialogTitle>Remove {removeSection}?</DialogTitle><DialogDescription>All entries in this chapter will be removed from the current draft. Export first if you need a copy.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRemoveSection("")}>Cancel</Button><Button variant="destructive" onClick={() => { if (!draft.document) return; const sections = { ...draft.document.cv.sections }; delete sections[removeSection]; editDocument({ ...draft.document, cv: { ...draft.document.cv, sections } }); setRemoveSection(""); }}>Remove chapter</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
