import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import ScoreRangeSlider from "@/components/ui/score-range-slider";
import { cn } from "@/lib/utils";
import AnalysisCard, { type TitleTone } from "@/pages/Analysis/components/AnalysisCard";
import TaskList from "@/pages/Analysis/components/TaskList";
import { taskIsWithinScoreRange, taskScore, type TaskScoreRange } from "@/pages/Analysis/lib/taskScore";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

type TaskListCardProps = {
  className?: string;
  scoreRange?: TaskScoreRange;
  onScoreRangeChange?: (range: TaskScoreRange) => void;
  eyebrow: string;
  title: string;
  description: string;
  titleTone?: TitleTone | null;
  tasks: ProfileTask[];
  taskExposureAssessments: ConfirmedTaskExposureAssessment[];
  highlightedIds: string[];
};

const TaskListCard = ({
  className,
  scoreRange: controlledRange,
  onScoreRangeChange,
  eyebrow,
  title,
  description,
  titleTone,
  tasks,
  taskExposureAssessments,
  highlightedIds,
}: TaskListCardProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localRange, setLocalRange] = useState<TaskScoreRange>([0, 1]);
  const scoreRange = controlledRange ?? localRange;
  const setScoreRange = onScoreRangeChange ?? setLocalRange;
  const [scrollHint, setScrollHint] = useState({ canScroll: false, atBottom: true });
  const taskExposureAssessmentByTaskId = new Map(
    taskExposureAssessments.map((assessment) => [assessment.task_id, assessment]),
  );
  const hasFullScoreRange = scoreRange[0] <= 0 && scoreRange[1] >= 1;
  const visibleCount = tasks.filter((task) => {
    const score = taskScore(task, taskExposureAssessmentByTaskId.get(task.id));
    return score == null ? hasFullScoreRange : taskIsWithinScoreRange(score, scoreRange);
  }).length;

  const updateScrollHint = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const canScroll = element.scrollHeight > element.clientHeight + 1;
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    setScrollHint({ canScroll, atBottom });
  }, []);

  useEffect(() => {
    updateScrollHint();
    const element = scrollRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tasks.length, taskExposureAssessments.length, scoreRange, highlightedIds.length, updateScrollHint]);

  const showScrollHint = scrollHint.canScroll && !scrollHint.atBottom;

  const scrollTowardBottom = () => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ top: Math.max(160, element.clientHeight * 0.65), behavior: "smooth" });
  };

  return (
    <AnalysisCard
      className={cn("analysis-overview__list", className)}
      eyebrow={eyebrow}
      title={title}
      description={`${description} Showing ${visibleCount} of ${tasks.length} tasks.`}
      headerContent={
        <ScoreRangeSlider
          value={scoreRange}
          onValueChange={setScoreRange}
          onReset={() => setScoreRange([0, 1])}
        />
      }
      titleTone={titleTone}
      contentClassName="pt-1"
    >
      <div className="task-list__viewport">
        <div
          ref={scrollRef}
          className="analysis-list-scroll h-full min-h-0"
          onScroll={updateScrollHint}
        >
          <div className="pb-10">
            <TaskList
              tasks={tasks}
              taskExposureAssessments={taskExposureAssessments}
              scoreRange={scoreRange}
              highlightedIds={highlightedIds}
            />
          </div>
        </div>

        {showScrollHint ? (
          <button
            type="button"
            className="analysis-list-scroll-hint"
            aria-label="Scroll to see more tasks"
            onClick={scrollTowardBottom}
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </AnalysisCard>
  );
};

export default TaskListCard;
