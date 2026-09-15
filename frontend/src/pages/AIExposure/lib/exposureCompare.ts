import type { TaskOverview } from "@/pages/AIExposure/lib/taskOverview";

export type ExposureCompareKind = "close" | "above" | "below" | "incomplete";

export type ExposureCompareInsight = {
  kind: ExposureCompareKind;
  occupationScore: number | null;
  taskMean: number | null;
  delta: number | null;
  scoredCount: number;
  missingCount: number;
  summary: string;
  disclaimer: string;
  tip: string;
  ctaLabel: string;
};

const CLOSE_BAND = 0.03;

const clampScore = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null;

export const exposureCompareInsight = (input: {
  occupationScore: number | null | undefined;
  overview: TaskOverview;
}): ExposureCompareInsight => {
  const occupationScore = clampScore(input.occupationScore);
  const taskMean = clampScore(input.overview.mean);
  const scoredCount = input.overview.scored.length;
  const missingCount = input.overview.missingCount;
  const disclaimer =
    "This does not indicate better or worse performance. It helps you identify tasks worth exploring with AI.";

  if (occupationScore == null || taskMean == null || scoredCount === 0) {
    return {
      kind: "incomplete",
      occupationScore,
      taskMean,
      delta: null,
      scoredCount,
      missingCount,
      summary:
        occupationScore == null
          ? "An occupation reference score is not available for comparison yet."
          : "Add scored tasks to compare your mix with the occupation reference.",
      disclaimer,
      tip: "Confirm tasks with exposure scores, then return here for a clear next step.",
      ctaLabel: "View tasks to explore",
    };
  }

  const delta = taskMean - occupationScore;
  const abs = Math.abs(delta);
  const amount = `${Math.round(abs * 100)}%`;

  if (abs < CLOSE_BAND) {
    return {
      kind: "close",
      occupationScore,
      taskMean,
      delta,
      scoredCount,
      missingCount,
      summary: `Your task mix is close to the occupation reference (${amount} difference).`,
      disclaimer,
      tip: "Start with your highest-scoring tasks — those are the best places to explore with AI.",
      ctaLabel: "View tasks to explore",
    };
  }

  if (delta > 0) {
    return {
      kind: "above",
      occupationScore,
      taskMean,
      delta,
      scoredCount,
      missingCount,
      summary: `Your task mix is ${amount} above the occupation reference.`,
      disclaimer,
      tip: "Prioritise exploring AI on the highest-scoring tasks in your list.",
      ctaLabel: "View tasks to explore",
    };
  }

  return {
    kind: "below",
    occupationScore,
    taskMean,
    delta,
    scoredCount,
    missingCount,
    summary: `Your task mix is slightly below the occupation reference (${amount}).`,
    disclaimer,
    tip: "You can still explore AI on these tasks — or edit your list if high-exposure work is missing.",
    ctaLabel: "View tasks to explore",
  };
};
