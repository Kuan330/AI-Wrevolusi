import { useCallback, useEffect, useMemo, useState } from "react";

import { authService } from "@/services/authService";
import { ApiError } from "@/services/api";
import { taskService } from "@/services/taskService";
import type { AuthUser } from "@/types/auth";
import type { Task } from "@/types/task";

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    const data = await taskService.list();
    setTasks(data);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const user = await authService.ensureDemoSession();
        setCurrentUser(user);
        await refreshTasks();
      } catch (error) {
        if (error instanceof ApiError) {
          setError(error.detail);
        } else {
          setError("Failed to initialize task session.");
        }
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [refreshTasks]);

  const addTask = async (title: string) => {
    setMutating(true);
    try {
      const task = await taskService.create({
        title,
        status: "needs_review",
      });
      setTasks((prev) => [task, ...prev]);
    } finally {
      setMutating(false);
    }
  };

  const updateTask = async (taskId: string, patch: Partial<Task>) => {
    setMutating(true);
    try {
      const updatedTask = await taskService.update(taskId, {
        title: patch.title,
        description: patch.description,
        status: patch.status,
        context: patch.context,
      });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updatedTask : task)));
    } finally {
      setMutating(false);
    }
  };

  const removeTask = async (taskId: string) => {
    setMutating(true);
    try {
      await taskService.remove(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } finally {
      setMutating(false);
    }
  };

  const confirmedCount = useMemo(
    () => tasks.filter((task) => task.status === "confirmed").length,
    [tasks]
  );

  return {
    tasks,
    currentUser,
    loading,
    mutating,
    error,
    confirmedCount,
    refreshTasks,
    addTask,
    updateTask,
    removeTask,
  };
};
