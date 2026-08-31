import { api } from "@/services/api";

export type SkillConfidenceBand = "identified" | "possible";

export interface SkillEstimateTask {
  client_task_id: string;
  task_title: string;
  task_description?: string;
  occupation?: string;
  language?: string;
}

export interface SkillPrediction {
  skill_id: string;
  wef_skill_id: number;
  confidence: SkillConfidenceBand;
  confidence_score: number;
  evidence: string;
  reason: string;
  match_layer: string;
}

export interface SkillEstimateItem {
  client_task_id: string;
  insufficient_context: boolean;
  predictions: SkillPrediction[];
  reject_reason?: string | null;
}

export interface SkillEstimateResponse {
  model_version: string;
  prompt_version: string;
  taxonomy_version: string;
  llm_ready: boolean;
  results: SkillEstimateItem[];
}

const ESTIMATE_TIMEOUT_MS = 180000;

export const skillService = {
  estimate: (tasks: SkillEstimateTask[]) =>
    api.post<SkillEstimateResponse, { tasks: SkillEstimateTask[] }>(
      "/skills/estimate",
      { tasks },
      ESTIMATE_TIMEOUT_MS,
    ),
};
