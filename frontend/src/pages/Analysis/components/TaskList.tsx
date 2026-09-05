import { Badge } from "@/components/ui/badge";
import { GradientBar } from "@/components/ui/gradient-bar";
import EmptyState from "@/components/common/EmptyState";
import { occupationBandFromPotential, type OccupationBandId } from "@/pages/Analysis/lib/occupationBands";
import { referenceOccupationCategory } from "@/pages/Analysis/lib/iloExposure";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

type TaskListProps = {
  tasks: ProfileTask[];
  taskExposureAssessments: ConfirmedTaskExposureAssessment[];
  activeCategory: OccupationBandId | null;
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
  activeCategory,
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
      if (!activeCategory) return true;
      const assessment = taskExposureAssessmentByTaskId.get(task.id);
      return referenceOccupationCategory(task, assessment) === activeCategory;
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
        const databaseCategory = occupationBandFromPotential(
          referenceOccupationCategory(task, taskExposureAssessment),
        );
        const highlighted = highlightedIds.includes(task.id);

        return (
          <article
            key={task.id}
            className={`analysis-task-item ${highlighted ? "is-highlighted" : ""}`}
          >
            <div className="flex gap-3">
              <span
                className="w-1 shrink-0 rounded-full"
                style={{ background: databaseCategory?.color ?? "#C9C2C7" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-6 text-[#2f2430]">{task.wording}</p>
                  <div className="flex max-w-[45%] shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[10px] text-[#7f7280]">Reference occupation</span>
                    {databaseCategory ? (
                      <Badge
                        variant="outline"
                        className="whitespace-normal rounded-full border-0 px-2 py-0.5 text-right text-[11px] font-medium"
                        style={{ background: `${databaseCategory.color}55`, color: databaseCategory.ink }}
                      >
                        {databaseCategory.label}
                      </Badge>
                    ) : null}
                    {!databaseCategory ? (
                      <span className="text-[11px] text-[#7f7280]">Occupation category unavailable</span>
                    ) : null}
                  </div>
                </div>
                {typeof taskExposureAssessment?.adjusted_score === "number" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <GradientBar value={taskExposureAssessment.adjusted_score * 100} className="h-1.5" />
                    <span className="w-20 text-right text-xs tabular-nums text-[#7f7280]">
                      Task score {taskExposureAssessment.adjusted_score.toFixed(2)}
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
                      {databaseCategory ? (
                        <p><strong>ILO reference occupation category:</strong> {databaseCategory.label}. This category uses the occupation’s task-score distribution, not this individual task score.</p>
                      ) : null}
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
