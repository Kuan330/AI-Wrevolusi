import { PILOT_WEF_SKILLS } from "@/data/pilotWefSkills";
import { skillIdsForCourse, skillKey } from "@/pages/Skills/learningSkills";
import type { WefSkill } from "@/types/reference";

export function wefSkillsForCourse(courseId: string): WefSkill[] {
  const ids = new Set(skillIdsForCourse(courseId));
  return PILOT_WEF_SKILLS.filter((skill) => ids.has(skillKey(skill.core_skill)));
}
