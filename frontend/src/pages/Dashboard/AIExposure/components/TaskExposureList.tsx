import { Progress } from "@/components/ui/progress";
import { bandFromScore, taskBandMeta, type TaskBandId } from "@/pages/Dashboard/AIExposure/taskBands";
import type { ProfileTask } from "@/pages/WorkProfile/types";

type TaskExposureListProps = {
  tasks: ProfileTask[];
  activeBand: TaskBandId | null;
  highlightedIds: string[];
};

const TaskExposureList = ({ tasks, activeBand, highlightedIds }: TaskExposureListProps) => {
  const visible = tasks.filter((task) => {
    if (!activeBand) return true;
    return bandFromScore(task.score2025) === activeBand;
  });

  return (
    <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No tasks in this group.
        </p>
      ) : (
        visible.map((task) => {
          const band = taskBandMeta(bandFromScore(task.score2025));
          const highlighted = highlightedIds.includes(task.id);
          return (
            <article
              key={task.id}
              className={`rounded-xl border bg-card p-3 ${highlighted ? "border-primary/40 ring-1 ring-primary/20" : ""}`}
            >
              <div className="flex gap-3">
                <span
                  className="w-1 shrink-0 rounded-full"
                  style={{ background: band?.color ?? "#C9C2C7" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-6">{task.wording}</p>
                    {band ? (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: `${band.color}22`, color: band.color }}
                      >
                        {band.label}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] text-muted-foreground">Not scored yet</span>
                    )}
                  </div>
                  {typeof task.score2025 === "number" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={task.score2025 * 100} className="h-1.5" />
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {task.score2025.toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
};

export default TaskExposureList;
