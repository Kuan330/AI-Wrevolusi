import { accountStorage, commitWorkspaceItems, currentWorkspaceSession, flushWorkspace, saveWorkspaceItems } from "../../services/accountStorage.ts";
import { readUserProfile, type UserProfile } from "../work-profile/userProfile.ts";
import { readPlanState } from "../learning-planning/planCourses.ts";
import { readLibrary } from "../learning-planning/libraryStorage.ts";
import { ROUTES } from "../../constants/routes.ts";
import { readWorkDraft } from "../work-profile/workProfileDraft.ts";

export const JOURNEY_KEY = "aiwrevolusi.journey.v1";
export type SkillDecision = "accepted" | "rejected";
export type LearningContext = {
  id: string;
  origin: "work" | "career" | "browse";
  skill: { source: "wef"; id: number; slug: string; name: string };
  taskIds: string[];
  taskLabels: string[];
  career?: { code: string; title: string };
  goal: string;
  workKey: string;
  createdAt: string;
};
export type LearningInput = {
  origin: LearningContext["origin"];
  skill: Omit<LearningContext["skill"], "source">;
  taskIds?: string[];
  taskLabels?: string[];
  career?: LearningContext["career"];
  goal?: string;
};
export type PersonalSkillChoice = "use" | "no" | "unsure" | null;
export type PersonalSkill = {
  id: string; name: string; taskIds: string[]; taskLabels: string[]; workKey: string; updatedAt: string;
  decision?: PersonalSkillChoice; wantsLearning?: boolean;
};
export type JourneyState = {
  personalSkills?: PersonalSkill[];
  version: 1;
  contexts: Record<string, LearningContext>;
  courseContexts: Record<string, string>;
  activeContextId?: string;
  review?: {
    workKey: string;
    decisions: Record<string, SkillDecision>;
    completed: boolean;
    updatedAt: string;
  };
  resume?: { kind: "work" | "skills" | "learning" | "course"; id?: string; updatedAt: string };
};

const empty = (): JourneyState => ({ version: 1, contexts: {}, courseContexts: {} });
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 1000): value is string =>
  typeof value === "string" && value.length <= max;
const strings = (value: unknown, max = 100): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every(item => text(item));
const dated = (value: unknown): value is string => text(value, 40) && Number.isFinite(Date.parse(value));

export function isLearningContext(value: unknown): value is LearningContext {
  if (!record(value) || !record(value.skill)) return false;
  return text(value.id, 100) && value.id.length > 0 &&
    typeof value.origin === "string" && ["work", "career", "browse"].includes(value.origin) &&
    value.skill.source === "wef" && Number.isSafeInteger(value.skill.id) && Number(value.skill.id) > 0 &&
    text(value.skill.slug, 120) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.skill.slug) &&
    text(value.skill.name, 200) && value.skill.name.length > 0 &&
    strings(value.taskIds) && strings(value.taskLabels) && value.taskIds.length === value.taskLabels.length &&
    text(value.goal) && text(value.workKey, 100_000) && dated(value.createdAt) &&
    (value.career === undefined || (record(value.career) && text(value.career.code, 40) &&
      value.career.code.length > 0 && text(value.career.title, 200) && value.career.title.length > 0)) &&
    (value.origin !== "career" || value.career !== undefined);
}

export function isPersonalSkill(value: unknown): value is PersonalSkill {
  return record(value) && text(value.id, 100) && value.id.trim().length > 0 &&
    text(value.name, 120) && value.name.trim().length > 0 &&
    strings(value.taskIds) && value.taskIds.length > 0 && value.taskIds.every(id => id.trim().length > 0) &&
    new Set(value.taskIds).size === value.taskIds.length && strings(value.taskLabels) &&
    value.taskLabels.length === value.taskIds.length && value.taskLabels.every(label => label.trim().length > 0) &&
    text(value.workKey, 100_000) && value.workKey.length > 0 && dated(value.updatedAt) &&
    (value.decision === undefined || value.decision === null || (typeof value.decision === "string" && ["use", "no", "unsure"].includes(value.decision))) &&
    (value.wantsLearning === undefined || typeof value.wantsLearning === "boolean");
}

