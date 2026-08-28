import type { Task } from "@/types/task";

export const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Oversee daily sales operations",
    status: "confirmed",
    exposure: "human_led",
    context: { frequencyPerWeek: 5, responsibilityLevel: "lead" },
  },
  {
    id: "task-2",
    title: "Prepare weekly sales report",
    status: "optional_context_missing",
    exposure: "partly_automated",
  },
  {
    id: "task-3",
    title: "Coach new staff on customer handling",
    status: "confirmed",
    exposure: "ai_assisted",
  },
];
