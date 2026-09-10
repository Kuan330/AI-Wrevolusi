import type { ComponentProps } from "react";
import { useState } from "react";

import EmptyState from "@/components/common/EmptyState";
import Loading from "@/components/common/Loading";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import TaskCard from "@/pages/WorkProfile/components/TaskCard";
import { ApiError } from "@/services/api";
import { useTasks } from "@/hooks/useTasks";
import { validateTaskTitle } from "@/utils/validation";

const TaskList = () => {
  const { tasks, addTask, removeTask, loading, mutating, currentUser, error } =
    useTasks();
  const [newTask, setNewTask] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddTask = async () => {
    const validationError = validateTaskTitle(newTask);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      await addTask(newTask.trim());
      setNewTask("");
      setFormError(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.detail);
        return;
      }
      setFormError("Unable to create task right now.");
    }
  };

  if (loading) {
    return <Loading label={MESSAGES.loading} />;
  }

  if (!currentUser) {
    const emptyStateProps1 = {
      title: "Session unavailable",
      message: error ?? "Unable to initialize backend session.",
    } satisfies Partial<ComponentProps<typeof EmptyState>>;
    return <EmptyState {...emptyStateProps1} />;
  }

  const buttonProps2 = {
    onClick: () => {
      void handleAddTask();
    },
    disabled: mutating,
  } satisfies Partial<ComponentProps<typeof Button>>;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium">Add task</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            placeholder="e.g. Coach new staff on customer service"
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            disabled={mutating}
          />
          <Button {...buttonProps2}>Add</Button>
        </div>
        {formError ? (
          <p className="mt-2 text-xs text-destructive">{formError}</p>
        ) : null}
      </div>

      {tasks.length ? (
        <div className="grid gap-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              {...({ task: task, onDelete: removeTask } satisfies Partial<
                ComponentProps<typeof TaskCard>
              >)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          {...({
            title: "No tasks yet",
            message: MESSAGES.emptyTasks,
          } satisfies Partial<ComponentProps<typeof EmptyState>>)}
        />
      )}
    </div>
  );
};

export default TaskList;
