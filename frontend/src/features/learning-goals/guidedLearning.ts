import type { LearningGoal } from "./learningGoals";
import type { DraftAttempt } from "./goalDraft";
import type { GuidedTaskSuggestions, GuidedGoalSuggestion } from "../../services/guidedLearningService";

export function taskSuggestionsAreCurrent(result: GuidedTaskSuggestions, task: { id: string; wording: string }) {
  return result.task.id === task.id && result.task.wording === task.wording && result.suggestions.length <= 3 &&
    result.suggestions.every(item => Boolean(item.task_quote.trim()) && task.wording.includes(item.task_quote));
}
/** A starting idea, never a claim that this is a checked guide or completed work. */
export function templateGoalSuggestion(goal: LearningGoal, alternative = false): GuidedGoalSuggestion {
  const skill = goal.initial.skill.label;
  const text = alternative
    ? `Choose a small example related to ${skill}. Try one step and note what you would change.`
    : `Choose a small example related to ${skill}. Describe how you would approach it and one thing to check.`;
  return { goal_id: goal.id, revision: goal.revision, source: "template", goal: `Explore how to use ${skill} in a small example`,
    action: { kind: "practise", text }, practice_idea: text,
    notice: "General starting idea. Check that it fits your work. It is not a reviewed practice guide." };
}
export function plannedActivityAttempt(goal: LearningGoal, tasks: { id: string; wording: string }[], date: string, id: string): DraftAttempt {
  if (!goal.action) throw new Error("Choose a saved activity first.");
  const task = goal.initial.tasks.find(saved => tasks.some(current => current.id === saved.id && current.wording === saved.wording)) ?? null;
  const isSample = goal.action.origin === "ai_suggestion" || goal.action.origin === "template" || !task;
  return { id, editing: false, date, type: goal.action.kind === "practise" ? isSample ? "course_practice" : "workplace_practice" : "study",
    description: goal.action.text, notes: "", task: goal.action.kind === "practise" && !isSample ? task : null };
}

/** Missing evidence allows a generic idea. Changed or unreadable context needs review first. */
export function hasMaterialGoalWarnings(warnings: string[]): boolean {
  return warnings.some(message => message !== "No confirmed work task or career reason was saved with this goal.");
}
export function suggestedActivityText(suggestion: Pick<GuidedGoalSuggestion, "action" | "practice_idea">): string {
  const action = suggestion.action.text.trim();
  const practice = suggestion.practice_idea.trim();
  if (!practice || practice === action) return action;
  const combined = `${action}\n\nPractice example: ${practice}`;
  return combined.length <= 1000 ? combined : action;
}
