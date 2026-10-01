import { api } from "./api.ts";
export type ProgressSummary = {
  goals_total: number; excluded_goals?: number; with_task_evidence: number; with_current_use?: number;
  with_study: number; with_completed_learning: number; with_course_practice: number;
  with_workplace_practice: number; needing_evidence: number; new_goals: number;
};
export type ProgressAttempt = { id: string; date: string; type: string; description: string; notes: string; task: { id: string; wording: string } | null };
export type ProgressEvidence = {
  recorded_at: string; goal_wording: string;
  skill: { source: string; id: string; label: string; sourceVersion: string | null };
  task_evidence: { id: string; wording: string }[]; confirmed_tasks?: { id: string; wording: string }[]; decision: string | null;
  study: ProgressAttempt[]; course_practice: ProgressAttempt[]; workplace_practice: ProgressAttempt[];
  current_workplace_practice_count?: number;
  completed_learning: { id: string; title: string; completed_at: string | null; source_label: string }[];
  gaps: string[];
};
export type ProgressGoal = {
  goal_id: string; label: string;
  status: "starting_point" | "comparable" | "new_goal" | "needs_starting_point" | "source_needs_review";
  reason: string; next_step?: string; earlier: ProgressEvidence | null; current: ProgressEvidence;
};
export type ProgressPreview = {
  workspace_revision: number; previous_review_id: string | null; reviewed_at: string;
  summary: ProgressSummary; goals: ProgressGoal[]; can_save: boolean;
  required_reset_goal_ids: string[]; notice: string;
};
export type ReviewStatus = "current" | "new_evidence_available" | "needs_review";
export type ProgressReviewListItem = { id: string; created_at: string; previous_review_id: string | null; summary: ProgressSummary; status: ReviewStatus; status_reasons: string[] };
export type ProgressReview = ProgressReviewListItem & { snapshot: ProgressPreview };
export type ReviewList = { items: ProgressReviewListItem[]; total: number; limit: number; offset: number };
export type SaveReviewRequest = { request_id: string; expected_workspace_revision: number; expected_previous_review_id: string | null; reset_goal_ids: string[] };
export const progressReviewService = {
  preview: (signal?: AbortSignal) => api.get<ProgressPreview>("/progress-reviews/preview", signal),
  list: (offset = 0, signal?: AbortSignal) => api.get<ReviewList>(`/progress-reviews?limit=20&offset=${offset}`, signal),
  get: (id: string, signal?: AbortSignal) => api.get<ProgressReview>(`/progress-reviews/${encodeURIComponent(id)}`, signal),
  save: (payload: SaveReviewRequest) => api.post<ProgressReview>("/progress-reviews", payload),
};
