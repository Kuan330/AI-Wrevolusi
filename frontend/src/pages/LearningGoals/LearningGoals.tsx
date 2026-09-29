import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import "./learning-goals.css";

const attemptLabels = { study: "Study", course_practice: "Course practice", workplace_practice: "Workplace practice" };
const decisionLabels: Record<string, string> = { use: "I use this skill", no: "I do not use this skill", unsure: "I am unsure", accepted: "I recognise this skill in my work", rejected: "I do not recognise this skill in my work" };
const actionLabels = { understand: "Understand", practise: "Practise", find_learning: "Find learning" };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const displayDate = (date: string) => new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(new Date(date.length === 10 ? `${date}T12:00:00` : date));
const errorText = (error: unknown) => error instanceof Error ? error.message : "Your work could not be saved. Please try again.";
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
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const lock = useRef(false);
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
      if (specialist) created = await createSpecialistGoal(specialist, { newGoal: params.get("new") === "1" });
      else if (context) created = await createContextGoal(context, { newGoal: params.get("new") === "1" });
      else if (personal) created = await createPersonalGoal(personal, { newGoal: params.get("new") === "1" });
      else throw new Error("Choose a saved skill first.");
    }, "Your goal is saved. You can add an action or record an attempt.");
    if (ok && created) setParams({ goal: created.id });
  };
  return <div className="learning-goals">
    <PageHeader title="My learning goals" description="Choose a small action or record something you tried. A course or schedule is optional." />
    <div role="status" aria-live="polite" className={notice ? "lg-notice" : ""}>{notice}</div>
    {error && <p role="alert" className="lg-error">{error}</p>}
    {needsReload && !goal && <div className="lg-warning"><p>Your account changed in another tab. Reload the saved account before trying again.</p><button onClick={reload}>Reload saved account</button></div>}
    {loadError ? <section className="lg-card"><h2>Your saved work needs attention</h2><p role="alert">{loadError}</p><Link to={ROUTES.skills}>Review my skills</Link></section> : goal ?
      <GoalDetail key={goal.id} goal={goal} tasks={tasks} run={run} busy={busy} needsReload={needsReload} /> : specialist || context || personal ?
      <section className="lg-card"><p className="lg-eyebrow">Your saved learning interest</p><h2>{specialist?.skillLabel ?? context?.skill.name ?? personal?.name}</h2>
        <p>{specialist ? specialist.taskWording : context?.goal || personal?.taskLabels.join(". ") || "Choose one small step to explore this skill."}</p>
        <p className="lg-muted">Save this choice as a goal to keep its starting context. You can change the goal wording later.</p>
        {params.get("new") === "1" && <p>This creates a new starting record. Your earlier goal and attempts stay available.</p>}
        <button className="lg-primary" disabled={busy} onClick={() => void create()}>{busy ? "Saving…" : "Save my goal"}</button>
      </section> : <section className="lg-card"><h2>{goals.length ? "Continue a saved goal" : "Start with a skill that matters to you"}</h2><p>Choose a learning interest in your skills. Its task and reason will come with you.</p><Link className="lg-primary" to={ROUTES.skills}>Choose a skill</Link></section>}
    <section className="lg-card"><h2>Your saved goals</h2>{goals.length ? <ul className="lg-goal-list">{[...goals].reverse().map(g => <li key={g.id}><Link aria-current={g.id === goal?.id ? "page" : undefined} to={`${ROUTES.learningGoals}?goal=${encodeURIComponent(g.id)}`}>{g.wording}</Link><span>{g.initial.skill.label} · {g.attempts.length} {g.attempts.length === 1 ? "attempt" : "attempts"}</span></li>)}</ul> : <p>No goals saved yet.</p>}</section>
    <aside className="lg-resources"><h2>Optional learning resources</h2><p>Your existing courses and history are still available. Browsing a course does not mean it has been checked for this exact skill.</p><div className="lg-buttons"><Link to={ROUTES.plan}>My courses and history</Link><Link to={`${ROUTES.learningCentre}?mode=browse`}>Browse courses</Link></div></aside>
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
  const sourceParams = goal.sourceKey.startsWith("personal:") ? `personal=${encodeURIComponent(goal.sourceKey.slice(9))}` : goal.sourceKey.startsWith("specialist:") ? `specialist=${encodeURIComponent(goal.sourceKey.slice(11))}` : `context=${encodeURIComponent(goal.sourceKey.slice(8))}`;
  return <>
    {(draftHasChanges(draft) || draftError || needsReload) && <section className="lg-warning" aria-label="Unsaved draft recovery">
      <h2>{needsReload ? "Reload your saved account to continue" : "Unsaved changes in this tab"}</h2>
      <p>Your draft is separate from saved learning evidence. It belongs to this account and goal in this tab.</p>
      {draftError && <p role="alert">{draftError}</p>}
      {reviewRequired && <><p role="alert">Your saved goal or work context changed since you started this draft. Review the latest saved details before choosing to save your draft.</p><details open><summary>Latest saved details</summary><p>Goal: {goal.wording}</p><p>Action: {goal.action?.text ?? "None"}</p>{attempt.editing && <p>Attempt: {editing ? `${editing.date} · ${attemptLabels[editing.type]} · ${editing.description} · Notes: ${editing.notes || "None"} · Work task: ${editing.task?.wording ?? "None"}` : "This attempt was removed. It cannot be restored by saving this draft."}</p>}<p>Current confirmed tasks:</p><ul>{tasks.map(task => <li key={task.id}>{task.wording}</li>)}</ul></details><button disabled={busy || unreadable || needsReload} onClick={() => { if (draftRef.current) keepDraft({ ...draftRef.current, baseRevision: goal.revision, baseContext: contextStamp }); }}>I reviewed the saved changes</button></>}
      {removedAttempt && <p role="alert">This attempt was removed from saved evidence. Copy any notes you want to keep, then discard this attempt draft. It will not be recreated.</p>}
      <div className="lg-buttons"><button disabled={busy || Boolean(draftError)} onClick={reload}>Reload saved account and keep draft</button>{draftError && !unreadable && <button disabled={busy} onClick={() => keepDraft(draftRef.current)}>Retry keeping draft</button>}<button disabled={busy} onClick={() => setDiscarding(true)}>Discard unsaved changes</button></div>
      {discarding && <div><p>Discard the wording, action and attempt draft in this tab? Saved account records stay unchanged.</p><button disabled={busy} onClick={discardDraft}>Confirm discard</button><button disabled={busy} onClick={() => setDiscarding(false)}>Keep editing</button></div>}
    </section>}
    <section className="lg-card"><p className="lg-eyebrow">My goal</p><h2>{goal.wording}</h2><p className="lg-muted">{origin.skill.label} · Saved {displayDate(goal.createdAt)}</p>
      {warnings.length > 0 && <div className="lg-warning"><h3>Check the original context</h3>{warnings.map((w, i) => <p key={i}>{w}</p>)}<Link to={ROUTES.skills}>Review my skills</Link><p><Link to={`${ROUTES.learningGoals}?${sourceParams}&new=1`}>Create a new goal from my current saved choice</Link></p></div>}
      <form onSubmit={e => { e.preventDefault(); void savePart("wording", () => updateLearningGoal(goal.id, { wording }), "Goal wording saved. Your original starting record is unchanged."); }}>
        <label htmlFor="goal-wording">What do you want to work on?</label><textarea id="goal-wording" required maxLength={1000} value={wording} onChange={e => changeDraft({ wording: e.target.value })} disabled={formBlocked} rows={2} />
        <button disabled={saveBlocked || wording.trim() === goal.wording}>Save wording</button>
      </form>
      <details className="lg-starting"><summary>Why I chose this skill and my starting record</summary>
        <p><strong>Original goal:</strong> {origin.wording}</p><p><strong>Skill source:</strong> {origin.skill.source === "personal" ? "Your own skill entry. No external source identity or version is claimed." : `${origin.skill.source.toUpperCase()} ${origin.skill.sourceVersion ? `version ${origin.skill.sourceVersion}` : "· source version not recorded"}`}</p>
        <p className="lg-muted lg-break">Skill identity: {origin.skill.id}</p><p><strong>My original choice:</strong> {origin.decision ? decisionLabels[origin.decision] ?? origin.decision : "Not recorded"}</p>
        {origin.tasks.length ? <><h3>Tasks saved with this goal</h3><ul>{origin.tasks.map(t => <li key={t.id}>{t.wording}</li>)}</ul></> : <p>No confirmed work task was linked at the start. This is a gap in the record, not a lack of ability.</p>}
        {origin.career ? <p><strong>Career reason:</strong> {origin.career.title} ({origin.career.code})</p> : <p>No career reason was saved.</p>}
        {origin.sourceOccupationUri && <p>An ESCO role was used to discover this skill. That role is not a confirmed career goal.</p>}
        <p>Changing the goal wording does not change this starting record. A different skill or work context needs an explicit new goal.</p>
      </details>
    </section>
    <section className="lg-card"><h2>My next action <span className="lg-optional">Optional</span></h2><p>Keep this small. You can also record an attempt below without making a plan.</p>
      <form onSubmit={e => { e.preventDefault(); void savePart("action", () => updateLearningGoal(goal.id, { action: { kind: actionKind, text: actionText } }), "Next action saved."); }}>
        <label htmlFor="action-kind">I want to</label><select id="action-kind" value={actionKind} disabled={formBlocked} onChange={e => changeDraft({ action: { kind: e.target.value as keyof typeof actionLabels, text: actionText } })}>{Object.entries(actionLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
        <label htmlFor="action-text">My small action</label><textarea id="action-text" value={actionText} required maxLength={1000} disabled={formBlocked} onChange={e => changeDraft({ action: { kind: actionKind, text: e.target.value } })} rows={2} placeholder="For example, try one step and note what I learned" />
        <p className="lg-muted">This example is an idea for you to judge, not a checked practice guide.</p><div className="lg-buttons"><button className="lg-primary" disabled={saveBlocked}>Save action</button><button type="button" disabled={saveBlocked} onClick={() => { changeDraft({ action: null }); void savePart("action", () => updateLearningGoal(goal.id, { action: null }), "Goal kept for later. Your attempts are unchanged."); }}>{goal.action ? "Clear action and keep for later" : "Keep goal for later"}</button></div>
      </form>
    </section>
    <section className="lg-card"><h2>{attempt.editing ? "Correct an attempt" : "Record what I tried"}</h2><p>Use your own description. Leave out names, customer details and other confidential information.</p>
      <AttemptForm value={attempt} historical={editing?.task ?? null} tasks={tasks} busy={formBlocked} saveBlocked={saveBlocked || removedAttempt} onChange={value => changeDraft({ attempt: value })} onCancel={() => keepDraft(clearDraftPart(draftRef.current, "attempt", draftRef.current?.baseRevision ?? goal.revision))} onSave={async input => {
        await savePart("attempt", () => saveLearningAttempt(goal.id, input), attempt.editing ? "Attempt corrected. Earlier records are kept in history." : "Attempt saved.");
      }} />
    </section>
    <section className="lg-card"><h2>My attempts</h2><p>{goal.attempts.length} saved {goal.attempts.length === 1 ? "attempt" : "attempts"}. These are your records, not a skill grade or a change in AI exposure.</p><p className="lg-muted">{Object.entries(attemptLabels).map(([type, label]) => `${label}: ${goal.attempts.filter(a => a.type === type).length}`).join(" · ")}</p>
      {goal.attempts.length === 0 ? <p>No attempts recorded yet. This does not mean you lack the skill.</p> : <ul className="lg-attempts">{[...goal.attempts].sort((a, b) => b.date.localeCompare(a.date)).map(a => <li key={a.id}><div className="lg-attempt-heading"><strong>{attemptLabels[a.type]}</strong><time dateTime={a.date}>{displayDate(a.date)}</time></div><p className="lg-preserve">{a.description}</p>{a.task && <p><strong>Work task:</strong> {a.task.wording}</p>}{a.notes && <p className="lg-preserve lg-muted">{a.notes}</p>}
      <div className="lg-buttons"><button disabled={formBlocked || Boolean(draft?.attempt)} onClick={() => { changeDraft({ attempt: { id: a.id, editing: true, date: a.date, type: a.type, description: a.description, notes: a.notes, task: a.task } }); setRemoveId(null); requestAnimationFrame(() => document.getElementById("attempt-date")?.focus()); }}>Correct</button><button disabled={saveBlocked || Boolean(draft?.attempt)} onClick={() => setRemoveId(a.id)}>Remove</button></div>
      {removeId === a.id && <div className="lg-warning" role="group" aria-label="Confirm removal"><p>Remove this attempt from your current evidence? Its earlier version remains in history.</p><div className="lg-buttons"><button disabled={saveBlocked} onClick={() => { void savePart("attempt", () => removeLearningAttempt(goal.id, a.id), "Attempt removed from current evidence. History is kept.").then(ok => { if (ok) { setRemoveId(null);  } }); }}>Confirm removal</button><button disabled={busy} onClick={() => setRemoveId(null)}>Cancel</button></div></div>}</li>)}</ul>}
      {goal.needsReview && <p className="lg-muted">Your current records include these changes. Earlier versions remain below.</p>}
      {goal.history.length > 0 && <details className="lg-starting"><summary>Earlier saved versions ({goal.history.length})</summary><p>These versions preserve corrections. They are not counted as current attempts.</p>{[...goal.history].reverse().map(h => <div className="lg-history" key={h.revision}><h3>Version {h.revision} · {displayDate(h.recordedAt)}</h3><p>{h.wording}</p><p>Action: {h.action?.text ?? "None"}</p>{h.attempts.map(a => <p key={a.id}>{displayDate(a.date)} · {attemptLabels[a.type]}: {a.description}{a.task ? ` · Task: ${a.task.wording}` : ""}{a.notes ? ` · Notes: ${a.notes}` : ""}</p>)}</div>)}</details>}
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
    <p className="lg-muted">{type === "study" ? "Reading, watching or learning about the skill. This does not prove mastery." : type === "course_practice" ? "An exercise or project during learning. It does not need a workplace task." : "An attempt using the skill in a real work task."}</p>
    {type === "workplace_practice" && <><label htmlFor="attempt-task">Real work task</label><select id="attempt-task" required value={taskIdentity(task)} disabled={busy} onChange={e => onChange({ ...value, task: selectable.find(t => taskIdentity(t.task) === e.target.value)?.task ?? null })}><option value="">Choose a confirmed task</option>{selectable.map(option => <option key={taskIdentity(option.task)} value={taskIdentity(option.task)}>{option.historical ? "Earlier wording: " : "Current task: "}{option.task.wording}</option>)}</select>{task && !selectable.some(t => taskIdentity(t.task) === taskIdentity(task)) && <p role="alert">The task in your unsaved draft changed. Choose a current task before saving.</p>}{!selectable.length && <p>Add and confirm a real task in <Link to={ROUTES.task}>your work profile</Link> before saving workplace practice.</p>}</>}
    <label htmlFor="attempt-description">What did you do?</label><textarea id="attempt-description" value={description} required maxLength={2000} rows={3} disabled={busy} onChange={e => onChange({ ...value, description: e.target.value })} />
    <label htmlFor="attempt-notes">Notes <span className="lg-optional">Optional</span></label><textarea id="attempt-notes" value={notes} maxLength={4000} rows={2} disabled={busy} onChange={e => onChange({ ...value, notes: e.target.value })} />
    {confirmDiscard && <div className="lg-warning"><p>Discard this unsaved attempt draft? Saved attempts stay unchanged.</p><button type="button" disabled={busy} onClick={() => { onCancel(); setConfirmDiscard(false); }}>Confirm discard attempt</button><button type="button" onClick={() => setConfirmDiscard(false)}>Keep draft</button></div>}
    <div className="lg-buttons"><button className="lg-primary" disabled={saveBlocked || (type === "workplace_practice" && (!task || !selectable.some(t => taskIdentity(t.task) === taskIdentity(task))))}>{busy ? "Saving…" : value.editing ? "Save correction" : "Save attempt"}</button>{(value.editing || description || notes) && <button type="button" disabled={busy} onClick={() => setConfirmDiscard(true)}>Discard attempt draft</button>}</div>
  </form>;
}
