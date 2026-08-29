import { api } from "@/services/api";
import type { ExposureState } from "@/types/task";

export interface ExposureResult {
  task_id: string;
  exposure_type: ExposureState;
  reason: string;
  confidence: number;
}

export const exposureService = {
  getByTaskId: (taskId: string) => api.get<ExposureResult>(`/exposure/tasks/${taskId}`),
};
