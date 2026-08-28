import type { Task, TaskStatus } from "@/types/task";

export const groupTasksByStatus = (tasks: Task[]): Record<TaskStatus, Task[]> => ({
  confirmed: tasks.filter((task) => task.status === "confirmed"),
  needs_review: tasks.filter((task) => task.status === "needs_review"),
  optional_context_missing: tasks.filter(
    (task) => task.status === "optional_context_missing"
  ),
});
