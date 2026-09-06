import { Info } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import TaskDetailsDrawer from "./TaskDetailsDrawer";
import { cn } from "@/lib/utils";
import { taskIsWithinScoreRange, taskScore, type TaskScoreRange } from "@/pages/Analysis/lib/taskScore";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

type TaskListProps = {
  tasks: ProfileTask[];
  taskExposureAssessments: ConfirmedTaskExposureAssessment[];
  scoreRange: TaskScoreRange;
  highlightedIds: string[];
};

const TaskList = ({
  tasks,
  taskExposureAssessments,
  scoreRange,
  highlightedIds,
}: TaskListProps) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
  const hasFullScoreRange = scoreRange[0] <= 0 && scoreRange[1] >= 1;
  const visible = [...tasks]
    .filter((task) => {
      const score = taskScore(task, taskExposureAssessmentByTaskId.get(task.id));
      return score == null ? hasFullScoreRange : taskIsWithinScoreRange(score, scoreRange);
    })
    .sort(
      (firstTask, secondTask) =>
        (taskScore(secondTask, taskExposureAssessmentByTaskId.get(secondTask.id)) ?? -1) -
        (taskScore(firstTask, taskExposureAssessmentByTaskId.get(firstTask.id)) ?? -1),
    );

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedAssessment = selectedTask
    ? taskExposureAssessmentByTaskId.get(selectedTask.id) ?? null
    : null;

  if (visible.length === 0) {
    return (
      <p className="task-list__empty">
        No tasks match this score range. Move the slider to widen the range.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        {visible.map((task) => {
          const highlighted = highlightedIds.includes(task.id);

          return (
            <article
              key={task.id}
              className={cn("analysis-task-item", highlighted && "is-highlighted")}
            >
              <div className="task-list__row">
                <span className="task-list__dot" aria-hidden="true" />
                <p className="task-list__name">{task.wording}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="task-details-button"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <Info className="size-3.5" aria-hidden="true" />
                  Details
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <TaskDetailsDrawer selectedTask={selectedTask} selectedAssessment={selectedAssessment} onClose={() => setSelectedTaskId(null)} />
    </>
  );
};

export default TaskList;
