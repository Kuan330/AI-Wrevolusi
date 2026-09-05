import { api } from "@/services/api";
import type { ExposureState } from "@/types/task";

export interface ExposureResult {
  task_id: string;
  exposure_type: ExposureState;
  reason: string;
  confidence: number;
}

export type TaskAssessmentContextLevel = "low" | "medium" | "high";

export interface ConfirmedTaskAssessmentContextInput {
  routine_processing_level: TaskAssessmentContextLevel | null;
  information_use_level: TaskAssessmentContextLevel | null;
  human_interaction_level: TaskAssessmentContextLevel | null;
  judgement_level: TaskAssessmentContextLevel | null;
  responsibility_level: "individual" | "shared" | "lead" | null;
  time_spent: string | null;
}

export interface ConfirmedTaskExposureAssessmentRequestItem {
  task_id: string;
  task_text: string;
  ilo_task_id?: string;
  context: ConfirmedTaskAssessmentContextInput;
}

export interface ConfirmedTaskExposureAssessmentBatchRequest {
  occupation_code: string;
  confirmed_tasks: ConfirmedTaskExposureAssessmentRequestItem[];
}

export interface MatchedIloTaskExposureEvidence {
  ilo_task_id: string;
  task_text: string;
  score_2025: number;
  similarity: number;
  source_method: string | null;
}

export interface ConfirmedTaskExposureAssessment {
  task_id: string;
  suggested_state: ExposureState;
  potential25: string | null;
  match_layer: "exact" | "nlp" | "insufficient_data";
  baseline_score: number | null;
  adjusted_score: number | null;
  confidence: number;
  source_name: string;
  source_year: string;
  source_url: string;
  reasoning: string;
  uncertainty: string;
  limitations: string;
  missing_data_status:
    | "complete"
    | "partial_context"
    | "no_reliable_match"
    | "missing_reference_tasks";
  matched_reference_tasks: MatchedIloTaskExposureEvidence[];
}

export interface ConfirmedTaskExposureAssessmentBatchResponse {
  assessments: ConfirmedTaskExposureAssessment[];
}

export const exposureService = {
  getByTaskId: (taskId: string) => api.get<ExposureResult>(`/exposure/tasks/${taskId}`),
  assessConfirmedTasksAgainstIloReferences: (
    request: ConfirmedTaskExposureAssessmentBatchRequest,
  ) =>
    api.post<
      ConfirmedTaskExposureAssessmentBatchResponse,
      ConfirmedTaskExposureAssessmentBatchRequest
    >("/exposure/assessments", request),
};
