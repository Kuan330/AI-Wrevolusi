import { useEffect, useState } from "react";

import { createTaskId } from "@/pages/WorkProfile/taskOptions";
import { bandFromPotential25 } from "@/pages/Dashboard/lib/taskBands";
import type { TaskEntrySource } from "@/pages/WorkProfile/taskEntry";
import type { ProfileTask, TaskEditorValues } from "@/pages/WorkProfile/types";
import { readConfirmedAnalysis, saveProfileTasks } from "@/pages/WorkProfile/userProfile";
import { referenceService } from "@/services/referenceService";

export const toProfileTask = (
  wording: string,
  source: ProfileTask["source"],
  extras?: Partial<
    Pick<
      ProfileTask,
      | "iloTaskId"
      | "timeSpent"
      | "responsibility"
      | "score2025"
      | "originalScore2025"
      | "scoreSource"
      | "potential25"
      | "meanScore2025"
      | "band"
    >
  >,
): ProfileTask => ({
  id: createTaskId(),
  wording,
  timeSpent: extras?.timeSpent ?? "",
  responsibility: extras?.responsibility ?? "",
  source,
  iloTaskId: extras?.iloTaskId,
  originalWording: source === "ilo" ? wording : undefined,
  originalScore2025: source === "ilo" ? extras?.originalScore2025 ?? extras?.score2025 : undefined,
  score2025: extras?.score2025,
  scoreSource:
    extras?.scoreSource ?? (source === "ilo" && typeof extras?.score2025 === "number" ? "official" : undefined),
  potential25: extras?.potential25,
  meanScore2025: extras?.meanScore2025,
  band: extras?.band ?? bandFromPotential25(extras?.potential25) ?? undefined,
});

const applyTasks = (
  code: string,
  next: ProfileTask[],
  setTasks: (tasks: ProfileTask[]) => void,
  setOccupationPotential25: (value: string | null) => void,
  setOccupationMeanScore2025: (value: number | null) => void,
  setError: (value: string | null) => void,
  options?: { potential25?: string | null; meanScore2025?: number | null },
) => {
  setTasks(next);
  const occupationRow = next.find((task) => task.potential25 || typeof task.meanScore2025 === "number");
  setOccupationPotential25(options?.potential25 ?? occupationRow?.potential25 ?? null);
  setOccupationMeanScore2025(options?.meanScore2025 ?? occupationRow?.meanScore2025 ?? null);
  setError(next.length === 0 ? "No starter tasks are available for this occupation yet. You can add your own." : null);
  saveProfileTasks(code, next);
};

export const useProfileTasks = (occupationCode?: string, taskEntry?: TaskEntrySource) => {
  const [tasks, setTasks] = useState<ProfileTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occupationPotential25, setOccupationPotential25] = useState<string | null>(null);
  const [occupationMeanScore2025, setOccupationMeanScore2025] = useState<number | null>(null);

  const persist = (next: ProfileTask[]) => {
    if (!occupationCode) return;
    saveProfileTasks(occupationCode, next);
  };

  const loadStarterTasks = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await referenceService.tasks(code);
      const occupationRow = rows.find((task) => task.potential25 || typeof task.mean_score_2025 === "number");
      const next = rows.map((task) =>
        toProfileTask(task.task_text, "ilo", {
          iloTaskId: task.task_id,
          score2025: task.score_2025,
          originalScore2025: task.score_2025,
          scoreSource: typeof task.score_2025 === "number" ? "official" : undefined,
          potential25: task.potential25,
          meanScore2025: task.mean_score_2025,
        }),
      );
      applyTasks(
        code,
        next,
        setTasks,
        setOccupationPotential25,
        setOccupationMeanScore2025,
        setError,
        {
          potential25: occupationRow?.potential25 ?? null,
          meanScore2025: occupationRow?.mean_score_2025 ?? null,
        },
      );
      if (rows.length === 0) {
        setError("No starter tasks are available for this occupation yet. You can add your own.");
      }
    } catch {
      setError("Occupation selected, but its reference tasks could not be loaded.");
      setTasks([]);
      setOccupationPotential25(null);
      setOccupationMeanScore2025(null);
      saveProfileTasks(code, []);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysisTasks = (code: string) => {
    const analysis = readConfirmedAnalysis();
    if (analysis?.occupationCode !== code || analysis.tasks.length === 0) {
      return false;
    }
    applyTasks(
      code,
      analysis.tasks,
      setTasks,
      setOccupationPotential25,
      setOccupationMeanScore2025,
      setError,
      {
        meanScore2025: analysis.occupationScore ?? analysis.meanScore2025,
      },
    );
    return true;
  };

  useEffect(() => {
    if (!occupationCode) return;

    if (taskEntry === "occupation") {
      void loadStarterTasks(occupationCode);
      return;
    }

    if (taskEntry === "dashboard") {
      if (loadAnalysisTasks(occupationCode)) return;
      void loadStarterTasks(occupationCode);
      return;
    }

    if (loadAnalysisTasks(occupationCode)) return;
    void loadStarterTasks(occupationCode);
    // taskEntry is only set when navigating from occupation or dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupationCode, taskEntry]);

  const addTask = (
    values: TaskEditorValues,
    extras?: Pick<ProfileTask, "score2025" | "scoreSource" | "band" | "potential25">,
  ) => {
    setTasks((current) => {
      const next = [
        toProfileTask(values.wording.trim(), "user", {
          timeSpent: values.timeSpent,
          responsibility: values.responsibility,
          score2025: extras?.score2025,
          scoreSource: extras?.scoreSource,
        }),
        ...current,
      ];
      persist(next);
      return next;
    });
  };

  const updateTask = (
    taskId: string,
    values: TaskEditorValues,
    extras?: Pick<ProfileTask, "score2025" | "scoreSource" | "band" | "potential25">,
  ) => {
    setTasks((current) => {
      const next = current.map((task) => {
        if (task.id !== taskId) return task;
        const wording = values.wording.trim();
        const restored = task.source === "ilo" && wording === (task.originalWording ?? "").trim();
        const edited = task.source === "ilo" && !restored;
        return {
          ...task,
          wording,
          timeSpent: values.timeSpent,
          responsibility: values.responsibility,
          score2025: restored ? task.originalScore2025 : extras?.score2025 ?? (edited ? null : task.score2025),
          scoreSource: restored ? "official" : extras?.scoreSource ?? (edited ? undefined : task.scoreSource),
          band: restored
            ? bandFromPotential25(task.potential25) ?? task.band
            : extras?.band ?? (edited ? undefined : task.band),
          potential25: extras?.potential25 ?? task.potential25,
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
    occupationPotential25,
    occupationMeanScore2025,
    loadStarterTasks,
    addTask,
    updateTask,
    removeTask,
    removeTasks,
  };
};
