import { useEffect, useState } from "react";
import { readJourneyProfile, readJourneyState } from "@/features/journey/journey";
import { readLearningGoals } from "@/features/learning-goals/learningGoals";
import { readPlanState } from "@/features/learning-planning/planCourses";
import { useAccount } from "@/components/account/useAccount";

/** Read-only account snapshots refresh after saves and when returning to the app. */
function useAccountSnapshot<T>(read: () => T) {
  const { user } = useAccount();
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener("workspace-change", update);
    window.addEventListener("focus", update);
    return () => { window.removeEventListener("workspace-change", update); window.removeEventListener("focus", update); };
  }, []);
  try {
    return { data: user ? read() : null, error: "" };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Your saved workspace could not be read. Please retry." };
  }
}
const readLearning = () => ({ plan: readPlanState({ migrateLegacy: false }), goals: readLearningGoals() });
export function useWorkspaceSnapshot() {
  return useAccountSnapshot(() => ({ profile: readJourneyProfile(), journey: readJourneyState(), ...readLearning() }));
}
/** Learning history remains readable even when work or skill context needs recovery. */
export function useLearningSnapshot() {
  return useAccountSnapshot(readLearning);
}
