import { useState } from "react";

import { Button } from "@/components/ui/button";
import CapabilityReviewDialog from "@/pages/Dashboard/components/CapabilityReviewDialog";
import DashboardCard from "@/pages/Dashboard/components/DashboardCard";
import SkillBubbleChart from "@/pages/Dashboard/components/SkillBubbleChart";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type {
  ConfirmedCapabilityProfile,
  ConfirmedTaskCapabilityRecognitionBatchResponse,
} from "@/types/capability";
import type { WefSkill } from "@/types/reference";

type SkillMapCardProps = {
  skills: WefSkill[];
  litSkillIds: number[];
  tasksBySkill: Record<number, ProfileTask[]>;
  selectedSkillId: number | null;
  onSelectSkill: (skillId: number | null) => void;
  tasks: ProfileTask[];
  recognition: ConfirmedTaskCapabilityRecognitionBatchResponse | null;
  recognitionStatus: "loading" | "model" | "fallback";
  confirmedProfile: ConfirmedCapabilityProfile | null;
  onSaveConfirmedProfile: (profile: ConfirmedCapabilityProfile) => void;
};

const SkillMapCard = ({
  skills,
  litSkillIds,
  tasksBySkill,
  selectedSkillId,
  onSelectSkill,
  tasks,
  recognition,
  recognitionStatus,
  confirmedProfile,
  onSaveConfirmedProfile,
}: SkillMapCardProps) => {
  const [reviewOpen, setReviewOpen] = useState(false);
  const confirmedCount = confirmedProfile?.capabilities.length ?? 0;
  const description = confirmedProfile
    ? `${confirmedCount} confirmed capabilities · review to update your evidence`
    : recognitionStatus === "loading"
      ? "Analysing confirmed tasks with the Epic 3 model…"
      : recognition
      ? `${litSkillIds.length} AI-assisted suggestions · review before later use`
      : `${litSkillIds.length} fallback matches · capability model unavailable`;

  return (
    <>
      <DashboardCard
        id="capabilities"
        className="dashboard-overview__bubble"
        eyebrow="Where your skills sit"
        description={description}
        action={
          <div className="flex items-center gap-1">
            {selectedSkillId ? (
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2 text-xs font-medium text-[#4f91ba]"
                onClick={() => onSelectSkill(null)}
              >
                Clear skill
              </Button>
            ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => setReviewOpen(true)}
          >
            Review capabilities
          </Button>
          </div>
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
      {reviewOpen ? (
        <CapabilityReviewDialog
          open
          tasks={tasks}
          recognition={recognition}
          savedProfile={confirmedProfile}
          onClose={() => setReviewOpen(false)}
          onSave={onSaveConfirmedProfile}
        />
      ) : null}
    </>
  );
};

export default SkillMapCard;
