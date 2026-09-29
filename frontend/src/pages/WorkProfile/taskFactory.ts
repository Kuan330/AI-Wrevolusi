import { createTaskId } from "./taskOptions";
import type { ProfileTask } from "@/features/work-profile/types";

export const toProfileTask = (
  wording: string,
  source: ProfileTask["source"],
  extras?: Partial<
    Pick<
      ProfileTask,
      | "sourceOccupationCode"
      | "sourceVersion"
      | "iloTaskId"
      | "timeSpent"
      | "notes"
      | "responsibility"
      | "routineProcessingLevel"
      | "informationUseLevel"
      | "humanInteractionLevel"
      | "judgementLevel"
      | "score2025"
      | "potential25"
      | "meanScore2025"
    >
  >,
): ProfileTask => ({
  id: createTaskId(),
  wording,
  timeSpent: extras?.timeSpent ?? "",
  notes: extras?.notes ?? "",
  responsibility: extras?.responsibility ?? "",
  routineProcessingLevel: extras?.routineProcessingLevel ?? "",
  informationUseLevel: extras?.informationUseLevel ?? "",
  humanInteractionLevel: extras?.humanInteractionLevel ?? "",
  judgementLevel: extras?.judgementLevel ?? "",
  source,
  iloTaskId: extras?.iloTaskId,
  sourceOccupationCode: extras?.sourceOccupationCode,
  sourceVersion: extras?.sourceVersion,
  originalWording: source === "ilo" ? wording : undefined,
  score2025: extras?.score2025,
  potential25: extras?.potential25,
  meanScore2025: extras?.meanScore2025,
});
