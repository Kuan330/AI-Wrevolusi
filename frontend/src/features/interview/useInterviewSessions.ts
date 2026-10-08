import { useCallback, useEffect, useRef, useState } from "react";
import { currentWorkspaceSession } from "../../services/accountStorage.ts";
import { clearInterview, deleteInterviewSession, loadInterview, saveInterviewSession } from "./repository.ts";
import type { InterviewSession } from "./session.ts";

/** Practice sessions for this account, kept only in this browser. Every change is written before it counts as saved. */
export function useInterviewSessions(owner: string) {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const revision = useRef(0), queue = useRef<Promise<unknown>>(Promise.resolve()), active = useRef(true), blocked = useRef(false);
  const session = useRef(currentWorkspaceSession());
  const current = () => active.current && session.current === currentWorkspaceSession();

  useEffect(() => {
    active.current = true;
    loadInterview(owner).then(record => {
      if (!current()) return;
      revision.current = record.revision; setSessions(record.sessions);
    }).catch(cause => {
      if (!current()) return;
      blocked.current = true; setError(cause instanceof Error ? cause.message : "Your saved practice could not be read.");
    }).finally(() => { if (current()) setLoading(false); });
    return () => { active.current = false; };
  }, [owner]);

  const save = useCallback((next: InterviewSession) => {
    if (!current()) return Promise.resolve();
    setSessions(old => [next, ...old.filter(item => item.id !== next.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    if (blocked.current) { setSaveStatus("Not saved on this device"); return Promise.resolve(); }
    setSaveStatus("Saving on this device…");
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        const record = await saveInterviewSession(owner, next, revision.current, current);
        revision.current = record.revision;
        if (current()) { setSaveStatus("Saved on this device"); setError(""); }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Practice could not be saved on this device.";
        if (/Another tab|not been overwritten/.test(message)) blocked.current = true;
        if (current()) { setError(message); setSaveStatus("Not saved on this device"); }
      }
    });
    return queue.current;
  }, [owner]);

  const remove = useCallback(async (id: string) => {
    await queue.current.catch(() => undefined);
    if (!current()) return;
    try {
      const record = await deleteInterviewSession(owner, id, revision.current);
      revision.current = record.revision; setSessions(record.sessions); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Practice could not be deleted."); }
  }, [owner]);

  const clearAll = useCallback(async () => {
    await queue.current.catch(() => undefined);
    if (!current()) return;
    try { await clearInterview(owner); revision.current = 0; blocked.current = false; setSessions([]); setError(""); setSaveStatus(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Saved practice could not be deleted."); }
  }, [owner]);

  return { sessions, loading, error, saveStatus, save, remove, clearAll };
}
