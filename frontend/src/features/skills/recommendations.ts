import { buildSkillEvidence } from "./skillProfile.ts";
import { assistanceOverview } from "../ai-impact/assistance.ts";
import type { ProfileTask } from "../work-profile/types.ts";
import type { WefSkill } from "../../types/reference.ts";
import type { ConfirmedTaskExposureAssessment } from "../../services/exposureService.ts";

export function recommendSkills(tasks: ProfileTask[], skills: WefSkill[], assessments: ConfirmedTaskExposureAssessment[], decisions: Record<string, string> = {}) {
  const high = new Set(assistanceOverview(tasks, assessments).items.filter(item => item.category === "high").map(item => item.task.id));
  return buildSkillEvidence(tasks, skills).filter(item => decisions[item.skill.wef_skill_id] !== "rejected")
    .map(item => ({ ...item, highTaskCount: item.tasks.filter(task => high.has(task.id)).length }))
    .sort((a,b) => b.highTaskCount - a.highTaskCount || b.tasks.length - a.tasks.length || a.skill.wef_skill_id - b.skill.wef_skill_id).slice(0,5);
}
