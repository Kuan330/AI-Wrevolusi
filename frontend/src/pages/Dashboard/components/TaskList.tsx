import { Badge } from "@/components/ui/badge";
import { GradientBar } from "@/components/ui/gradient-bar";
import EmptyState from "@/components/common/EmptyState";
import { taskBandMeta, type TaskBandId } from "@/pages/Dashboard/lib/taskBands";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

type TaskListProps = {
  tasks: ProfileTask[];
  taskExposureAssessments: ConfirmedTaskExposureAssessment[];
  activeBand: TaskBandId | null;
  highlightedIds: string[];
};

const formatTaskAssessmentMatchLayer = (
  matchLayer: ConfirmedTaskExposureAssessment["match_layer"],
) => {
  if (matchLayer === "exact") return "Exact ILO task evidence";
  if (matchLayer === "nlp") return "NLP task-text match";
  return "No reliable evidence match";
};

const TaskList = ({
  tasks,
  taskExposureAssessments,
  activeBand,
  highlightedIds,
}: TaskListProps) => {
  if (tasks.length === 0) {
    return (
      <EmptyState title="No tasks yet" message="Add tasks in your profile to see them here." />
    );
  }

  const taskExposureAssessmentByTaskId = new Map(
    taskExposureAssessments.map((taskExposureAssessment) => [
      taskExposureAssessment.task_id,
      taskExposureAssessment,
    ]),
  );
  const visible = [...tasks]
    .filter((task) => {
      if (!activeBand) return true;
      return taskExposureAssessmentByTaskId.get(task.id)?.suggested_state === activeBand;
    })
    .sort(
      (firstTask, secondTask) =>
        (taskExposureAssessmentByTaskId.get(secondTask.id)?.adjusted_score ?? -1) -
        (taskExposureAssessmentByTaskId.get(firstTask.id)?.adjusted_score ?? -1),
    );

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
        const taskExposureAssessment = taskExposureAssessmentByTaskId.get(task.id);
        const band = taskBandMeta(taskExposureAssessment?.suggested_state ?? null);
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
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full border-0 px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: `${band.color}55`, color: band.ink }}
                    >
                      {band.label}
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-[11px] text-[#7f7280]">Not scored yet</span>
                  )}
                </div>
                {typeof taskExposureAssessment?.adjusted_score === "number" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <GradientBar value={taskExposureAssessment.adjusted_score * 100} className="h-1.5" />
                    <span className="w-10 text-right text-xs tabular-nums text-[#7f7280]">
                      {taskExposureAssessment.adjusted_score.toFixed(2)}
                    </span>
                  </div>
                ) : null}
                {taskExposureAssessment ? (
                  <details className="mt-3 rounded-xl border border-white/80 bg-white/55 px-3 py-2 text-xs text-[#574a55]">
                    <summary className="cursor-pointer font-semibold text-[#3d5f7a]">
                      Why this possible transformation was suggested
                    </summary>
                    <div className="mt-3 space-y-2 leading-5">
                      <p>
                        <strong>Evidence method:</strong>{" "}
                        {formatTaskAssessmentMatchLayer(taskExposureAssessment.match_layer)}
                      </p>
                      <p>
                        <strong>Model:</strong>{" "}
                        {taskExposureAssessment.model_type?.replaceAll("_", " ") ?? "legacy scoring method"}{" "}
                        ({taskExposureAssessment.model_version ?? "legacy"})
                      </p>
                      <p><strong>Reasoning:</strong> {taskExposureAssessment.reasoning}</p>
                      <p><strong>Uncertainty:</strong> {taskExposureAssessment.uncertainty}</p>
                      <p><strong>Limitations:</strong> {taskExposureAssessment.limitations}</p>
                      <p>
                        <strong>Confidence:</strong>{" "}
                        {Math.round(taskExposureAssessment.confidence * 100)}%
                      </p>
                      <p>
                        <strong>Source:</strong>{" "}
                        <a
                          href={taskExposureAssessment.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#4f91ba] underline underline-offset-2"
                        >
                          {taskExposureAssessment.source_name} ({taskExposureAssessment.source_year})
                        </a>
                      </p>
                      {taskExposureAssessment.matched_reference_tasks[0] ? (
                        <p>
                          <strong>Closest task evidence:</strong>{" "}
                          {taskExposureAssessment.matched_reference_tasks[0].task_text}
                        </p>
                      ) : null}
                    </div>
                  </details>
                ) : (
                  <p className="mt-2 text-xs text-[#7f7280]">
                    This saved task has no current assessment. Return to your tasks and run the assessment again.
                  </p>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default TaskList;
