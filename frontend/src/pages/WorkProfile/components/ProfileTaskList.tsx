import type { ComponentProps } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ListChecks, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import BatchDeleteTaskDialog from "@/pages/WorkProfile/components/BatchDeleteTaskDialog";
import DeleteTaskDialog from "@/pages/WorkProfile/components/DeleteTaskDialog";
import {
  optionLabel,
  TIME_SPENT_OPTIONS,
} from "@/pages/WorkProfile/taskOptions";
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
  const time = task.timeSpent
    ? optionLabel(TIME_SPENT_OPTIONS, task.timeSpent)
    : "";
  const count = task.practice?.trials.length ?? 0;
  return [
    time,
    count ? `${count} AI ${count === 1 ? "trial" : "trials"} recorded` : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

const ProfileTaskList = (props: ProfileTaskListProps) => {
  const { tasks, loading, error, onAdd, onEdit, onDelete, onBatchDelete } =
    props;
  const [deleteTarget, setDeleteTarget] = useState<ProfileTask | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollHint, setScrollHint] = useState({
    canScroll: false,
    atBottom: true,
  });

  const updateScrollHint = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const canScroll = element.scrollHeight > element.clientHeight + 1;
    const atBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    setScrollHint({ canScroll, atBottom });
  }, []);

  useEffect(() => {
    updateScrollHint();
    const element = scrollRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tasks.length, loading, error, batchMode, updateScrollHint]);

  const showScrollHint = scrollHint.canScroll && !scrollHint.atBottom;

  const scrollTowardBottom = () => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({
      top: Math.max(120, element.clientHeight * 0.65),
      behavior: "smooth",
    });
  };

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

  const selectedTaskIds = tasks
    .filter((task) => selectedIds.has(task.id))
    .map((task) => task.id);
  const allSelected =
    tasks.length > 0 && selectedTaskIds.length === tasks.length;

  const handleBatchDeleteConfirm = () => {
    onBatchDelete(selectedTaskIds);
    exitBatchMode();
  };

  const deleteTaskDialogProps1 = {
    open: Boolean(deleteTarget),
    taskWording: deleteTarget?.wording ?? "",
    onClose: () => setDeleteTarget(null),
    onConfirm: () => {
      if (deleteTarget) onDelete(deleteTarget.id);
    },
  } satisfies Partial<ComponentProps<typeof DeleteTaskDialog>>;
  const batchDeleteTaskDialogProps2 = {
    open: batchDeleteOpen,
    count: selectedTaskIds.length,
    onClose: () => setBatchDeleteOpen(false),
    onConfirm: handleBatchDeleteConfirm,
  } satisfies Partial<ComponentProps<typeof BatchDeleteTaskDialog>>;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {batchMode ? (
          <>
            <label className="mr-auto flex items-center gap-2 text-sm text-[#574a55]">
              <Checkbox
                {...({
                  "aria-label": "Select all tasks",
                  checked: allSelected
                    ? true
                    : selectedTaskIds.length
                      ? "indeterminate"
                      : false,
                  onCheckedChange: () =>
                    setSelectedIds(
                      allSelected
                        ? new Set()
                        : new Set(tasks.map((task) => task.id)),
                    ),
                } satisfies Partial<ComponentProps<typeof Checkbox>>)}
              />
              Select all
              <span className="ml-2 text-[#7f7280]" role="status">
                {selectedTaskIds.length} of {tasks.length} selected
              </span>
            </label>
            <Button
              {...({
                type: "button",
                variant: "outline",
                className: "profile-outline-btn h-10 rounded-full px-4",
                onClick: exitBatchMode,
              } satisfies Partial<ComponentProps<typeof Button>>)}
            >
              Cancel
            </Button>
            <Button
              {...({
                type: "button",
                className:
                  "profile-batch-btn inline-flex h-10 items-center gap-2 rounded-full px-5 font-normal",
                disabled: selectedTaskIds.length === 0,
                onClick: () => setBatchDeleteOpen(true),
              } satisfies Partial<ComponentProps<typeof Button>>)}
            >
              <Trash2
                {...({
                  className: "h-4 w-4",
                  "aria-hidden": true,
                } satisfies Partial<ComponentProps<typeof Trash2>>)}
              />
              Delete selected ({selectedTaskIds.length})
            </Button>
          </>
        ) : (
          <Button
            {...({
              type: "button",
              className:
                "profile-batch-btn inline-flex h-10 items-center gap-2 rounded-full px-5 font-normal",
              disabled: loading || tasks.length === 0,
              onClick: () => setBatchMode(true),
            } satisfies Partial<ComponentProps<typeof Button>>)}
          >
            <ListChecks
              {...({
                className: "h-4 w-4",
                "aria-hidden": true,
              } satisfies Partial<ComponentProps<typeof ListChecks>>)}
            />
            Select tasks
          </Button>
        )}
        {!batchMode && (
          <Button
            {...({
              className:
                "profile-blue-btn inline-flex h-10 items-center gap-2 rounded-full px-4 font-normal",
              onClick: onAdd,
            } satisfies Partial<ComponentProps<typeof Button>>)}
          >
            <Plus className="h-4 w-4" />
            Add a task
          </Button>
        )}
      </div>

      {batchMode ? (
        <p className="shrink-0 text-sm text-[#7f7280]">
          Select tasks below, or select all tasks including those further down
          the list.
        </p>
      ) : null}

      {error ? (
        <div className="shrink-0 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="profile-task-list-scroll h-full min-h-0 overflow-y-auto overscroll-contain"
          onScroll={updateScrollHint}
        >
          <div className="space-y-3 pr-1 pb-10">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-2xl bg-white/50"
                  />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="profile-task-card border border-dashed p-6 text-sm text-[#7f7280]">
                No tasks in your profile yet. Add one that matches your
                day-to-day work.
              </div>
            ) : (
              tasks.map((task) => {
                const isSelected = selectedIds.has(task.id);

                return (
                  <div
                    key={task.id}
                    className={`profile-task-card p-4 ${batchMode && isSelected ? "ring-1 ring-[#8dbbd6] bg-[#eaf4fb]" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {batchMode ? (
                        <Checkbox
                          {...({
                            id: `select-task-${task.id}`,
                            "aria-label": `Select task: ${task.wording}`,
                            checked: isSelected,
                            onCheckedChange: () => toggleSelection(task.id),
                          } satisfies Partial<ComponentProps<typeof Checkbox>>)}
                        />
                      ) : null}
                      <p className="min-w-0 flex-1 text-sm leading-6 text-[#2f2430]">
                        {batchMode ? (
                          <label
                            htmlFor={`select-task-${task.id}`}
                            className="block cursor-pointer"
                          >
                            {task.wording}
                          </label>
                        ) : (
                          task.wording
                        )}
                      </p>
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
                            className="profile-icon-btn profile-icon-btn--delete"
                            aria-label="Delete task"
                            onClick={() => setDeleteTarget(task)}
                          >
                            <Trash2
                              {...({
                                className: "h-4 w-4",
                                "aria-hidden": true,
                              } satisfies Partial<
                                ComponentProps<typeof Trash2>
                              >)}
                            />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {taskMeta(task) ? (
                      <p
                        className={`mt-2 text-xs text-[#7f7280] ${batchMode ? "pl-[52px]" : ""}`}
                      >
                        {taskMeta(task)}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {showScrollHint ? (
          <button
            type="button"
            className="profile-task-scroll-hint"
            aria-label="Scroll to see more tasks"
            onClick={scrollTowardBottom}
          >
            <ChevronDown
              {...({
                className: "h-4 w-4",
                "aria-hidden": true,
              } satisfies Partial<ComponentProps<typeof ChevronDown>>)}
            />
          </button>
        ) : null}
      </div>

      <DeleteTaskDialog {...deleteTaskDialogProps1} />

      <BatchDeleteTaskDialog {...batchDeleteTaskDialogProps2} />
    </div>
  );
};

export default ProfileTaskList;
