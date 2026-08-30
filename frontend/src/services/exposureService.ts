import { api } from "@/services/api";
import type { ExposureState } from "@/types/task";

export interface ExposureResult {
  task_id: string;
  exposure_type: ExposureState;
  reason: string;
  confidence: number;
}

export interface ExposureEstimateTask {
  client_task_id: string;
  task_text: string;
  original_task_text?: string;
}

export interface ExposureNeighbor {
  isco_08: string;
  task_id: string;
  task_text: string;
  score_2025: number;
  similarity: number;
}

export interface ExposureEstimateItem {
  client_task_id: string;
  score_2025: number | null;
  band: string;
  match_layer: string;
  score_source: string;
  reject_reason?: string | null;
  neighbors: ExposureNeighbor[];
}

export interface ExposureEstimateResponse {
  embedding_model: string;
  taxonomy_version: string;
  nlp_ready: boolean;
  results: ExposureEstimateItem[];
}

const ESTIMATE_TIMEOUT_MS = 30000;

export const exposureService = {
  getByTaskId: (taskId: string) => api.get<ExposureResult>(`/exposure/tasks/${taskId}`),
  estimate: (occupationCode: string, tasks: ExposureEstimateTask[]) =>
    api.post<ExposureEstimateResponse, { occupation_code: string; tasks: ExposureEstimateTask[] }>(
      "/exposure/estimate",
      { occupation_code: occupationCode, tasks },
      ESTIMATE_TIMEOUT_MS,
    ),
};
