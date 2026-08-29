import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { optionLabel, RESPONSIBILITY_OPTIONS, TIME_SPENT_OPTIONS } from "@/pages/WorkProfile/taskOptions";
import type { ProfileTask } from "@/pages/WorkProfile/types";

type ProfileTaskListProps = {
  tasks: ProfileTask[];
  loading: boolean;
  error: string | null;
  onAdd: () => void;
  onEdit: (task: ProfileTask) => void;
  onDelete: (taskId: string) => void;
};

const taskMeta = (task: ProfileTask) => {
  const time = task.timeSpent ? optionLabel(TIME_SPENT_OPTIONS, task.timeSpent) : "";
  const responsibility = task.responsibility
    ? optionLabel(RESPONSIBILITY_OPTIONS, task.responsibility)
    : "";
  return [time, responsibility].filter(Boolean).join(" · ");
};

const ProfileTaskList = ({ tasks, loading, error, onAdd, onEdit, onDelete }: ProfileTaskListProps) => {
  const confirmDelete = (task: ProfileTask) => {
    if (window.confirm("Remove this task from your profile?")) {
      onDelete(task.id);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Your tasks</h2>
        <Button className="h-10 rounded-full" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add a task
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No tasks in your profile yet. Add one that matches your day-to-day work.
        </div>
      ) : (
        tasks.map((task) => (
          <div key={task.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <p className="flex-1 text-sm leading-6">{task.wording}</p>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" aria-label="Edit task" onClick={() => onEdit(task)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete task" onClick={() => confirmDelete(task)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {taskMeta(task) ? (
              <p className="mt-2 text-xs text-muted-foreground">{taskMeta(task)}</p>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
};

export default ProfileTaskList;
