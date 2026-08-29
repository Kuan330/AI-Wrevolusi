export const TASK_BANDS = [
  { id: "human_led", label: "Human-led", min: 0, max: 0.25, color: "#7BB8A4" },
  { id: "ai_assisted", label: "AI-assisted", min: 0.25, max: 0.4, color: "#E8C35A" },
  { id: "partly_automated", label: "Partly automated", min: 0.4, max: 0.55, color: "#E08A3C" },
  { id: "reshaped", label: "Reshaped", min: 0.55, max: 1.01, color: "#D15A4A" },
] as const;

export type TaskBandId = (typeof TASK_BANDS)[number]["id"];

export const bandFromScore = (score: number | null | undefined): TaskBandId | null => {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  const match = TASK_BANDS.find((band) => score >= band.min && score < band.max);
  return match?.id ?? "reshaped";
};

export const taskBandMeta = (id: TaskBandId | null) =>
  TASK_BANDS.find((band) => band.id === id) ?? null;
