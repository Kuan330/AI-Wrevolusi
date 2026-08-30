import { useEffect, useState } from "react";

import { createTaskId } from "@/pages/WorkProfile/taskOptions";
import type { ProfileTask, TaskEditorValues } from "@/pages/WorkProfile/types";
import { readProfileTasks, saveProfileTasks } from "@/pages/WorkProfile/userProfile";
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

export const useProfileTasks = (occupationCode?: string) => {
  const [tasks, setTasks] = useState<ProfileTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = (next: ProfileTask[]) => {
    if (!occupationCode) return;
    saveProfileTasks(occupationCode, next);
  };

  const loadStarterTasks = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await referenceService.tasks(code);
      const next = rows.map((task) =>
        toProfileTask(task.task_text, "ilo", {
          iloTaskId: task.task_id,
          score2025: task.score_2025,
          potential25: task.potential25,
          meanScore2025: task.mean_score_2025,
        }),
      );
      setTasks(next);
      saveProfileTasks(code, next);
      if (rows.length === 0) {
        setError("No starter tasks are available for this occupation yet. You can add your own.");
      }
    } catch {
      setError("Occupation selected, but its reference tasks could not be loaded.");
      setTasks([]);
      saveProfileTasks(code, []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!occupationCode) return;
    const saved = readProfileTasks(occupationCode);
    if (saved) {
      setTasks(saved);
      setError(saved.length === 0 ? "No starter tasks are available for this occupation yet. You can add your own." : null);
      return;
    }
    void loadStarterTasks(occupationCode);
  }, [occupationCode]);

  const addTask = (values: TaskEditorValues) => {
    setTasks((current) => {
      const next = [
        toProfileTask(values.wording.trim(), "user", {
          timeSpent: values.timeSpent,
          responsibility: values.responsibility,
        }),
        ...current,
      ];
      persist(next);
      return next;
    });
  };

  const updateTask = (taskId: string, values: TaskEditorValues) => {
    setTasks((current) => {
      const next = current.map((task) => {
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
      });
      persist(next);
      return next;
    });
  };

  const removeTask = (taskId: string) => {
    setTasks((current) => {
      const next = current.filter((task) => task.id !== taskId);
      persist(next);
      return next;
    });
  };

  const removeTasks = (taskIds: string[]) => {
    const idSet = new Set(taskIds);
    setTasks((current) => {
      const next = current.filter((task) => !idSet.has(task.id));
      persist(next);
      return next;
    });
  };

  return {
    tasks,
    loading,
    error,
    loadStarterTasks,
    addTask,
    updateTask,
    removeTask,
    removeTasks,
  };
};
