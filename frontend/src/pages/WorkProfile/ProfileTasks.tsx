import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { saveConfirmedAnalysis } from "@/pages/Dashboard/analysisSession";
import MatchIssueDialog from "@/pages/WorkProfile/components/MatchIssueDialog";
import ProfileTaskList from "@/pages/WorkProfile/components/ProfileTaskList";
import TaskEditorDialog from "@/pages/WorkProfile/components/TaskEditorDialog";
import { useProfileTasks } from "@/pages/WorkProfile/hooks/useProfileTasks";
import { readSelectedOccupation } from "@/pages/WorkProfile/occupationSession";
import {
  hasExposureScore,
  needsExposureEstimate,
  type ProfileTask,
  type TaskEditorValues,
} from "@/pages/WorkProfile/types";
import { exposureService } from "@/services/exposureService";

const emptyEditorValues = (): TaskEditorValues => ({
  wording: "",
  timeSpent: "",
  responsibility: "",
});

const valuesFromTask = (task: ProfileTask): TaskEditorValues => ({
  wording: task.wording,
  timeSpent: task.timeSpent,
  responsibility: task.responsibility,
});

const ProfileTasks = () => {
  const selected = readSelectedOccupation();
  const navigate = useNavigate();
  const profileTasks = useProfileTasks(selected?.unit.occupation_code);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<TaskEditorValues>(emptyEditorValues);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [matchIssue, setMatchIssue] = useState<"not_a_task" | "service" | null>(null);
  const [pendingValues, setPendingValues] = useState<TaskEditorValues | null>(null);

  if (!selected) {
    return <Navigate to={ROUTES.workProfile} replace />;
  }

  const openAddDialog = () => {
    setEditorMode("add");
    setEditingTaskId(null);
    setEditorValues(emptyEditorValues());
    setMatchIssue(null);
    setEditorOpen(true);
  };

  const openEditDialog = (task: ProfileTask) => {
    setEditorMode("edit");
    setEditingTaskId(task.id);
    setEditorValues(valuesFromTask(task));
    setMatchIssue(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingTaskId(null);
    setMatchIssue(null);
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

  const commitScoredTask = (values: TaskEditorValues, score2025: number) => {
    if (editorMode === "edit" && editingTaskId) {
      profileTasks.updateTask(editingTaskId, values, {
        score2025,
        scoreSource: "estimated",
      });
    } else {
      profileTasks.addTask(values, { score2025, scoreSource: "estimated" });
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

    setSaving(true);
    setPendingValues(values);
    try {
      const { nlpReady, estimate } = await scoreWording(values, editing?.originalWording);
      if (!nlpReady || estimate?.reject_reason === "service_unavailable") {
        setMatchIssue("service");
        setEditorOpen(false);
        return false;
      }
      if (typeof estimate?.score_2025 !== "number") {
        setMatchIssue("not_a_task");
        setEditorOpen(false);
        return false;
      }
      commitScoredTask(values, estimate.score_2025);
      setPendingValues(null);
      return true;
    } catch {
      setMatchIssue("service");
      setEditorOpen(false);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const rewriteUnmatched = () => {
    setMatchIssue(null);
    if (pendingValues) setEditorValues(pendingValues);
    setEditorOpen(true);
  };

  const discardUnmatched = () => {
    setMatchIssue(null);
    setPendingValues(null);
    setEditorOpen(false);
    setEditingTaskId(null);
  };

  const confirmTasks = async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
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
            return { ...task, score2025: estimate.score_2025, scoreSource: "estimated" as const };
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

      saveConfirmedAnalysis({
        occupationTitle: selected.unit.title,
        occupationPath: selected.path.map((item) => item.title),
        occupationCode: selected.unit.occupation_code,
        potential25: profileTasks.occupationPotential25,
        meanScore2025: profileTasks.occupationMeanScore2025,
        tasks: nextTasks,
      });
      navigate(`${ROUTES.dashboard}#exposure`);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="space-y-3 border-b border-white/70 pb-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-[#2f2430]">Your tasks</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild className="profile-primary-btn h-10 whitespace-nowrap rounded-full px-5">
              <Link to={ROUTES.workProfile}>Change occupation</Link>
            </Button>
            <Button
              type="button"
              className="profile-blue-btn h-10 whitespace-nowrap rounded-full px-5"
              disabled={profileTasks.tasks.length === 0 || confirming || saving}
              onClick={() => void confirmTasks()}
            >
              {confirming ? "Checking scores…" : "Explore AI impact"}
            </Button>
          </div>
        </div>
        {selected.path.length > 0 ? (
          <p className="text-sm text-[#7f7280]">{selected.path.map((item) => item.title).join(" → ")}</p>
        ) : null}
      </header>

      <section className="profile-glass-card flex flex-col gap-5 p-5">
        <ProfileTaskList
          tasks={profileTasks.tasks}
          loading={profileTasks.loading}
          error={profileTasks.error}
          onAdd={openAddDialog}
          onEdit={openEditDialog}
          onDelete={profileTasks.removeTask}
          onBatchDelete={profileTasks.removeTasks}
        />

        {confirmError ? <p className="text-sm text-destructive">{confirmError}</p> : null}

        <div className="flex justify-end">
          <Button
            type="button"
            className="profile-blue-btn h-10 whitespace-nowrap rounded-full px-5"
            disabled={profileTasks.tasks.length === 0 || confirming || saving}
            onClick={() => void confirmTasks()}
          >
            {confirming ? "Checking scores…" : "Explore AI impact"}
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
        onRewrite={rewriteUnmatched}
        onDiscard={discardUnmatched}
      />
    </div>
  );
};

export default ProfileTasks;
