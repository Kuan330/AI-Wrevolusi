import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { saveConfirmedAnalysis } from "@/pages/Dashboard/analysisSession";
import MatchIssueDialog, { type MatchIssueKind } from "@/pages/WorkProfile/components/MatchIssueDialog";
import ProfileTaskList from "@/pages/WorkProfile/components/ProfileTaskList";
import TaskEditorDialog from "@/pages/WorkProfile/components/TaskEditorDialog";
import { useProfileTasks } from "@/pages/WorkProfile/hooks/useProfileTasks";
import { readSelectedOccupation } from "@/pages/WorkProfile/occupationSession";
import type { TaskEntryLocationState } from "@/pages/WorkProfile/taskEntry";
import { findTaskConflict, hasDuplicateTasks } from "@/pages/WorkProfile/taskSimilarity";
import type { ExposureEstimateItem } from "@/services/exposureService";
import { resolveExposureBand } from "@/pages/Dashboard/lib/taskBands";
import type { ExposureBand, ProfileTask, TaskEditorValues } from "@/pages/WorkProfile/types";
import { hasExposureScore, needsExposureEstimate } from "@/pages/WorkProfile/types";
import { attachSkillPredictions } from "@/lib/skillPredictions";
import { exposureService } from "@/services/exposureService";

const emptyEditorValues = (): TaskEditorValues => ({
  wording: "",
  timeSpent: "",
  responsibility: "",
});

const toExposureBand = (band: string | null | undefined): ExposureBand | undefined => {
  if (!band || band === "insufficient_data") return undefined;
  return band as ExposureBand;
};

const applyExposureFields = (task: ProfileTask, estimate: ExposureEstimateItem): ProfileTask => ({
  ...task,
  score2025: estimate.score_2025 ?? task.score2025,
  scoreSource: "estimated",
  band: toExposureBand(estimate.band) ?? task.band,
  potential25: estimate.potential25 ?? task.potential25,
});

const finalizeTaskBands = (tasks: ProfileTask[]): ProfileTask[] =>
  tasks.map((task) => {
    const band = resolveExposureBand({
      band: task.band,
      potential25: task.potential25,
      score2025: task.score2025,
    });
    return band ? { ...task, band } : task;
  });

const averageTaskScore = (tasks: ProfileTask[]) => {
  const scored = tasks
    .map((task) => task.score2025)
    .filter((score): score is number => typeof score === "number" && !Number.isNaN(score));
  if (scored.length === 0) return null;
  return scored.reduce((sum, score) => sum + score, 0) / scored.length;
};

const valuesFromTask = (task: ProfileTask): TaskEditorValues => ({
  wording: task.wording,
  timeSpent: task.timeSpent,
  responsibility: task.responsibility,
});

