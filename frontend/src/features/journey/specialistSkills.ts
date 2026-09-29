import { accountStorage, commitWorkspaceItems, currentWorkspaceSession } from "../../services/accountStorage.ts";
import { readJourneyProfile } from "./journey.ts";
import type { ProfileTask } from "../work-profile/types";

export const SPECIALIST_KEY = "aiwrevolusi.specialistSkills.v1";
export type SpecialistEntry = {
  taskId: string;
  taskWording: string;
  occupationCode: string | null;
  skillUri: string;
  skillLabel: string;
  sourceVersion: string;
  /** Source role chosen for discovery; never changes the confirmed work occupation. */
  sourceOccupationUri?: string | null;
  decision: "use" | "no" | "unsure" | null;
  wantsLearning: boolean;
  updatedAt: string;
};
export type SpecialistState = { version: 1; entries: SpecialistEntry[]; focusKey: string | null };
export const specialistEntryKey = (entry: Pick<SpecialistEntry, "taskId" | "skillUri">): string =>
  JSON.stringify([entry.taskId, entry.skillUri]);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const fields = ["taskId", "taskWording", "occupationCode", "skillUri", "skillLabel", "sourceVersion", "sourceOccupationUri", "decision", "wantsLearning", "updatedAt"];
function validEntry(value: unknown): value is SpecialistEntry {
  return record(value) && Object.keys(value).every(key => fields.includes(key)) &&
    text(value.taskId, 200) && text(value.taskWording, 5000) &&
    (value.occupationCode === null || text(value.occupationCode, 40)) &&
    typeof value.skillUri === "string" && /^http:\/\/data\.europa\.eu\/esco\/skill\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.skillUri) &&
    (value.sourceOccupationUri === undefined || value.sourceOccupationUri === null ||
      (typeof value.sourceOccupationUri === "string" && /^http:\/\/data\.europa\.eu\/esco\/occupation\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.sourceOccupationUri))) &&
    text(value.skillLabel, 300) && text(value.sourceVersion, 40) &&
    (value.decision === null || value.decision === "use" || value.decision === "no" || value.decision === "unsure") &&
    typeof value.wantsLearning === "boolean" && text(value.updatedAt, 40) && Number.isFinite(Date.parse(value.updatedAt));
}
export function parseSpecialistState(raw: string | null): SpecialistState {
  if (raw === null) return { version: 1, entries: [], focusKey: null };
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || Object.keys(value).some(key => !["version", "entries", "focusKey"].includes(key)) || value.version !== 1 ||
      !Array.isArray(value.entries) || value.entries.length > 200 || !value.entries.every(validEntry) ||
      new Set(value.entries.map(specialistEntryKey)).size !== value.entries.length ||
      !(value.focusKey === null || (text(value.focusKey, 400) && value.entries.some(entry => specialistEntryKey(entry) === value.focusKey && entry.wantsLearning)))) throw new Error();
    return value as SpecialistState;
  } catch { throw new Error("Your saved specialist skills could not be read. Your data is kept; reload your saved account before making changes."); }
}
export const readSpecialistState = (): SpecialistState => parseSpecialistState(accountStorage.getItem(SPECIALIST_KEY));
export function specialistEntryIsCurrent(entry: SpecialistEntry, tasks: readonly ProfileTask[], occupationCode: string | null): boolean {
  return entry.occupationCode === occupationCode && tasks.some(task => task.id === entry.taskId && task.wording === entry.taskWording);
}
function assertCurrent(entry: SpecialistEntry) {
  const profile = readJourneyProfile();
  if (!profile.tasksConfirmed || !specialistEntryIsCurrent(entry, profile.tasks, profile.tasksOccupationCode)) {
    throw new Error("Your work changed. Review this skill against your current task before saving.");
  }
}
let savingOwner: number | null = null;
async function persist(state: SpecialistState, check: () => void) {
  const owner = currentWorkspaceSession();
  if (savingOwner === owner) throw new Error("A skill choice is being saved. Please wait.");
  savingOwner = owner;
  try {
    check();
    const raw = JSON.stringify(state);
    parseSpecialistState(raw);
    await commitWorkspaceItems({ [SPECIALIST_KEY]: raw });
    if (owner !== currentWorkspaceSession()) throw new Error("Your account changed. Reload before continuing.");
    check();
  } finally { if (savingOwner === owner) savingOwner = null; }
}
/** Saves a self-report and a separate interest; never modifies source scores or WEF decisions. */
export async function saveSpecialistEntry(input: Omit<SpecialistEntry, "updatedAt">): Promise<void> {
  const state = readSpecialistState();
  const entry: SpecialistEntry = { ...input, updatedAt: new Date().toISOString() };
  const key = specialistEntryKey(entry);
  const previous = state.entries.find(item => specialistEntryKey(item) === key);
  const changed = previous && (previous.taskWording !== entry.taskWording || previous.occupationCode !== entry.occupationCode || previous.sourceVersion !== entry.sourceVersion);
  const next: SpecialistState = {
    ...state,
    entries: [...state.entries.filter(item => specialistEntryKey(item) !== key), entry],
    focusKey: state.focusKey === key && (!entry.wantsLearning || changed) ? null : state.focusKey,
  };
  await persist(next, () => assertCurrent(entry));
}
export async function saveSpecialistFocus(key: string | null): Promise<void> {
  const state = readSpecialistState();
  const entry = state.entries.find(item => specialistEntryKey(item) === key);
  if (key !== null && (!entry || !entry.wantsLearning)) throw new Error("Choose a saved learning interest first.");
  await persist({ ...state, focusKey: key }, () => { if (entry) assertCurrent(entry); });
}
