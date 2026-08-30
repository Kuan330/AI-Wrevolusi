import { Button } from "@/components/ui/button";
import DashboardCard, { type TitleTone } from "@/pages/Dashboard/components/DashboardCard";
import TaskList from "@/pages/Dashboard/components/TaskList";
import type { TaskBandId } from "@/pages/Dashboard/lib/taskBands";
import type { ProfileTask } from "@/pages/WorkProfile/types";

type TaskListCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  titleTone?: TitleTone | null;
  tasks: ProfileTask[];
  activeBand: TaskBandId | null;
  highlightedIds: string[];
  onClear?: () => void;
};

const TaskListCard = ({
  eyebrow,
  title,
  description,
  titleTone,
  tasks,
  activeBand,
  highlightedIds,
  onClear,
}: TaskListCardProps) => {
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
      <div className="dashboard-list-scroll">
        <TaskList tasks={tasks} activeBand={activeBand} highlightedIds={highlightedIds} />
      </div>
    </DashboardCard>
  );
};

export default TaskListCard;
