import { mockTasks } from "@/data/tasks";
import { api } from "@/services/api";
import type { Task } from "@/types/task";

export const taskService = {
  list: () => api.get<Task[]>(mockTasks),
  save: (tasks: Task[]) => api.post<Task[]>(tasks),
};
