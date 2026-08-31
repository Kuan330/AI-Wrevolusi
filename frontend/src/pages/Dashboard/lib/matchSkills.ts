import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { WefSkill } from "@/types/reference";

export const skillsForTask = (
  task: ProfileTask,
  skills: WefSkill[],
): Array<WefSkill & { confidence: "identified" | "possible" }> => {
  const predictions = task.skillPredictions ?? [];
  const byId = new Map(skills.map((skill) => [skill.wef_skill_id, skill]));
  return predictions
    .map((prediction) => {
      const skill = byId.get(prediction.wefSkillId);
      if (!skill) return null;
      return { ...skill, confidence: prediction.confidence };
    })
    .filter((skill): skill is WefSkill & { confidence: "identified" | "possible" } => Boolean(skill));
};
