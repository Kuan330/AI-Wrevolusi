import type { ProfileTask } from "./types";

/** Keep edited wording distinct from the original source without changing it. */
export function taskSourceLabel(task: Pick<ProfileTask, "source" | "wording" | "originalWording">): string {
  if (task.source === "user") return "Written by you";
  if (task.source !== "ilo") return "Source not recorded";
  if (typeof task.originalWording !== "string") return "ILO suggestion · original wording not recorded";
  return task.wording === task.originalWording
    ? "Suggested task · ILO reference"
    : "Edited by you · originally an ILO suggestion";
}
