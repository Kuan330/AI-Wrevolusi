import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import DashboardCard, { type TitleTone } from "@/pages/Dashboard/components/DashboardCard";
import TaskList from "@/pages/Dashboard/components/TaskList";
import type { TaskBandId } from "@/pages/Dashboard/lib/taskBands";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { WefSkill } from "@/types/reference";

type TaskListCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  titleTone?: TitleTone | null;
  tasks: ProfileTask[];
  skills: WefSkill[];
  activeBand: TaskBandId | null;
  highlightedIds: string[];
  selectedSkillId?: number | null;
  onSelectSkill?: (skillId: number | null) => void;
  onClear?: () => void;
};

const TaskListCard = ({
  eyebrow,
  title,
  description,
  titleTone,
  tasks,
  skills,
  activeBand,
  highlightedIds,
  selectedSkillId,
  onSelectSkill,
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
  }, [tasks.length, activeBand, highlightedIds.length, updateScrollHint]);

  const showScrollHint = scrollHint.canScroll && !scrollHint.atBottom;

  const scrollTowardBottom = () => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ top: Math.max(120, element.clientHeight * 0.65), behavior: "smooth" });
  };

  return (
    <DashboardCard
      className="dashboard-overview__list"
      eyebrow={eyebrow}
      title={title}
      description={description}
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
          className="dashboard-list-scroll h-full min-h-0"
          onScroll={updateScrollHint}
        >
          <div className="pb-10">
            <TaskList
              tasks={tasks}
              skills={skills}
              activeBand={activeBand}
              highlightedIds={highlightedIds}
              selectedSkillId={selectedSkillId}
              onSelectSkill={onSelectSkill}
            />
          </div>
        </div>

        {showScrollHint ? (
          <button
            type="button"
            className="dashboard-list-scroll-hint"
            aria-label="Scroll to see more tasks"
            onClick={scrollTowardBottom}
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </DashboardCard>
  );
};

export default TaskListCard;
