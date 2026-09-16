import { useState } from "react";
import { message } from "@/components/ui/message";
import { syncPlanWithLearningCourses } from "@/pages/Plan/lib/planCourses";
import { readLibrary, saveLibrary, emptyLibrary } from "../lib/libraryStorage";
import type { LibraryState } from "../types";

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

  async function syncPlan(savedIds: string[]) {
    try {
      await syncPlanWithLearningCourses(savedIds);
    } catch {
      setNotice(
        "Course saved, but My Plan could not be updated. Open My Plan to retry.",
      );
      message.error(
        "Course saved, but My Plan could not be updated. Open My Plan to retry.",
      );
    }
  }

  function toggleSave(courseId: string) {
    const wasSaved = state.saved.includes(courseId);
    const nextSaved = wasSaved
      ? state.saved.filter((id) => id !== courseId)
      : [...state.saved, courseId];
    const changed = update({
      ...state,
      saved: nextSaved,
    });
    if (!changed) {
      message.error("Could not save your changes. Please try again.");
      return;
    }
    void syncPlan(nextSaved);
    message.success(wasSaved ? "Removed from My Plan" : "Added to My Plan");
  }

  /** Drop courses from the learning list (e.g. when their skill is removed). */
  function removeSavedCourses(courseIds: string[]) {
    if (!courseIds.length) return false;
    const drop = new Set(courseIds);
    const nextSaved = state.saved.filter((id) => !drop.has(id));
    if (nextSaved.length === state.saved.length) return false;
    const changed = update({ ...state, saved: nextSaved });
    if (changed) void syncPlan(nextSaved);
    return changed;
  }

  return {
    state,
    update,
    notice,
    toggleSave,
    removeSavedCourses,
  };
}
