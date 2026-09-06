import { skillsForTask } from "@/pages/Analysis/lib/matchSkills";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { WefSkill } from "@/types/reference";

export type SkillEvidence = {
  skill: WefSkill;
  tasks: ProfileTask[];
};

export const buildSkillEvidence = (
  tasks: ProfileTask[],
  skills: WefSkill[],
): SkillEvidence[] => {
  const tasksBySkillId = new Map<number, ProfileTask[]>();

  for (const task of tasks) {
    for (const skill of skillsForTask(task.wording, skills)) {
      const supportingTasks = tasksBySkillId.get(skill.wef_skill_id) ?? [];
      if (!supportingTasks.some((item) => item.id === task.id)) {
        supportingTasks.push(task);
      }
      tasksBySkillId.set(skill.wef_skill_id, supportingTasks);
    }
  }

  return skills
    .filter((skill) => tasksBySkillId.has(skill.wef_skill_id))
    .map((skill) => ({
      skill,
      tasks: tasksBySkillId.get(skill.wef_skill_id) ?? [],
    }))
    .sort(
      (left, right) =>
        right.tasks.length - left.tasks.length ||
        left.skill.wef_skill_id - right.skill.wef_skill_id,
    );
};

export const signedPercentage = (value: number | null): string => {
  if (typeof value !== "number") return "Not available";
  return `${value > 0 ? "+" : ""}${value}%`;
};
