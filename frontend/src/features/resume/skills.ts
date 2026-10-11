import { readLearningGoals } from "../learning-goals/learningGoals.ts";
import { readLibrary } from "../learning-planning/libraryStorage.ts";
import { resolveCatalogueSkill } from "../learning-planning/catalogueSkill.ts";
import type { Course } from "../learning-planning/types.ts";
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
export function selectedCourseSkills(reference: WefSkill[], directory: Map<string, Course>, ids: string[]): SkillCandidate[] {
  return mergeResumeSkills([ [...new Set(ids)].flatMap(id => {
    const course = directory.get(id);
    if (!course || !course.skills.length) throw new Error("A selected course could not be resolved to its skills. Retry before generating; your selections are kept.");
    return course.skills.map(slug => {
      const skill = resolveCatalogueSkill(slug, reference);
      if (!skill) throw new Error("A selected course has an unknown skill mapping. Retry before generating; no skill has been dropped.");
      return { id: String(skill.id), name: skill.name };
    });
  }) ]);
}
export function selectedResumeCourseIds(): string[] {
  const library = readLibrary();
  return [...new Set([...library.saved, ...library.pending.map(p => p.courseId)])];
}
export function canonicalResumeSkill(id: string | number, name: string, reference: WefSkill[], directory: Map<string, Course>, requireWef = false): SkillCandidate[] {
  const resolved = requireWef || !/^\d+$/.test(String(id)) ? resolveCatalogueSkill(id, reference) : null;
  if (resolved) return [{ id: String(resolved.id), name: resolved.name }];
  const byName = resolveCatalogueSkill(name, reference);
  if (byName) return [{ id: String(byName.id), name: byName.name }];
  const key = name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const selected = selectedResumeCourseIds().flatMap(courseId => { const course = directory.get(courseId); return course ? [course] : []; });
  const courses = selected.filter(course => course.title.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ") === key);
  if (courses.length) return selectedCourseSkills(reference, directory, courses.map(course => course.id));
  if (requireWef) throw new Error("A saved learning skill could not be resolved to its standard name. Retry or review the selection; no skill has been dropped.");
  return [{ id: String(id), name }];
}
export function resumeSkillSnapshot(reference: WefSkill[], directory: Map<string, Course> = new Map()): SkillCandidate[] {
  const journey = readJourneyState();
  const confirmed = isSkillReviewCurrent() ? reference.filter(s => journey.review?.decisions[String(s.wef_skill_id)] === "accepted").map(s => ({ id: String(s.wef_skill_id), name: s.core_skill })) : [];
  const learning = (readLearningSkills() ?? []).flatMap(s => canonicalResumeSkill(s.id, s.name, reference, directory, s.source === "wef" || s.source === "other-role"));
  const path = readCareerPath().ids.flatMap(id => { const skill = reference.find(s => s.wef_skill_id === id); return skill ? [{ id: String(id), name: skill.core_skill }] : []; });
  const contexts = Object.values(journey.contexts).flatMap(c => canonicalResumeSkill(c.skill.id, c.skill.name, reference, directory, true));
  const personal = (journey.personalSkills ?? []).filter(s => personalSkillIsCurrent(s) && (s.decision === "use" || s.wantsLearning)).map(s => ({ id: s.id, name: s.name }));
  const profile = readJourneyProfile();
  const specialist = readSpecialistState().entries.filter(s => specialistEntryIsCurrent(s, profile.tasks, profile.tasksOccupationCode ?? null) && (s.decision === "use" || s.wantsLearning)).map(s => ({ id: s.skillUri, name: s.skillLabel }));
  const goals = readLearningGoals().flatMap(goal => canonicalResumeSkill(goal.initial.skill.id, goal.initial.skill.label, reference, directory, goal.initial.skill.source === "wef"));
  const courses = selectedCourseSkills(reference, directory, selectedResumeCourseIds());
  return mergeResumeSkills([confirmed, learning, path, contexts, personal, specialist, goals, courses]);
}
