import { useEffect, useRef, useState } from "react";
import { message } from "@/components/ui/message";
import { changeSavedCourses, type SavedCourseChange } from "@/features/learning-planning/courseOperations";
import { currentWorkspaceSession, flushWorkspace } from "@/services/accountStorage";
import { readLibrary, saveLibrary, emptyLibrary } from "../../../features/learning-planning/libraryStorage";
import type { LibraryState } from "../../../features/learning-planning/types";

export function useCourseLibrary() {
  const [initial] = useState(() => {
    try {
      return { state: readLibrary(), error: "" };
    } catch (error) {
      return { state: emptyLibrary(), error: error instanceof Error ? error.message : "Could not load saved courses." };
    }
  });
  const [state, setState] = useState(initial.state);
  const [notice, setNotice] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const session = useRef(currentWorkspaceSession());

  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      if (session.current !== currentWorkspaceSession()) {
        session.current = currentWorkspaceSession();
        saving.current = false;
        setBusy(false);
        setPendingSync(false);
        setNotice("");
      }
      try { setState(readLibrary()); }
      catch { setNotice("Could not read your saved courses. Please reload."); }
    };
    window.addEventListener("workspace-change", refresh);
    return () => {
      mounted.current = false;
      window.removeEventListener("workspace-change", refresh);
    };
  }, []);

  function update(next: LibraryState) {
    if (initial.error) { setNotice(initial.error); return false; }
    try { saveLibrary(next); setState(next); return true; }
    catch { setNotice("Could not save your changes. Please try again."); return false; }
  }

  async function changeCourses(change: SavedCourseChange) {
    if (saving.current || pendingSync || initial.error) return false;
    const owner = currentWorkspaceSession();
    saving.current = true;
    setBusy(true);
    let changedLocally = false;
    try {
      const result = await changeSavedCourses(change);
      if (!mounted.current || owner !== currentWorkspaceSession()) return false;
      changedLocally = true;
      setPendingSync(true);
      setState(result.library);
      await flushWorkspace();
      if (!mounted.current || owner !== currentWorkspaceSession()) return false;
      setPendingSync(false);
      setNotice("");
      return true;
    } catch (error) {
      if (!mounted.current || owner !== currentWorkspaceSession()) return false;
      const detail = error instanceof Error ? error.message : "Please try again.";
      const text = changedLocally
        ? `Your changes are kept on this browser but have not synced to your account. ${detail}`
        : detail;
      setNotice(text);
      message.error(text);
      return false;
    } finally {
      if (mounted.current && owner === currentWorkspaceSession()) {
        saving.current = false;
        setBusy(false);
      }
    }
  }

  async function retrySync() {
    if (saving.current || !pendingSync) return false;
    const owner = currentWorkspaceSession();
    saving.current = true;
    setBusy(true);
    try {
      await flushWorkspace();
      if (!mounted.current || owner !== currentWorkspaceSession()) return false;
      setPendingSync(false);
      setNotice("");
      message.success("Your course changes are synced to your account");
      return true;
    } catch (error) {
      if (!mounted.current || owner !== currentWorkspaceSession()) return false;
      const detail = error instanceof Error ? error.message : "Please try again.";
      setNotice(`Your changes are still kept on this browser and have not synced to your account. ${detail}`);
      return false;
    } finally {
      if (mounted.current && owner === currentWorkspaceSession()) {
        saving.current = false;
        setBusy(false);
      }
    }
  }

  async function toggleSave(courseId: string, learningContextId?: string) {
    const wasSaved = state.saved.includes(courseId);
    const changed = await changeCourses(wasSaved
      ? { remove: [courseId] }
      : { add: [courseId], learningContextId });
    if (changed) message.success(wasSaved ? "Removed from My Learning" : "Added to My Learning");
    return changed;
  }

  async function removeSavedCoursesForSkill(id: string, remainingIds: string[]) {
    return changeCourses({ removeSkill: { id, remainingIds } });
  }

  return { state, update, notice, busy, pendingSync, retrySync, toggleSave, removeSavedCoursesForSkill };
}
