import { accountStorage, commitWorkspaceItems } from "../../services/accountStorage.ts";
import { compactGoalState } from "../learning-goals/goalHistoryCodec.ts";
import { LEARNING_GOALS_KEY, parseLearningGoals, readLearningGoals } from "../learning-goals/learningGoals.ts";
import type { LearningGoal } from "../learning-goals/learningGoals.ts";
import { generatePersonalPlan, personalPlanWorkspaceItems, readPersonalPlans } from "../learning-goals/personalLearningPlan.ts";
import type { LearningPlanInputs, PersonalLearningPlan } from "../learning-goals/personalLearningPlan.ts";
import type { LearningPlanResource } from "../learning-goals/learningPlanSetup.ts";
import { setupInputs } from "../learning-goals/learningPlanSetup.ts";
import type { Course } from "../learning-planning/types.ts";
import type { WefSkill } from "../../types/reference.ts";
import { resolveCatalogueSkill } from "../learning-planning/catalogueSkill.ts";

export const LEARNING_ONBOARDING_KEY = "aiwrevolusi.learningPlanOnboarding.v1";
export type LearningOnboardingCompletion = { version: 1; completedAt: string; goalId: string; planId: string };
export type LearningOnboardingStatus = "new" | "completed";

export function parseOnboardingCompletion(raw: string | null): LearningOnboardingCompletion | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const record = value as Record<string, unknown>;
    if (record.version !== 1 || Object.keys(record).sort().join(",") !== "completedAt,goalId,planId,version" ||
        typeof record.completedAt !== "string" || record.completedAt.length > 40 || !Number.isFinite(Date.parse(record.completedAt)) ||
        typeof record.goalId !== "string" || !record.goalId.trim() || record.goalId.length > 100 ||
        typeof record.planId !== "string" || !record.planId.trim() || record.planId.length > 100) throw new Error();
    return record as LearningOnboardingCompletion;
  } catch { throw new Error("Your learning setup could not be read. Reload your saved account before continuing. Your existing work has been kept."); }
}

/** Existing blueprints also count as prior setup; do not force existing users through onboarding. */
export function onboardingStatus(): LearningOnboardingStatus {
  const completion = parseOnboardingCompletion(accountStorage.getItem(LEARNING_ONBOARDING_KEY));
  const plans = readPersonalPlans();
  if (completion) {
    const goals = readLearningGoals();
    if (!goals.some(goal => goal.id === completion.goalId) || !plans.some(plan => plan.id === completion.planId && plan.goalId === completion.goalId)) {
      throw new Error("Your saved learning setup is missing its goal or plan. Reload your saved account; no records have been replaced.");
    }
    return "completed";
  }
  return plans.length ? "completed" : "new";
}

export function validateLearningRequest(value: string): string {
  if (!value.trim()) return "Tell us what you would like to learn.";
  if (value.trim().length > 300) return "Keep your goal to 300 characters or fewer.";
  return "";
}
export function createOnboardingRecords({ inputs, resources, courses, selectedCourseIds, selectedSkill = null, referenceSkills = [], goalId = crypto.randomUUID() }: {
  inputs: LearningPlanInputs; resources: LearningPlanResource[]; courses: Course[]; selectedCourseIds?: string[]; selectedSkill?: string | number | null; referenceSkills?: WefSkill[]; goalId?: string;
}): { goal: LearningGoal; plan: PersonalLearningPlan; completion: LearningOnboardingCompletion } {
  const checked = setupInputs(inputs);
  const now = new Date().toISOString();
  const goal: LearningGoal = {
    id: goalId, sourceKey: `onboarding:${goalId}`, createdAt: now, updatedAt: now,
    initial: { skill: { source: "personal", id: goalId, label: checked.goalText, sourceVersion: null },
      decision: null, tasks: [], occupationCode: null, sourceOccupationUri: null, career: null, origin: "browse", workKey: null, wording: checked.goalText },
    wording: checked.goalText, action: null, attempts: [], history: [], revision: 1, needsReview: false,
  };
  // Validate the baseline using the existing goal contract before writing anything.
  parseLearningGoals(JSON.stringify(compactGoalState([goal])));
  const selected = resolveCatalogueSkill(selectedSkill, referenceSkills);
  if (selectedSkill !== null && !selected) throw new Error("The selected skill is not in the current WEF framework. Choose a supported skill or build a practice-only plan.");
  const topic = { skillId: selected?.slug ?? "", skillLabel: selected?.name ?? checked.goalText };
  const plan = generatePersonalPlan({ goalId, goalTitle: checked.goalText, ...topic, courses, selectedCourseIds, inputs: checked, resources });
  return { goal, plan, completion: { version: 1, completedAt: now, goalId, planId: plan.id } };
}

/** Complete only after a single server-confirmed transaction saves all three records. */
export async function completeLearningOnboarding(records: ReturnType<typeof createOnboardingRecords>, allowNewPlan = false): Promise<void> {
  if (onboardingStatus() === "completed" && !allowNewPlan) throw new Error("Your learning setup has already been completed. Reload your saved plan.");
  const goals = readLearningGoals();
  if (goals.length >= 100) throw new Error("Your account has reached its learning goal limit. Existing records have been kept.");
  if (goals.some(goal => goal.id === records.goal.id)) throw new Error("This setup was already saved. Reload your learning plan.");
  const raw = JSON.stringify(compactGoalState([...goals, records.goal]));
  parseLearningGoals(raw);
  const marker = JSON.stringify(records.completion);
  parseOnboardingCompletion(marker);
  await commitWorkspaceItems({ ...personalPlanWorkspaceItems(records.plan), [LEARNING_GOALS_KEY]: raw, [LEARNING_ONBOARDING_KEY]: marker });
}
