import { accountStorage, commitWorkspaceItems, currentWorkspaceSession, hasAccountWorkspace } from "../../services/accountStorage.ts";
import { readUserProfile, type SelectedOccupation, type UserProfile } from "./userProfile.ts";
import type { ProfileTask } from "./types";

const DRAFT_KEY = "aiwrevolusi.workProfileDraft.v1";
const PROFILE_KEY = "aiwrevolusi.userProfile";
const ANALYSIS_KEY = "aiwrevolusi.confirmedAnalysis";
export type WorkProfileDraft = {
  version: 1;
  stage: "job" | "tasks";
  jobTitle: string;
  occupation: SelectedOccupation | null;
  occupationConfirmedTitle?: string;
  tasks: ProfileTask[];
  baseProfileVersion: number;
  updatedAt: string;
};
let savingSession: number | null = null;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const validTask = (task: unknown): task is ProfileTask => {
  if (!task || typeof task !== "object") return false;
  const value = task as ProfileTask;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 200 &&
    typeof value.wording === "string" && value.wording.length <= 3000 &&
    (value.source === undefined || value.source === "user" || value.source === "ilo");
};
function validate(draft: WorkProfileDraft) {
  if (!draft || draft.version !== 1 || !["job", "tasks"].includes(draft.stage) ||
      typeof draft.jobTitle !== "string" || draft.jobTitle.length > 200 ||
      (draft.occupationConfirmedTitle !== undefined && (typeof draft.occupationConfirmedTitle !== "string" || draft.occupationConfirmedTitle.length > 200)) ||
      !Number.isInteger(draft.baseProfileVersion) || draft.baseProfileVersion < 0 ||
      typeof draft.updatedAt !== "string" || !Number.isFinite(Date.parse(draft.updatedAt)) ||
      !Array.isArray(draft.tasks) || draft.tasks.length > 50 || !draft.tasks.every(validTask) ||
      new Set(draft.tasks.map(task => task.id)).size !== draft.tasks.length ||
      (draft.occupation !== null && (!draft.occupation || !draft.occupation.unit ||
        typeof draft.occupation.unit.occupation_code !== "string" || !draft.occupation.unit.occupation_code ||
        typeof draft.occupation.unit.title !== "string" || !Array.isArray(draft.occupation.path)))) {
    throw new Error("Your saved work draft could not be read. Keep a backup and reload your account before continuing.");
  }
  return draft;
}
function writable() {
  if (!hasAccountWorkspace()) throw new Error("Sign in before editing your work.");
  if (savingSession === currentWorkspaceSession()) throw new Error("Your work is being saved. Please wait.");
}
export function readWorkDraft(): WorkProfileDraft | null {
  const raw = accountStorage.getItem(DRAFT_KEY);
  if (raw === null) return null;
  try { return validate(JSON.parse(raw)); }
  catch { throw new Error("Your saved work draft could not be read. Keep a backup and reload your account before continuing."); }
}
export function startWorkDraft(stage: WorkProfileDraft["stage"] = "job"): WorkProfileDraft {
  writable();
  const existing = readWorkDraft();
  if (existing) return existing.stage === stage ? existing : updateWorkDraft({ stage });
  const profile = readUserProfile();
  let occupation = profile.occupation ?? null;
  if (!occupation && profile.tasksOccupationCode) {
    occupation = { unit: { occupation_code: profile.tasksOccupationCode, title: profile.analysis?.occupationTitle || "Saved occupation", level: "unit", parent_code: null, description: null }, path: [] };
  }
  const draft: WorkProfileDraft = {
    version: 1, stage, jobTitle: profile.jobTitle ?? "", occupation,
    occupationConfirmedTitle: occupation ? profile.jobTitle ?? "" : undefined,
    tasks: clone(profile.tasks), baseProfileVersion: profile.profileVersion ?? 0,
    updatedAt: new Date().toISOString(),
  };
  accountStorage.setItem(DRAFT_KEY, JSON.stringify(validate(draft)));
  return draft;
}
export function updateWorkDraft(patch: Partial<Pick<WorkProfileDraft, "stage" | "jobTitle" | "occupation" | "tasks">>): WorkProfileDraft {
  writable();
  const previous = readWorkDraft();
  if (!previous) throw new Error("Start your work profile before editing it.");
  const next = validate({ ...previous, ...clone(patch), updatedAt: new Date().toISOString() });
  if (Object.hasOwn(patch, "occupation")) {
    next.occupationConfirmedTitle = next.occupation ? next.jobTitle.trim() : undefined;
  }
  accountStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  return next;
}
const normaliseTitle = (title: string) => title.trim().replace(/\s+/g, " ").toLocaleLowerCase();
export function workDraftNeedsMatchReview(draft: WorkProfileDraft): boolean {
  return Boolean(draft.occupation && (draft.occupationConfirmedTitle === undefined ||
    normaliseTitle(draft.jobTitle) !== normaliseTitle(draft.occupationConfirmedTitle)));
}
export async function discardWorkDraft(): Promise<void> {
  writable();
  // Reading first preserves malformed data instead of silently deleting it.
  readWorkDraft();
  const owner = currentWorkspaceSession();
  savingSession = owner;
  try { await commitWorkspaceItems({ [DRAFT_KEY]: null }); }
  finally { if (savingSession === owner) savingSession = null; }
}
export async function confirmWorkDraft(): Promise<UserProfile> {
  writable();
  const draft = readWorkDraft();
  if (!draft || !draft.jobTitle.trim()) throw new Error("Enter your job title before saving.");
  if (workDraftNeedsMatchReview(draft)) throw new Error("Your job title changed. Keep, replace or remove the reference match before saving.");
  if (!draft.tasks.length || draft.tasks.some(task => !task.wording.trim())) throw new Error("Add at least one clear task before saving your work.");
  const previous = readUserProfile();
  if ((previous.profileVersion ?? 0) !== draft.baseProfileVersion) throw new Error("Your saved profile changed. Reload it before saving this draft.");
  const code = draft.occupation?.unit.occupation_code ?? null;
  const taskEvidence = (task: ProfileTask) => {
    const { practice: _practice, ...evidence } = task;
    return JSON.stringify(evidence);
  };
  const changedTaskIds = [...new Set([...previous.tasks, ...draft.tasks].filter(task => {
    const old = previous.tasks.find(item => item.id === task.id);
    const next = draft.tasks.find(item => item.id === task.id);
    return !old || !next || taskEvidence(old) !== taskEvidence(next);
  }).map(task => task.id))];
  const changed = code !== previous.tasksOccupationCode || changedTaskIds.length > 0;
  const history = [...(previous.history ?? [])];
  if (previous.tasksConfirmed && (changed || draft.jobTitle.trim() !== previous.jobTitle)) {
    history.push({ profileVersion: previous.profileVersion ?? 0, confirmedAt: previous.confirmedAt ?? null,
      jobTitle: previous.jobTitle ?? "", occupationCode: previous.tasksOccupationCode, tasks: clone(previous.tasks) });
  }
  const next: UserProfile = { ...previous, jobTitle: draft.jobTitle.trim(), occupation: draft.occupation,
    tasksOccupationCode: code, tasksConfirmed: true, confirmedAt: new Date().toISOString(),
    profileVersion: (previous.profileVersion ?? 0) + 1, history, changedTaskIds,
    tasks: draft.tasks.map(task => {
      const original = previous.tasks.find(item => item.id === task.id && item.wording === task.wording);
      const { practice: _practice, ...rest } = task;
      const kept = original?.practice ? { ...rest, practice: clone(original.practice) } : rest;
      if (code !== previous.tasksOccupationCode && task.sourceOccupationCode !== code) {
        return { ...kept, meanScore2025: null, potential25: null };
      }
      return kept;
    }),
    analysis: changed ? null : previous.analysis,
    learningReviewNeeded: changed || previous.learningReviewNeeded,
  };
  const items: Record<string, string | null> = { [PROFILE_KEY]: JSON.stringify(next), [DRAFT_KEY]: null,
    [ANALYSIS_KEY]: next.analysis ? JSON.stringify(next.analysis) : null };
  if (changed) {
    items["aiwrevolusi.possibilities.chosenDirection"] = null;
    items["aiwrevolusi.possibilities.shortlist"] = null;
  }
  const owner = currentWorkspaceSession();
  savingSession = owner;
  try { await commitWorkspaceItems(items); return next; }
  finally { if (savingSession === owner) savingSession = null; }
}
