import { readLearningSkills } from "../skills/learningSkills.ts";
import { readCareerPath } from "../skills/careerPath.ts";
import { isSkillReviewCurrent, readJourneyState, personalSkillIsCurrent, readJourneyProfile } from "../journey/journey.ts";
import { readSpecialistState, specialistEntryIsCurrent } from "../journey/specialistSkills.ts";
import type { WefSkill } from "../../types/reference.ts";
import type { SkillCandidate } from "./types.ts";
export function mergeResumeSkills(groups: SkillCandidate[][]): SkillCandidate[] {
  const result = new Map<string, SkillCandidate>();
  for (const group of groups) for (const skill of group) {
    // Preserve significant punctuation: C, C++ and C# are different skills.
    const key = skill.name.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
    let hash = 2166136261;
    for (const character of key) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
    const id = `skill:${key.length > 154 ? key.slice(0, 140) + "-" + (hash >>> 0).toString(16) : key}`;
    if (key && !result.has(key)) result.set(key, { id, name: skill.name.trim() });
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function resumeSkillSnapshot(reference: WefSkill[]): SkillCandidate[] {
  const journey = readJourneyState();
  const confirmed = isSkillReviewCurrent() ? reference.filter(s => journey.review?.decisions[String(s.wef_skill_id)] === "accepted").map(s => ({ id: String(s.wef_skill_id), name: s.core_skill })) : [];
  const learning = (readLearningSkills() ?? []).map(s => ({ id: s.id, name: s.name }));
  const path = readCareerPath().ids.flatMap(id => { const skill = reference.find(s => s.wef_skill_id === id); return skill ? [{ id: String(id), name: skill.core_skill }] : []; });
  const contexts = Object.values(journey.contexts).map(c => ({ id: String(c.skill.id), name: c.skill.name }));
  const personal = (journey.personalSkills ?? []).filter(s => personalSkillIsCurrent(s) && (s.decision === "use" || s.wantsLearning)).map(s => ({ id: s.id, name: s.name }));
  const profile = readJourneyProfile();
  const specialist = readSpecialistState().entries.filter(s => specialistEntryIsCurrent(s, profile.tasks, profile.tasksOccupationCode ?? null) && (s.decision === "use" || s.wantsLearning)).map(s => ({ id: s.skillUri, name: s.skillLabel }));
  return mergeResumeSkills([confirmed, learning, path, contexts, personal, specialist]);
}
