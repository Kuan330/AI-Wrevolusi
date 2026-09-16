import type { TaskBaseline, TaskTrial } from "../../WorkProfile/types";

export function parseMinutes(value: string): number | null {
  const minutes = Number(value);
  return value.trim() &&
    Number.isFinite(minutes) &&
    minutes > 0 &&
    minutes <= 100000
    ? minutes
    : null;
}
export const sameWorkload = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, " ") ===
  b.trim().toLowerCase().replace(/\s+/g, " ");
export function matchingBaseline(
  baseline: TaskBaseline | undefined,
  wording: string,
  workload: string,
) {
  return baseline?.taskWording === wording &&
    sameWorkload(baseline.workload, workload)
    ? baseline.minutes
    : null;
}
export function trialComparison(trial: TaskTrial) {
  if (
    !trial.sameWorkload ||
    trial.baselineMinutes == null ||
    !Number.isFinite(trial.baselineMinutes) ||
    trial.baselineMinutes <= 0 ||
    !Number.isFinite(trial.minutes) ||
    trial.minutes <= 0
  )
    return null;
  const difference = trial.baselineMinutes - trial.minutes;
  return { difference, percentage: (difference / trial.baselineMinutes) * 100 };
}
export const qualityLabels = {
  met: "Met requirements",
  partly: "Partly met requirements",
  not_met: "Did not meet requirements",
} as const;
export const formatMinutes = (value: number) =>
  Number(value.toFixed(1)).toLocaleString();
