import { api } from "@/services/api";

// Candidate matching stays within the normal short request budget. Task Assist
// allows a configured provider plus one bounded fallback attempt (20s each).
const AI_REQUEST_TIMEOUT_MS = 25000;
const TASK_ASSIST_TIMEOUT_MS = 45000;
const TASK_ASSIST_STATE_TIMEOUT_MS = 10000;

export interface TaskMatchCandidatePayload {
  id: string;
  text: string;
}

export interface TaskMatchRequest {
  occupation_code: string;
  user_task: string;
  candidates: TaskMatchCandidatePayload[];
}

export interface TaskMatchResponse {
  candidate_id: string;
  confidence: number;
  matched_concepts: string[];
  unmatched_concepts: string[];
  reason: string;
  clarifying_question: string | null;
  status: "matched" | "no_match" | "needs_more_input";
  needs_user_confirmation: boolean;
}

export interface SkillMatchCandidatePayload {
  id: number;
  skill: string;
}

export interface SkillMatchRequest {
  fast_only?: boolean;
  task_text: string;
  candidates: SkillMatchCandidatePayload[];
}

export interface SkillMatchItem {
  wef_skill_id: number;
  confidence: number;
  evidence_phrases: string[];
}

export interface SkillMatchResponse {
  skills: SkillMatchItem[];
  needs_user_confirmation: boolean;
}

export interface OccupationSuggestionCandidatePayload {
  code: string;
  title: string;
  description?: string;
}

export interface OccupationSuggestionsRequest {
  user_description: string;
  candidates: OccupationSuggestionCandidatePayload[];
}

export interface OccupationResultItem {
  occupation_code: string;
  title: string;
  confidence: number;
  evidence: string[];
  difference: string;
}

export interface OccupationSuggestionsResponse {
  status: "suggestions" | "clarifying";
  candidates: OccupationResultItem[];
  clarifying_questions: string[];
  needs_user_confirmation: boolean;
}

export type TaskAssistStatus = "available" | "pending" | "completed";

export interface TaskAssistDetailInput {
  task_key: string;
  task_text: string;
  notes?: string;
}

export interface TaskAssistDetailBatchRequest {
  details: TaskAssistDetailInput[];
}

export interface TaskAssistRequest {
  task_id: string;
  user_message: string;
}

export interface TaskAssistInteraction {
  task_id: string;
  status: TaskAssistStatus;
  question: string | null;
  reply: string | null;
  generated_by_model: boolean | null;
  needs_user_confirmation: boolean;
  completed_at: string | null;
}

export interface TaskAssistDetailBatchResponse {
  items: TaskAssistInteraction[];
}

export const aiService = {
  taskMatch: (request: TaskMatchRequest, signal?: AbortSignal) =>
    api.post<TaskMatchResponse, TaskMatchRequest>(
      "/ai/task-match",
      request,
      AI_REQUEST_TIMEOUT_MS,
      signal,
    ),
  skillMatch: (request: SkillMatchRequest, signal?: AbortSignal) =>
    api.post<SkillMatchResponse, SkillMatchRequest>(
      "/ai/skill-match",
      request,
      request.fast_only ? 5000 : AI_REQUEST_TIMEOUT_MS,
      signal,
    ),
  occupationSuggestions: (request: OccupationSuggestionsRequest) =>
    api.post<OccupationSuggestionsResponse, OccupationSuggestionsRequest>(
      "/ai/occupation-suggestions",
      request,
      AI_REQUEST_TIMEOUT_MS,
    ),
  registerTaskAssistDetails: (
    request: TaskAssistDetailBatchRequest,
    signal?: AbortSignal,
  ) =>
    api.post<TaskAssistDetailBatchResponse, TaskAssistDetailBatchRequest>(
      "/ai/task-assist/details",
      request,
      TASK_ASSIST_STATE_TIMEOUT_MS,
      signal,
    ),
  getTaskAssist: (taskId: string) =>
    api.get<TaskAssistInteraction>(
      `/ai/task-assist/${encodeURIComponent(taskId)}`,
    ),
  taskAssist: (request: TaskAssistRequest, signal?: AbortSignal) =>
    api.post<TaskAssistInteraction, TaskAssistRequest>(
      "/ai/task-assist",
      request,
      TASK_ASSIST_TIMEOUT_MS,
      signal,
    ),
};
