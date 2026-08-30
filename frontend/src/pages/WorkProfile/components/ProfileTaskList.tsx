import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import BatchDeleteTaskDialog from "@/pages/WorkProfile/components/BatchDeleteTaskDialog";
import DeleteTaskDialog from "@/pages/WorkProfile/components/DeleteTaskDialog";
import { optionLabel, RESPONSIBILITY_OPTIONS, TIME_SPENT_OPTIONS } from "@/pages/WorkProfile/taskOptions";
import type { ProfileTask } from "@/pages/WorkProfile/types";

type ProfileTaskListProps = {
  tasks: ProfileTask[];
  loading: boolean;
  error: string | null;
  onAdd: () => void;
  onEdit: (task: ProfileTask) => void;
  onDelete: (taskId: string) => void;
  onBatchDelete: (taskIds: string[]) => void;
};

const taskMeta = (task: ProfileTask) => {
  const time = task.timeSpent ? optionLabel(TIME_SPENT_OPTIONS, task.timeSpent) : "";
  const responsibility = task.responsibility
    ? optionLabel(RESPONSIBILITY_OPTIONS, task.responsibility)
    : "";
  return [time, responsibility].filter(Boolean).join(" · ");
};

const ProfileTaskList = ({
  tasks,
  loading,
  error,
  onAdd,
  onEdit,
  onDelete,
  onBatchDelete,
}: ProfileTaskListProps) => {
  const [deleteTarget, setDeleteTarget] = useState<ProfileTask | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelection = (taskId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleBatchDeleteConfirm = () => {
    onBatchDelete(Array.from(selectedIds));
    exitBatchMode();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
          {batchMode ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="profile-outline-btn h-10 rounded-full px-4"
                onClick={exitBatchMode}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="profile-batch-btn h-10 rounded-full px-4"
                disabled={selectedIds.size === 0}
                onClick={() => setBatchDeleteOpen(true)}
              >
                <img src="/images/icons/icon-delete-black.svg" alt="" className="h-5 w-5" />
                Delete selected ({selectedIds.size})
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="profile-batch-btn h-10 rounded-full px-4"
              disabled={tasks.length === 0}
              onClick={() => setBatchMode(true)}
            >
              <img src="/images/icons/icon-delete-black.svg" alt="" className="h-5 w-5" />
              Batch delete
            </Button>
          )}
          <Button className="profile-gradient-btn h-10 rounded-full px-4" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add a task
          </Button>
      </div>

      {batchMode ? (
        <p className="text-sm text-[#7f7280]">Select the tasks you want to remove.</p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/50" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="profile-task-card border border-dashed p-6 text-sm text-[#7f7280]">
          No tasks in your profile yet. Add one that matches your day-to-day work.
        </div>
      ) : (
        tasks.map((task) => {
          const isSelected = selectedIds.has(task.id);

          return (
            <div key={task.id} className="profile-task-card p-4">
              <div className="flex items-center gap-3">
                {batchMode ? (
                  <button
                    type="button"
                    className="profile-task-checkbox"
                    aria-label={isSelected ? "Deselect task" : "Select task"}
                    onClick={() => toggleSelection(task.id)}
                  >
                    <img
                      src={
                        isSelected
                          ? "/images/icons/icon-checkbox-checked.svg"
                          : "/images/icons/icon-checkbox-unchecked.svg"
                      }
                      alt=""
                      className="block h-[22px] w-[22px] object-contain"
                    />
                  </button>
                ) : null}
                <p className="min-w-0 flex-1 text-sm leading-6 text-[#2f2430]">{task.wording}</p>
                {!batchMode ? (
                  <div className="profile-icon-actions">
                    <button
                      type="button"
                      className="profile-icon-btn"
                      aria-label="Edit task"
                      onClick={() => onEdit(task)}
                    >
                      <img src="/images/icons/icon-edit.svg" alt="" />
                    </button>
                    <button
                      type="button"
                      className="profile-icon-btn"
                      aria-label="Delete task"
                      onClick={() => setDeleteTarget(task)}
                    >
                      <img src="/images/icons/icon-delete.svg" alt="" />
                    </button>
                  </div>
                ) : null}
              </div>
              {taskMeta(task) ? (
                <p className={`mt-2 text-xs text-[#7f7280] ${batchMode ? "pl-[52px]" : ""}`}>
                  {taskMeta(task)}
                </p>
              ) : null}
            </div>
          );
        })
      )}

      <DeleteTaskDialog
        open={Boolean(deleteTarget)}
        taskWording={deleteTarget?.wording ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
        }}
      />

      <BatchDeleteTaskDialog
        open={batchDeleteOpen}
        count={selectedIds.size}
        onClose={() => setBatchDeleteOpen(false)}
        onConfirm={handleBatchDeleteConfirm}
      />
    </div>
  );
};

export default ProfileTaskList;
