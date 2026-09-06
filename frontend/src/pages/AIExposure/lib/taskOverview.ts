import { taskIsWithinScoreRange, taskScore, type TaskScoreRange } from "../../Analysis/lib/taskScore.ts";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

/** Personal statistics use scored tasks only; missing evidence is never a zero. */
export function taskOverview(tasks: ProfileTask[], assessments: ConfirmedTaskExposureAssessment[], range: TaskScoreRange) {
  const byId = new Map(assessments.map((assessment) => [assessment.task_id, assessment]));
  const scored = tasks.flatMap((task) => {
    const assessment = byId.get(task.id) ?? null;
    const score = taskScore(task, assessment);
    return score === null ? [] : [{ task, assessment, score }];
  }).sort((a, b) => b.score - a.score);
  const inRange = scored.filter(({ score }) => taskIsWithinScoreRange(score, range)).length;
  return {
    scored,
    missingCount: tasks.length - scored.length,
    mean: scored.length ? scored.reduce((sum, item) => sum + item.score, 0) / scored.length : null,
    inRange,
    percentage: scored.length ? Math.round(inRange / scored.length * 100) : null,
    priorities: scored.slice(0, 3),
  };
}
export type TaskOverview = ReturnType<typeof taskOverview>;
