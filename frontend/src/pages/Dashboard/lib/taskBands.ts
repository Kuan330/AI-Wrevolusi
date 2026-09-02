import {
  TaskBandColor,
  TaskBandId,
  TASK_BAND_COLOR,
  TASK_BAND_INK,
  TASK_BAND_TONE,
} from "@/pages/Dashboard/lib/palette";

export { TaskBandId };

export const TASK_BANDS = [
  {
    id: TaskBandId.HumanLed,
    label: "Human-led",
    min: 0,
    max: 0.25,
    color: TASK_BAND_COLOR[TaskBandId.HumanLed],
    ink: TASK_BAND_INK[TaskBandId.HumanLed],
  },
  {
    id: TaskBandId.AiAssisted,
    label: "AI-assisted",
    min: 0.25,
    max: 0.4,
    color: TASK_BAND_COLOR[TaskBandId.AiAssisted],
    ink: TASK_BAND_INK[TaskBandId.AiAssisted],
  },
  {
    id: TaskBandId.PartlyAutomated,
    label: "Partly automated",
    min: 0.4,
    max: 0.55,
    color: TASK_BAND_COLOR[TaskBandId.PartlyAutomated],
    ink: TASK_BAND_INK[TaskBandId.PartlyAutomated],
  },
  {
    id: TaskBandId.Reshaped,
    label: "Reshaped",
    min: 0.55,
    max: 1.01,
    color: TASK_BAND_COLOR[TaskBandId.Reshaped],
    ink: TASK_BAND_INK[TaskBandId.Reshaped],
  },
  {
    id: TaskBandId.InsufficientData,
    label: "Insufficient data",
    min: Number.POSITIVE_INFINITY,
    max: Number.POSITIVE_INFINITY,
    color: TASK_BAND_COLOR[TaskBandId.InsufficientData],
    ink: TASK_BAND_INK[TaskBandId.InsufficientData],
  },
] as const;

export const bandFromScore = (score: number | null | undefined): TaskBandId | null => {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  const match = TASK_BANDS.find((band) => score >= band.min && score < band.max);
  return match?.id ?? TaskBandId.Reshaped;
};

export const taskBandMeta = (id: TaskBandId | null) =>
  TASK_BANDS.find((band) => band.id === id) ?? null;

export { TaskBandColor, TASK_BAND_COLOR, TASK_BAND_INK, TASK_BAND_TONE };
