import { api } from "@/services/api";
import type { Task } from "@/types/task";

interface TaskResponse {
  id: string;
  user_id: string;
  occupation_id: string | null;
  title: string;
  description: string | null;
  status: Task["status"];
  exposure_type: NonNullable<Task["exposure"]>;
  context: Task["context"] | null;
}

interface TaskCreatePayload {
  title: string;
  description?: string;
  status?: Task["status"];
  context?: Task["context"];
}

const toTask = (payload: TaskResponse): Task => ({
  id: payload.id,
  title: payload.title,
  description: payload.description ?? undefined,
  status: payload.status,
  exposure: payload.exposure_type,
  context: payload.context ?? undefined,
});

export const taskService = {
  list: async (): Promise<Task[]> => {
    const data = await api.get<TaskResponse[]>("/tasks");
    return data.map(toTask);
  },
  create: async (payload: TaskCreatePayload): Promise<Task> => {
    const data = await api.post<TaskResponse, TaskCreatePayload>("/tasks", payload);
    return toTask(data);
  },
  update: async (taskId: string, payload: Partial<TaskCreatePayload>): Promise<Task> => {
    const data = await api.patch<TaskResponse, Partial<TaskCreatePayload>>(
      `/tasks/${taskId}`,
      payload
    );
    return toTask(data);
  },
  remove: async (taskId: string): Promise<void> => {
    await api.delete(`/tasks/${taskId}`);
  },
};
