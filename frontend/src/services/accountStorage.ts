import { api } from "./api.ts";

type Workspace = { data: Record<string, string>; revision: number };
export const workspaceKeys = [
  "aiwrevolusi.journey.v1",
  "aiwrevolusi.workProfileDraft.v1",
  "aiwrevolusi.userProfile",
  "aiwrevolusi.confirmedAnalysis",
  "aiwrevolusi.learningCentre",
  "aiwrevolusi.learningResourceSelections.v1",
  "aiwrevolusi.courseLibrary.v1",
  "aiwrevolusi.learningSkills.v1",
  "aiwrevolusi.plan.courses.v1",
  "aiwrevolusi.planner.v1",
  "aiwrevolusi.possibilities.chosenDirection",
  "aiwrevolusi.possibilities.shortlist",
];
let userId: string | null = null;
let workspaceSession = 0;
let workspace: Workspace = { data: {}, revision: 0 };
let saving: Promise<void> | null = null;
let savingSession: number | null = null;
let dirty = false;
let committedKeys: { session: number; keys: Set<string> } | null = null;
function checkPendingCommit(keys: string[]) {
  if (committedKeys?.session === workspaceSession && keys.some(key => committedKeys!.keys.has(key)))
    throw new Error("Your work is being saved. Wait before changing it again.");
}
let timer: ReturnType<typeof setTimeout> | undefined;
export let syncError = "";
const notify = () => {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("workspace-change"));
};
const cache = () => {
  if (userId)
    localStorage.setItem(
      `aiwrevolusi.account.${userId}`,
      JSON.stringify({ ...workspace, dirty }),
    );
};
export function activateWorkspace(id: string | null, next?: Workspace) {
  clearTimeout(timer);
  workspaceSession += 1;
  userId = id;
  workspace = next ?? { data: {}, revision: 0 };
  dirty = false;
  syncError = "";
  if (id) {
    const raw = localStorage.getItem(`aiwrevolusi.account.${id}`);
    if (raw) {
      try {
        const pending = JSON.parse(raw);
        if (pending.dirty) {
          workspace = pending;
          dirty = true;
          syncError =
            "You have unsynced changes on this browser. Download a local backup and reload the saved account before continuing.";
        }
      } catch {
        /* The server copy remains authoritative for unreadable caches. */
      }
    }
  }
  notify();
}
/** Clear browser work after a successful logout; saved account work stays on the server. */
export function clearWorkspaceOnLogout() {
  for (const key of Object.keys(localStorage)) {
    if (workspaceKeys.includes(key) || key.startsWith("aiwrevolusi.account.") ||
        key === "aiwrevolusi.selectedOccupation" || key === "aiwrevolusi.demo.credential") {
      localStorage.removeItem(key);
    }
  }
  activateWorkspace(null);
}

export async function flushWorkspace(): Promise<void> {
  clearTimeout(timer);
  if (saving) {
    const pendingOwner = savingSession;
    try {
      await saving;
    } catch (error) {
      // A previous account's failed request must not block this account's save.
      if (pendingOwner === workspaceSession) throw error;
    }
    if (dirty) return flushWorkspace();
    return;
  }
  if (!userId || !dirty) return;
  const snapshot = {
    owner_id: userId,
    data: { ...workspace.data },
    revision: workspace.revision,
  };
  const ownerSession = workspaceSession;
  savingSession = ownerSession;
  saving = (async () => {
    try {
      const saved = await api.patch<Workspace>("/account/workspace", snapshot);
      if (ownerSession !== workspaceSession) return;
      workspace.revision = saved.revision;
      dirty = JSON.stringify(workspace.data) !== JSON.stringify(snapshot.data);
      syncError = "";
      cache();
    } catch (error) {
      if (ownerSession === workspaceSession) {
        syncError = error instanceof Error
          ? error.message : "Your changes could not sync. Please retry.";
      }
      throw error;
    } finally {
      saving = null;
      savingSession = null;
      notify();
    }
  })();
  await saving;
  if (dirty) await flushWorkspace();
}
export const accountStorage = {
  getItem(key: string): string | null {
    return userId ? (workspace.data[key] ?? null) : localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    checkPendingCommit([key]);
    if (!userId) {
      localStorage.setItem(key, value);
      notify();
      return;
    }
    if (!workspaceKeys.includes(key) || workspace.data[key] === value) return;
    workspace.data[key] = value;
    dirty = true;
    cache();
    notify();
    clearTimeout(timer);
    timer = setTimeout(() => {
      void flushWorkspace().catch(() => {});
    }, 400);
  },
  removeItem(key: string) {
    checkPendingCommit([key]);
    if (!userId) {
      localStorage.removeItem(key);
      return;
    }
    if (!(key in workspace.data)) return;
    delete workspace.data[key];
    dirty = true;
    cache();
    notify();
    clearTimeout(timer);
    timer = setTimeout(() => {
      void flushWorkspace().catch(() => {});
    }, 400);
  },
};
export const hasAccountWorkspace = () => Boolean(userId);
/** Detect an account change while an operation waits for catalogue data. */
export const currentWorkspaceSession = () => workspaceSession;

