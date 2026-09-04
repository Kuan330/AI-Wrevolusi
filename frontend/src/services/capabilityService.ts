import { api } from "@/services/api";
import type {
  ConfirmedTaskCapabilityRecognitionBatchRequest,
  ConfirmedTaskCapabilityRecognitionBatchResponse,
} from "@/types/capability";

export const capabilityService = {
  recognizeConfirmedTasks: (
    request: ConfirmedTaskCapabilityRecognitionBatchRequest,
  ) =>
    api.post<
      ConfirmedTaskCapabilityRecognitionBatchResponse,
      ConfirmedTaskCapabilityRecognitionBatchRequest
    >("/capabilities/recognize", request),
};
