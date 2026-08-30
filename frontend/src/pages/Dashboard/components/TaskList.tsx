import { Badge } from "@/components/ui/badge";
import { GradientBar } from "@/components/ui/gradient-bar";
import EmptyState from "@/components/common/EmptyState";
import { bandFromScore, taskBandMeta, type TaskBandId } from "@/pages/Dashboard/lib/taskBands";
import type { ProfileTask } from "@/pages/WorkProfile/types";

type TaskListProps = {
  tasks: ProfileTask[];
  activeBand: TaskBandId | null;
  highlightedIds: string[];
};

const exposureScore = (task: ProfileTask) =>
  typeof task.score2025 === "number" ? task.score2025 : -1;

const TaskList = ({ tasks, activeBand, highlightedIds }: TaskListProps) => {
  if (tasks.length === 0) {
    return (
      <EmptyState title="No tasks yet" message="Add tasks in your profile to see them here." />
    );
  }

  const visible = tasks
    .filter((task) => {
      if (!activeBand) return true;
      return bandFromScore(task.score2025) === activeBand;
    })
    .sort((a, b) => exposureScore(b) - exposureScore(a));

  if (visible.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/80 p-4 text-sm text-[#7f7280]">
        No tasks in this group.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {visible.map((task) => {
        const band = taskBandMeta(bandFromScore(task.score2025));
        const highlighted = highlightedIds.includes(task.id);

        return (
          <article
            key={task.id}
            className={`dashboard-task-item ${highlighted ? "is-highlighted" : ""}`}
          >
            <div className="flex gap-3">
              <span
                className="w-1 shrink-0 rounded-full"
                style={{ background: band?.color ?? "#C9C2C7" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-6 text-[#2f2430]">{task.wording}</p>
                  {band ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <Badge
                        variant="outline"
                        className="rounded-full border-0 px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: `${band.color}55`, color: band.ink }}
                      >
                        {band.label}
                      </Badge>
                      {task.scoreSource === "estimated" ? (
                        <span className="text-[11px] text-[#7f7280]">Estimated</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-[#7f7280]">Not scored yet</span>
                  )}
                </div>
                {typeof task.score2025 === "number" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <GradientBar value={task.score2025 * 100} className="h-1.5" />
                    <span className="w-10 text-right text-xs tabular-nums text-[#7f7280]">
                      {task.score2025.toFixed(2)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default TaskList;
