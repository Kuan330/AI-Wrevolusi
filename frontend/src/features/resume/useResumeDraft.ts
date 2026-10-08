import { useEffect, useRef, useState } from "react";
import { currentWorkspaceSession } from "../../services/accountStorage.ts";
import { clearResumeDraft, loadResumeDraft, saveResumeDraft } from "./repository.ts";
import { emptyDraft, type ResumeDraft } from "./types.ts";
export function useResumeDraft(owner: string) {
  const [draft, setDraft] = useState(() => emptyDraft(owner));
  const [loading, setLoading] = useState(true);
  const [editVersion, setEditVersion] = useState(0);
  const [storageError, setStorageError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [unreadable, setUnreadable] = useState(false);
  const current = useRef(draft), revision = useRef(0), queue = useRef<Promise<unknown>>(Promise.resolve());
  const active = useRef(true), loaded = useRef(false), writeBlocked = useRef(false);
  const edits = useRef(0), clearing = useRef(false);
  const session = useRef(currentWorkspaceSession());
  useEffect(() => {
    active.current = true;
    let valid = true;
    loadResumeDraft(owner).then(record => {
      if (!valid || !active.current || session.current !== currentWorkspaceSession()) return;
      current.current = record; revision.current = record.revision; setDraft(record);
      setSaveStatus(record.revision ? "Saved on this device" : ""); loaded.current = true;
    }).catch(error => {
      if (!valid || !active.current || session.current !== currentWorkspaceSession()) return;
      setStorageError(error.message); loaded.current = true;
      if (/not been overwritten|record could not/.test(error.message)) { writeBlocked.current = true; setUnreadable(true); }
    }).finally(() => { if (valid && active.current && session.current === currentWorkspaceSession()) setLoading(false); });
    return () => { valid = false; active.current = false; };
  }, [owner]);
  const change = (update: (value: ResumeDraft) => ResumeDraft) => {
    if (!loaded.current || clearing.current || !active.current || session.current !== currentWorkspaceSession()) return;
    const next = update(current.current);
    current.current = next; setDraft(next);
    const sequence = ++edits.current;
    setEditVersion(sequence);
    if (writeBlocked.current) { setSaveStatus("Not saved locally"); return; }
    setSaveStatus("Saving locally…");
    // Start an IDB transaction on every edit; no unload handler/debounce data loss.
    queue.current = queue.current.catch(() => undefined).then(async () => {
      if (writeBlocked.current) return;
      try {
        const saved = await saveResumeDraft(owner, next, revision.current, () => session.current === currentWorkspaceSession());
        revision.current = saved.revision;
        if (active.current && sequence === edits.current) { setSaveStatus("Saved on this device"); setStorageError(""); }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Local save failed. Export before leaving.";
        if (/Another tab|not been overwritten/.test(message)) { writeBlocked.current = true; setUnreadable(true); }
        if (active.current) { setStorageError(message); setSaveStatus("Not saved locally"); }
      }
    });
  };
  const clear = async () => {
    if (clearing.current) return;
    clearing.current = true;
    try {
      // Block edits and drain writes so old writes cannot resurrect the cleared CV.
      await queue.current.catch(() => undefined);
      if (session.current !== currentWorkspaceSession()) return;
      await clearResumeDraft(owner);
      const next = emptyDraft(owner);
      current.current = next; revision.current = 0; writeBlocked.current = false; loaded.current = true;
      if (active.current) { setDraft(next); setStorageError(""); setSaveStatus(""); setUnreadable(false); }
    } finally { clearing.current = false; }
  };
  return { draft, change, clear, editVersion, loading, storageError, saveStatus, unreadable, flush: () => queue.current };
}
