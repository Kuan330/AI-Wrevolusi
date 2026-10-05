import { accountStorage, commitWorkspaceItems } from "../../services/accountStorage.ts";
import { groupProviderCourses } from "../learning-planning/courseGroups.ts";
import { addPlanResource, type LearningPlanResource } from "./learningPlanSetup.ts";
import type { Course } from "../learning-planning/types.ts";

export const LEARNING_PLAN_DRAFT_KEY = "aiwrevolusi.learningPlanDraft.v1";
export type ExperienceLevel = "new" | "some" | "comfortable";
export type LearningGoalKind = "career" | "skill" | "confidence" | "curiosity";
export type MinutesPerDay = 15 | 30 | 45 | 60 | 90;
export type PlanActivity = {
  id: string; title: string; kind: "course" | "practice" | "review";
  courseId?: string; courseTitle?: string; minutes: number; description: string; estimated?: boolean;
};
export type LearningPlanInputs = {
  experience: ExperienceLevel; minutesPerDay: MinutesPerDay;
  goalKind: LearningGoalKind; goalText: string;
};
export type PersonalLearningPlan = {
  version: 1; id: string; goalId: string; goalTitle: string; skillId: string; skillLabel: string;
  status: "draft" | "active" | "archived"; createdAt: string; updatedAt: string;
  resources?: LearningPlanResource[];
  inputs: LearningPlanInputs; courseIds: string[]; activities: PlanActivity[];
  totals: { minutes: number; sessions: number; courseMinutes: number; practiceMinutes: number };
  estimatedDays: number; rationale: string; acceptedAt: string | null;
};
export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  new: "New to it", some: "Some experience", comfortable: "Pretty comfortable",
};
export const GOAL_LABELS: Record<LearningGoalKind, string> = {
  career: "My career", skill: "Build a specific skill", confidence: "Feel more confident", curiosity: "Explore out of interest",
};
export const MINUTES_LABELS: Record<MinutesPerDay, string> = {
  15: "15 minutes a day", 30: "30 minutes a day", 45: "45 minutes a day", 60: "1 hour a day", 90: "1 hour 30 minutes a day",
};
const LEVEL_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
export function normalizeMinutesPerDay(value: unknown): MinutesPerDay {
  return [15, 30, 45, 60, 90].includes(Number(value)) && typeof value === "number" ? value as MinutesPerDay : 30;
}
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ""}` : `${minutes} min`;
}
export function formatDays(days: number): string {
  const count = Math.max(1, Math.ceil(days));
  return `${count} ${count === 1 ? "day" : "days"}`;
}
export function experienceLevelForPlan(experience: ExperienceLevel): string {
  return experience === "new" ? "Beginner" : experience === "some" ? "Intermediate" : "Advanced";
}
function courseScore(course: Course, inputs: LearningPlanInputs): number {
  const wanted = LEVEL_ORDER[experienceLevelForPlan(inputs.experience).toLowerCase()];
  const level = LEVEL_ORDER[course.level.toLowerCase()];
  let score = level === undefined ? 0 : 30 - Math.abs(wanted - level) * 10;
  if (course.selfPaced) score += 2;
  const text = `${course.title} ${course.intro} ${course.outcomes.join(" ")}`;
  if (inputs.goalKind === "career" && /career|job|work|professional|project/i.test(text)) score += 3;
  if (inputs.goalKind === "confidence" && /fundamental|intro|basic|confidence|practice/i.test(text)) score += 3;
  return score;
}
/** Select relevant catalogue records, never invent courses or duplicate provider URLs. */
export function recommendCourses(courses: Course[], inputs: LearningPlanInputs, skillId: string) {
  const relevant = courses.filter(course => !!skillId && course.skills.includes(skillId));
  const selected = groupProviderCourses(relevant).map(group => group.course)
    .sort((a, b) => courseScore(b, inputs) - courseScore(a, inputs) || a.id.localeCompare(b.id)).slice(0, 3);
  const levelLabel = experienceLevelForPlan(inputs.experience);
  return {
    courses: selected, levelLabel,
    rationale: selected.length
      ? `Selected from the verified catalogue for this skill, prioritising your experience level and learning motivation. Availability may mean some courses have a different level. The order is a suggestion, not a locked sequence.`
      : "No verified courses are available for this skill. Start with a small practice activity and review; no course content has been generated.",
  };
}
function positiveMinutes(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function buildActivities(inputs: LearningPlanInputs, recommended: Course[]): PlanActivity[] {
  const activities: PlanActivity[] = [];
  for (const course of recommended) {
    const chapters = course.chapters?.length ? course.chapters : [{ title: "Complete the course", min: course.durationMin }];
    const known = chapters.reduce((sum, chapter) => sum + (positiveMinutes(chapter.min) ? Math.ceil(chapter.min) : 0), 0);
    const unknown = chapters.filter(chapter => !positiveMinutes(chapter.min)).length;
    const remaining = positiveMinutes(course.durationMin) && course.durationMin > known ? Math.ceil(course.durationMin) - known : null;
    let missingIndex = 0;
    chapters.forEach((chapter, index) => {
      const minutes = positiveMinutes(chapter.min) ? Math.ceil(chapter.min)
        : remaining !== null && remaining >= unknown
          ? Math.floor(remaining / unknown) + (missingIndex++ < remaining % unknown ? 1 : 0)
          : inputs.minutesPerDay;
      activities.push({
        id: `${course.id}:${index}`, title: chapter.title, kind: "course", courseId: course.id, courseTitle: course.title, minutes,
        estimated: !positiveMinutes(chapter.min),
        description: !positiveMinutes(chapter.min)
          ? "Planning estimate only: the catalogue does not list a duration for this activity. Adjust your pace after starting."
          : "Study this part of the course, then note what you can explain or try.",
      });
    });
  }
  activities.push({ id: "practice:1", title: "Try one small example", kind: "practice", minutes: inputs.minutesPerDay, description: `Practise towards: ${inputs.goalText.trim()}. Keep a sample or notes and record an attempt below.` });
  activities.push({ id: "review:1", title: "Reflect and choose your next step", kind: "review", minutes: Math.min(inputs.minutesPerDay, 30), description: "Review what worked, what is still unclear and the next small action. Completing a course does not by itself prove mastery." });
  return activities;
}
export function generatePersonalPlan({ goalId, goalTitle, skillId, skillLabel, courses, inputs, selectedCourseIds, resources = [] }: {
  goalId: string; goalTitle: string; skillId: string; skillLabel: string;
  courses: Course[]; inputs: LearningPlanInputs; selectedCourseIds?: string[]; resources?: LearningPlanResource[];
}): PersonalLearningPlan {
  if (inputs.goalText.trim().length > 1000) throw new Error("Keep your learning goal to 1,000 characters or fewer.");
  if (!inputs.goalText.trim()) throw new Error("Describe what you want to learn before building your plan.");
  const recommendation = recommendCourses(courses, inputs, skillId);
  const selected = selectedCourseIds === undefined ? recommendation.courses : selectedCourseIds.map(id => courses.find(course => course.id === id)).filter((course): course is Course => Boolean(course));
  if (selectedCourseIds?.some(id => !courses.some(course => course.id === id))) throw new Error("A selected course is unavailable. Return to Skill areas and choose your courses again.");
  const activities = buildActivities(inputs, selected);
  const courseMinutes = activities.filter(item => item.kind === "course").reduce((sum, item) => sum + item.minutes, 0);
  const practiceMinutes = activities.filter(item => item.kind !== "course").reduce((sum, item) => sum + item.minutes, 0);
  const totals = { minutes: courseMinutes + practiceMinutes, sessions: activities.length, courseMinutes, practiceMinutes };
  const now = new Date().toISOString();
  return {
    version: 1, id: crypto.randomUUID(), goalId, goalTitle, skillId, skillLabel, status: "draft",
    createdAt: now, updatedAt: now, inputs: { ...inputs, goalText: inputs.goalText.trim() },
    resources: resources.reduce<LearningPlanResource[]>((items, resource) => addPlanResource(items, resource), []),
    courseIds: selected.map(course => course.id), activities, totals,
    estimatedDays: Math.ceil(totals.minutes / inputs.minutesPerDay), rationale: recommendation.rationale, acceptedAt: null,
  };
}
const obj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const date = (value: unknown) => str(value) && Number.isFinite(Date.parse(value));
function isPlan(value: unknown): value is PersonalLearningPlan {
  if (!obj(value) || value.version !== 1 || !["id", "goalId", "goalTitle", "skillLabel", "createdAt", "updatedAt", "rationale"].every(key => str(value[key])) || typeof value.skillId !== "string") return false;
  if (!["draft", "active", "archived"].includes(String(value.status)) || !date(value.createdAt) || !date(value.updatedAt) || !(value.acceptedAt === null || date(value.acceptedAt)) || (value.status === "active" && value.acceptedAt === null)) return false;
  if (value.resources !== undefined) {
    if (!Array.isArray(value.resources) || value.resources.length > 5 || new Set(value.resources.map(item => obj(item) ? item.id : null)).size !== value.resources.length) return false;
    try { value.resources.reduce<LearningPlanResource[]>((items, resource) => {
      if (!obj(resource) || !str(resource.id) || !str(resource.name)) throw new Error();
      return addPlanResource(items, resource as LearningPlanResource);
    }, []); } catch { return false; }
  }
  const inputs = value.inputs;
  if (!obj(inputs) || !["new", "some", "comfortable"].includes(String(inputs.experience)) || !["career", "skill", "confidence", "curiosity"].includes(String(inputs.goalKind)) || ![15, 30, 45, 60, 90].includes(Number(inputs.minutesPerDay)) || typeof inputs.minutesPerDay !== "number" || !str(inputs.goalText) || inputs.goalText.length > 1000) return false;
  if (!Array.isArray(value.courseIds) || !value.courseIds.every(str) || new Set(value.courseIds).size !== value.courseIds.length || !Array.isArray(value.activities) || !value.activities.length || value.activities.length > 1000) return false;
  if (!value.activities.every(item => obj(item) && str(item.id) && str(item.title) && (item.courseTitle === undefined || str(item.courseTitle)) && typeof item.description === "string" && ["course", "practice", "review"].includes(String(item.kind)) && Number.isSafeInteger(item.minutes) && Number(item.minutes) > 0 && (item.estimated === undefined || typeof item.estimated === "boolean") && (item.kind !== "course" || (str(item.courseId) && (value.courseIds as string[]).includes(item.courseId))))) return false;
  if (new Set(value.activities.map(item => item.id)).size !== value.activities.length || !obj(value.totals)) return false;
  const courseMinutes = value.activities.filter(item => item.kind === "course").reduce((sum, item) => sum + item.minutes, 0);
  const practiceMinutes = value.activities.filter(item => item.kind !== "course").reduce((sum, item) => sum + item.minutes, 0);
  return value.totals.minutes === courseMinutes + practiceMinutes && value.totals.courseMinutes === courseMinutes && value.totals.practiceMinutes === practiceMinutes && value.totals.sessions === value.activities.length && value.estimatedDays === Math.ceil((courseMinutes + practiceMinutes) / inputs.minutesPerDay);
}
/** Each goal retains its own plan; previous blueprints are kept rather than silently overwritten. */
export function readPersonalPlans(): PersonalLearningPlan[] {
  const raw = accountStorage.getItem(LEARNING_PLAN_DRAFT_KEY);
  if (!raw) return [];
  try {
    const saved: unknown = JSON.parse(raw);
    const plans: unknown = obj(saved) && Array.isArray(saved.plans) ? saved.plans : [saved];
    if (!obj(saved) || saved.version !== 1 || !Array.isArray(plans) || plans.length > 200 || !plans.every(isPlan) || new Set(plans.map(plan => plan.id)).size !== plans.length) throw new Error();
    return plans;
  } catch { throw new Error("Your saved learning plans could not be read. Reload your saved account before making changes. Your records have been kept."); }
}
export function readPersonalPlan(goalId?: string): PersonalLearningPlan | null {
  return [...readPersonalPlans()].reverse().find(plan => plan.status !== "archived" && (!goalId || plan.goalId === goalId)) ?? null;
}
export function personalPlanWorkspaceItems(plan: PersonalLearningPlan): Record<string, string> {
  if (!isPlan(plan)) throw new Error("This learning plan is invalid. Your saved plan has not been changed.");
  const plans = readPersonalPlans();
  if (!plans.some(item => item.id === plan.id) && plans.length >= 200) throw new Error("Your plan history is full. Your saved plans have been kept.");
  const next = plans.filter(item => item.id !== plan.id).map(item => item.goalId === plan.goalId ? { ...item, status: "archived" as const } : item);
  return { [LEARNING_PLAN_DRAFT_KEY]: JSON.stringify({ version: 1, plans: [...next, { ...plan, updatedAt: new Date().toISOString() }] }) };
}
export async function savePersonalPlan(plan: PersonalLearningPlan): Promise<PersonalLearningPlan> {
  await commitWorkspaceItems(personalPlanWorkspaceItems(plan));
  return plan;
}
export function activePersonalPlan(plan: PersonalLearningPlan): PersonalLearningPlan {
  return { ...plan, status: "active", acceptedAt: plan.acceptedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
}

/** Keep course selection separate from the recommendation blueprint until acceptance. */
export function selectPlanCourses(plan: PersonalLearningPlan, selectedIds: string[]): PersonalLearningPlan {
  const courseIds = plan.courseIds.filter(id => selectedIds.includes(id));
  const activities = plan.activities.filter(item => item.kind !== "course" || courseIds.includes(item.courseId ?? ""));
  const courseMinutes = activities.filter(item => item.kind === "course").reduce((sum, item) => sum + item.minutes, 0);
  const practiceMinutes = activities.filter(item => item.kind !== "course").reduce((sum, item) => sum + item.minutes, 0);
  const totals = { minutes: courseMinutes + practiceMinutes, sessions: activities.length, courseMinutes, practiceMinutes };
  return { ...plan, courseIds, activities, totals, estimatedDays: Math.ceil(totals.minutes / plan.inputs.minutesPerDay) };
}