export function parseJourneyState(raw: string | null): JourneyState {
  if (raw === null) return empty();
  try {
    const state: unknown = JSON.parse(raw);
    if (!record(state) || state.version !== 1 || !record(state.contexts) || !record(state.courseContexts)) throw new Error();
    if (Object.keys(state.contexts).length > 500 || Object.keys(state.courseContexts).length > 500) throw new Error();
    if (!Object.entries(state.contexts).every(([id, value]) => isLearningContext(value) && value.id === id)) throw new Error();
    if (!Object.entries(state.courseContexts).every(([id, context]) => text(id, 100) && id.length && text(context, 100) && Object.hasOwn(state.contexts as object, context))) throw new Error();
    if (state.activeContextId !== undefined && (!text(state.activeContextId, 100) || !Object.hasOwn(state.contexts, state.activeContextId))) throw new Error();
    if (state.personalSkills !== undefined && (!Array.isArray(state.personalSkills) || state.personalSkills.length > 50 ||
      !state.personalSkills.every(isPersonalSkill) || new Set(state.personalSkills.map(s => s.id)).size !== state.personalSkills.length)) throw new Error();
    if (state.review !== undefined) {
      const r = state.review;
      if (!record(r) || !text(r.workKey, 100_000) || !record(r.decisions) || typeof r.completed !== "boolean" || !dated(r.updatedAt)) throw new Error();
      if (Object.keys(r.decisions).length > 100 || !Object.entries(r.decisions).every(([id, decision]) => /^[1-9]\d*$/.test(id) && typeof decision === "string" && ["accepted", "rejected"].includes(decision))) throw new Error();
    }
    if (state.resume !== undefined) {
      const r = state.resume;
      if (!record(r) || (typeof r.kind !== "string" || !["work", "skills", "learning", "course"].includes(r.kind)) || !dated(r.updatedAt) || (r.id !== undefined && !text(r.id, 100))) throw new Error();
    }
    return state as JourneyState;
  } catch {
    throw new Error("Your saved journey could not be read. Your data has been kept; reload your saved account before making changes.");
  }
}

export const readJourneyState = (): JourneyState => parseJourneyState(accountStorage.getItem(JOURNEY_KEY));

/** Read-only validation prevents a damaged profile being mistaken for a new user. */
export function readJourneyProfile(): UserProfile {
  const raw = accountStorage.getItem("aiwrevolusi.userProfile");
  const legacy = accountStorage.getItem("aiwrevolusi.confirmedAnalysis");
  try {
    if (raw !== null) {
      const p: unknown = JSON.parse(raw);
      if (!record(p) || !Array.isArray(p.tasks) || !p.tasks.every(t => record(t) && text(t.id, 100) && text(t.wording, 5000))) throw new Error();
      if (p.jobTitle !== undefined && !text(p.jobTitle, 200)) throw new Error();
      if (p.profileVersion !== undefined && (!Number.isSafeInteger(p.profileVersion) || Number(p.profileVersion) < 0)) throw new Error();
      if (p.confirmedAt !== undefined && !dated(p.confirmedAt)) throw new Error();
      if (p.history !== undefined && (!Array.isArray(p.history) || !p.history.every(entry => record(entry) &&
        Number.isSafeInteger(entry.profileVersion) && Number(entry.profileVersion) >= 0 && text(entry.jobTitle, 200) &&
        (entry.confirmedAt === null || dated(entry.confirmedAt)) && Array.isArray(entry.tasks) &&
        entry.tasks.every(task => record(task) && text(task.id, 200) && text(task.wording, 5000))))) throw new Error();
      if (p.tasksOccupationCode !== undefined && p.tasksOccupationCode !== null && typeof p.tasksOccupationCode !== "string") throw new Error();
      if (p.analysis !== null && p.analysis !== undefined && (!record(p.analysis) || !Array.isArray(p.analysis.tasks) || !p.analysis.tasks.every(t => record(t) && text(t.id, 100) && text(t.wording, 5000)))) throw new Error();
    } else if (legacy !== null) {
      const a: unknown = JSON.parse(legacy);
      if (!record(a) || !text(a.occupationTitle) || !Array.isArray(a.tasks) || !a.tasks.every(t => record(t) && text(t.id, 100) && text(t.wording, 5000))) throw new Error();
    }
    return readUserProfile();
  } catch {
    throw new Error("Your saved work could not be read. Your work and learning have been kept; reload your saved account before continuing.");
  }
}

