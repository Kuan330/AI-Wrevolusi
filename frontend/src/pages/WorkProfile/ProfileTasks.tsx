import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { saveConfirmedAnalysis } from "@/pages/Dashboard/analysisSession";
import ProfileTaskList from "@/pages/WorkProfile/components/ProfileTaskList";
import TaskEditorDialog from "@/pages/WorkProfile/components/TaskEditorDialog";
import { useProfileTasks } from "@/pages/WorkProfile/hooks/useProfileTasks";
import { readSelectedOccupation } from "@/pages/WorkProfile/occupationSession";
import type { ProfileTask, TaskEditorValues } from "@/pages/WorkProfile/types";
import { exposureService, type TaskAssessmentContextLevel } from "@/services/exposureService";

const emptyEditorValues = (): TaskEditorValues => ({
  wording: "",
  timeSpent: "",
  responsibility: "",
  routineProcessingLevel: "",
  informationUseLevel: "",
  humanInteractionLevel: "",
  judgementLevel: "",
});

const valuesFromTask = (task: ProfileTask): TaskEditorValues => ({
  wording: task.wording,
  timeSpent: task.timeSpent,
  responsibility: task.responsibility,
  routineProcessingLevel: task.routineProcessingLevel ?? "",
  informationUseLevel: task.informationUseLevel ?? "",
  humanInteractionLevel: task.humanInteractionLevel ?? "",
  judgementLevel: task.judgementLevel ?? "",
});

const normalizeOptionalTaskAssessmentContextLevel = (
  value: string | undefined,
): TaskAssessmentContextLevel | null =>
  value === "low" || value === "medium" || value === "high" ? value : null;

const normalizeOptionalResponsibilityLevel = (
  value: string,
): "individual" | "shared" | "lead" | null =>
  value === "individual" || value === "shared" || value === "lead" ? value : null;

const ProfileTasks = () => {
  const selected = readSelectedOccupation();
  const navigate = useNavigate();
  const profileTasks = useProfileTasks(selected?.unit.occupation_code);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<TaskEditorValues>(emptyEditorValues);
  const [taskAssessmentRequestInProgress, setTaskAssessmentRequestInProgress] = useState(false);
  const [taskAssessmentRequestError, setTaskAssessmentRequestError] = useState<string | null>(null);

  if (!selected) {
    return <Navigate to={ROUTES.workProfile} replace />;
  }

  const openAddDialog = () => {
    setEditorMode("add");
    setEditingTaskId(null);
    setEditorValues(emptyEditorValues());
    setEditorOpen(true);
  };

  const openEditDialog = (task: ProfileTask) => {
    setEditorMode("edit");
    setEditingTaskId(task.id);
    setEditorValues(valuesFromTask(task));
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingTaskId(null);
  };

  const saveTask = (values: TaskEditorValues) => {
    if (editorMode === "edit" && editingTaskId) {
      profileTasks.updateTask(editingTaskId, values);
      return;
    }
    profileTasks.addTask(values);
  };

  const assessConfirmedTasksAndOpenDashboard = async () => {
    setTaskAssessmentRequestInProgress(true);
    setTaskAssessmentRequestError(null);
    try {
      const assessmentResponse = await exposureService.assessConfirmedTasksAgainstIloReferences({
        occupation_code: selected.unit.occupation_code,
        confirmed_tasks: profileTasks.tasks.map((task) => ({
          task_id: task.id,
          task_text: task.wording,
          ilo_task_id: task.iloTaskId,
          context: {
            routine_processing_level: normalizeOptionalTaskAssessmentContextLevel(
              task.routineProcessingLevel,
            ),
            information_use_level: normalizeOptionalTaskAssessmentContextLevel(
              task.informationUseLevel,
            ),
            human_interaction_level: normalizeOptionalTaskAssessmentContextLevel(
              task.humanInteractionLevel,
            ),
            judgement_level: normalizeOptionalTaskAssessmentContextLevel(task.judgementLevel),
            responsibility_level: normalizeOptionalResponsibilityLevel(task.responsibility),
            time_spent: task.timeSpent || null,
          },
        })),
      });
      const scored = profileTasks.tasks.find(
        (task) => task.potential25 || typeof task.meanScore2025 === "number",
      );
      saveConfirmedAnalysis({
        occupationTitle: selected.unit.title,
        occupationPath: selected.path.map((item) => item.title),
        occupationCode: selected.unit.occupation_code,
        potential25: scored?.potential25 ?? null,
        meanScore2025: scored?.meanScore2025 ?? null,
        tasks: profileTasks.tasks,
        taskExposureAssessments: assessmentResponse.assessments,
      });
      navigate(`${ROUTES.dashboard}#exposure`);
    } catch {
      setTaskAssessmentRequestError(
        "The task assessment could not be completed. Your confirmed tasks are still saved; please try again.",
      );
    } finally {
      setTaskAssessmentRequestInProgress(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="shrink-0 space-y-3 border-b border-white/70 pb-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-[#2f2430]">Your tasks</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              asChild
              className="profile-primary-btn h-10 whitespace-nowrap rounded-full px-5"
            >
              <Link to={ROUTES.workProfile}>Change occupation</Link>
            </Button>
            <Button
              type="button"
              className="profile-gradient-btn h-10 whitespace-nowrap rounded-full px-5 font-normal"
              disabled={profileTasks.tasks.length === 0 || taskAssessmentRequestInProgress}
              onClick={() => void assessConfirmedTasksAndOpenDashboard()}
            >
              {taskAssessmentRequestInProgress ? "Assessing tasks…" : "Explore AI impact"}
            </Button>
          </div>
        </div>
        {selected.path.length > 0 ? (
          <p className="text-sm text-[#7f7280]">
            {selected.path.map((item) => item.title).join(" → ")}
          </p>
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
        {taskAssessmentRequestError ? (
          <p className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {taskAssessmentRequestError}
          </p>
        ) : null}
        <div className="flex shrink-0 justify-end pt-1">
          <Button
            type="button"
            className="profile-gradient-btn h-10 shrink-0 whitespace-nowrap rounded-full px-5 font-normal"
            disabled={profileTasks.tasks.length === 0 || taskAssessmentRequestInProgress}
            onClick={() => void assessConfirmedTasksAndOpenDashboard()}
          >
            {taskAssessmentRequestInProgress ? "Assessing tasks…" : "Explore AI impact"}
          </Button>
        </div>
      </section>

      <TaskEditorDialog
        open={editorOpen}
        mode={editorMode}
        initialValues={editorValues}
        onClose={closeEditor}
        onSave={saveTask}
      />
    </div>
  );
};

export default ProfileTasks;
