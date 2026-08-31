import type { ProfileTask } from "@/pages/WorkProfile/types";
import { skillService, type SkillEstimateItem } from "@/services/skillService";

export const taskNeedsSkillPredictions = (task: ProfileTask) =>
  !task.skillPredictions || task.skillPredictions.length === 0;

export const mergeSkillEstimate = (task: ProfileTask, estimate: SkillEstimateItem): ProfileTask => ({
  ...task,
  insufficientSkillContext: estimate.insufficient_context,
  skillPredictions: estimate.predictions.map((prediction) => ({
    skillId: prediction.skill_id,
    wefSkillId: prediction.wef_skill_id,
    confidence: prediction.confidence,
    evidence: prediction.evidence,
    reason: prediction.reason,
    matchLayer: prediction.match_layer,
  })),
});

export const attachSkillPredictions = async (
  tasks: ProfileTask[],
  occupationTitle: string,
): Promise<ProfileTask[]> => {
  const pending = tasks.filter(taskNeedsSkillPredictions);
  if (pending.length === 0) return tasks;

  const skillResponse = await skillService.estimate(
    pending.map((task) => ({
      client_task_id: task.id,
      task_title: task.wording,
      task_description: task.responsibility ? `${task.wording}\n${task.responsibility}` : task.wording,
      occupation: occupationTitle,
      language: "en",
    })),
  );

  if (
    !skillResponse.llm_ready ||
    skillResponse.results.some((item) => item.reject_reason === "service_unavailable")
  ) {
    throw new Error("Skill inference is unavailable");
  }

  const skillById = new Map(skillResponse.results.map((item) => [item.client_task_id, item]));
  return tasks.map((task) => {
    if (!taskNeedsSkillPredictions(task)) return task;
    const estimate = skillById.get(task.id);
    if (!estimate) return task;
    return mergeSkillEstimate(task, estimate);
  });
};
