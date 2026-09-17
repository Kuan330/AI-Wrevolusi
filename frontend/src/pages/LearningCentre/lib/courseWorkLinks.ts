import { PILOT_WEF_SKILLS } from "@/data/pilotWefSkills";
import { skillKey } from "@/pages/Skills/learningSkills";
import type { WefSkill } from "@/types/reference";
import type { Course } from "../../../features/learning-planning/types";

/**
 * WEF skills linked to one course, read from the backend course record. This
 * used to go through a bundled course-id → skill-id map whose ids (``c1``…)
 * never matched the live catalogue, so the list was always empty.
 */
export function wefSkillsForCourse(course: Pick<Course, "skills">): WefSkill[] {
  const ids = new Set(course.skills);
  return PILOT_WEF_SKILLS.filter((skill) => ids.has(skillKey(skill.core_skill)));
}
