import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

export type TaskScoreRange = readonly [number, number];

/**
 * Return the score that belongs to the task itself.
 *
 * Reference tasks carry the published `score_2025`. User-entered tasks do not
 * have that value, so the assessment baseline is the next best source. The
 * adjusted score is only a final fallback for older saved analyses.
 */
export const taskScore = (
  task: Pick<ProfileTask, "score2025">,
  assessment?: Pick<ConfirmedTaskExposureAssessment, "baseline_score" | "adjusted_score"> | null,
): number | null => {
  const candidates = [task.score2025, assessment?.baseline_score, assessment?.adjusted_score];
  const score = candidates.find((candidate): candidate is number =>
    typeof candidate === "number" && Number.isFinite(candidate),
  );
  return score == null ? null : Math.min(1, Math.max(0, score));
};

export const taskIsWithinScoreRange = (
  score: number | null,
  [minimum, maximum]: TaskScoreRange,
): boolean => score != null && score >= minimum - 0.0001 && score <= maximum + 0.0001;
