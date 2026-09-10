import { api } from "./api.ts";

type Workspace = { data: Record<string, string>; revision: number };
export const workspaceKeys = [
  "aiwrevolusi.userProfile",
  "aiwrevolusi.confirmedAnalysis",
  "aiwrevolusi.learningCentre",
  "aiwrevolusi.learningResourceSelections.v1",
  "aiwrevolusi.planner.v1",
  "aiwrevolusi.possibilities.saved",
  "aiwrevolusi.possibilities.intent",
];
let userId: string | null = null;
let workspace: Workspace = { data: {}, revision: 0 };
let saving: Promise<void> | null = null;
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
            "You have unsynced changes on this browser. Retry saving before continuing.";
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
    await saving;
    if (dirty) return flushWorkspace();
    return;
  }
  if (!userId || !dirty) return;
  const snapshot = {
    owner_id: userId,
    data: { ...workspace.data },
    revision: workspace.revision,
  };
  saving = (async () => {
    try {
      const saved = await api.patch<Workspace>("/account/workspace", snapshot);
      workspace.revision = saved.revision;
      dirty = JSON.stringify(workspace.data) !== JSON.stringify(snapshot.data);
      syncError = "";
      cache();
    } catch (error) {
      syncError =
        error instanceof Error
          ? error.message
          : "Your changes could not sync. Please retry.";
      throw error;
    } finally {
      saving = null;
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
