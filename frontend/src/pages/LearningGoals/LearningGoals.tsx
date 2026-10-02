import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { useAccount } from "@/components/account/useAccount";
import { ROUTES } from "@/constants/routes";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { readJourneyProfile, readJourneyState, type LearningContext, type PersonalSkill } from "@/features/journey/journey";
import { readSpecialistState, specialistEntryKey, type SpecialistEntry } from "@/features/journey/specialistSkills";
import {
  readLearningGoals, createSpecialistGoal, createContextGoal, createPersonalGoal, updateLearningGoal,
  saveLearningAttempt, removeLearningAttempt, goalContextWarnings,
  type LearningGoal,
} from "@/features/learning-goals/learningGoals";
import { ApiError } from "@/services/api";
import { readGoalDraft, writeGoalDraft, draftHasChanges, draftNeedsReview, clearDraftPart, taskIdentity, attemptTaskOptions, type GoalDraft, type DraftAttempt } from "@/features/learning-goals/goalDraft";
import { learningGoalDraftStorage } from "@/infrastructure/storage/learningGoalDraftStorage";
import { cleanDisplayText, cleanMultilineDisplayText, goalDisplayLabel, shortTaskLabel, taskDisplayText, taskListText } from "@/lib/displayText";
import PendingLearningInterests from "./PendingLearningInterests";
import GoalSuggestion from "./GoalSuggestion";
import SavedGoalHistory from "./SavedGoalHistory";
import { plannedActivityAttempt, hasMaterialGoalWarnings } from "@/features/learning-goals/guidedLearning";
import { loadLearningCatalogue } from "@/features/learning-planning/courseDirectory";
import { changeSavedCourses } from "@/features/learning-planning/courseOperations";
import type { Course } from "@/features/learning-planning/types";
import { EXPERIENCE_LABELS, experienceLevelForPlan, formatDays, formatMinutes, generatePersonalPlan, GOAL_LABELS, readPersonalPlan, savePersonalPlan, selectPlanCourses, type PersonalLearningPlan, type LearningPlanInputs, type PlanActivity } from "@/features/learning-goals/personalLearningPlan";
import type { LearningPlanResource } from "@/features/learning-goals/learningPlanSetup";
import LearningPlanSetup from "./LearningPlanSetup";
import type { GuidedGoalSuggestion } from "@/services/guidedLearningService";
import "./learning-goals.css";

const attemptLabels = { study: "Study", course_practice: "Course or sample practice", workplace_practice: "Workplace practice" };
const decisionLabels: Record<string, string> = { use: "I use this skill", no: "I do not use this skill", unsure: "I am unsure", accepted: "I recognise this skill in my work", rejected: "I do not recognise this skill in my work" };
const actionLabels = { understand: "Understand", practise: "Practise", find_learning: "Find learning" };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const displayDate = (date: string) => new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(new Date(date.length === 10 ? `${date}T12:00:00` : date));
const errorText = (error: unknown) => {
  const text = error instanceof Error ? error.message : "";
  return /(?:status|http|request failed|fetch|network|timeout)/i.test(text)
    ? "Your work could not be saved right now. Keep this page open and try again."
    : cleanDisplayText(text) || "Your work could not be saved. Please try again.";
};
type Task = { id: string; wording: string };
type Run = (operation: () => Promise<void>, message: string) => Promise<boolean>;

export default function LearningGoals() {
  const { user, loading } = useAccount();
  const [session, setSession] = useState(currentWorkspaceSession);
  useEffect(() => {
    const changed = () => setSession(currentWorkspaceSession());
    window.addEventListener("workspace-change", changed);
    return () => window.removeEventListener("workspace-change", changed);
  }, []);
  if (loading) return <p role="status">Loading your saved work…</p>;
  if (!user) return <p>Sign in to save and return to your learning goals.</p>;
  return <GoalsWorkspace key={`${user.id}:${session}`} />;
}