/** Legacy browser imports are permitted only in the guest workspace. */
export function readGuestLegacyItem(key: string): string | null {
  if (userId) return null;
  return (typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null)
    ?? (typeof localStorage !== "undefined" ? localStorage.getItem(key) : null);
}

/** Commit related course records together before notifying or scheduling sync. */
export function saveWorkspaceItems(items: Record<string, string>) {
  checkPendingCommit(Object.keys(items));
  if (userId) {
    if (Object.keys(items).some((key) => !workspaceKeys.includes(key)))
      throw new Error("This data cannot be saved in your account workspace.");
    const previous = workspace;
    const wasDirty = dirty;
    workspace = { ...workspace, data: { ...workspace.data, ...items } };
    dirty = true;
    try {
      cache();
    } catch (error) {
      workspace = previous;
      dirty = wasDirty;
      throw error;
    }
    notify();
    clearTimeout(timer);
    timer = setTimeout(() => { void flushWorkspace().catch(() => {}); }, 400);
    return;
  }
  const previous = Object.fromEntries(
    Object.keys(items).map((key) => [key, localStorage.getItem(key)]),
  );
  try {
    for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
  } catch (error) {
    try {
      for (const [key, value] of Object.entries(previous)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    } catch {
      throw new Error("Course changes could not be restored. Reload and review your saved courses before continuing.");
    }
    throw error;
  }
  notify();
}

/** Publish a confirmed record only after the account server accepts it. */
export async function commitWorkspaceItems(items: Record<string, string | null>): Promise<void> {
  const owner = workspaceSession;
  if (!userId) throw new Error("Sign in before saving your work.");
  const keys = Object.keys(items);
  if (keys.some(key => !workspaceKeys.includes(key)))
    throw new Error("This data cannot be saved in your account workspace.");
  const expected = Object.fromEntries(keys.map(key => [key, workspace.data[key]]));
  // Recheck after every await: another confirmation may have acquired the slot.
  do {
    await flushWorkspace();
    if (owner !== workspaceSession || !userId) throw new Error("Your account changed. Please try again.");
  } while (saving);
  if (keys.some(key => workspace.data[key] !== expected[key]))
    throw new Error("Your work changed while saving. Review it and try again.");
  const before = { ...workspace.data };
  const data = { ...before };
  for (const [key, value] of Object.entries(items)) {
    if (value === null) delete data[key];
    else data[key] = value;
  }
  clearTimeout(timer);
  const lock = { session: owner, keys: new Set(keys) };
  committedKeys = lock;
  savingSession = owner;
  const request = (async () => {
    const saved = await api.patch<Workspace>("/account/workspace", { owner_id: userId, data, revision: workspace.revision });
    if (owner !== workspaceSession) throw new Error("Your account changed. Please try again.");
    // Conflicting writes are blocked; unrelated edits are retained for later sync.
    const concurrent = { ...workspace.data };
    workspace = { data: { ...data }, revision: saved.revision };
    for (const key of new Set([...Object.keys(before), ...Object.keys(concurrent)])) {
      if (before[key] !== concurrent[key] && !(key in items)) {
        if (concurrent[key] === undefined) delete workspace.data[key];
        else workspace.data[key] = concurrent[key];
      }
    }
    dirty = JSON.stringify(workspace.data) !== JSON.stringify(data);
    syncError = "";
    try { cache(); }
    catch {
      // The account server accepted this profile. Do not report a failed save
      // or restore stale work just because the optional browser cache is full.
      syncError = "Your work is saved to your account, but this browser could not keep a local copy. Reload to use the saved account copy.";
    }
  })();
  saving = request;
  try { await request; }
  catch (error) {
    if (owner === workspaceSession) syncError = error instanceof Error ? error.message : "Your work could not be saved.";
    throw error;
  } finally {
    if (saving === request) { saving = null; savingSession = null; }
    if (committedKeys === lock) committedKeys = null;
    notify();
  }
}
