import { useEffect, useRef, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Check, CheckCheck, ChevronDown, ClipboardList, LoaderCircle, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { referenceService } from "@/services/referenceService";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { confirmWorkDraft, readWorkDraft, startWorkDraft, updateWorkDraft, workDraftNeedsMatchReview } from "@/features/work-profile/workProfileDraft";
import type { ProfileTask, TaskEditorValues } from "@/features/work-profile/types";
import type { ReferenceOccupation } from "@/types/reference";
import { cleanDisplayText, taskDisplayText } from "@/lib/displayText";
import { useOccupationFilters } from "../hooks/useOccupationFilters";
import { useWorkDraft } from "../hooks/useWorkDraft";
import { toProfileTask } from "../taskFactory";
import TaskEditorDialog from "./TaskEditorDialog";
import "../work-scene.css";

const emptyValues: TaskEditorValues = { wording: "", notes: "", timeSpent: "" };

type Props = { confirmed: boolean; cancelling: boolean; onSaved: () => void; onCancel: () => void };
export default function WorkSceneEditor({ confirmed, cancelling, onSaved, onCancel }: Props) {
  const { draft, error: readError } = useWorkDraft();
  const search = useOccupationFilters();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [failedOccupation, setFailedOccupation] = useState<ReferenceOccupation | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [editor, setEditor] = useState<{ task: ProfileTask | null; values: TaskEditorValues } | null>(null);
  const [removed, setRemoved] = useState<{ task: ProfileTask; index: number } | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleOverflow, setRoleOverflow] = useState(false);
  const request = useRef(0);
  const roleCopy = useRef<HTMLParagraphElement>(null);
  const mounted = useRef(false);
  const searchBox = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const jobTitle = draft?.jobTitle ?? "";
  const occupation = draft?.occupation?.unit;
  const roleDescription = occupation ? cleanDisplayText(occupation.description ?? "A description is not available for this role.") : "";
  const needsReview = draft ? workDraftNeedsMatchReview(draft) : false;
  const ready = Boolean(occupation && !needsReview && !loading && !failedOccupation);
  const locked = saving || cancelling;
  const tasks = draft?.tasks ?? [];
  const filtered = tasks.filter(task => `${task.wording} ${task.notes ?? ""}`.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  const dropdown = open && jobTitle.trim().length >= 2;

  useEffect(() => {
    mounted.current = true;
    try { startWorkDraft("job"); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not open your work draft."); }
    return () => { mounted.current = false; request.current += 1; };
  }, []);
  useEffect(() => { search.setQuery(jobTitle); setActive(-1); }, [jobTitle, search.setQuery]);
  useEffect(() => { setRoleOpen(false); }, [occupation?.occupation_code]);
  useEffect(() => {
    const node = roleCopy.current;
    if (!node || roleOpen) return;
    const measure = () => setRoleOverflow(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [roleDescription, roleOpen, occupation?.occupation_code]);
  useEffect(() => {
    function outside(event: PointerEvent) { if (!searchBox.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => { if (active >= 0) document.getElementById(`job-option-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  function changeTitle(value: string) {
    request.current += 1;
    setLoading(false); setFailedOccupation(null); setRemoved(null); setOpen(true);
    try { updateWorkDraft({ jobTitle: value, stage: "job" }); setError(""); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not update your draft."); }
  }
  async function choose(unit: ReferenceOccupation, retry = false) {
    const existing = readWorkDraft();
    if (!retry && unit.occupation_code === existing?.occupation?.unit.occupation_code && !failedOccupation && !loading) {
      updateWorkDraft({ jobTitle: unit.title, occupation: existing.occupation });
      setOpen(false); setError("");
      return;
    }
    const id = ++request.current;
    const owner = currentWorkspaceSession();
    const current = () => mounted.current && request.current === id && owner === currentWorkspaceSession();
    setOpen(false); setFilter(""); setRemoved(null); setError(""); setLoading(true); setFailedOccupation(null);
    try {
      updateWorkDraft({ jobTitle: unit.title, occupation: { unit, path: [unit], source: { name: "Occupation reference catalogue", version: null, recordId: unit.occupation_code } }, tasks: [], stage: "job" });
      const rows = await referenceService.tasks(unit.occupation_code);
      if (!current()) return;
      // Keep the existing draft limit explicit instead of silently truncating reference tasks.
      if (rows.length > 50) throw new Error("This occupation has more than 50 reference tasks. Please choose a more specific job.");
      updateWorkDraft({ tasks: rows.map(row => toProfileTask(row.task_text, "ilo", { iloTaskId: row.task_id, sourceOccupationCode: unit.occupation_code, sourceVersion: "ILO 2025", score2025: row.score_2025, potential25: row.potential25, meanScore2025: row.mean_score_2025 })) });
      list.current?.scrollTo({ top: 0 });
    } catch (issue) {
      if (current()) { setFailedOccupation(unit); setError(issue instanceof Error ? issue.message : "Tasks could not load. Please retry."); }
    } finally { if (current()) setLoading(false); }
  }
  function replaceTasks(next: ProfileTask[]) { updateWorkDraft({ tasks: next, stage: "job" }); setError(""); }
  function saveTask(values: TaskEditorValues) {
    const task = editor?.task;
    replaceTasks(task ? tasks.map(item => item.id === task.id ? { ...item, ...values, score2025: values.wording !== (item.originalWording ?? item.wording) ? null : item.score2025 } : item) : [...tasks, toProfileTask(values.wording, "user", values)]);
  }
  function removeTask(task: ProfileTask) {
    try { replaceTasks(tasks.filter(item => item.id !== task.id)); setRemoved({ task, index: tasks.findIndex(item => item.id === task.id) }); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not remove this task."); }
  }
  function undo() {
    if (!removed) return;
    try { const next = [...tasks]; next.splice(removed.index, 0, removed.task); replaceTasks(next); setRemoved(null); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not restore this task."); }
  }
  async function save() {
    if (!ready || !tasks.length || locked) return;
    const owner = currentWorkspaceSession();
    setSaving(true); setError("");
    try { await confirmWorkDraft(); if (mounted.current && owner === currentWorkspaceSession()) onSaved(); }
    catch (issue) { if (mounted.current && owner === currentWorkspaceSession()) setError(issue instanceof Error ? issue.message : "Could not save your work. Please retry."); }
    finally { if (mounted.current && owner === currentWorkspaceSession()) setSaving(false); }
  }
  return <div className="work-scene">
    <header className="work-scene-heading">
      <p className="work-scene-eyebrow">YOUR WORK, IN YOUR WORDS</p>
      <PageHeader title="Make this work profile yours." description="Find your role, then shape the task list around what you actually do." />
    </header>
    {confirmed && <div className="work-scene-preserved"><ShieldCheck size={18} /><span>Your confirmed profile stays safe. Saving this version keeps your previous work in history.</span></div>}
    <fieldset disabled={locked} className="work-scene-layout">
      <legend className="sr-only">Your job and everyday tasks</legend>
      <section className="work-scene-role" aria-labelledby="role-heading">
        <div className="work-scene-section-heading"><div><h2 id="role-heading">Find your role</h2><p>A starting point for your real work.</p></div></div>
        <div className="work-scene-search" ref={searchBox} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
          <label htmlFor="scene-job-title">Job title</label>
          <div className="work-scene-input-wrap"><Search size={18} aria-hidden="true" />
            <input id="scene-job-title" role="combobox" autoComplete="off" maxLength={200} value={jobTitle} placeholder="Search e.g. teacher, sales assistant"
              aria-expanded={dropdown} aria-controls="scene-job-results" aria-autocomplete="list" aria-activedescendant={dropdown && active >= 0 ? `job-option-${active}` : undefined} aria-describedby="scene-job-help"
              onFocus={() => setOpen(true)} onChange={event => changeTitle(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Escape") { setOpen(false); setActive(-1); }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(index => search.results.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + search.results.length) % search.results.length : -1); }
                if (event.key === "Enter" && dropdown && !search.searching && active >= 0 && search.results[active]) { event.preventDefault(); void choose(search.results[active]); }
              }} />
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <p id="scene-job-help">Choose a job from the suggestions to load its tasks.</p>
          {dropdown && <div className="work-scene-dropdown">
            <ul id="scene-job-results" role="listbox" aria-label="Matching jobs" aria-busy={search.searching}>
              {!search.searching && search.results.map((unit, index) => <li key={unit.occupation_code} id={`job-option-${index}`} role="option" aria-selected={unit.occupation_code === occupation?.occupation_code && !needsReview} className={active === index ? "is-active" : ""} onMouseDown={event => event.preventDefault()} onClick={() => { void choose(unit); }}>
                <BriefcaseBusiness size={16} aria-hidden="true" /><span>{cleanDisplayText(unit.title)}</span>{unit.occupation_code === occupation?.occupation_code && !needsReview && <Check size={16} aria-hidden="true" />}
              </li>)}
            </ul>
            {search.searching ? <p role="status"><LoaderCircle className="animate-spin" size={16} />Finding matching jobs…</p> : search.searchError ? <p role="alert">Jobs could not load. <button type="button" onClick={search.retry}>Try again</button></p> : !search.results.length && <p role="status">No matching jobs. Try a different title or keyword.</p>}
          </div>}
        </div>
        {occupation && !needsReview ? <div className="work-scene-description">
          <span className="work-scene-selection"><Check size={13} />Selected role</span>
          <h3>{cleanDisplayText(occupation.title)}</h3>
          <h4>About this role</h4>
          <p ref={roleCopy} className={roleOpen ? undefined : "is-clamped"}>{roleDescription}</p>
          {roleOverflow && <button type="button" className="work-scene-description-more" aria-expanded={roleOpen} onClick={() => setRoleOpen(value => !value)}>{roleOpen ? "Show less" : "Show more"}</button>}
        </div> : <div className="work-scene-role-empty"><BriefcaseBusiness size={28} strokeWidth={1.4} /><h3>{needsReview ? "Choose your updated role" : "Start with your job title"}</h3><p>{needsReview ? "Select a suggestion to update the role and its tasks together." : "Your role description will appear here once you choose a job."}</p></div>}
        <p className="work-scene-switch-note">Choosing a different role replaces the tasks in this draft.</p>
      </section>
      <section className="work-scene-tasks" aria-labelledby="tasks-heading" aria-busy={loading}>
        <div className="work-scene-task-heading"><div className="work-scene-section-heading"><div><h2 id="tasks-heading">Your everyday tasks <span className="work-scene-count">{ready ? tasks.length : "—"}</span></h2><p>Keep what fits. Edit the details. Remove the rest.</p></div></div><Button variant="outline" disabled={!ready || tasks.length >= 50} onClick={() => setEditor({ task: null, values: emptyValues })}><Plus />Add task</Button></div>
        <div className="work-scene-task-search"><Search size={16} aria-hidden="true" /><input aria-label="Search your tasks" placeholder="Find a task in this list" disabled={!ready} value={filter} onChange={event => setFilter(event.target.value)} />{filter && <button type="button" aria-label="Clear task search" onClick={() => setFilter("")}><X size={16} /></button>}</div>
        <div className="work-scene-task-list" ref={list} tabIndex={0} role="region" aria-label="Scrollable task list">
          {loading ? <div className="work-scene-task-empty" role="status"><LoaderCircle className="animate-spin" size={28} /><h3>Loading tasks for your role…</h3><p>Preparing a copy you can make your own.</p></div> : failedOccupation ? <div className="work-scene-task-empty"><ClipboardList size={30} /><h3>Tasks could not load</h3><p>Your confirmed work has not changed.</p><Button variant="outline" onClick={() => { void choose(failedOccupation, true); }}>Retry tasks</Button></div> : !ready ? <div className="work-scene-task-empty"><span className="work-scene-empty-icon"><ClipboardList size={32} strokeWidth={1.4} /></span><h3>Your work takes shape here</h3><p>Choose a role on the left to see its tasks. Then adjust them to reflect your day.</p></div> : filtered.length ? <ol>{filtered.map(task => <li key={task.id} className="work-scene-task-card">
            <div className="work-scene-task-top"><span className="work-scene-task-number">{String(tasks.indexOf(task) + 1).padStart(2, "0")}</span><span className="work-scene-task-source">{task.source === "user" ? "Added by you" : task.originalWording !== task.wording ? "Personalised task" : "Suggested task"}</span><div className="work-scene-task-actions"><button type="button" aria-label={`Edit task ${tasks.indexOf(task) + 1}`} onClick={() => setEditor({ task, values: { wording: taskDisplayText(task.wording), notes: task.notes ?? "", timeSpent: task.timeSpent } })}><Pencil size={15} /></button><button type="button" aria-label={`Remove task ${tasks.indexOf(task) + 1}`} onClick={() => removeTask(task)}><Trash2 size={15} /></button></div></div>
            <p>{taskDisplayText(task.wording)}</p>{task.notes && <details><summary>Your working context</summary><p>{task.notes}</p></details>}
          </li>)}</ol> : <div className="work-scene-task-empty"><Search size={28} /><h3>{tasks.length ? "No tasks match your search" : "What else do you do?"}</h3><p>{tasks.length ? "Try another keyword or clear the search." : "Add at least one task that describes your everyday work."}</p><Button variant="outline" onClick={() => tasks.length ? setFilter("") : setEditor({ task: null, values: emptyValues })}>{tasks.length ? "Clear search" : "Add your first task"}</Button></div>}
        </div>
        <div className="work-scene-task-footer" role="status">{removed && ready ? <><span>Task removed from your draft.</span><button type="button" disabled={tasks.length >= 50} onClick={undo}>Undo</button></> : <><ShieldCheck size={15} /><span>These are your copies. Changes only affect your work profile.</span></>}</div>
      </section>
    </fieldset>
    {(error || readError) && <p role="alert" className="work-scene-error">{error || readError}</p>}
    <footer className="work-scene-save"><div><CheckCheck size={22} /><div><h3>Does this reflect your real work?</h3><p>{ready ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} ready for your review. Save when the list feels right.` : "Choose a role and review its tasks before saving."}</p></div></div><div className="work-scene-save-actions"><Button variant="ghost" disabled={locked} onClick={onCancel}>{confirmed ? "Cancel changes" : "Clear draft"}</Button><Button className="work-scene-confirm" disabled={!ready || !tasks.length || locked} onClick={() => { void save(); }}>{saving ? <LoaderCircle className="animate-spin" /> : null}{saving ? "Saving your work…" : "Save and explore AI impact"}{!saving && <ArrowRight />}</Button></div></footer>
    {editor && <TaskEditorDialog open mode={editor.task ? "edit" : "add"} initialValues={editor.values} occupationCode={ready ? occupation?.occupation_code : undefined} existingTasks={tasks} editingTaskId={editor.task?.id} onClose={() => setEditor(null)} onSave={saveTask} />}
  </div>;
}
