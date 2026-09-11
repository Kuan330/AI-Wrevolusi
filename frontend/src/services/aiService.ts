import { api } from "@/services/api";

// The backend commits to a deterministic answer when the provider is slow or
// unavailable, so this timeout only needs to cover one provider round-trip
// (backend default provider timeout is 20s).
const AI_REQUEST_TIMEOUT_MS = 25000;

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

export const aiService = {
  taskMatch: (request: TaskMatchRequest) =>
    api.post<TaskMatchResponse, TaskMatchRequest>(
      "/ai/task-match",
      request,
      AI_REQUEST_TIMEOUT_MS,
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
};
