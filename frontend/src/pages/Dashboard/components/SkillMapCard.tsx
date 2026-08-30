import { Button } from "@/components/ui/button";
import DashboardCard from "@/pages/Dashboard/components/DashboardCard";
import SkillBubbleChart from "@/pages/Dashboard/components/SkillBubbleChart";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { WefSkill } from "@/types/reference";

type SkillMapCardProps = {
  skills: WefSkill[];
  litSkillIds: number[];
  tasksBySkill: Record<number, ProfileTask[]>;
  selectedSkillId: number | null;
  onSelectSkill: (skillId: number | null) => void;
};

const SkillMapCard = ({
  skills,
  litSkillIds,
  tasksBySkill,
  selectedSkillId,
  onSelectSkill,
}: SkillMapCardProps) => {
  return (
    <DashboardCard
      className="dashboard-overview__bubble"
      eyebrow="Where your skills sit"
      description={`${litSkillIds.length} skills · click a bubble to filter tasks`}
      action={
        selectedSkillId ? (
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-xs font-medium text-[#4f91ba]"
            onClick={() => onSelectSkill(null)}
          >
            Clear skill
          </Button>
        ) : null
      }
      contentClassName="pt-1"
    >
      <SkillBubbleChart
        skills={skills}
        litSkillIds={litSkillIds}
        tasksBySkill={tasksBySkill}
        selectedSkillId={selectedSkillId}
        onSelectSkill={onSelectSkill}
      />
    </DashboardCard>
  );
};

export default SkillMapCard;
