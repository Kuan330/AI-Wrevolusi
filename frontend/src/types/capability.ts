export type CapabilityEvolution =
  | "continue_to_be_useful"
  | "needs_strengthening"
  | "needs_updating";

export interface Capability {
  id: string;
  name: string;
  description?: string;
  linkedTaskIds: string[];
  evolution: CapabilityEvolution;
  evidence: string[];
}

export type CapabilityRecognitionExposureState =
  | "human_led"
  | "ai_assisted"
  | "partly_automated"
  | "reshaped"
  | "insufficient_data";

export interface ConfirmedTaskCapabilityRecognitionRequestItem {
  task_id: string;
  task_text: string;
  exposure_state: CapabilityRecognitionExposureState | null;
}

export interface ConfirmedTaskCapabilityRecognitionBatchRequest {
  confirmed_tasks: ConfirmedTaskCapabilityRecognitionRequestItem[];
}

export interface CapabilityRecognitionTaskEvidence {
  task_id: string;
  task_text: string;
  exposure_state: CapabilityRecognitionExposureState | null;
  similarity: number;
}

export interface RecognizedWefCapability {
  wef_skill_id: number;
  core_skill: string;
  wef_skill_group: string | null;
  suggested_evolution: CapabilityEvolution | null;
  strongest_similarity: number;
  model_version: string;
  model_type: string;
  source_name: string;
  source_year: string;
  reasoning: string;
  uncertainty: string;
  limitations: string;
  confirmation_status: "requires_user_confirmation";
  task_evidence: CapabilityRecognitionTaskEvidence[];
}

export interface ConfirmedTaskCapabilityRecognitionBatchResponse {
  capabilities: RecognizedWefCapability[];
  unmatched_task_ids: string[];
}

export interface ConfirmedCapabilityProfileItem {
  id: string;
  wefSkillId: number | null;
  name: string;
  linkedTaskIds: string[];
  evolution: CapabilityEvolution | null;
  workplaceExample: string;
  source: "model" | "user";
  modelVersion: string | null;
  reasoning: string | null;
  uncertainty: string | null;
  limitations: string | null;
}

export interface ConfirmedCapabilityProfile {
  version: 1;
  modelVersion: string | null;
  capabilities: ConfirmedCapabilityProfileItem[];
}