const ProfileTasks = () => {
  const selected = readSelectedOccupation();
  const location = useLocation();
  const navigate = useNavigate();
  const taskEntry = (location.state as TaskEntryLocationState | null)?.taskEntry;
  const profileTasks = useProfileTasks(selected?.unit.occupation_code, taskEntry);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<TaskEditorValues>(emptyEditorValues);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmPhase, setConfirmPhase] = useState<"exposure" | "skills" | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [matchIssue, setMatchIssue] = useState<MatchIssueKind | null>(null);
  const [existingTaskWording, setExistingTaskWording] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<TaskEditorValues | null>(null);

  if (!selected) {
    return <Navigate to={ROUTES.workProfile} replace />;
  }

  const openAddDialog = () => {
    setEditorMode("add");
    setEditingTaskId(null);
    setEditorValues(emptyEditorValues());
    setMatchIssue(null);
    setExistingTaskWording(null);
    setEditorOpen(true);
  };

  const openEditDialog = (task: ProfileTask) => {
    setEditorMode("edit");
    setEditingTaskId(task.id);
    setEditorValues(valuesFromTask(task));
    setMatchIssue(null);
    setExistingTaskWording(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingTaskId(null);
    setMatchIssue(null);
    setExistingTaskWording(null);
    setPendingValues(null);
  };

  const scoreWording = async (values: TaskEditorValues, originalWording?: string) => {
    const response = await exposureService.estimate(selected.unit.occupation_code, [
      {
        client_task_id: "draft",
        task_text: values.wording,
        original_task_text: originalWording,
      },
    ]);
    return { nlpReady: response.nlp_ready, estimate: response.results[0] };
  };

  const commitScoredTask = (values: TaskEditorValues, estimate: ExposureEstimateItem) => {
    const extras = {
      score2025: estimate.score_2025 ?? undefined,
      scoreSource: "estimated" as const,
      band: toExposureBand(estimate.band),
      potential25: estimate.potential25 ?? undefined,
    };
    if (editorMode === "edit" && editingTaskId) {
      profileTasks.updateTask(editingTaskId, values, extras);
    } else {
      profileTasks.addTask(values, extras);
    }
  };

  const scoreAndSave = async (
    values: TaskEditorValues,
    options?: { ignoreSimilar?: boolean; editing?: ProfileTask },
  ): Promise<boolean> => {
    const editing = options?.editing;

    if (!options?.ignoreSimilar) {
      const conflict = findTaskConflict(values.wording, profileTasks.tasks, editing?.id);
      if (conflict) {
        setPendingValues(values);
        setExistingTaskWording(conflict.task.wording);
        setMatchIssue(conflict.kind);
        setEditorOpen(false);
        return false;
      }
    }

    setSaving(true);
    setPendingValues(values);
    try {
      const { nlpReady, estimate } = await scoreWording(values, editing?.originalWording);
      if (!nlpReady || estimate?.reject_reason === "service_unavailable") {
        setMatchIssue("service");
        setExistingTaskWording(null);
        setEditorOpen(false);
        return false;
      }
      if (typeof estimate?.score_2025 !== "number") {
        setMatchIssue("not_a_task");
        setExistingTaskWording(null);
        setEditorOpen(false);
        return false;
      }
      commitScoredTask(values, estimate);
      setPendingValues(null);
      setExistingTaskWording(null);
      return true;
    } catch {
      setMatchIssue("service");
      setExistingTaskWording(null);
      setEditorOpen(false);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveTask = async (values: TaskEditorValues): Promise<boolean> => {
    setConfirmError(null);
    const editing = editorMode === "edit" ? profileTasks.tasks.find((task) => task.id === editingTaskId) : undefined;
    const restored = editing?.source === "ilo" && values.wording === (editing.originalWording ?? "").trim();
    if (restored && editing) {
      profileTasks.updateTask(editing.id, values);
      return true;
    }

    return scoreAndSave(values, { editing });
  };

  const rewriteUnmatched = () => {
    setMatchIssue(null);
    setExistingTaskWording(null);
    if (pendingValues) setEditorValues(pendingValues);
    setEditorOpen(true);
  };

  const discardUnmatched = () => {
    setMatchIssue(null);
    setExistingTaskWording(null);
    setPendingValues(null);
    setEditorOpen(false);
    setEditingTaskId(null);
  };

  const addSimilarAnyway = () => {
    if (!pendingValues) return;
    setMatchIssue(null);
    setExistingTaskWording(null);
    void scoreAndSave(pendingValues, { ignoreSimilar: true });
  };

  const confirmLabel = confirming
    ? confirmPhase === "skills"
      ? "Matching skills…"
      : "Checking scores…"
    : "Explore AI impact";

  const confirmTasks = async () => {
    setConfirming(true);
    setConfirmPhase("exposure");
    setConfirmError(null);
    try {
      if (hasDuplicateTasks(profileTasks.tasks)) {
        setConfirmError("Remove duplicate tasks before continuing. Two tasks have the same wording.");
        return;
      }

      let nextTasks = profileTasks.tasks.map((task) =>
        needsExposureEstimate(task) ? task : { ...task, scoreSource: "official" as const },
      );
      const pending = nextTasks.filter((task) => needsExposureEstimate(task) && !hasExposureScore(task));
      if (pending.length > 0) {
        try {
          const response = await exposureService.estimate(
            selected.unit.occupation_code,
            pending.map((task) => ({
              client_task_id: task.id,
              task_text: task.wording,
              original_task_text: task.originalWording,
            })),
          );
          if (!response.nlp_ready) {
            setConfirmError("Scoring is unavailable. Try again in a moment.");
            return;
          }
          const byId = new Map(response.results.map((item) => [item.client_task_id, item]));
          nextTasks = nextTasks.map((task) => {
            const estimate = byId.get(task.id);
            if (!estimate || typeof estimate.score_2025 !== "number") return task;
            return applyExposureFields(task, estimate);
          });
        } catch {
          setConfirmError("Scoring is unavailable. Try again in a moment.");
          return;
        }
      }

      const unmatched = nextTasks.filter((task) => !hasExposureScore(task));
      if (unmatched.length > 0) {
        setConfirmError(
          unmatched.length === 1
            ? "One task does not look like a real work activity. Rewrite it before confirming."
            : `${unmatched.length} tasks do not look like real work activities. Rewrite them before confirming.`,
        );
        return;
      }

      nextTasks = finalizeTaskBands(nextTasks);

      setConfirmPhase("skills");
      try {
        nextTasks = await attachSkillPredictions(nextTasks, selected.unit.title);
      } catch {
        setConfirmError("Skill inference is unavailable. Try again in a moment.");
        return;
      }

      saveConfirmedAnalysis({
        occupationTitle: selected.unit.title,
        occupationPath: selected.path.map((item) => item.title),
        occupationCode: selected.unit.occupation_code,
        occupationScore:
          profileTasks.occupationMeanScore2025 ?? averageTaskScore(nextTasks),
        meanScore2025:
          profileTasks.occupationMeanScore2025 ?? averageTaskScore(nextTasks),
        tasks: nextTasks,
      });
      navigate(`${ROUTES.dashboard}#exposure`);
    } finally {
      setConfirming(false);
      setConfirmPhase(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="shrink-0 space-y-3 border-b border-white/70 pb-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-[#2f2430]">Your tasks</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild className="profile-primary-btn h-10 whitespace-nowrap rounded-full px-5">
              <Link to={ROUTES.workProfile}>Change occupation</Link>
            </Button>
            <Button
              type="button"
              className="profile-gradient-btn h-10 whitespace-nowrap rounded-full px-5 font-normal"
              disabled={profileTasks.tasks.length === 0 || confirming || saving}
              onClick={() => void confirmTasks()}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
        {selected.path.length > 0 ? (
          <p className="text-sm text-[#7f7280]">{selected.path.map((item) => item.title).join(" → ")}</p>
        ) : null}
      </header>

      <section className="profile-glass-card flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5">
        <ProfileTaskList
          tasks={profileTasks.tasks}
          loading={profileTasks.loading}
          error={profileTasks.error}
          onAdd={openAddDialog}
          onEdit={openEditDialog}
          onDelete={profileTasks.removeTask}
          onBatchDelete={profileTasks.removeTasks}
        />

        {confirmError ? <p className="shrink-0 text-sm text-destructive">{confirmError}</p> : null}

        <div className="flex shrink-0 justify-end pt-1">
          <Button
            type="button"
            className="profile-gradient-btn h-10 shrink-0 whitespace-nowrap rounded-full px-5 font-normal"
            disabled={profileTasks.tasks.length === 0 || confirming || saving}
            onClick={() => void confirmTasks()}
          >
            {confirmLabel}
          </Button>
        </div>
      </section>

      <TaskEditorDialog
        open={editorOpen}
        mode={editorMode}
        saving={saving}
        initialValues={editorValues}
        onClose={closeEditor}
        onSave={saveTask}
      />
      <MatchIssueDialog
        open={matchIssue !== null}
        kind={matchIssue ?? "not_a_task"}
        existingTaskWording={existingTaskWording}
        onRewrite={rewriteUnmatched}
        onDiscard={discardUnmatched}
        onAddAnyway={matchIssue === "similar" ? addSimilarAnyway : undefined}
      />
    </div>
  );
};

export default ProfileTasks;
