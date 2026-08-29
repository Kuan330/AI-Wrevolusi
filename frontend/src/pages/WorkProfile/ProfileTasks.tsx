import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import { ROUTES } from "@/constants/routes";
import ProfileTaskList from "@/pages/WorkProfile/components/ProfileTaskList";
import TaskEditorDialog from "@/pages/WorkProfile/components/TaskEditorDialog";
import { useProfileTasks } from "@/pages/WorkProfile/hooks/useProfileTasks";
import { readSelectedOccupation } from "@/pages/WorkProfile/occupationSession";
import type { ProfileTask, TaskEditorValues } from "@/pages/WorkProfile/types";

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
  const profileTasks = useProfileTasks();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<TaskEditorValues>(emptyEditorValues);

  useEffect(() => {
    if (!selected?.unit.occupation_code) return;
    void profileTasks.loadStarterTasks(selected.unit.occupation_code);
    // Load once for the occupation stored in this session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.unit.occupation_code]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your tasks"
        description={`These are the tasks for ${selected.unit.title}. Add, edit, or remove anything that does not match your work.`}
        actions={
          <Link to={ROUTES.workProfile} className="text-sm font-medium text-primary hover:underline">
            Change occupation
          </Link>
        }
      />

      {selected.path.length > 0 ? (
        <p className="text-sm text-muted-foreground">{selected.path.map((item) => item.title).join(" → ")}</p>
      ) : null}

      <ProfileTaskList
        tasks={profileTasks.tasks}
        loading={profileTasks.loading}
        error={profileTasks.error}
        onAdd={openAddDialog}
        onEdit={openEditDialog}
        onDelete={profileTasks.removeTask}
      />

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
