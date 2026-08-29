import type { TaskStatus } from "@/types/task";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  confirmed: "Confirmed",
  needs_review: "Needs review",
  optional_context_missing: "Optional context not set",
};
