import type { SpecialistSkill } from "../../../services/specialistSkillService";

const generic = new Set(["with", "from", "that", "this", "their", "using", "used", "work", "works", "working", "tasks", "task", "skills", "skill", "perform", "ensure", "conduct", "assist", "support", "required", "requirements", "according", "other"]);
const words = (text: string) => new Set((text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(word => !generic.has(word)));
/** Exact shared words are a discovery aid, never a validated task-to-skill mapping. */
export function suggestSpecialistSkills(task: string, skills: SpecialistSkill[]) {
  const taskWords = words(task);
  return skills.map(skill => ({
    skill,
    sharedWords: [...words([skill.label, ...skill.aliases].join(" "))].filter(word => taskWords.has(word)),
  })).filter(item => item.sharedWords.length >= 2)
    .sort((a, b) => b.sharedWords.length - a.sharedWords.length || a.skill.label.localeCompare(b.skill.label));
}
