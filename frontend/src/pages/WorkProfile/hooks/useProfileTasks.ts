import { useState } from "react";

import { createTaskId } from "@/pages/WorkProfile/taskOptions";
import type { ProfileTask, TaskEditorValues } from "@/pages/WorkProfile/types";
import { referenceService } from "@/services/referenceService";

export const toProfileTask = (
  wording: string,
  source: ProfileTask["source"],
  extras?: Partial<
    Pick<ProfileTask, "iloTaskId" | "timeSpent" | "responsibility" | "score2025" | "potential25" | "meanScore2025">
  >,
): ProfileTask => ({
  id: createTaskId(),
  wording,
  timeSpent: extras?.timeSpent ?? "",
  responsibility: extras?.responsibility ?? "",
  source,
  iloTaskId: extras?.iloTaskId,
  originalWording: source === "ilo" ? wording : undefined,
  score2025: extras?.score2025,
  potential25: extras?.potential25,
  meanScore2025: extras?.meanScore2025,
});

export const useProfileTasks = () => {
  const [tasks, setTasks] = useState<ProfileTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearTasks = () => {
    setTasks([]);
    setError(null);
  };

  const loadStarterTasks = async (occupationCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await referenceService.tasks(occupationCode);
      setTasks(
        rows.map((task) =>
          toProfileTask(task.task_text, "ilo", {
            iloTaskId: task.task_id,
            score2025: task.score_2025,
            potential25: task.potential25,
            meanScore2025: task.mean_score_2025,
          }),
        ),
      );
      if (rows.length === 0) {
        setError("No starter tasks are available for this occupation yet. You can add your own.");
      }
    } catch {
      setError("Occupation selected, but its reference tasks could not be loaded.");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const addTask = (values: TaskEditorValues) => {
    setTasks((current) => [
      toProfileTask(values.wording.trim(), "user", {
        timeSpent: values.timeSpent,
        responsibility: values.responsibility,
      }),
      ...current,
    ]);
  };

  const updateTask = (taskId: string, values: TaskEditorValues) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const wording = values.wording.trim();
        const edited = task.source === "ilo" && wording !== (task.originalWording ?? task.wording);
        return {
          ...task,
          wording,
          timeSpent: values.timeSpent,
          responsibility: values.responsibility,
          score2025: edited ? null : task.score2025,
          potential25: edited ? null : task.potential25,
        };
      }),
    );
  };

  const removeTask = (taskId: string) => {
    setTasks((current) => current.filter((task) => task.id !== taskId));
  };

  const removeTasks = (taskIds: string[]) => {
    const idSet = new Set(taskIds);
    setTasks((current) => current.filter((task) => !idSet.has(task.id)));
  };

  return {
    tasks,
    loading,
    error,
    clearTasks,
    loadStarterTasks,
    addTask,
    updateTask,
    removeTask,
    removeTasks,
  };
};
