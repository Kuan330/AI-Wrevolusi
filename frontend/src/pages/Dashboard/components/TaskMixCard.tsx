import { TASK_BANDS, type TaskBandId } from "@/pages/Dashboard/lib/taskBands";
import DashboardCard from "@/pages/Dashboard/components/DashboardCard";
import TaskMixPie from "@/pages/Dashboard/components/TaskMixPie";

type TaskMixCardProps = {
  counts: Record<TaskBandId, number>;
  activeBand: TaskBandId | null;
  taskCount: number;
  onSelectBand: (band: TaskBandId | null) => void;
};

const TaskMixCard = ({ counts, activeBand, taskCount, onSelectBand }: TaskMixCardProps) => {
  const activeMeta = activeBand ? TASK_BANDS.find((band) => band.id === activeBand) : null;

  return (
    <DashboardCard
      id="capabilities"
      className="dashboard-overview__pie"
      eyebrow="Your tasks"
      title="How these may change"
      action={
        <p className="shrink-0 text-xs text-[#7f7280]">
          {activeMeta ? `${activeMeta.label} · ${counts[activeMeta.id]}` : `${taskCount} tasks`}
        </p>
      }
    >
      <TaskMixPie counts={counts} active={activeBand} onSelect={onSelectBand} />
    </DashboardCard>
  );
};

export default TaskMixCard;
