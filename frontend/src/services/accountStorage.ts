import { api } from "./api.ts";

type Workspace = { data: Record<string, string>; revision: number };
export const workspaceKeys = [
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
