import { readLearningGoals } from "../learning-goals/learningGoals.ts";
import { readPersonalPlans } from "../learning-goals/personalLearningPlan.ts";
import { readLibrary } from "../learning-planning/libraryStorage.ts";
import { resolveCatalogueSkill } from "../learning-planning/catalogueSkill.ts";
import type { Course } from "../learning-planning/types.ts";
import { readLearningSkills } from "../skills/learningSkills.ts";
import { readCareerPath } from "../skills/careerPath.ts";
import { isSkillReviewCurrent, readJourneyState, personalSkillIsCurrent, readJourneyProfile } from "../journey/journey.ts";
import { readSpecialistState, specialistEntryIsCurrent } from "../journey/specialistSkills.ts";
import type { WefSkill } from "../../types/reference.ts";
import type { SkillCandidate, SkillOrigin, SkillSources } from "./types.ts";
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
export type ResumeSkillInput = { skill: SkillCandidate; origin: SkillOrigin };
export function mergeSkillInputs(inputs: ResumeSkillInput[]) {
  const skills = mergeResumeSkills([inputs.map(input => input.skill)]);
  const sources: SkillSources[] = skills.map(skill => ({ skill_id: skill.id, origins: [] }));
  for (const input of inputs) {
    const id = mergeResumeSkills([[input.skill]])[0]?.id;
    const row = sources.find(source => source.skill_id === id);
    if (row && !row.origins.some(origin => JSON.stringify(origin) === JSON.stringify(input.origin))) row.origins.push(input.origin);
  }
  if (sources.some(row => row.origins.length > 20 || row.origins.some(origin => origin.label.length > 300 || origin.fact_ids.length > 20))) throw new Error("Skill source details exceed the supported limit. Review your selections; no source has been silently dropped.");
  return { skills, sources };
}
export function resumeSkillInputs(reference: WefSkill[], directory: Map<string, Course> = new Map()): ResumeSkillInput[] {
  const inputs: ResumeSkillInput[] = [];
  const add = (skills: SkillCandidate[], kind: SkillOrigin["kind"], label: string) => inputs.push(...skills.map(skill => ({ skill, origin: { kind, label, fact_ids: [] } })));
  const journey = readJourneyState();
  add(isSkillReviewCurrent() ? reference.filter(s => journey.review?.decisions[String(s.wef_skill_id)] === "accepted").map(s => ({ id: String(s.wef_skill_id), name: s.core_skill })) : [], "platform_confirmed", "Confirmed platform skills");
  for (const skill of readLearningSkills() ?? []) add(canonicalResumeSkill(skill.id, skill.name, reference, directory, skill.source === "wef" || skill.source === "other-role"), "learning_intention", "Selected learning skill");
  add(readCareerPath().ids.flatMap(id => { const skill = reference.find(s => s.wef_skill_id === id); return skill ? [{ id: String(id), name: skill.core_skill }] : []; }), "learning_intention", "Selected career learning direction");
  for (const context of Object.values(journey.contexts)) add(canonicalResumeSkill(context.skill.id, context.skill.name, reference, directory, true), "learning_intention", "Learning context");
  for (const skill of journey.personalSkills ?? []) {
    if (!personalSkillIsCurrent(skill)) continue;
    if (skill.decision === "use") add([{ id: skill.id, name: skill.name }], "platform_confirmed", "Confirmed personal skill");
    if (skill.wantsLearning) add([{ id: skill.id, name: skill.name }], "learning_intention", "Personal learning choice");
  }
  const profile = readJourneyProfile();
  for (const skill of readSpecialistState().entries) {
    if (!specialistEntryIsCurrent(skill, profile.tasks, profile.tasksOccupationCode ?? null)) continue;
    if (skill.decision === "use") add([{ id: skill.skillUri, name: skill.skillLabel }], "platform_confirmed", "Confirmed specialist skill");
    if (skill.wantsLearning) add([{ id: skill.skillUri, name: skill.skillLabel }], "learning_intention", "Specialist learning choice");
  }
  for (const goal of readLearningGoals()) add(canonicalResumeSkill(goal.initial.skill.id, goal.initial.skill.label, reference, directory, goal.initial.skill.source === "wef"), "learning_intention", "Selected learning goal");
  for (const plan of readPersonalPlans()) if (plan.status !== "archived" && plan.skillId) add(canonicalResumeSkill(plan.skillId, plan.skillLabel, reference, directory, true), "learning_intention", "Selected learning plan");
  for (const id of selectedResumeCourseIds()) add(selectedCourseSkills(reference, directory, [id]), "learning_intention", "Selected course: " + directory.get(id)!.title);
  return inputs;
}
export function resumeSkillSnapshot(reference: WefSkill[], directory: Map<string, Course> = new Map()): SkillCandidate[] {
  return mergeSkillInputs(resumeSkillInputs(reference, directory)).skills;
}
