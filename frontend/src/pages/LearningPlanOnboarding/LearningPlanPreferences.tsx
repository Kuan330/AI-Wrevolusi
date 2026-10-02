import { useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowRight, Check, FileText, Link2, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import type { LearningPlanInputs } from "@/features/learning-goals/personalLearningPlan";
import {
  addPlanResource, MAX_PLAN_RESOURCES, normalizeResourceUrl, RESOURCE_ACCEPT,
  setupInputs, validateResourceFile, validateSetupDraft,
} from "@/features/learning-goals/learningPlanSetup";
import type { LearningPlanResource, LearningPlanSetupDraft } from "@/features/learning-goals/learningPlanSetup";
import "./learning-plan-preferences.css";

export type LearningPlanPreferencesProps = {
  goalTitle: string;
  initialInputs?: LearningPlanInputs;
  initialResources?: LearningPlanResource[];
  disabled?: boolean;
  busy?: boolean;
  loading?: boolean;
  error?: string;
  onSubmit: (inputs: LearningPlanInputs, resources: LearningPlanResource[]) => void | Promise<void>;
  onCancel?: () => void;
  onGoalTextChange: (text: string) => void;
};

const experiences = [
  { value: "new", title: "New to it", detail: "Start with the foundations" },
  { value: "some", title: "Some experience", detail: "Build on what I already know" },
  { value: "comfortable", title: "Pretty comfortable", detail: "Go deeper and apply it" },
] as const;
const motivations = [
  { value: "career", title: "My career" },
  { value: "skill", title: "My current job" },
  { value: "confidence", title: "Build confidence" },
  { value: "curiosity", title: "Curiosity" },
] as const;
const timeOptions = [15, 30, 60] as const;
const readableError = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

/** Preferences step for first-time learning-plan setup within our own workspace. */
export default function LearningPlanPreferences({ goalTitle, initialInputs, initialResources = [], disabled = false, busy = false, loading = false, error = "", onSubmit, onCancel, onGoalTextChange }: LearningPlanPreferencesProps) {
  const id = useId();
  const [draft, setDraft] = useState<LearningPlanSetupDraft>(() => ({
    goalText: initialInputs?.goalText ?? goalTitle,
    experience: initialInputs?.experience ?? "",
    minutesPerDay: initialInputs?.minutesPerDay ?? "",
    goalKind: initialInputs?.goalKind ?? "",
  }));
  const values = { ...draft, goalText: goalTitle };
  const [editingGoal, setEditingGoal] = useState(!goalTitle.trim());
  const [resources, setResources] = useState<LearningPlanResource[]>(initialResources);
  const [showLink, setShowLink] = useState(false);
  const [link, setLink] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [pending, setPending] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const operation = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const blocked = disabled || busy || pending || readingFile;
  const submitBlocked = blocked || loading || Boolean(validateSetupDraft(values)) || editingGoal;
  const hasExtraTime = draft.minutesPerDay === 45 || draft.minutesPerDay === 90;

  const attachFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || operation.current || disabled || busy) return;
    setResourceError("");
    const fileError = validateResourceFile(file);
    if (fileError) { setResourceError(fileError); return; }
    operation.current = true;
    setReadingFile(true);
    try {
      const text = await file.text();
      setResources(addPlanResource(resources, { id: crypto.randomUUID(), kind: "file", name: file.name, text, sizeBytes: file.size }));
    } catch (cause) { setResourceError(readableError(cause)); }
    finally { operation.current = false; setReadingFile(false); }
  };
  // Validate outside state updaters: a failed resource must never crash a React render.
  const attachLink = () => {
    try {
      const url = normalizeResourceUrl(link);
      const next = addPlanResource(resources, { id: crypto.randomUUID(), kind: "link", name: new URL(url).hostname, url });
      setResources(next); setLink(""); setShowLink(false); setResourceError("");
    } catch (cause) { setResourceError(readableError(cause)); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operation.current || disabled || busy || loading || editingGoal) return;
    const validation = validateSetupDraft(values);
    if (validation) { setSubmitError(validation); return; }
    operation.current = true;
    setPending(true); setSubmitError("");
    try { await onSubmit(setupInputs(values), resources.map(resource => ({ ...resource }))); }
    catch (cause) { setSubmitError(readableError(cause)); }
    finally { operation.current = false; setPending(false); }
  };

  return <form className="learning-plan-setup" onSubmit={submit} aria-label="Configure your learning plan" aria-busy={busy || pending || readingFile}>
    <fieldset className="lps-controls" disabled={blocked}>
      <div className="lps-goal">
        <span className="lps-kicker">Your learning goal</span>
        {editingGoal ? <div className="lps-goal-editor">
          <label htmlFor={`${id}-goal`}>What would you like to learn?</label>
          <textarea id={`${id}-goal`} autoFocus rows={2} maxLength={300} value={goalTitle} onChange={event => onGoalTextChange(event.target.value)} aria-describedby={`${id}-goal-hint`} />
          <div className="lps-edit-footer"><span id={`${id}-goal-hint`}>{goalTitle.length}/300 · Your goal will be saved when you build your plan.</span><button type="button" disabled={!goalTitle.trim()} onClick={() => setEditingGoal(false)}><Check size={15} aria-hidden="true" /> Keep this wording</button></div>
        </div> : <><h3 className="lps-goal-title">“{goalTitle}”</h3><button className="lps-text-button" type="button" onClick={() => setEditingGoal(true)}><Pencil size={14} aria-hidden="true" /> Say it differently</button></>}
      </div>
      <p className="lps-intro">Two quick choices, and we’ll build a plan that fits you.</p>
      <fieldset className="lps-question"><legend>Where are you starting from?</legend><div className="lps-level-options">
        {experiences.map(option => <label className="lps-choice lps-level" key={option.value}>
          <input type="radio" name={`${id}-experience`} value={option.value} checked={draft.experience === option.value} onChange={() => setDraft({ ...draft, experience: option.value })} required />
          <span className="lps-choice-content"><span className="lps-choice-title">{option.title}<Check size={15} className="lps-selected-icon" aria-hidden="true" /></span><span className="lps-choice-detail">{option.detail}</span></span>
        </label>)}
      </div></fieldset>
      <fieldset className="lps-question"><legend>How much time can you give it a day?</legend><div className="lps-pill-options">
        {[...timeOptions, ...(hasExtraTime ? [draft.minutesPerDay as 45 | 90] : [])].sort((a, b) => a - b).map(minutes => <label className="lps-choice lps-pill" key={minutes}><input type="radio" name={`${id}-minutes`} value={minutes} checked={draft.minutesPerDay === minutes} onChange={() => setDraft({ ...draft, minutesPerDay: minutes })} required /><span className="lps-choice-content">{minutes === 60 ? "1 hour" : minutes === 90 ? "1½ hours" : `${minutes} min`}<Check size={14} className="lps-selected-icon" aria-hidden="true" /></span></label>)}
      </div><p className="lps-hint">A small, regular session is a good place to start. You can change this later.</p></fieldset>
      <fieldset className="lps-question"><legend>What is this for? <span className="lps-optional">Optional</span></legend><div className="lps-pill-options">
        {motivations.map(option => <label className="lps-choice lps-pill" key={option.value}><input type="radio" name={`${id}-motivation`} value={option.value} checked={draft.goalKind === option.value} onChange={() => setDraft({ ...draft, goalKind: option.value })} /><span className="lps-choice-content">{option.title}<Check size={14} className="lps-selected-icon" aria-hidden="true" /></span></label>)}
        {draft.goalKind && <button type="button" className="lps-text-button" onClick={() => setDraft({ ...draft, goalKind: "" })}>Clear choice</button>}
      </div></fieldset>
      <section className="lps-question" aria-labelledby={`${id}-resources`}>
        <h4 id={`${id}-resources`}>Your resources <span className="lps-optional">Optional</span></h4>
        <p className="lps-hint">Attach your own reference material, or start with courses from our catalogue.</p>
        <p className="lps-hint">TXT, MD or CSV · up to 1 MB and 20,000 characters per file · up to 5 resources. Files stay as text references; links are not automatically opened or analysed.</p>
        <input ref={fileInput} type="file" className="lps-file-input" accept={RESOURCE_ACCEPT} onChange={event => { void attachFile(event); }} aria-label="Attach a text reference file" tabIndex={-1} />
        <div className="lps-resource-actions"><button type="button" disabled={resources.length >= MAX_PLAN_RESOURCES} onClick={() => fileInput.current?.click()}><Plus size={16} aria-hidden="true" /> Attach file</button><button type="button" disabled={resources.length >= MAX_PLAN_RESOURCES} onClick={() => { setShowLink(value => !value); setResourceError(""); }} aria-expanded={showLink} aria-controls={`${id}-link-editor`}><Link2 size={16} aria-hidden="true" /> Paste link</button></div>
        {showLink && <div className="lps-link-editor" id={`${id}-link-editor`}><label htmlFor={`${id}-url`}>Resource link</label><div><input id={`${id}-url`} type="url" maxLength={2048} autoFocus placeholder="https://…" value={link} onChange={event => setLink(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); attachLink(); } }} /><button type="button" disabled={!link.trim()} onClick={attachLink}>Add link</button><button type="button" onClick={() => { setShowLink(false); setLink(""); setResourceError(""); }}>Cancel</button></div></div>}
        {resourceError && <p className="lps-error" role="alert">{resourceError}</p>}
        {resources.length > 0 && <ul className="lps-resources" aria-label="Attached references">{resources.map(resource => <li key={resource.id}>{resource.kind === "file" ? <FileText size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}<div><strong>{resource.name}</strong><span>{resource.kind === "link" ? resource.url : `${Math.ceil((resource.sizeBytes ?? 0) / 1024)} KB · Text reference`}</span></div><button type="button" aria-label={`Remove ${resource.name}`} onClick={() => { setResources(current => current.filter(item => item.id !== resource.id)); setResourceError(""); }}><X size={16} aria-hidden="true" /></button></li>)}</ul>}
        <p className="lps-privacy">Leave out passwords, personal details and confidential work information. References are saved with your plan when you build it.</p>
      </section>
    </fieldset>
    {(error || submitError) && <p className="lps-error" role="alert">{error || submitError}</p>}
    <div className="lps-footer"><button className="lps-submit" type="submit" disabled={submitBlocked}>{busy || pending || loading || readingFile ? <LoaderCircle size={17} className="lps-spinner" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}{busy || pending ? "Building your plan…" : readingFile ? "Reading file…" : loading ? "Loading courses…" : "Build my plan"}</button>{onCancel && <button type="button" disabled={blocked} onClick={onCancel}>Back to my goal</button>}</div>
    <p className="lps-hint" aria-live="polite">{!draft.experience || !draft.minutesPerDay ? "Choose your starting level and daily time to continue." : "You’ll review the plan before adding courses to My courses."}</p>
    {(busy || pending) && <p className="lps-progress" role="status">Preparing a starting sequence from your goal and the available courses. Your setup is completed only after the plan has been saved successfully.</p>}
  </form>;
}
