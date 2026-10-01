import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { currentWorkspaceSession, flushWorkspace } from "@/services/accountStorage";
import { referenceService } from "@/services/referenceService";
import { taskSourceLabel } from "@/features/work-profile/taskSourceLabel";
import type { ReferenceTask } from "@/types/reference";
import type { ProfileTask, TaskEditorValues } from "@/features/work-profile/types";
import { startWorkDraft, updateWorkDraft, discardWorkDraft, confirmWorkDraft, workDraftNeedsMatchReview } from "@/features/work-profile/workProfileDraft";
import { useWorkDraft } from "./hooks/useWorkDraft";
import { toProfileTask } from "./taskFactory";
import TaskEditorDialog from "./components/TaskEditorDialog";

const emptyValues: TaskEditorValues = { wording: "", timeSpent: "", notes: "" };
export default function ProfileTasks() {
  const navigate = useNavigate();
  const { draft, profile, error: readError } = useWorkDraft();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{ task: ProfileTask | null; values: TaskEditorValues } | null>(null);
  const [suggestions, setSuggestions] = useState<ReferenceTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const code = draft?.occupation?.unit.occupation_code;
  const initialised = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    if (readError) return;
    try { startWorkDraft("tasks"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not open the task draft."); }
  }, [draft, readError]);
  useEffect(() => {
    let active = true;
    const owner = currentWorkspaceSession();
    setSuggestions([]); setSuggestionError("");
    if (!code) { setLoading(false); return; }
    setLoading(true);
    void referenceService.tasks(code).then(rows => { if (active && owner === currentWorkspaceSession()) setSuggestions(rows); })
      .catch(() => { if (active && owner === currentWorkspaceSession()) setSuggestionError("Suggestions could not load. You can add your own tasks."); })
      .finally(() => { if (active && owner === currentWorkspaceSession()) setLoading(false); });
    return () => { active = false; };
  }, [code, attempt]);

  function replaceTasks(tasks: ProfileTask[]) {
    updateWorkDraft({ tasks, stage: "tasks" });
    setError(""); setSavedMessage("");
  }
  function keepSuggestion(row: ReferenceTask) {
    if (!draft || draft.tasks.some(task => task.iloTaskId === row.task_id && task.wording === row.task_text)) return;
    try { replaceTasks([...draft.tasks, toProfileTask(row.task_text, "ilo", { iloTaskId: row.task_id, sourceOccupationCode: code, sourceVersion: "ILO 2025", score2025: row.score_2025, potential25: row.potential25, meanScore2025: row.mean_score_2025 })]); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not add this task."); }
  }
  function saveTask(values: TaskEditorValues) {
    if (!draft || !editor) return;
    const currentTask = editor.task;
    const next = currentTask ? draft.tasks.map(task => task.id !== currentTask.id ? task : {
      ...task, wording: values.wording, notes: values.notes, timeSpent: values.timeSpent,
      score2025: values.wording !== (task.originalWording ?? task.wording) ? null : task.score2025,
    }) : [...draft.tasks, toProfileTask(values.wording, "user", values)];
    replaceTasks(next);
  }
  async function finish() {
    const owner = currentWorkspaceSession();
    setBusy(true); setError("");
    try { await confirmWorkDraft(); if (mounted.current && owner === currentWorkspaceSession()) navigate(ROUTES.aiExposure, { replace: true }); }
    catch (issue) { if (mounted.current && owner === currentWorkspaceSession()) setError(issue instanceof Error ? issue.message : "Your work could not be saved. Your draft is kept; please retry."); }
    finally { if (mounted.current && owner === currentWorkspaceSession()) setBusy(false); }
  }
  async function cancel() {
    const owner = currentWorkspaceSession();
    setBusy(true); setError("");
    try { await discardWorkDraft(); if (mounted.current && owner === currentWorkspaceSession()) navigate(ROUTES.workProfile, { replace: true }); }
    catch (issue) { if (mounted.current && owner === currentWorkspaceSession()) setError(issue instanceof Error ? issue.message : "Could not discard your draft."); }
    finally { if (mounted.current && owner === currentWorkspaceSession()) setBusy(false); }
  }
  async function saveForLater() {
    const owner = currentWorkspaceSession();
    setBusy(true); setError("");
    try { await flushWorkspace(); if (mounted.current && owner === currentWorkspaceSession()) setSavedMessage("Draft saved. Your tasks are not confirmed yet."); }
    catch (issue) { if (mounted.current && owner === currentWorkspaceSession()) setError(issue instanceof Error ? issue.message : "Your draft is kept on this browser but has not synced. Retry when connected."); }
    finally { if (mounted.current && owner === currentWorkspaceSession()) setBusy(false); }
  }
  if (readError) return <section role="alert" className="profile-glass-card p-6"><h1 className="text-xl font-semibold">Your work needs attention</h1><p className="my-3">{readError} Your saved work has not been replaced.</p><Button onClick={() => window.location.reload()}>Reload saved work</Button></section>;
  if (!draft) return <p role="status">{error || "Opening your work draft…"}</p>;
  if (!draft.jobTitle.trim()) return <section className="profile-glass-card space-y-3 p-5"><h1 className="text-xl font-semibold">Start with your job title</h1><p>You can use your own title even if there is no matching occupation.</p><Button asChild><Link to={`${ROUTES.workProfile}?edit=job`}>Describe my job</Link></Button></section>;
  const available = suggestions.filter(row => !draft.tasks.some(task => task.iloTaskId === row.task_id && task.wording === row.task_text));
  const visible = showAll ? available : available.slice(0, 3);
  return <div className="space-y-5">
    <p className="text-sm text-primary" aria-label="Work setup progress">1. Your job <span aria-hidden="true">→</span> <strong>2. Your tasks</strong></p>
    <PageHeader className="flex-col items-start sm:flex-row sm:items-center" title="What do you usually do?" description={`Describe your work as ${draft.jobTitle}. One clear task is enough to start.`} />
    <fieldset disabled={busy} className="space-y-5">
      <legend className="sr-only">Review your task draft</legend>
      <section className="profile-glass-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Tasks in your draft</h2><Button variant="outline" disabled={draft.tasks.length >= 50} onClick={() => setEditor({ task: null, values: emptyValues })}>Add my own task</Button></div>
        {!draft.tasks.length && <p className="text-sm text-muted-foreground">For example: “I check customer orders for missing details.” Add your own task or choose a suggestion below.</p>}
        <ul className="divide-y divide-border">{draft.tasks.map(task => <li key={task.id} className="space-y-2 py-3">
          <p className="leading-6">{task.wording}</p><p className="text-xs text-muted-foreground">{taskSourceLabel(task)}</p>
          <div className="flex gap-2"><Button variant="link" className="min-h-11 px-0" onClick={() => setEditor({ task, values: { wording: task.wording, timeSpent: task.timeSpent, notes: task.notes ?? "" } })}>Edit task</Button><Button variant="ghost" className="min-h-11" onClick={() => { try { replaceTasks(draft.tasks.filter(item => item.id !== task.id)); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not remove this draft task."); } }}>Remove from draft</Button></div>
        </li>)}</ul>
      </section>
      {code && <details className="profile-glass-card p-5" open={draft.tasks.length === 0 ? true : undefined}>
        <summary className="cursor-pointer font-semibold">Need ideas? Tasks from the reference occupation</summary>
        <p className="mt-3 text-sm text-muted-foreground">These are suggestions, not confirmed work. Keep only tasks you actually do.</p>
        {loading ? <p role="status" className="mt-3 text-sm">Loading suggestions…</p> : suggestionError ? <p role="status" className="mt-3 text-sm">{suggestionError} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Retry suggestions</button></p> : <>
          <ul className="mt-3 divide-y divide-border">{visible.map(row => <li key={row.task_id} className="space-y-2 py-3"><p className="text-sm leading-6">{row.task_text}</p><Button variant="outline" size="sm" disabled={draft.tasks.length >= 50} onClick={() => keepSuggestion(row)}>I do this task</Button></li>)}</ul>
          {!available.length && <p className="mt-3 text-sm">No more suggestions are available. You can add tasks in your own words.</p>}
          {available.length > 3 && <Button variant="link" onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer suggestions" : "Show more suggestions"}</Button>}
        </>}
      </details>}
      <section className="profile-glass-card space-y-3 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Ready to save your work?</h2>
        <p className="text-sm">You are confirming {draft.tasks.length} {draft.tasks.length === 1 ? "task" : "tasks"} for “{draft.jobTitle}”. This list will be used for AI findings and skill suggestions.</p>
        <p className="text-sm"><strong>Reference match:</strong> {draft.occupation?.unit.title ?? "No reference match — using your own title"}</p>
        {workDraftNeedsMatchReview(draft) && <p role="alert" className="text-sm text-destructive">Your title changed. Go back to your job to keep, replace or remove the reference before saving.</p>}
        <p className="text-sm text-muted-foreground">{profile?.tasksConfirmed ? "Your current confirmed profile stays unchanged until this save succeeds." : "You can edit your work later. No AI analysis runs when you save."}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {savedMessage && <p role="status" className="text-sm">{savedMessage}</p>}
        <div className="flex flex-wrap gap-3"><Button disabled={busy || !draft.tasks.length || workDraftNeedsMatchReview(draft)} onClick={() => { void finish(); }}>{busy ? "Saving…" : "Save my work"}</Button><Button variant="outline" disabled={busy} onClick={() => { void saveForLater(); }}>Save draft for later</Button><Button variant="ghost" disabled={busy} onClick={() => { void cancel(); }}>{profile?.tasksConfirmed ? "Cancel changes" : "Discard draft"}</Button></div>
        <Button asChild variant="link" className="px-0"><Link to={`${ROUTES.workProfile}?edit=job`}>Back to my job</Link></Button>
      </section>
    </fieldset>
    {editor && <TaskEditorDialog open mode={editor.task ? "edit" : "add"} initialValues={editor.values} occupationCode={code} existingTasks={draft.tasks} editingTaskId={editor.task?.id} onClose={() => setEditor(null)} onSave={saveTask} />}
  </div>;
}