export function workKeyFor(profile: UserProfile): string {
  return JSON.stringify({
    occupationCode: profile.tasksOccupationCode ?? profile.analysis?.occupationCode ?? null,
    tasks: profile.tasks.map(task => ({ id: task.id, wording: task.wording })).sort((a, b) => a.id.localeCompare(b.id)),
  });
}
export const currentWorkKey = () => workKeyFor(readJourneyProfile());
export function isSkillReviewCurrent(): boolean {
  const review = readJourneyState().review;
  return Boolean(review?.completed && review.workKey === currentWorkKey());
}
export const getSkillDecision = (id: number): SkillDecision | undefined => readJourneyState().review?.decisions[String(id)];

function save(state: JourneyState) {
  const raw = JSON.stringify(state);
  parseJourneyState(raw);
  saveWorkspaceItems({ [JOURNEY_KEY]: raw });
}
async function persist(state: JourneyState): Promise<void> {
  const owner = currentWorkspaceSession();
  save(state);
  await flushWorkspace();
  if (owner !== currentWorkspaceSession()) throw new Error("Your account changed. Reload before continuing.");
}
function reviewFor(state: JourneyState): NonNullable<JourneyState["review"]> {
  const workKey = currentWorkKey();
  return {
    workKey,
    decisions: state.review?.workKey === workKey ? { ...state.review.decisions } :
      Object.fromEntries(Object.entries(state.review?.decisions ?? {}).filter(([, decision]) => decision === "rejected")),
    completed: false,
    updatedAt: new Date().toISOString(),
  };
}
export async function saveSkillDecision(id: number, decision: SkillDecision | undefined): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Choose a supported skill before saving.");
  const profile = readJourneyProfile();
  if (!profile.tasks.length || !(profile.tasksConfirmed || profile.analysis)) throw new Error("Confirm your work tasks before reviewing skills.");
  const state = readJourneyState();
  const review = reviewFor(state);
  if (decision === undefined) delete review.decisions[String(id)];
  else review.decisions[String(id)] = decision;
  await persist({ ...state, review, resume: { kind: "skills", updatedAt: review.updatedAt } });
}
/** User statements stay separate from reference skills and career/course matching. */
export async function addPersonalSkill(id: string, name: string, taskId: string): Promise<void> {
  const state = readJourneyState();
  const profile = readJourneyProfile();
  const task = profile.tasks.find(item => item.id === taskId);
  if (!task || !(profile.tasksConfirmed || profile.analysis)) throw new Error("Choose one confirmed work task for this skill.");
  const entry: PersonalSkill = { id, name: name.trim(), taskIds: [task.id], taskLabels: [task.wording], workKey: workKeyFor(profile), updatedAt: new Date().toISOString() };
  if (!isPersonalSkill(entry)) throw new Error("Enter a skill name of up to 120 characters and choose a task.");
  const saved = state.personalSkills ?? [];
  const existing = saved.find(item => item.id === id);
  if (existing) {
    if (existing.name !== entry.name || existing.workKey !== entry.workKey || existing.taskIds[0] !== taskId) throw new Error("This saved skill changed. Reload before trying again.");
    const owner = currentWorkspaceSession();
    await flushWorkspace(); // Retrying a failed sync must not create a second entry.
    if (owner !== currentWorkspaceSession()) throw new Error("Your account changed. Reload before continuing.");
    return;
  }
  if (saved.some(item => item.workKey === entry.workKey && item.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase() && item.taskIds.includes(taskId)))
    throw new Error("You already added this skill for this task.");
  if (saved.length >= 50) throw new Error("You can save up to 50 personal skills. Remove an old entry before adding another.");
  await persist({ ...state, personalSkills: [...saved, entry] });
}

