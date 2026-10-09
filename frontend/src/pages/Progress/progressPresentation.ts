import type { ProgressAttempt, ProgressEvidence, ProgressGoal } from "../../services/progressReviewService.ts";
import { ApiError } from "../../services/api.ts";
import { cleanDisplayText } from "../../lib/displayText.ts";

export type ProgressOperation = "load" | "prepare" | "save";
export function progressErrorText(error: unknown, operation: ProgressOperation): string {
  if (error instanceof ApiError && error.status === 409 && operation === "save") {
    return "Your saved records or latest review changed. Refresh this preview before saving.";
  }
  const message = operation === "load" ? "We could not load your saved reviews. Your saved records are kept."
    : operation === "prepare" ? "We could not prepare your progress review. Your saved records are kept."
    : "We could not confirm that this review was saved. Your earlier reviews are kept. Retry to check this same review.";
  return error instanceof ApiError && (error.status === 422 || error.status === 503)
    ? `${message} ${cleanDisplayText(error.detail)}` : message;
}

/** Plain reason shown beside the Save button while it cannot be used. Empty when nothing blocks saving. */
export function saveBlockedReason(preview: { can_save: boolean; goals: { status: string }[]; required_reset_goal_ids: string[] }, approvedReset: boolean): string {
  if (!preview.can_save) {
    return preview.goals.some(goal => goal.status === "source_needs_review")
      ? "You cannot save yet. Your goal needs a source check. Review your skills, then come back."
      : "There is nothing new to save yet. Add or record some learning, then check again.";
  }
  if (preview.required_reset_goal_ids.length > 0 && !approvedReset) return "Tick the box above to use your current records as the new starting point.";
  return "";
}

export const activityGroups = [
  ["study", "Study"],
  ["course_practice", "Course or sample practice"],
  ["workplace_practice", "Workplace practice"],
] as const;
export type AttemptChange = { kind: "added" | "corrected" | "removed"; attempt: ProgressAttempt; group: typeof activityGroups[number][0] };
const attemptValue = (a: ProgressAttempt) => JSON.stringify([a.date, a.type, a.description, a.notes, a.task?.id ?? null, a.task?.wording ?? null]);
const attempts = (e: ProgressEvidence) => activityGroups.flatMap(([group]) => e[group].map(attempt => ({ group, attempt })));

export function attemptChanges(goal: ProgressGoal): AttemptChange[] {
  // A changed source or a new goal has no valid progress comparison.
  if (goal.status !== "comparable" || !goal.earlier) return [];
  const earlier = new Map(attempts(goal.earlier).map(item => [item.attempt.id, item]));
  const current = new Map(attempts(goal.current).map(item => [item.attempt.id, item]));
  const changes: AttemptChange[] = [];
  for (const [id, item] of current) {
    const old = earlier.get(id);
    if (!old) changes.push({ ...item, kind: "added" });
    else if (old.group !== item.group || attemptValue(old.attempt) !== attemptValue(item.attempt)) changes.push({ ...item, kind: "corrected" });
  }
  for (const [id, item] of earlier) if (!current.has(id)) changes.push({ ...item, kind: "removed" });
  return changes;
}

export function progressHeadline(goals: ProgressGoal[]): string {
  const changes = goals.flatMap(attemptChanges);
  const additions = changes.filter(item => item.kind === "added");
  if (additions.length) {
    const group = additions.every(item => item.group === additions[0].group) ? additions[0].group : null;
    const name = group === "study" ? "study record" : group === "course_practice" ? "course or sample practice attempt" : group === "workplace_practice" ? "workplace practice attempt" : "activity record";
    return `You added ${additions.length} new ${name}${additions.length === 1 ? "" : "s"}`;
  }
  const comparable = goals.filter(g => g.status === "comparable" && g.earlier);
  const completed = comparable.reduce((count, g) => count + g.current.completed_learning.filter(c => !g.earlier!.completed_learning.some(old => old.id === c.id)).length, 0);
  if (completed) return `You recorded ${completed} new course completion${completed === 1 ? "" : "s"}`;
  if (changes.length) return "Earlier activity records were corrected or removed";
  if (goals.some(g => g.status === "comparable")) return "No new activity attempts in the compared goals";
  if (goals.some(g => g.status === "needs_starting_point")) return "Keep a new starting point for changed goals";
  if (goals.some(g => g.status === "starting_point" || g.status === "new_goal")) return "Your learning starting point";
  return "Review your saved goal connections";
}

export function evidenceCounts(e: ProgressEvidence) {
  return [...activityGroups.map(([group, label]) => ({ key: group, label, value: group === "workplace_practice" ? e.current_workplace_practice_count ?? e[group].length : e[group].length })), { key: "completed_learning", label: "Reported completed learning", value: e.completed_learning.length }];
}

export function comparisonRows(goal: ProgressGoal) {
  const current = evidenceCounts(goal.current);
  const earlier = goal.status === "comparable" && goal.earlier ? evidenceCounts(goal.earlier) : null;
  const rows = current.map((row, index) => ({ ...row, earlier: earlier?.[index].value ?? null }));
  const scale = Math.max(1, ...rows.flatMap(row => [row.value, row.earlier ?? 0]));
  return { rows, scale };
}

export function evidenceTimeline(goal: ProgressGoal) {
  const changes = new Map(attemptChanges(goal).map(item => [item.attempt.id, item.kind]));
  return attempts(goal.current).map(item => ({ ...item, change: changes.get(item.attempt.id) ?? "recorded" as const }))
    .sort((a, b) => b.attempt.date.localeCompare(a.attempt.date) || a.attempt.id.localeCompare(b.attempt.id));
}
