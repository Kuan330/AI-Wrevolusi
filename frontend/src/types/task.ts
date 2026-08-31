export type TaskStatus = "confirmed" | "needs_review" | "optional_context_missing";

export type ExposureState =
  | "human_led"
  | "ai_assisted"
  | "partly_automated"
  | "automated"
  | "insufficient_data";

export interface TaskContext {
  frequencyPerWeek?: number;
  responsibilityLevel?: "individual" | "shared" | "lead";
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  context?: TaskContext;
  exposure?: ExposureState;
}
