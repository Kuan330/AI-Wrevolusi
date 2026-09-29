import { useEffect, useState } from "react";
import { readWorkDraft } from "@/features/work-profile/workProfileDraft";
import { readJourneyProfile } from "@/features/journey/journey";

function readState() {
  try { return { draft: readWorkDraft(), profile: readJourneyProfile(), error: "" }; }
  catch (error) { return { draft: null, profile: null, error: error instanceof Error ? error.message : "Your saved work could not be read. Please reload your account." }; }
}
export function useWorkDraft() {
  const [state, setState] = useState(readState);
  useEffect(() => {
    const refresh = () => setState(readState());
    window.addEventListener("workspace-change", refresh);
    return () => window.removeEventListener("workspace-change", refresh);
  }, []);
  return state;
}
