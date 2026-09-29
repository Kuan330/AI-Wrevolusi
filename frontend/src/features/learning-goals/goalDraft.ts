/** Tab-local recovery only. A draft is never learning evidence or a saved account record. */
export type DraftAttempt = {
  id: string; editing: boolean; date: string;
  type: "study" | "course_practice" | "workplace_practice";
  description: string; notes: string; task: { id: string; wording: string } | null;
};
export type GoalDraft = {
  version: 1; owner: string; goalId: string; baseRevision: number; baseContext?: string;
  wording?: string;
  action?: { kind: "understand" | "practise" | "find_learning"; text: string; origin?: "ai_suggestion" | "template" } | null;
  attempt?: DraftAttempt;
};
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const goalDraftKey = (owner: string, goalId: string) => `aiwrevolusi.goalDraft.v1:${JSON.stringify([owner, goalId])}`;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
export function parseGoalDraft(raw: string | null, owner: string, goalId: string): GoalDraft | null {
  if (raw === null) return null;
  try {
    const d: unknown = JSON.parse(raw);
    if (!object(d) || d.version !== 1 || d.owner !== owner || d.goalId !== goalId || !Number.isSafeInteger(d.baseRevision) || Number(d.baseRevision) < 1 || Object.keys(d).some(k => !["version", "owner", "goalId", "baseRevision", "baseContext", "wording", "action", "attempt"].includes(k))) throw Error();
    if (d.baseContext !== undefined && !text(d.baseContext,1000000)) throw Error();
    if (d.wording !== undefined && !text(d.wording, 1000)) throw Error();
    if (d.action !== undefined && d.action !== null && (!object(d.action) || (typeof d.action.kind !== "string" || !["understand", "practise", "find_learning"].includes(d.action.kind)) || !text(d.action.text,1000) || (d.action.origin !== undefined && d.action.origin !== "ai_suggestion" && d.action.origin !== "template"))) throw Error();
    if (d.attempt !== undefined) {
      const a = d.attempt;
      if (!object(a) || !text(a.id,100) || !a.id || typeof a.editing !== "boolean" || !text(a.date,10) || (typeof a.type !== "string" || !["study", "course_practice", "workplace_practice"].includes(a.type)) || !text(a.description,2000) || !text(a.notes,4000) || (a.task !== null && (!object(a.task) || !text(a.task.id,200) || !text(a.task.wording,5000)))) throw Error();
    }
    return d as GoalDraft;
  } catch { throw Error("The unsaved draft in this tab could not be read. Your saved account records have not changed. Discard this draft to continue."); }
}
export const draftHasChanges = (draft: GoalDraft | null) => Boolean(draft && (draft.wording !== undefined || draft.action !== undefined || draft.attempt !== undefined));
export function readGoalDraft(storage: DraftStorage, owner: string, goalId: string) {
  return parseGoalDraft(storage.getItem(goalDraftKey(owner,goalId)),owner,goalId);
}
export function writeGoalDraft(storage: DraftStorage, owner: string, goalId: string, draft: GoalDraft | null) {
  if (draft && (draft.owner !== owner || draft.goalId !== goalId)) throw Error("This draft belongs to a different account or goal.");
  if (!draftHasChanges(draft)) storage.removeItem(goalDraftKey(owner,goalId));
  else { parseGoalDraft(JSON.stringify(draft),owner,goalId); storage.setItem(goalDraftKey(owner,goalId),JSON.stringify(draft)); }
}
export const draftNeedsReview = (draft: GoalDraft | null, savedRevision: number, context?: string) => draftHasChanges(draft) && (draft!.baseRevision !== savedRevision || (context !== undefined && draft!.baseContext !== context));
export function clearDraftPart(draft: GoalDraft | null, part: "wording" | "action" | "attempt", revision: number): GoalDraft | null {
  if (!draft) return null;
  const next = { ...draft, baseRevision: revision }; delete next[part];
  return draftHasChanges(next) ? next : null;
}
export const taskIdentity = (task: { id: string; wording: string } | null) => task ? JSON.stringify([task.id, task.wording]) : "";
export function attemptTaskOptions(tasks: { id: string; wording: string }[], historical: { id: string; wording: string } | null) {
  const options = tasks.map(task => ({ task, historical: false }));
  if (historical && !tasks.some(task => taskIdentity(task) === taskIdentity(historical))) options.unshift({ task: historical, historical: true });
  return options;
}