function GoalsWorkspace() {
  const { reload } = useAccount();
  const [needsReload, setNeedsReload] = useState(false);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const newGoal = params.get("new") === "1";
  const creationId = newGoal ? params.get("creation") || undefined : undefined;
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    if (newGoal && !creationId) {
      const next = new URLSearchParams(params);
      next.set("creation", crypto.randomUUID());
      // Keep one creation intent through failed saves and account reloads.
      setParams(next, { replace: true, state: location.state });
    }
  }, [newGoal, creationId, params, setParams, location.state]);
  useEffect(() => {
    alive.current = true;
    const refresh = () => setVersion(v => v + 1);
    window.addEventListener("workspace-change", refresh);
    return () => { alive.current = false; window.removeEventListener("workspace-change", refresh); };
  }, []);
  void version;
  let goals: LearningGoal[] = [];
  let specialist: SpecialistEntry | undefined;
  let context: LearningContext | undefined;
  let personal: PersonalSkill | undefined;
  let tasks: Task[] = [];
  let loadError = "";
  try {
    goals = readLearningGoals();
    const profile = readJourneyProfile();
    if (profile.tasksConfirmed) tasks = profile.tasks.map(({ id, wording }) => ({ id, wording }));
    const specialistKey = params.get("specialist");
    const contextId = params.get("context");
    const personalId = params.get("personal");
    if ([specialistKey, contextId, personalId].filter(Boolean).length > 1) throw new Error("This link has two learning choices. Open one choice from your skills again.");
    if (specialistKey) {
      specialist = readSpecialistState().entries.find(e => specialistEntryKey(e) === specialistKey && e.wantsLearning);
      if (!specialist) throw new Error("This saved learning interest is no longer available. Review your skills to choose a current interest.");
    }
    if (personalId) {
      personal = readJourneyState().personalSkills?.find(entry => entry.id === personalId && entry.wantsLearning);
      if (!personal) throw new Error("This personal learning interest is no longer available. Review your saved skill first.");
    }
    if (contextId) {
      context = readJourneyState().contexts[contextId];
      if (!context) throw new Error("This learning choice is no longer available. Choose a skill again.");
    }
  } catch (e) { loadError = errorText(e); }
  const sourceKey = specialist ? `specialist:${specialistEntryKey(specialist)}` : context ? `context:${context.id}` : personal ? `personal:${personal.id}` : null;
  const goal = params.get("goal") ? goals.find(g => g.id === params.get("goal")) : params.get("new") === "1" ? undefined : [...goals].reverse().find(g => g.sourceKey === sourceKey);
  if (params.get("goal") && !goal && !loadError) loadError = "This goal was not found in your account. Open one of your saved goals below.";
  const run: Run = async (operation, message) => {
    if (lock.current || needsReload) return false;
    lock.current = true;
    const owner = currentWorkspaceSession();
    setBusy(true); setError(""); setNotice("");
    try {
      await operation();
      if (!alive.current || owner !== currentWorkspaceSession()) return false;
      setVersion(v => v + 1); setNotice(message);
      return true;
    } catch (e) {
      if (alive.current && owner === currentWorkspaceSession()) { setError(errorText(e)); if (e instanceof ApiError && e.status === 409) setNeedsReload(true); }
      return false;
    } finally {
      lock.current = false;
      if (alive.current && owner === currentWorkspaceSession()) setBusy(false);
    }
  };
  const create = async () => {
    let created: LearningGoal | undefined;
    const ok = await run(async () => {
      if (newGoal && !creationId) throw new Error("Your new goal is being prepared. Please try again.");
      const options = { newGoal, ...(creationId ? { creationId } : {}) };
      if (specialist) created = await createSpecialistGoal(specialist, options);
      else if (context) created = await createContextGoal(context, options);
      else if (personal) created = await createPersonalGoal(personal, options);
      else throw new Error("Choose a saved skill first.");
    }, "Your goal is saved. You can add an action or record an attempt.");
    if (ok && created) setParams({ goal: created.id });
  };
  return <div className="learning-goals">
    <PageHeader title="My learning plan" description="Continue a goal, try a small action and keep a record of what you learned." />
    <div role="status" aria-live="polite" className={notice ? "lg-notice" : ""}>{notice}</div>
    {error && <p role="alert" className="lg-error">{error}</p>}
    {needsReload && !goal && <div className="lg-warning"><p>Your account changed in another tab. Reload the saved account before trying again.</p><button onClick={reload}>Reload saved account</button></div>}
    {loadError ? <section className="lg-card"><h2>Your saved work needs attention</h2><p role="alert">{loadError}</p><Link to={ROUTES.skills}>Review my skills</Link></section> : goal ?
      <GoalDetail key={goal.id} goal={goal} tasks={tasks} run={run} busy={busy} needsReload={needsReload} /> : specialist || context || personal ?
      <section className="lg-card"><p className="lg-eyebrow">Your saved learning interest</p><h2>{cleanDisplayText(specialist?.skillLabel ?? context?.skill.name ?? personal?.name ?? "")}</h2>
        <p>{specialist ? taskDisplayText(specialist.taskWording) : context?.goal ? cleanDisplayText(context.goal) : personal?.taskLabels.length ? taskListText(personal.taskLabels) : "Choose one small step to explore this skill."}</p>
        {context?.origin === "career" && context.career && <p>Chosen career direction: <strong>{cleanDisplayText(context.career.title)}</strong></p>}
        {context?.origin === "browse" && <p>Independent learning · Work tasks and a career reason are optional.</p>}
        <p className="lg-muted">Save this choice as a goal to keep its starting context. You can change the goal wording later.</p>
        {params.get("new") === "1" && <p>This creates a new starting record. Your earlier goal and attempts stay available.</p>}
        <button className="lg-primary" disabled={busy || (newGoal && !creationId)} onClick={() => void create()}>{busy ? "Saving…" : "Save my goal"}</button>
      </section> : null}
    {!goal && !specialist && !context && !personal && !loadError && <PendingLearningInterests />}
    {(!goal || goals.length > 1) && <section className="lg-card"><h2>{goal ? "Your other goals" : goals.length ? "Continue a saved goal" : "Your goals"}</h2>{goals.length ? <ul className="lg-goal-list">{[...goals].reverse().filter(g => g.id !== goal?.id).map(g => <li key={g.id}><Link aria-current={g.id === goal?.id ? "page" : undefined} to={`${ROUTES.learningGoals}?goal=${encodeURIComponent(g.id)}`}>{goalDisplayLabel(g.wording, g.initial.skill.label)}</Link><span>{cleanDisplayText(g.initial.skill.label)} · {g.attempts.length} {g.attempts.length === 1 ? "attempt" : "attempts"}</span></li>)}</ul> : <><p>No goals saved yet.</p><Link to={ROUTES.skills}>Find a skill</Link></>}</section>}
    <section className="lg-card"><h2>See what changed</h2><p>Review your saved study and practice without filling in another assessment.</p><Link className="lg-primary" to={ROUTES.progress}>Review my progress</Link></section>
    <details className="lg-resources"><summary>Optional courses</summary><p>You can continue this goal without a course. Check any course content before using it for your skill.</p><div className="lg-buttons"><Link to={ROUTES.plan}>My courses and history</Link><Link to={`${ROUTES.learningCentre}?${goal ? `goal=${encodeURIComponent(goal.id)}${goal.sourceKey.startsWith("context:") ? `&context=${encodeURIComponent(goal.sourceKey.slice(8))}` : ""}` : "mode=browse"}`}>Find resources{goal ? " for this goal" : ""}</Link></div></details>
  </div>;
}