/** A personal label is the user's statement, never a verified catalogue concept. */
export function personalSkillIsCurrent(entry: PersonalSkill): boolean {
  const profile = readJourneyProfile();
  return Boolean(profile.tasksConfirmed) &&
    entry.taskIds.every((id, index) => profile.tasks.some(task => task.id === id && task.wording === entry.taskLabels[index]));
}
export async function savePersonalSkillChoice(id: string, patch: { decision?: PersonalSkillChoice; wantsLearning?: boolean }): Promise<void> {
  const state = readJourneyState();
  const saved = state.personalSkills?.find(entry => entry.id === id);
  if (!saved) throw new Error("This personal skill is no longer available.");
  if (!personalSkillIsCurrent(saved)) throw new Error("Your work changed. Add this skill again against a confirmed current task.");
  const updated: PersonalSkill = { ...saved, ...patch, updatedAt: new Date().toISOString() };
  if (!isPersonalSkill(updated)) throw new Error("Choose a supported skill decision or learning interest.");
  const next = { ...state, personalSkills: state.personalSkills!.map(entry => entry.id === id ? updated : entry) };
  await commitWorkspaceItems({ [JOURNEY_KEY]: JSON.stringify(next) });
}

export async function removePersonalSkill(id: string): Promise<void> {
  const state = readJourneyState();
  await persist({ ...state, personalSkills: (state.personalSkills ?? []).filter(item => item.id !== id) });
}

export async function completeSkillReview(): Promise<void> {
  const state = readJourneyState();
  await persist({ ...state, review: { ...reviewFor(state), completed: true } });
}

export const learningContextUrl = (context: LearningContext) => `${ROUTES.learningGoals}?${new URLSearchParams({ context: context.id })}`;
export const planCourseUrl = (courseId: string) => `${ROUTES.plan}?${new URLSearchParams({ course: courseId })}`;
export function readLearningContext(id?: string | null): LearningContext | null {
  const state = readJourneyState();
  const target = id == null ? state.activeContextId : id;
  return target && Object.hasOwn(state.contexts, target) ? state.contexts[target] : null;
}
export function learningContextNeedsReview(context: LearningContext): boolean {
  if (context.origin === "browse") return false;
  const profile = readJourneyProfile();
  if (context.origin === "career") return context.workKey !== workKeyFor(profile);
  // A work learning choice depends on its own supporting tasks. Editing an
  // unrelated task must not mark this saved connection as outdated.
  return !profile.tasksConfirmed || !context.taskIds.length ||
    context.taskIds.some((id, index) => !profile.tasks.some(task => task.id === id && task.wording === context.taskLabels[index])) ||
    getSkillDecision(context.skill.id) !== "accepted";
}
export async function startLearning(input: LearningInput): Promise<string> {
  const state = readJourneyState();
  const profile = readJourneyProfile();
  const taskIds = input.taskIds ?? [];
  const taskLabels = input.taskLabels ?? [];
  if (input.origin === "work") {
    if (!isSkillReviewCurrent() || getSkillDecision(input.skill.id) !== "accepted")
      throw new Error("Review and confirm this skill for your current work before choosing learning.");
    if (!taskIds.length || taskIds.some((id, i) => !profile.tasks.some(t => t.id === id && t.wording === taskLabels[i])))
      throw new Error("These task connections changed. Review your skills before continuing.");
  }
  const context: LearningContext = {
    id: crypto.randomUUID(), origin: input.origin,
    skill: { ...input.skill, source: "wef" }, taskIds, taskLabels,
    ...(input.career ? { career: input.career } : {}), goal: (input.goal ?? "").trim(),
    workKey: workKeyFor(profile), createdAt: new Date().toISOString(),
  };
  if (!isLearningContext(context)) throw new Error("The learning choice is incomplete. Choose a supported skill and try again.");
  const next: JourneyState = {
    ...state, contexts: { ...state.contexts, [context.id]: context }, activeContextId: context.id,
    resume: { kind: "learning", id: context.id, updatedAt: context.createdAt },
  };
  await persist(next);
  return learningContextUrl(context);
}

