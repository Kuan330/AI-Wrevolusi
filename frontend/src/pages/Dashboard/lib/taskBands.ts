import {
  TaskBandColor,
  TaskBandId,
  TASK_BAND_COLOR,
  TASK_BAND_INK,
  TASK_BAND_TONE,
} from "@/pages/Dashboard/lib/palette";
import type { ProfileTask } from "@/pages/WorkProfile/types";

export { TaskBandId };

export type ExposureBand = TaskBandId | "insufficient_data";

const POTENTIAL25_TO_BAND: Record<string, TaskBandId> = {
  "Not Exposed": TaskBandId.HumanLed,
  "Minimal Exposure": TaskBandId.HumanLed,
  "Exposed: Gradient 1": TaskBandId.AiAssisted,
  "Exposed: Gradient 2": TaskBandId.AiAssisted,
  "Exposed: Gradient 3": TaskBandId.PartlyAutomated,
  "Exposed: Gradient 4": TaskBandId.Automated,
};

const SCORE_HUMAN_MAX = 0.28;
const SCORE_AI_ASSISTED_MAX = 0.43;
const SCORE_PARTLY_MAX = 0.57;

export const TASK_BANDS = [
  {
    id: TaskBandId.HumanLed,
    label: "Human-led",
    color: TASK_BAND_COLOR[TaskBandId.HumanLed],
    ink: TASK_BAND_INK[TaskBandId.HumanLed],
  },
  {
    id: TaskBandId.AiAssisted,
    label: "AI-assisted",
    color: TASK_BAND_COLOR[TaskBandId.AiAssisted],
    ink: TASK_BAND_INK[TaskBandId.AiAssisted],
  },
  {
    id: TaskBandId.PartlyAutomated,
    label: "Partly automated",
    color: TASK_BAND_COLOR[TaskBandId.PartlyAutomated],
    ink: TASK_BAND_INK[TaskBandId.PartlyAutomated],
  },
  {
    id: TaskBandId.Automated,
    label: "Automated",
    color: TASK_BAND_COLOR[TaskBandId.Automated],
    ink: TASK_BAND_INK[TaskBandId.Automated],
  },
] as const;

export const bandFromPotential25 = (potential25: string | null | undefined): TaskBandId | null => {
  if (!potential25) return null;
  return POTENTIAL25_TO_BAND[potential25.trim()] ?? null;
};

export const bandFromScore = (score: number | null | undefined): TaskBandId | null => {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  if (score < SCORE_HUMAN_MAX) return TaskBandId.HumanLed;
  if (score < SCORE_AI_ASSISTED_MAX) return TaskBandId.AiAssisted;
  if (score < SCORE_PARTLY_MAX) return TaskBandId.PartlyAutomated;
  return TaskBandId.Automated;
};

export const resolveExposureBand = (input: {
  band?: string | null;
  potential25?: string | null;
  score2025?: number | null;
}): TaskBandId | null => {
  if (input.band && input.band !== "insufficient_data") {
    const known = TASK_BANDS.find((item) => item.id === input.band);
    if (known) return known.id;
  }
  const fromPotential = bandFromPotential25(input.potential25);
  if (fromPotential) return fromPotential;
  return bandFromScore(input.score2025);
};

export const resolveTaskBand = (task: ProfileTask): TaskBandId | null =>
  resolveExposureBand({
    band: task.band,
    potential25: task.potential25,
    score2025: task.score2025,
  });

export const taskBandMeta = (id: TaskBandId | null) =>
  TASK_BANDS.find((band) => band.id === id) ?? null;

export { TaskBandColor, TASK_BAND_COLOR, TASK_BAND_INK, TASK_BAND_TONE };
