import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import OccupationSearch from "./components/OccupationSearch";
import { useOccupationFilters } from "./hooks/useOccupationFilters";
import { useWorkDraft } from "./hooks/useWorkDraft";
import { startWorkDraft, updateWorkDraft, discardWorkDraft, workDraftNeedsMatchReview } from "@/features/work-profile/workProfileDraft";
import { currentWorkspaceSession, flushWorkspace, syncError } from "@/services/accountStorage";
import { taskSourceLabel } from "@/features/work-profile/taskSourceLabel";
import type { ReferenceOccupation } from "@/types/reference";

const workAreaLabels: Record<string, string> = {
  "0": "Armed forces", "1": "Management", "2": "Professional roles",
  "3": "Technical and associate professional roles", "4": "Office and clerical support",
  "5": "Sales and service", "6": "Agriculture, forestry and fishing",
  "7": "Skilled trades", "8": "Machine operation and assembly", "9": "General and manual work",
};
export default function WorkProfile() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { draft, profile, error: readError } = useWorkDraft();
  const occupation = useOccupationFilters();
  const editing = params.get("edit") === "job";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const confirmed = Boolean(profile?.tasksConfirmed && profile.tasks.length);
  const jobTitle = draft?.jobTitle ?? (editing ? profile?.jobTitle ?? "" : "");
  const match = draft ? draft.occupation?.unit ?? null : editing ? profile?.occupation?.unit ?? null : null;
  const showEditor = editing || !confirmed;
  const matchNeedsReview = draft ? workDraftNeedsMatchReview(draft) : false;
  const editorEntered = useRef(false);
  useEffect(() => {
    if (!showEditor) { editorEntered.current = false; return; }
    if (editorEntered.current || readError) return;
    editorEntered.current = true;
    try { if (draft) startWorkDraft("job"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not restore the job step."); }
  }, [showEditor, readError, draft]);

  // A restored draft supplies search text; this never changes confirmed work.
  useEffect(() => { if (showEditor) occupation.setQuery(jobTitle); }, [jobTitle, showEditor, occupation.setQuery]);

  function edit(stage: "job" | "tasks") {
    try {
      startWorkDraft(stage);
      setError("");
      if (stage === "tasks") navigate(ROUTES.task);
      else { setParams({ edit: "job" }, { replace: true }); }
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not open your draft."); }
  }
  function changeTitle(value: string) {
    try {
      if (!draft) startWorkDraft("job");
      updateWorkDraft({ jobTitle: value, stage: "job" });
      setError("");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not save your draft."); }
  }
  function choose(unit: ReferenceOccupation) {
    try {
      if (!draft) startWorkDraft("job");
      updateWorkDraft({ occupation: { unit, path: [unit], source: { name: "Occupation reference catalogue", version: null, recordId: unit.occupation_code } }, jobTitle: jobTitle.trim() || unit.title, stage: "job" });
      setError("");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not save the reference choice."); }
  }
  async function next() {
    if (!jobTitle.trim() || busy || matchNeedsReview) return;
    const owner = currentWorkspaceSession();
    setBusy(true); setError("");
    try {
      if (!draft) startWorkDraft("job");
      updateWorkDraft({ stage: "tasks" });
      await flushWorkspace();
      if (mounted.current && owner === currentWorkspaceSession()) navigate(ROUTES.task);
    } catch (issue) { if (mounted.current && owner === currentWorkspaceSession()) setError(issue instanceof Error ? issue.message : "Your draft could not sync. Please retry."); }
    finally { if (mounted.current && owner === currentWorkspaceSession()) setBusy(false); }
  }
  async function cancel() {
    const owner = currentWorkspaceSession();
    setBusy(true); setError("");
    try { await discardWorkDraft(); if (mounted.current && owner === currentWorkspaceSession()) setParams({}, { replace: true }); }
    catch (issue) { if (mounted.current && owner === currentWorkspaceSession()) setError(issue instanceof Error ? issue.message : "Could not discard this draft. Please retry."); }
    finally { if (mounted.current && owner === currentWorkspaceSession()) setBusy(false); }
  }
  if (readError) return <section role="alert" className="profile-glass-card p-6"><h1 className="text-xl font-semibold">Your work needs attention</h1><p className="my-3">{readError} Your stored work has not been replaced.</p><Button onClick={() => window.location.reload()}>Reload saved work</Button></section>;

  if (!showEditor && profile) return <div className="space-y-5">
    <PageHeader title="My work profile" description="Your confirmed work is ready for AI findings and skill review." />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {params.get("saved") === "1" && !syncError && <p role="status" className="rounded-xl bg-white/80 p-4 text-sm">Work profile saved.</p>}
    {draft && <div className="profile-glass-card space-y-3 p-4"><p>You have an unfinished draft. Your confirmed work below has not changed.</p><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => edit(draft.stage)}>Continue draft</Button><Button disabled={busy} variant="outline" onClick={() => { void cancel(); }}>Discard draft</Button></div></div>}
    <section className="profile-glass-card space-y-4 p-5 sm:p-6">
      <div><p className="text-xs text-muted-foreground">Your job</p><h2 className="mt-1 text-xl font-semibold">{profile.jobTitle || profile.analysis?.occupationTitle || "Your saved work"}</h2></div>
      <p className="text-xs text-muted-foreground">{profile.confirmedAt ? `Confirmed ${new Date(profile.confirmedAt).toLocaleString()}` : "Previously confirmed · confirmation date not recorded"}{profile.profileVersion ? ` · Version ${profile.profileVersion}` : ""}</p>
      <p className="text-sm text-muted-foreground"><strong>Reference match:</strong> {profile.tasksOccupationCode ? profile.occupation?.unit.title || profile.analysis?.occupationTitle || `Saved occupation ${profile.tasksOccupationCode}` : "No reference match — using your own title"}</p>
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => edit("job")}>Edit job</Button><Button variant="outline" onClick={() => edit("tasks")}>Edit tasks</Button></div>
      <h3 className="font-semibold">Tasks you confirmed</h3>
      <ul className="divide-y divide-border">{profile.tasks.map(task => <li key={task.id} className="py-3"><p>{task.wording}</p><p className="mt-1 text-xs text-muted-foreground">{taskSourceLabel(task)}</p></li>)}</ul>
    </section>
    {Boolean(profile.history?.length) && <details className="profile-glass-card p-5">
      <summary className="cursor-pointer font-medium">Earlier confirmed work</summary>
      <p className="mt-3 text-sm text-muted-foreground">Earlier task wording is kept for your learning and practice history. It is not used as your current work.</p>
      {profile.history!.map((version, index) => <details key={`${version.profileVersion}-${index}`} className="mt-3 border-t border-border pt-3">
        <summary className="cursor-pointer text-sm">{version.jobTitle || "Earlier profile"} · Version {version.profileVersion}{version.confirmedAt ? ` · ${new Date(version.confirmedAt).toLocaleDateString()}` : " · date not recorded"}</summary>
        <ul className="mt-2 space-y-3 text-sm">{version.tasks.map(task => <li key={task.id}><p>{task.wording}</p>{Boolean(task.practice?.trials.length) && <p className="mt-1 text-xs text-muted-foreground">{task.practice!.trials.length} original practice {task.practice!.trials.length === 1 ? "record" : "records"} retained with this task.</p>}</li>)}</ul>
      </details>)}
    </details>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">What would you like to explore?</h2><div className="flex flex-wrap gap-3"><Button asChild><Link to={ROUTES.aiExposure}>See AI findings</Link></Button><Button asChild variant="outline"><Link to={ROUTES.skills}>Review my skills</Link></Button></div><p className="text-sm text-muted-foreground">You can review skills even when research about your job is unavailable.</p></section>
  </div>;

  return <div className="space-y-5">
    <p className="text-sm text-primary" aria-label="Work setup progress">1. Your job <span aria-hidden="true">→</span> 2. Your tasks</p>
    <PageHeader title="What do you do?" description="Use your own job title. A reference match is optional." />
    {confirmed && <p className="text-sm text-muted-foreground">You are editing a draft. Your confirmed profile stays unchanged until you save it.</p>}
    <fieldset disabled={busy} className="profile-glass-card space-y-5 p-5 sm:p-6">
      <legend className="sr-only">Your job</legend>
      <OccupationSearch query={jobTitle} hasArea={Boolean(occupation.area)} searching={occupation.searching} hasSearched={occupation.hasSearched} results={occupation.results} selectedCode={match?.occupation_code ?? null} onQueryChange={changeTitle} onChoose={choose} />
      {match && <div className="space-y-2 rounded-xl bg-white/80 p-3 text-sm">
        <p><strong>Optional reference match:</strong> {match.title}</p>
        {matchNeedsReview ? <p role="alert">Your title changed. Does this reference still fit? Keep it, choose a different match above, or use only your own title.</p> : <p>Your job title stays “{jobTitle}”.</p>}
        <div className="flex flex-wrap gap-3">
          {matchNeedsReview && <Button variant="outline" onClick={() => { try { updateWorkDraft({ occupation: draft!.occupation }); setError(""); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not keep this reference."); } }}>Keep this reference</Button>}
          <Button variant="link" className="px-0" onClick={() => { try { if (!draft) startWorkDraft("job"); updateWorkDraft({ occupation: null }); setError(""); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not remove this reference."); } }}>Use only my own title</Button>
        </div>
      </div>}
      {!match && jobTitle.trim() && <p className="text-sm text-muted-foreground">You can continue as “{jobTitle}” without choosing a reference match.</p>}
      <div className="space-y-2"><label htmlFor="work-area" className="block text-sm font-medium">Narrow suggestions by type of work <span className="text-muted-foreground">(optional)</span></label><select id="work-area" value={occupation.area} disabled={occupation.loadingAreas} onChange={event => occupation.setArea(event.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-white/80 bg-white px-3 text-sm"><option value="">All types of work</option>{occupation.areas.map(area => <option key={area.occupation_code} value={area.occupation_code}>{workAreaLabels[area.occupation_code] ?? area.title}</option>)}</select></div>
      {(occupation.areaError || occupation.searchError) && <p role="status" className="text-sm">Suggestions are unavailable. You can keep your own title and continue. <button type="button" className="underline" onClick={occupation.retry}>Retry suggestions</button></p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3"><Button disabled={!jobTitle.trim() || busy || matchNeedsReview} onClick={() => { void next(); }}>{busy ? "Saving draft…" : "Continue to my tasks"}</Button>{draft && <Button variant="outline" disabled={busy} onClick={() => { void cancel(); }}>{confirmed ? "Cancel changes" : "Clear draft"}</Button>}</div>
      <p className="text-xs text-muted-foreground">This saves a draft. You will confirm your work after reviewing your tasks.</p>
    </fieldset>
  </div>;
}
