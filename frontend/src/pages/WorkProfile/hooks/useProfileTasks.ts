import { useEffect, useState } from "react";

import { createTaskId } from "@/pages/WorkProfile/taskOptions";
import type { ProfileTask, TaskEditorValues } from "@/pages/WorkProfile/types";
import { readProfileTaskCache, saveProfileTasks } from "@/pages/WorkProfile/userProfile";
import { referenceService } from "@/services/referenceService";
import type { ReferenceTask } from "@/types/reference";

export const toProfileTask = (
  wording: string,
  source: ProfileTask["source"],
  extras?: Partial<
    Pick<
      ProfileTask,
      | "iloTaskId"
      | "timeSpent"
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

const normalizePersistedProfileTaskAssessmentContext = (task: ProfileTask): ProfileTask => ({
  ...task,
  routineProcessingLevel: task.routineProcessingLevel ?? "",
  informationUseLevel: task.informationUseLevel ?? "",
  humanInteractionLevel: task.humanInteractionLevel ?? "",
  judgementLevel: task.judgementLevel ?? "",
});

const mergeRefreshedReferenceTasks = (
  savedTasks: ProfileTask[],
  referenceTasks: ReferenceTask[],
  removedReferenceTaskIds: string[],
): ProfileTask[] => {
  const savedByReferenceId = new Map(
    savedTasks
      .filter((task): task is ProfileTask & { iloTaskId: string } => Boolean(task.iloTaskId))
      .map((task) => [task.iloTaskId, task]),
  );
  const currentReferenceIds = new Set(referenceTasks.map((task) => task.task_id));
  const removedIds = new Set(removedReferenceTaskIds);
  const preservedTasks = savedTasks.filter(
    (task) =>
      task.source === "user" ||
      !task.iloTaskId ||
      (!currentReferenceIds.has(task.iloTaskId) &&
        task.wording !== (task.originalWording ?? task.wording)),
  );
  const refreshedTasks = referenceTasks
    .filter((task) => !removedIds.has(task.task_id))
    .map((task) => {
      const saved = savedByReferenceId.get(task.task_id);
      if (!saved) {
        return toProfileTask(task.task_text, "ilo", {
          iloTaskId: task.task_id,
          score2025: task.score_2025,
          potential25: task.potential25,
          meanScore2025: task.mean_score_2025,
        });
      }
      const editedWording = saved.wording !== (saved.originalWording ?? saved.wording);
      return {
        ...saved,
        wording: editedWording ? saved.wording : task.task_text,
        originalWording: task.task_text,
        score2025: editedWording ? null : task.score_2025,
        potential25: editedWording ? null : task.potential25,
        meanScore2025: editedWording ? null : task.mean_score_2025,
      };
    });
  return [...preservedTasks, ...refreshedTasks];
};

export const useProfileTasks = (occupationCode?: string) => {
  const [tasks, setTasks] = useState<ProfileTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedReferenceTaskIds, setRemovedReferenceTaskIds] = useState<string[]>([]);

  const persist = (next: ProfileTask[]) => {
    if (!occupationCode) return;
    saveProfileTasks(occupationCode, next);
  };

  const loadStarterTasks = async (
    code: string,
    referenceDataVersion?: string,
    savedTasks: ProfileTask[] = [],
    removedIds: string[] = removedReferenceTaskIds,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await referenceService.tasks(code);
      const next = mergeRefreshedReferenceTasks(savedTasks, rows, removedIds);
      setTasks(next);
      saveProfileTasks(code, next, {
        ...(referenceDataVersion === undefined ? {} : { referenceDataVersion }),
        removedReferenceTaskIds: removedIds,
      });
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
    const cached = readProfileTaskCache(occupationCode);
    const normalizedSavedTasks = cached?.tasks.map(
      normalizePersistedProfileTaskAssessmentContext,
    );
    if (cached && normalizedSavedTasks) {
      setTasks(normalizedSavedTasks);
      setRemovedReferenceTaskIds(cached.removedReferenceTaskIds);
      setError(
        normalizedSavedTasks.length === 0
          ? "No starter tasks are available for this occupation yet. You can add your own."
          : null,
      );
    }

    const refreshWhenReferenceDataChanges = async () => {
      try {
        const { version } = await referenceService.version();
        if (cached && cached.referenceDataVersion === null) {
          saveProfileTasks(occupationCode, normalizedSavedTasks ?? [], {
            referenceDataVersion: version,
          });
          return;
        }
        if (cached?.referenceDataVersion === version) return;
        await loadStarterTasks(
          occupationCode,
          version,
          normalizedSavedTasks ?? [],
          cached?.removedReferenceTaskIds ?? [],
        );
      } catch {
        if (!cached) await loadStarterTasks(occupationCode, undefined, [], []);
      }
    };

    void refreshWhenReferenceDataChanges();
  }, [occupationCode]);

  const addTask = (values: TaskEditorValues) => {
    setTasks((current) => {
      const next = [
        toProfileTask(values.wording.trim(), "user", {
          timeSpent: values.timeSpent,
          responsibility: values.responsibility,
          routineProcessingLevel: values.routineProcessingLevel,
          informationUseLevel: values.informationUseLevel,
          humanInteractionLevel: values.humanInteractionLevel,
          judgementLevel: values.judgementLevel,
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
          routineProcessingLevel: values.routineProcessingLevel,
          informationUseLevel: values.informationUseLevel,
          humanInteractionLevel: values.humanInteractionLevel,
          judgementLevel: values.judgementLevel,
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
      const removedReferenceId = current.find((task) => task.id === taskId)?.iloTaskId;
      const next = current.filter((task) => task.id !== taskId);
      const nextRemovedIds = removedReferenceId
        ? [...new Set([...removedReferenceTaskIds, removedReferenceId])]
        : removedReferenceTaskIds;
      setRemovedReferenceTaskIds(nextRemovedIds);
      if (occupationCode) {
        saveProfileTasks(occupationCode, next, {
          removedReferenceTaskIds: nextRemovedIds,
        });
      }
      return next;
    });
  };

  const removeTasks = (taskIds: string[]) => {
    const idSet = new Set(taskIds);
    setTasks((current) => {
      const removedIds = current
        .filter((task) => idSet.has(task.id))
        .flatMap((task) => (task.iloTaskId ? [task.iloTaskId] : []));
      const next = current.filter((task) => !idSet.has(task.id));
      const nextRemovedIds = [...new Set([...removedReferenceTaskIds, ...removedIds])];
      setRemovedReferenceTaskIds(nextRemovedIds);
      if (occupationCode) {
        saveProfileTasks(occupationCode, next, {
          removedReferenceTaskIds: nextRemovedIds,
        });
      }
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
