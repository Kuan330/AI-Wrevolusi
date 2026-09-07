import { useEffect, useState } from "react";

import { createTaskId } from "@/pages/WorkProfile/taskOptions";
import type { ProfileTask, TaskEditorValues } from "@/pages/WorkProfile/types";
import {
  readProfileTasks,
  saveProfileTasks,
} from "@/pages/WorkProfile/userProfile";
import { referenceService } from "@/services/referenceService";

export const toProfileTask = (
  wording: string,
  source: ProfileTask["source"],
  extras?: Partial<
    Pick<
      ProfileTask,
      | "iloTaskId"
      | "timeSpent"
      | "notes"
      | "responsibility"
      | "routineProcessingLevel"
      | "informationUseLevel"
      | "humanInteractionLevel"
      | "judgementLevel"
      | "score2025"
      | "potential25"
      | "meanScore2025"
    >
  >,
): ProfileTask => ({
  id: createTaskId(),
  wording,
  timeSpent: extras?.timeSpent ?? "",
  notes: extras?.notes ?? "",
  responsibility: extras?.responsibility ?? "",
  routineProcessingLevel: extras?.routineProcessingLevel ?? "",
  informationUseLevel: extras?.informationUseLevel ?? "",
  humanInteractionLevel: extras?.humanInteractionLevel ?? "",
  judgementLevel: extras?.judgementLevel ?? "",
  source,
  iloTaskId: extras?.iloTaskId,
  originalWording: source === "ilo" ? wording : undefined,
  score2025: extras?.score2025,
  potential25: extras?.potential25,
  meanScore2025: extras?.meanScore2025,
});

const normalizePersistedProfileTaskAssessmentContext = (
  task: ProfileTask,
): ProfileTask => ({
  ...task,
  routineProcessingLevel: task.routineProcessingLevel ?? "",
  informationUseLevel: task.informationUseLevel ?? "",
  humanInteractionLevel: task.humanInteractionLevel ?? "",
  judgementLevel: task.judgementLevel ?? "",
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
        setError(
          "No starter tasks are available for this occupation yet. You can add your own.",
        );
      }
    } catch {
      setError(
        "Occupation selected, but its reference tasks could not be loaded.",
      );
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!occupationCode) return;
    const saved = readProfileTasks(occupationCode);
    if (saved) {
      const normalizedSavedTasks = saved.map(
        normalizePersistedProfileTaskAssessmentContext,
      );
      setTasks(normalizedSavedTasks);
      setError(
        saved.length === 0
          ? "No starter tasks are available for this occupation yet. You can add your own."
          : null,
      );
      return;
    }
    void loadStarterTasks(occupationCode);
  }, [occupationCode]);

  const addTask = (values: TaskEditorValues) => {
    const next = [
      toProfileTask(values.wording.trim(), "user", {
        timeSpent: values.timeSpent,
        notes: values.notes,
      }),
      ...tasks,
    ];
    persist(next);
    setTasks(next);
  };

  const updateTask = (taskId: string, values: TaskEditorValues) => {
    const next = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const wording = values.wording.trim();
      const edited =
        task.source === "ilo" &&
        wording !== (task.originalWording ?? task.wording);
      return {
        ...task,
        wording,
        timeSpent: values.timeSpent,
        notes: values.notes,
        score2025: edited ? null : task.score2025,
        // Keep occupational evidence and historical trials when wording changes.
        // Practice baselines are matched against their original wording separately.
      };
    });
    persist(next);
    setTasks(next);
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
