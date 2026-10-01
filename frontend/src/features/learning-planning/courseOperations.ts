import { JOURNEY_KEY, journeyForAddedCourse, readLearningContext } from "../journey/journey.ts";
import { currentWorkspaceSession, saveWorkspaceItems, commitWorkspaceItems } from "../../services/accountStorage.ts";
import { loadCourseDirectory } from "./courseDirectory.ts";
import { readLibrary } from "./libraryStorage.ts";
import { planForSavedCourses, readPlanState } from "./planCourses.ts";
import { activePersonalPlan, personalPlanWorkspaceItems, type PersonalLearningPlan } from "../learning-goals/personalLearningPlan.ts";
import type { Course } from "./types";

export type SavedCourseChange = {
  learningContextId?: string;
  /** Accept a reviewed blueprint atomically with its courses. */
  personalPlan?: PersonalLearningPlan;
  add?: string[];
  remove?: string[];
  removeSkill?: { id: string; remainingIds: string[] };
};

/** Both pages use the same operation; no success is reported for a partial save. */
export async function changeSavedCourses(change: SavedCourseChange) {
  const owner = currentWorkspaceSession();
  // Removing a saved course must still work while the catalogue is unavailable.
  const directory = change.add?.length || change.removeSkill
    ? await loadCourseDirectory()
    : new Map<string, Course>();
  if (owner !== currentWorkspaceSession())
    throw new Error("Your account changed. Reload before changing saved courses.");
  for (const id of change.add ?? []) {
    if (!directory.has(id)) throw new Error("This course is no longer available. Refresh the catalogue before adding it.");
  }
  const current = readLibrary();
  const removed = new Set(change.remove ?? []);
  if (change.removeSkill) {
    const { id, remainingIds } = change.removeSkill;
    for (const course of directory.values()) {
      if (course.skills.includes(id) && !course.skills.some((skill) => remainingIds.includes(skill)))
        removed.add(course.id);
    }
  }
  const saved = [...new Set([...current.saved, ...(change.add ?? [])])]
    .filter((id) => !removed.has(id));
  const library = { ...current, saved };
  const plan = planForSavedCourses(saved, directory, readPlanState());
  if (plan.pendingProgress) {
    plan.pendingProgress = plan.pendingProgress.filter(item => !removed.has(item.course_id));
    if (!plan.pendingProgress.length) plan.progressSyncError = "";
  }
  const journeyItems: Record<string, string> = {};
  if (change.learningContextId && change.add?.length) {
    const context = readLearningContext(change.learningContextId);
    if (!context) throw new Error("The selected learning goal is no longer available.");
    if (change.add.length !== 1) throw new Error("Choose one course for this learning goal.");
    const courseId = change.add[0];
    if (!directory.get(courseId)?.skills.includes(context.skill.slug))
      throw new Error("This course has no supported link to the selected skill.");
    journeyItems[JOURNEY_KEY] = journeyForAddedCourse(courseId, context.id);
  }
  const personalPlan = change.personalPlan ? activePersonalPlan(change.personalPlan) : undefined;
  if (personalPlan && (personalPlan.courseIds.length !== (change.add ?? []).length || personalPlan.courseIds.some(id => !change.add?.includes(id))))
    throw new Error("The selected courses changed. Review your plan before accepting it.");
  const choices = { ...current.choices };
  if (personalPlan) for (const id of personalPlan.courseIds) {
    if (!choices[id]) choices[id] = { chapters: [], weekdays: [], minutesPerDay: personalPlan.inputs.minutesPerDay, scheduleMode: "later" };
  }
  const updatedLibrary = { ...library, choices };
  const items = {
    ...journeyItems,
    ...(personalPlan ? personalPlanWorkspaceItems(personalPlan) : {}),
    "aiwrevolusi.courseLibrary.v1": JSON.stringify(updatedLibrary),
    "aiwrevolusi.plan.courses.v1": JSON.stringify(plan),
  };
  if (personalPlan) await commitWorkspaceItems(items);
  else saveWorkspaceItems(items);
  return { library: updatedLibrary, plan, personalPlan };
}