/** Prepared alongside course/library records, then saved by their shared operation. */
export function journeyForAddedCourse(courseId: string, contextId: string): string {
  const state = readJourneyState();
  const context = Object.hasOwn(state.contexts, contextId) ? state.contexts[contextId] : null;
  if (!context) throw new Error("Your learning choice is no longer available. Select the skill again.");
  if (learningContextNeedsReview(context)) throw new Error("Review the changed work or career connection before adding new learning from it.");
  const next: JourneyState = {
    ...state, courseContexts: { ...state.courseContexts, [courseId]: contextId },
    resume: { kind: "course", id: courseId, updatedAt: new Date().toISOString() },
  };
  const raw = JSON.stringify(next); parseJourneyState(raw); return raw;
}
export function getCourseContext(courseId: string): LearningContext | null {
  const state = readJourneyState();
  const id = Object.hasOwn(state.courseContexts, courseId) ? state.courseContexts[courseId] : null;
  return id && Object.hasOwn(state.contexts, id) ? state.contexts[id] : null;
}
export async function rememberCourse(courseId: string): Promise<void> {
  if (!readPlanState().courses.some(course => course.id === courseId)) throw new Error("This course is no longer in your learning list.");
  await persist({ ...readJourneyState(), resume: { kind: "course", id: courseId, updatedAt: new Date().toISOString() } });
}
export async function rememberIntent(kind: "work" | "skills", id?: string): Promise<void> {
  await persist({ ...readJourneyState(), resume: { kind, ...(id ? { id } : {}), updatedAt: new Date().toISOString() } });
}

/** Only for generic entry/Continue. Intentional page visits must not use this. */
export function getContinueDestination(): string {
  const draft = readWorkDraft();
  if (draft) return draft.stage === "tasks" && draft.jobTitle.trim() ? ROUTES.workProfile : `${ROUTES.workProfile}?edit=job`;
  const state = readJourneyState();
  const profile = readJourneyProfile();
  const plan = readPlanState({ migrateLegacy: false });
  const library = readLibrary();
  const unfinished = plan.courses.filter(c => c.chapters.length === 0 || c.chapters.some(ch => ch.value < 10));
  const taskPath = ROUTES.workProfile;
  if (state.resume?.kind === "work" && !profile.analysis && !profile.tasksConfirmed) return taskPath;
  if (state.resume?.kind === "skills" && profile.tasks.length && !isSkillReviewCurrent()) return ROUTES.skills;
  if (state.resume?.kind === "learning" && state.resume.id) {
    const context = Object.hasOwn(state.contexts, state.resume.id) ? state.contexts[state.resume.id] : null;
    if (context) return learningContextUrl(context);
  }
  if (state.resume?.kind === "course" && unfinished.some(c => c.id === state.resume?.id)) return planCourseUrl(state.resume.id!);
  if (unfinished.length) return unfinished.length === 1 ? planCourseUrl(unfinished[0].id) : ROUTES.plan;
  // Unknown catalogue records remain visible in My Learning rather than erased.
  if (library.saved.length || plan.courses.length) return ROUTES.plan;
  const context = state.activeContextId ? state.contexts[state.activeContextId] : null;
  if (context) return learningContextUrl(context);
  if (!profile.tasks.length) return ROUTES.workProfile;
  if (!profile.analysis && !profile.tasksConfirmed) return taskPath;
  return ROUTES.skills;
}

export function safeJourneyDestination(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://journey.invalid");
    if (url.origin !== "https://journey.invalid" || !Object.values(ROUTES).includes(url.pathname as never) || [ROUTES.home, ROUTES.continue].includes(url.pathname as never)) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
