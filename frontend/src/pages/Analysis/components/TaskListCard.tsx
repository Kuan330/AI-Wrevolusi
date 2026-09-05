import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AnalysisCard, { type TitleTone } from "@/pages/Analysis/components/AnalysisCard";
import ExposureCategoryFilters from "@/pages/Analysis/components/ExposureCategoryFilters";
import TaskList from "@/pages/Analysis/components/TaskList";
import type { OccupationBandId } from "@/pages/Analysis/lib/occupationBands";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

type TaskListCardProps = {
  className?: string;
  eyebrow: string;
  title: string;
  description: string;
  titleTone?: TitleTone | null;
  tasks: ProfileTask[];
  taskExposureAssessments: ConfirmedTaskExposureAssessment[];
  activeCategory: OccupationBandId | null;
  categoryCounts: Record<OccupationBandId, number>;
  totalCount?: number;
  onSelectCategory: (category: OccupationBandId | null) => void;
  highlightedIds: string[];
  onClear?: () => void;
};

const TaskListCard = ({
  className,
  eyebrow,
  title,
  description,
  titleTone,
  tasks,
  taskExposureAssessments,
  activeCategory,
  categoryCounts,
  totalCount,
  onSelectCategory,
  highlightedIds,
  onClear,
}: TaskListCardProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollHint, setScrollHint] = useState({ canScroll: false, atBottom: true });

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
  }, [tasks.length, taskExposureAssessments.length, activeCategory, highlightedIds.length, updateScrollHint]);

  const showScrollHint = scrollHint.canScroll && !scrollHint.atBottom;

  const scrollTowardBottom = () => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ top: Math.max(120, element.clientHeight * 0.65), behavior: "smooth" });
  };

  return (
    <AnalysisCard
    className={cn("analysis-overview__list", className)}
      eyebrow={eyebrow}
      title={title}
      description={description}
      headerContent={
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7f7280]">
            Filter by ILO reference occupation category
          </p>
          <ExposureCategoryFilters
            counts={categoryCounts}
            activeCategory={activeCategory}
            totalCount={totalCount}
            onSelect={onSelectCategory}
            compact
          />
        </div>
      }
      titleTone={titleTone}
      action={
        onClear ? (
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-xs font-medium text-[#4f91ba]"
            onClick={onClear}
          >
            Clear
          </Button>
        ) : null
      }
      contentClassName="pt-1"
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="analysis-list-scroll h-full min-h-0"
          onScroll={updateScrollHint}
        >
          <div className="pb-10">
            <TaskList
              tasks={tasks}
              taskExposureAssessments={taskExposureAssessments}
              activeCategory={activeCategory}
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
