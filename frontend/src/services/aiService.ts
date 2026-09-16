import { api } from "@/services/api";

// Candidate matching stays within the normal short request budget. Task Assist
// allows a configured provider plus one bounded fallback attempt (20s each).
const AI_REQUEST_TIMEOUT_MS = 25000;
const TASK_ASSIST_TIMEOUT_MS = 45000;

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

export interface TaskAssistRequest {
  task_text: string;
  user_message: string;
  notes?: string;
}

export interface TaskAssistResponse {
  reply: string;
  generated_by_model: boolean;
  needs_user_confirmation: boolean;
}

export const aiService = {
  taskMatch: (request: TaskMatchRequest, signal?: AbortSignal) =>
    api.post<TaskMatchResponse, TaskMatchRequest>(
      "/ai/task-match",
      request,
      AI_REQUEST_TIMEOUT_MS,
      signal,
    ),
  skillMatch: (request: SkillMatchRequest) =>
    api.post<SkillMatchResponse, SkillMatchRequest>(
      "/ai/skill-match",
      request,
      AI_REQUEST_TIMEOUT_MS,
    ),
  occupationSuggestions: (request: OccupationSuggestionsRequest) =>
    api.post<OccupationSuggestionsResponse, OccupationSuggestionsRequest>(
      "/ai/occupation-suggestions",
      request,
      AI_REQUEST_TIMEOUT_MS,
    ),
  taskAssist: (request: TaskAssistRequest, signal?: AbortSignal) =>
    api.post<TaskAssistResponse, TaskAssistRequest>(
      "/ai/task-assist",
      request,
      TASK_ASSIST_TIMEOUT_MS,
      signal,
    ),
};