function contextForDraft(goal: LearningGoal) {
  try {
    const profile = readJourneyProfile();
    const source = goal.sourceKey.startsWith("specialist:") ? readSpecialistState().entries.find(entry => `specialist:${specialistEntryKey(entry)}` === goal.sourceKey)
      : goal.sourceKey.startsWith("personal:") ? readJourneyState().personalSkills?.find(entry => `personal:${entry.id}` === goal.sourceKey)
      : readJourneyState().contexts[goal.sourceKey.slice(8)];
    return JSON.stringify({ source, confirmed: profile.tasksConfirmed, occupation: profile.tasksOccupationCode, tasks: profile.tasks.map(task => [task.id, task.wording]) });
  } catch { return "unavailable"; }
}

function GoalDetail({ goal, tasks, run, busy, needsReload }: { goal: LearningGoal; tasks: Task[]; run: Run; busy: boolean; needsReload: boolean }) {
  const { user, reload } = useAccount();
  const location = useLocation();
  const incoming = (location.state as { guidedGoal?: GuidedGoalSuggestion } | null)?.guidedGoal;
  const [activityError, setActivityError] = useState("");
  const owner = user!.id;
  const contextStamp = contextForDraft(goal);
  const [loaded] = useState(() => {
    try { return { draft: readGoalDraft(learningGoalDraftStorage, owner, goal.id), error: "" }; }
    catch (error) { return { draft: null, error: errorText(error) }; }
  });
  const [draft, setDraft] = useState<GoalDraft | null>(loaded.draft);
  const draftRef = useRef(draft);
  const [draftError, setDraftError] = useState(loaded.error);
  const [unreadable, setUnreadable] = useState(Boolean(loaded.error));
  const [discarding, setDiscarding] = useState(false);
  const [freshAttempt, setFreshAttempt] = useState<DraftAttempt>(() => ({ id: crypto.randomUUID(), editing: false, date: today(), type: "study", description: "", notes: "", task: null }));
  const [removeId, setRemoveId] = useState<string | null>(null);
  function keepDraft(next: GoalDraft | null) {
    draftRef.current = next; setDraft(next);
    try { writeGoalDraft(learningGoalDraftStorage, owner, goal.id, next); setDraftError(""); return true; }
    catch { setDraftError("This tab could not keep your unsaved draft for reload. Keep this page open and retry keeping the draft before reloading."); return false; }
  }
  function changeDraft(patch: Partial<Pick<GoalDraft, "wording" | "action" | "attempt">>) {
    if (unreadable) return;
    keepDraft({ ...(draftRef.current ?? { version: 1, owner, goalId: goal.id, baseRevision: goal.revision, baseContext: contextStamp }), ...patch });
  }
  const reviewRequired = draftNeedsReview(draft, goal.revision, contextStamp);
  const formBlocked = busy || unreadable || needsReload;
  const saveBlocked = formBlocked || reviewRequired;
  const wording = draft?.wording ?? goal.wording;
  const action = draft?.action !== undefined ? draft.action : goal.action;
  const actionKind = action?.kind ?? "practise";
  const actionText = action?.text ?? "";
  const attempt = draft?.attempt ?? freshAttempt;
  const editing = attempt.editing ? goal.attempts.find(item => item.id === attempt.id) ?? null : null;
  const removedAttempt = attempt.editing && !editing;
  async function savePart(part: "wording" | "action" | "attempt", operation: () => Promise<void>, message: string) {
    if (saveBlocked) return false;
    const base = draftRef.current?.baseRevision ?? goal.revision;
    const ok = await run(async () => {
      const current = readLearningGoals().find(item => item.id === goal.id);
      if (!current || current.revision !== base || (draftRef.current && draftRef.current.baseContext !== contextForDraft(goal))) throw new Error("This goal changed. Reload the saved account and review your unsaved draft before saving.");
      await operation();
    }, message);
    if (ok) {
      const revision = readLearningGoals().find(item => item.id === goal.id)?.revision ?? goal.revision;
      keepDraft(clearDraftPart(draftRef.current, part, revision));
      if (part === "attempt") setFreshAttempt({ id: crypto.randomUUID(), editing: false, date: today(), type: "study", description: "", notes: "", task: null });
    }
    return ok;
  }
  function discardDraft() {
    try { writeGoalDraft(learningGoalDraftStorage, owner, goal.id, null); draftRef.current = null; setDraft(null); setDraftError(""); setUnreadable(false); setDiscarding(false); }
    catch { setDraftError("The unsaved draft could not be removed. Please keep this page open and try again."); }
  }
  let warnings: string[];
  try { warnings = goalContextWarnings(goal); } catch (e) { warnings = [errorText(e)]; }
  const origin = goal.initial;
  const suggestion = !hasMaterialGoalWarnings(warnings) && <GoalSuggestion key={`${goal.id}:${contextStamp}`} goal={goal} incoming={incoming} disabled={saveBlocked || draftHasChanges(draft)} onGoal={async text => {
      changeDraft({ wording: text });
      return savePart("wording", () => updateLearningGoal(goal.id, { wording: text }), "Suggested goal saved. Your starting record is unchanged.");
    }} onAction={async (text, origin) => {
      const next = { kind: "practise" as const, text, origin };
      changeDraft({ action: next });
      return savePart("action", () => updateLearningGoal(goal.id, { action: next }), "Activity saved as a plan. Record an attempt after you try it.");
    }} />;
  const recoveryNeedsAttention = reviewRequired || Boolean(draftError) || needsReload;
  const RecoveryContainer = recoveryNeedsAttention ? "section" : "details";
  const independentRequest = goal.sourceKey === `onboarding:${goal.id}`;
  const sourceParams = goal.sourceKey.startsWith("personal:") ? `personal=${encodeURIComponent(goal.sourceKey.slice(9))}` : goal.sourceKey.startsWith("specialist:") ? `specialist=${encodeURIComponent(goal.sourceKey.slice(11))}` : `context=${encodeURIComponent(goal.sourceKey.slice(8))}`;
  const newGoalLink = independentRequest ? <p><Link to={ROUTES.skills}>Choose another learning interest</Link></p> : <p><Link to={`${ROUTES.learningGoals}?${sourceParams}&new=1`}>Create a new goal from my current saved choice</Link></p>;
  return <>
    <PersonalPlanManager goal={goal} run={run} busy={busy} needsReload={needsReload} />
    {(draftHasChanges(draft) || draftError || needsReload) && <RecoveryContainer className="lg-warning" aria-label="Unsaved draft recovery">
      {recoveryNeedsAttention ? <h2>{needsReload ? "Reload your saved account to continue" : "Unsaved changes need attention"}</h2> : <summary>Unsaved draft options</summary>}
      <p>Your draft is separate from saved learning evidence. It belongs to this account and goal in this tab.</p>
      {draftError && <p role="alert">{draftError}</p>}
      {reviewRequired && <><p role="alert">Your saved goal or work context changed since you started this draft. Review the latest saved details before choosing to save your draft.</p><details open><summary>Latest saved details</summary><p>Goal: {goalDisplayLabel(goal.wording, goal.initial.skill.label)}</p><p>Action: {cleanMultilineDisplayText(goal.action?.text ?? "None")}</p>{attempt.editing && <p>Attempt: {editing ? `${editing.date} · ${attemptLabels[editing.type]} · ${editing.description} · Notes: ${editing.notes || "None"} · Work task: ${editing.task?.wording ?? "None"}` : "This attempt was removed. It cannot be restored by saving this draft."}</p>}<p>Current confirmed tasks:</p><ul>{tasks.map(task => <li key={task.id}>{taskDisplayText(task.wording)}</li>)}</ul></details><button disabled={busy || unreadable || needsReload} onClick={() => { if (draftRef.current) keepDraft({ ...draftRef.current, baseRevision: goal.revision, baseContext: contextStamp }); }}>I reviewed the saved changes</button></>}
      {removedAttempt && <p role="alert">This attempt was removed from saved evidence. Copy any notes you want to keep, then discard this attempt draft. It will not be recreated.</p>}
      <div className="lg-buttons"><button disabled={busy || Boolean(draftError)} onClick={reload}>Reload saved account and keep draft</button>{draftError && !unreadable && <button disabled={busy} onClick={() => keepDraft(draftRef.current)}>Retry keeping draft</button>}<button disabled={busy} onClick={() => setDiscarding(true)}>Discard unsaved changes</button></div>
      {discarding && <div><p>Discard the wording, action and attempt draft in this tab? Saved account records stay unchanged.</p><button disabled={busy} onClick={discardDraft}>Confirm discard</button><button disabled={busy} onClick={() => setDiscarding(false)}>Keep editing</button></div>}
    </RecoveryContainer>}
    <section className="lg-card"><p className="lg-eyebrow">My goal</p><h2>{goalDisplayLabel(goal.wording, goal.initial.skill.label)}</h2><p className="lg-muted">{cleanDisplayText(origin.skill.label)} · Saved {displayDate(goal.createdAt)}</p>
      {origin.career && <p>Chosen career direction: <strong>{cleanDisplayText(origin.career.title)}</strong></p>}
      {origin.origin === "browse" && <p>Independent learning · Work tasks and a career reason are optional.</p>}
      {warnings.length > 0 && <div className="lg-warning"><h3>Check the original context</h3>{warnings.map((w, i) => <p key={i}>{w}</p>)}<Link to={ROUTES.skills}>Review my skills</Link>{newGoalLink}</div>}
      <details open={draft?.wording !== undefined || undefined}><summary>Edit my goal wording</summary>
      <form onSubmit={e => { e.preventDefault(); void savePart("wording", () => updateLearningGoal(goal.id, { wording }), "Goal wording saved. Your original starting record is unchanged."); }}>
        <label htmlFor="goal-wording">What do you want to work on?</label><textarea id="goal-wording" required maxLength={1000} value={wording} onChange={e => changeDraft({ wording: e.target.value })} disabled={formBlocked} rows={2} />
        <button disabled={saveBlocked || wording.trim() === goal.wording}>Save wording</button>
      </form>
      </details>
      <details className="lg-starting"><summary>Why I chose this skill and my starting record</summary>
        <p><strong>Original goal:</strong> {goalDisplayLabel(origin.wording, origin.skill.label)}</p><p><strong>Skill source:</strong> {independentRequest ? "Your own learning request. No confirmed skill or work evidence is claimed." : origin.skill.source === "personal" ? "Your own skill entry. No external source identity or version is claimed." : `${origin.skill.source.toUpperCase()} ${origin.skill.sourceVersion ? `version ${origin.skill.sourceVersion}` : "· source version not recorded"}`}</p>
        <p className="lg-muted lg-break">{independentRequest ? "Goal identity" : "Skill identity"}: {origin.skill.id}</p><p><strong>My original choice:</strong> {origin.decision ? decisionLabels[origin.decision] ?? origin.decision : "Not recorded"}</p>
        {origin.tasks.length ? <><h3>Tasks saved with this goal</h3><ul>{origin.tasks.map(t => <li key={t.id}>{taskDisplayText(t.wording)}</li>)}</ul></> : <p>{origin.origin === "browse" ? "No work task was linked. Independent learning does not require one." : "No confirmed work task was linked at the start. This is a gap in the record, not a lack of ability."}</p>}
        {origin.career ? <p><strong>Career reason:</strong> {cleanDisplayText(origin.career.title)} ({origin.career.code})</p> : <p>{origin.origin === "browse" ? "No career reason was linked. This is optional for independent learning." : "No career reason was saved."}</p>}
        {origin.sourceOccupationUri && <p>An ESCO role was used to discover this skill. That role is not a confirmed career goal.</p>}
        <p>Changing the goal wording does not change this starting record. A different skill or work context needs an explicit new goal.</p>
        {warnings.length === 0 && newGoalLink}
      </details>
    </section>
    {!goal.action && suggestion}
    <section className="lg-card lg-next-action"><h2>My next action <span className="lg-optional">Optional</span></h2>
      {goal.action ? <><p className="lg-preserve">{cleanMultilineDisplayText(goal.action.text)}</p><p className="lg-muted">{goal.action.origin === "ai_suggestion" ? "Accepted AI idea. Check it before trying it." : goal.action.origin === "template" ? "Accepted sample idea. Check that it fits your goal." : "Your saved action."} Ready to try.</p><button className="lg-primary" disabled={saveBlocked || Boolean(draft?.attempt)} onClick={() => {
        try { changeDraft({ attempt: plannedActivityAttempt(goal, tasks, today(), crypto.randomUUID()) }); setActivityError(""); requestAnimationFrame(() => document.getElementById("attempt-description")?.focus()); }
        catch (error) { setActivityError(errorText(error)); const form = document.getElementById("record-attempt"); if (form instanceof HTMLDetailsElement) form.open = true; }
      }}>I tried this</button></> : <p>You can save the sample idea above, write your own action or record something you already tried.</p>}
      {activityError && <p role="alert">{activityError}</p>}
      <details open={draft?.action !== undefined || undefined}><summary>{goal.action ? "Edit or clear my action" : "Write my own action"}</summary>
      <form onSubmit={e => { e.preventDefault(); void savePart("action", () => updateLearningGoal(goal.id, { action: { kind: actionKind, text: actionText, ...(action?.origin ? { origin: action.origin } : {}) } }), "Next action saved."); }}>
        <label htmlFor="action-kind">I want to</label><select id="action-kind" value={actionKind} disabled={formBlocked} onChange={e => changeDraft({ action: { kind: e.target.value as keyof typeof actionLabels, text: actionText } })}>{Object.entries(actionLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
        <label htmlFor="action-text">My small action</label><textarea id="action-text" value={actionText} required maxLength={1000} disabled={formBlocked} onChange={e => changeDraft({ action: { kind: actionKind, text: e.target.value } })} rows={2} placeholder="For example, try one step and note what I learned" />
        <div className="lg-buttons"><button className="lg-primary" disabled={saveBlocked}>Save action</button><button type="button" disabled={saveBlocked} onClick={() => { changeDraft({ action: null }); void savePart("action", () => updateLearningGoal(goal.id, { action: null }), "Goal kept for later. Your attempts are unchanged."); }}>{goal.action ? "Clear action and keep for later" : "Keep goal for later"}</button></div>
      </form>
      </details>
    </section>
    {goal.action && suggestion}
    <details className="lg-card" id="record-attempt" open={Boolean(draft?.attempt) || undefined}><summary>{attempt.editing ? "Correct an attempt" : "Record what I tried"}</summary><p>Save only if this describes what you actually did. You can change the date, task and description. Leave out names, customer details and other confidential information.</p>
      <AttemptForm value={attempt} historical={editing?.task ?? null} tasks={tasks} busy={formBlocked} saveBlocked={saveBlocked || removedAttempt} onChange={value => changeDraft({ attempt: value })} onCancel={() => keepDraft(clearDraftPart(draftRef.current, "attempt", draftRef.current?.baseRevision ?? goal.revision))} onSave={async input => {
        await savePart("attempt", () => saveLearningAttempt(goal.id, input), attempt.editing ? "Attempt corrected. Earlier records are kept in history." : "Attempt saved.");
      }} />
    </details>
    <section className="lg-card"><h2>My attempts</h2><p>{goal.attempts.length} saved {goal.attempts.length === 1 ? "attempt" : "attempts"}. These are your records, not a skill grade or a change in AI exposure.</p><ul className="lg-evidence-counts" aria-label="Attempts by type">{Object.entries(attemptLabels).map(([type, label]) => <li key={type}><strong>{goal.attempts.filter(a => a.type === type).length}</strong><span>{label}</span></li>)}</ul>
      {goal.attempts.length === 0 ? <p>No attempts recorded yet. This does not mean you lack the skill.</p> : <ul className="lg-attempts">{[...goal.attempts].sort((a, b) => b.date.localeCompare(a.date)).map(a => <li key={a.id}><div className="lg-attempt-heading"><strong>{attemptLabels[a.type]}</strong><time dateTime={a.date}>{displayDate(a.date)}</time></div><p>{shortTaskLabel(a.description, 160)}</p>{(a.description.length > 160 || a.notes || a.task) && <details><summary>Full attempt and notes</summary><p className="lg-preserve">{cleanMultilineDisplayText(a.description)}</p>{a.task && <p><strong>Work task:</strong> {taskDisplayText(a.task.wording)}</p>}{a.notes && <p className="lg-preserve lg-muted">{cleanMultilineDisplayText(a.notes)}</p>}</details>}
      <div className="lg-buttons"><button disabled={formBlocked || Boolean(draft?.attempt)} onClick={() => { changeDraft({ attempt: { id: a.id, editing: true, date: a.date, type: a.type, description: a.description, notes: a.notes, task: a.task } }); setRemoveId(null); requestAnimationFrame(() => document.getElementById("attempt-date")?.focus()); }}>Correct</button><button disabled={saveBlocked || Boolean(draft?.attempt)} onClick={() => setRemoveId(a.id)}>Remove</button></div>
      {removeId === a.id && <div className="lg-warning" role="group" aria-label="Confirm removal"><p>Remove this attempt from your current evidence? Its earlier version remains in history.</p><div className="lg-buttons"><button disabled={saveBlocked} onClick={() => { void savePart("attempt", () => removeLearningAttempt(goal.id, a.id), "Attempt removed from current evidence. History is kept.").then(ok => { if (ok) { setRemoveId(null);  } }); }}>Confirm removal</button><button disabled={busy} onClick={() => setRemoveId(null)}>Cancel</button></div></div>}</li>)}</ul>}
      {goal.needsReview && <p className="lg-muted">Your current records include these changes. Earlier versions remain below.</p>}
      <SavedGoalHistory history={goal.history} />
    </section>
  </>;
}

type AttemptInput = Parameters<typeof saveLearningAttempt>[1];
function AttemptForm({ value, historical, tasks, busy, saveBlocked, onChange, onCancel, onSave }: { value: DraftAttempt; historical: Task | null; tasks: Task[]; busy: boolean; saveBlocked: boolean; onChange: (value: DraftAttempt) => void; onCancel: () => void; onSave: (input: AttemptInput) => Promise<void> }) {
  const { id, date, type, description, notes, task } = value;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const selectable = attemptTaskOptions(tasks, historical);
  return <form onSubmit={e => { e.preventDefault(); if (!saveBlocked) void onSave({ id, date, type, description, notes, ...(type === "workplace_practice" && task ? { task } : {}) }); }}>
    <div className="lg-form-grid"><div><label htmlFor="attempt-date">When did you try it?</label><input id="attempt-date" type="date" value={date} max={today()} required disabled={busy} onChange={e => onChange({ ...value, date: e.target.value })} /></div><div><label htmlFor="attempt-type">What kind of attempt?</label><select id="attempt-type" value={type} disabled={busy} onChange={e => onChange({ ...value, type: e.target.value as DraftAttempt["type"] })}>{Object.entries(attemptLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
    <p className="lg-muted">{type === "study" ? "Reading, watching or learning about the skill. This does not prove mastery." : type === "course_practice" ? "An exercise with a sample, or a course project. No course is assumed. Choose workplace practice only if you used it in a real work task." : "An attempt using the skill in a real work task."}</p>
    {type === "workplace_practice" && <><label htmlFor="attempt-task">Real work task</label><select id="attempt-task" required value={taskIdentity(task)} disabled={busy} onChange={e => onChange({ ...value, task: selectable.find(t => taskIdentity(t.task) === e.target.value)?.task ?? null })}><option value="">Choose a confirmed task</option>{selectable.map(option => <option key={taskIdentity(option.task)} value={taskIdentity(option.task)}>{option.historical ? "Earlier wording: " : "Current task: "}{taskDisplayText(option.task.wording)}</option>)}</select>{task && !selectable.some(t => taskIdentity(t.task) === taskIdentity(task)) && <p role="alert">The task in your unsaved draft changed. Choose a current task before saving.</p>}{!selectable.length && <p>Add and confirm a real task in <Link to={ROUTES.workProfile}>your work profile</Link> before saving workplace practice.</p>}</>}
    <label htmlFor="attempt-description">What did you do?</label><textarea id="attempt-description" value={description} required maxLength={2000} rows={3} disabled={busy} onChange={e => onChange({ ...value, description: e.target.value })} />
    <label htmlFor="attempt-notes">Notes <span className="lg-optional">Optional</span></label><textarea id="attempt-notes" value={notes} maxLength={4000} rows={2} disabled={busy} onChange={e => onChange({ ...value, notes: e.target.value })} />
    {confirmDiscard && <div className="lg-warning"><p>Discard this unsaved attempt draft? Saved attempts stay unchanged.</p><button type="button" disabled={busy} onClick={() => { onCancel(); setConfirmDiscard(false); }}>Confirm discard attempt</button><button type="button" onClick={() => setConfirmDiscard(false)}>Keep draft</button></div>}
    <div className="lg-buttons"><button className="lg-primary" disabled={saveBlocked || (type === "workplace_practice" && (!task || !selectable.some(t => taskIdentity(t.task) === taskIdentity(task))))}>{busy ? "Saving…" : value.editing ? "Save correction" : "Save attempt"}</button>{(value.editing || description || notes) && <button type="button" disabled={busy} onClick={() => setConfirmDiscard(true)}>Discard attempt draft</button>}</div>
  </form>;
}

function PersonalPlanManager({ goal, run, busy, needsReload }: { goal: LearningGoal; run: Run; busy: boolean; needsReload: boolean }) {
  const [saved] = useState(() => {
    try { return { plan: readPersonalPlan(goal.id), error: "" }; }
    catch (error) { return { plan: null, error: errorText(error) }; }
  });
  const [plan, setPlan] = useState<PersonalLearningPlan | null>(saved.plan);
  const [editing, setEditing] = useState(!saved.plan);
  const [courses, setCourses] = useState<Course[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>(saved.plan?.courseIds ?? []);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(!saved.plan || saved.plan.status !== "active");
  // Catalogue keys are WEF name slugs, not numeric WEF ids or ESCO URIs.
  const skillId = goal.initial.skill.source === "wef"
    ? goal.initial.skill.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : plan?.skillId ?? "";
  useEffect(() => {
    let cancelled = false;
    const request = skillId ? loadLearningCatalogue(skillId, true) : Promise.resolve({ courses: [] as Course[] });
    void request.then(result => {
      if (!cancelled) { setCourses(result.courses); setCatalogueError(""); }
    }).catch(() => {
      if (!cancelled) setCatalogueError("The course catalogue is unavailable. You can still build a practice-only plan, or retry loading courses.");
    }).finally(() => { if (!cancelled) setCatalogueLoading(false); });
    return () => { cancelled = true; };
  }, [skillId, retry]);
  const blocked = busy || needsReload || Boolean(saved.error);
  const generate = async (inputs: LearningPlanInputs, resources: LearningPlanResource[]) => {
    if (blocked || catalogueLoading) return;
    const next = generatePersonalPlan({ goalId: goal.id, goalTitle: goal.wording, skillId, skillLabel: plan?.skillLabel ?? goal.initial.skill.label, courses, inputs, resources });
    const ok = await run(async () => { await savePersonalPlan(next); }, "Your personalised plan is saved and ready to review.");
    if (ok) { setPlan(next); setSelectedIds(next.courseIds); setExpanded(true); setEditing(false); }
    else throw new Error("The plan could not be saved. Your answers are still here; review the message above before trying again.");
  };
  const selectedPlan = plan ? selectPlanCourses(plan, selectedIds) : null;
  const accept = async () => {
    if (!selectedPlan || blocked) return;
    let accepted: PersonalLearningPlan | undefined;
    const ok = await run(async () => {
      const result = await changeSavedCourses({ add: selectedPlan.courseIds, personalPlan: selectedPlan });
      accepted = result.personalPlan;
    }, selectedPlan.courseIds.length ? "Your plan is active. Your selected courses are saved in My courses." : "Your practice plan is active. Record your activities below as you work towards your goal.");
    if (ok && accepted) { setPlan(accepted); setSelectedIds(accepted.courseIds); }
  };
  return <section className="lg-card lg-plan" aria-labelledby="personal-plan-heading">
    <div className="lg-plan-heading"><div><p className="lg-eyebrow">Goals &amp; activities</p><h2 id="personal-plan-heading">{editing ? "A learning plan that fits you" : "Your learning blueprint"}</h2></div>{plan && !editing && <span className={`lg-plan-status lg-plan-status--${plan.status}`}>{plan.status === "active" ? "Active plan" : "Ready to review"}</span>}</div>
    {saved.error && <p role="alert" className="lg-error">{saved.error}</p>}
    {editing ? <LearningPlanSetup goalTitle={goal.wording} initialInputs={plan?.inputs} initialResources={plan?.resources} disabled={blocked} busy={busy} loading={catalogueLoading} error={catalogueError} onSubmit={generate} onCancel={plan ? () => setEditing(false) : undefined} /> : selectedPlan && plan && <>
      <p className="lg-plan-outcome">Work towards <strong>{selectedPlan.inputs.goalText}</strong> through a short sequence of learning, practice and reflection.</p>
      <div className="lg-plan-summary"><span><strong>{selectedPlan.courseIds.length}</strong> selected {selectedPlan.courseIds.length === 1 ? "course" : "courses"}</span><span><strong>{selectedPlan.activities.length}</strong> learning activities</span><span><strong>{formatMinutes(selectedPlan.totals.minutes)}</strong> planned time</span></div>
      <p className="lg-plan-total">At {selectedPlan.inputs.minutesPerDay} min/day: about {formatDays(selectedPlan.estimatedDays)} · Starting level: {experienceLevelForPlan(selectedPlan.inputs.experience)}</p>
      {selectedPlan.activities.some(item => item.estimated) && <p className="lg-muted">Some activity durations are planning estimates, not published course times. Your actual pace may differ.</p>}
      <details className="lg-original-request"><summary>Your original request</summary><p className="lg-preserve">{plan.inputs.goalText}</p><dl><div><dt>Starting point</dt><dd>{EXPERIENCE_LABELS[plan.inputs.experience]}</dd></div><div><dt>Daily time</dt><dd>{plan.inputs.minutesPerDay} minutes</dd></div><div><dt>Motivation</dt><dd>{GOAL_LABELS[plan.inputs.goalKind]}</dd></div></dl></details>
      {!!plan.resources?.length && <details className="lg-original-request"><summary>Your reference materials ({plan.resources.length})</summary><p className="lg-muted">Kept for your reference. These materials have not been analysed to generate course content.</p><ul>{plan.resources.map(resource => <li key={resource.id}>{resource.kind === "link" ? <a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.name}</a> : <details><summary>{resource.name}</summary><pre className="lg-preserve">{resource.text}</pre></details>}</li>)}</ul></details>}
      <p className="lg-muted">{plan.rationale}</p>
      {goal.wording !== plan.goalTitle && <p className="lg-warning">Your saved goal wording has changed since this blueprint was built. Change your answers to build a plan for the updated goal.</p>}
      <button type="button" className="lg-plan-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Hide learning sequence" : "Review learning sequence"}</button>
      {expanded && <div className="lg-plan-sequence">
        {plan.courseIds.length > 0 && <p className="lg-muted">{plan.status === "draft" ? "Select the recommended courses you want to add. You can also start with practice only." : "Suggested order — courses are not locked. Continue them at your own pace."}</p>}
        {plan.courseIds.map((id, index) => {
          const course = courses.find(item => item.id === id);
          const activities = plan.activities.filter(item => item.courseId === id);
          return <section key={id} className={`lg-plan-course${selectedIds.includes(id) ? " lg-plan-course--selected" : ""}`}>
            <div className="lg-plan-course-heading"><span className="lg-plan-index">{index + 1}</span><div><p className="lg-eyebrow">Course {index + 1}</p><h3>{course?.title ?? activities[0]?.courseTitle ?? `Saved course ${index + 1}`}</h3><p className="lg-muted">{course ? `${course.provider} · ${course.level} · ` : ""}{activities.length} {activities.length === 1 ? "activity" : "activities"} · {formatMinutes(activities.reduce((sum, item) => sum + item.minutes, 0))}</p></div>{plan.status === "draft" && <label className="lg-plan-choice"><input type="checkbox" checked={selectedIds.includes(id)} disabled={blocked} onChange={event => setSelectedIds(ids => event.target.checked ? [...ids, id] : ids.filter(value => value !== id))} /><span>Add to my plan</span></label>}</div>
            <details><summary>View course activities</summary><PlanActivityList activities={activities} /></details>
            <Link to={`${ROUTES.learningCentre}?goal=${encodeURIComponent(goal.id)}&mode=browse&course=${encodeURIComponent(id)}`}>View course details</Link>
          </section>;
        })}
        <h3>Put your learning into practice</h3><PlanActivityList activities={selectedPlan.activities.filter(item => item.kind !== "course")} />
      </div>}
      <div className="lg-buttons">{plan.status === "active" ? <><Link className="lg-primary" to={ROUTES.plan}>Go to My courses</Link><button type="button" disabled={blocked} onClick={() => setEditing(true)}>Change my answers</button></> : <><button type="button" className="lg-primary" disabled={blocked} onClick={() => void accept()}>{busy ? "Saving…" : "Accept plan and start"}</button><button type="button" disabled={blocked} onClick={() => setEditing(true)}>Change my answers</button></>}</div>
      <p className="lg-muted">Build again after changing your answers to regenerate the blueprint. Earlier plans and learning evidence are kept; existing saved courses are not removed.</p>
    </>}
    {catalogueError && <div className="lg-buttons"><button type="button" disabled={blocked || catalogueLoading} onClick={() => { setCatalogueLoading(true); setRetry(value => value + 1); }}>Retry loading courses</button></div>}
    <div className="lg-buttons"><Link to={`${ROUTES.learningCentre}?goal=${encodeURIComponent(goal.id)}&mode=browse`}>Browse more courses</Link></div>
  </section>;
}
function PlanActivityList({ activities }: { activities: PlanActivity[] }) {
  return <ol className="lg-plan-activities">{activities.map((activity, index) => <li key={activity.id}><span className="lg-plan-index">{index + 1}</span><div><strong>{activity.title}</strong><p>{activity.description}</p><small>{activity.kind === "course" ? "Study" : activity.kind === "practice" ? "Practice" : "Review"} · {formatMinutes(activity.minutes)}{activity.estimated ? " (estimate)" : ""}</small></div></li>)}</ol>;
}
