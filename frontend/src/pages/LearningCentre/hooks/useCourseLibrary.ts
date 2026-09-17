import { useRef, useState } from "react";
import { message } from "@/components/ui/message";
import { changeSavedCourses, type SavedCourseChange } from "@/features/learning-planning/courseOperations";
import { readLibrary, saveLibrary, emptyLibrary } from "../../../features/learning-planning/libraryStorage";
import type { LibraryState } from "../../../features/learning-planning/types";

export function useCourseLibrary() {
  const [initial] = useState(() => {
    try {
      return { state: readLibrary(), error: "" };
    } catch (error) {
      return {
        state: emptyLibrary(),
        error:
          error instanceof Error
            ? error.message
            : "Could not load saved courses.",
      };
    }
  });
  const [state, setState] = useState(initial.state);
  const [notice, setNotice] = useState(initial.error);
  function update(next: LibraryState) {
    if (initial.error) {
      setNotice(initial.error);
      return false;
    }
    try {
      saveLibrary(next);
      setState(next);
      return true;
    } catch {
      setNotice("Could not save your changes. Please try again.");
      return false;
    }
  }

  const saving = useRef(false);
  async function changeCourses(change: SavedCourseChange) {
    if (saving.current || initial.error) return false;
    saving.current = true;
    try {
      const result = await changeSavedCourses(change);
      setState(result.library);
      setNotice("");
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not save your courses. Please try again.";
      setNotice(detail);
      message.error(detail);
      return false;
    } finally {
      saving.current = false;
    }
  }

  async function toggleSave(courseId: string) {
    const wasSaved = state.saved.includes(courseId);
    const changed = await changeCourses(wasSaved ? { remove: [courseId] } : { add: [courseId] });
    if (changed) message.success(wasSaved ? "Removed from My Plan" : "Added to My Plan");
    return changed;
  }

  async function removeSavedCoursesForSkill(id: string, remainingIds: string[]) {
    return changeCourses({ removeSkill: { id, remainingIds } });
  }

  return {
    state,
    update,
    notice,
    toggleSave,
    removeSavedCoursesForSkill,
  };
}
