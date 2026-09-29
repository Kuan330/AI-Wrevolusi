import { api } from "./api.ts";
import type { SpecialistSkill } from "./specialistSkillService";

export type PreparedLearningSuggestion = {
  source: "model" | "template";
  goal: string;
  action: { kind: "practise"; text: string };
  practice_idea: string;
  notice: string;
};
export type GuidedSkillSuggestion = Omit<PreparedLearningSuggestion, "source" | "notice"> & {
  skill: SpecialistSkill;
  task_quote: string;
  reason: string;
};
export type GuidedTaskSuggestions = {
  task: { id: string; wording: string };
  status: "suggestions" | "no_supported_match";
  source: "ESCO";
  version: string;
  method: "model_reviewed_candidates";
  coverage: { activities_considered: number; limited: boolean; message: string };
  suggestions: GuidedSkillSuggestion[];
  notice: string;
};
export type GuidedGoalSuggestion = PreparedLearningSuggestion & { goal_id: string; revision: number };
export const guidedLearningService = {
  forTask: (task: { id: string; wording: string }, signal?: AbortSignal) => api.post<GuidedTaskSuggestions>(
    "/guided-learning/task-suggestions", { task_id: task.id, expected_wording: task.wording }, 75000, signal,
  ),
  forGoal: (goalId: string, revision: number, signal?: AbortSignal) => api.post<GuidedGoalSuggestion>(
    "/guided-learning/goal-suggestion", { goal_id: goalId, expected_revision: revision }, 60000, signal,
  ),
};
