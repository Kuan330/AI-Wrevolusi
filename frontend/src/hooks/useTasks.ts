import { useMemo } from "react";

import { mockTasks } from "@/data/tasks";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Task } from "@/types/task";

export const useTasks = () => {
  const [tasks, setTasks] = useLocalStorage<Task[]>("aiwrevolusi.tasks", mockTasks);

  const addTask = (title: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      status: "needs_review",
      exposure: "insufficient_data",
    };

    setTasks((prev) => [newTask, ...prev]);
  };

  const updateTask = (taskId: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task))
    );
  };

  const removeTask = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const confirmedCount = useMemo(
    () => tasks.filter((task) => task.status === "confirmed").length,
    [tasks]
  );

  return {
    tasks,
    confirmedCount,
    addTask,
    updateTask,
    removeTask,
  };
};
