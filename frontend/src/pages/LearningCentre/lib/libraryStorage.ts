import { accountStorage } from "@/services/accountStorage";
import type { LibraryState } from "../types";
const KEY = "aiwrevolusi.courseLibrary.v1";
export const emptyLibrary = (): LibraryState => ({
  version: 1,
  workContext: accountStorage.getItem("aiwrevolusi.confirmedAnalysis") ?? "",
  skillId: "",
  saved: [],
  choices: {},
  basis: {},
  pending: [],
});
export function readLibrary(): LibraryState {
  const raw = accountStorage.getItem(KEY);
  if (!raw) return emptyLibrary();
  const state = JSON.parse(raw) as LibraryState;
  if (
    state?.version !== 1 ||
    !Array.isArray(state.saved) ||
    !Array.isArray(state.pending) ||
    !state.choices ||
    !state.basis
  )
    throw new Error(
      "Saved courses could not be read. Your saved data has not been overwritten.",
    );
  const context = accountStorage.getItem("aiwrevolusi.confirmedAnalysis") ?? "";
  if (state.workContext !== context) {
    return { ...state, workContext: context, saved: [], choices: {}, basis: {} };
  }
  // Saved ids belong to the backend catalogue, which is not available
  // synchronously here. Validating them against a bundled list used to wipe
  // every saved course on reload, so ids are kept as-is and resolved against
  // the live catalogue where they are displayed.
  if (typeof state.skillId !== "string") state.skillId = "";
  for (const choice of [
    ...Object.values(state.choices),
    ...state.pending.map((entry) => entry.choice),
  ]) {
    if (
      !choice ||
      !Array.isArray(choice.chapters) ||
      !choice.chapters.every(Number.isInteger) ||
      !Array.isArray(choice.weekdays) ||
      !choice.weekdays.every(
        (day) => Number.isInteger(day) && day >= 0 && day < 7,
      ) ||
      ![15, 30, 45, 60, 90].includes(choice.minutesPerDay)
    )
      throw new Error("Saved learning preferences could not be read.");
  }
  return state;
}
export function saveLibrary(state: LibraryState) {
  accountStorage.setItem(KEY, JSON.stringify({...state, workContext: accountStorage.getItem("aiwrevolusi.confirmedAnalysis") ?? ""}));
}
