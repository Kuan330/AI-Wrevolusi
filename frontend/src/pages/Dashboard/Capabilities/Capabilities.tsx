import { useMemo, useState } from "react";

import SkillBubbleChart from "@/pages/Dashboard/Capabilities/components/SkillBubbleChart";
import { skillsForTask } from "@/pages/Dashboard/Capabilities/matchSkills";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { WefSkill } from "@/types/reference";

type CapabilitiesSectionProps = {
  tasks: ProfileTask[];
  skills: WefSkill[];
  onHighlightTasks: (taskIds: string[]) => void;
};

const CapabilitiesSection = ({ tasks, skills, onHighlightTasks }: CapabilitiesSectionProps) => {
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);

  const { litSkillIds, tasksBySkill } = useMemo(() => {
    const linked: Record<number, ProfileTask[]> = {};
    for (const task of tasks) {
      for (const skill of skillsForTask(task.wording, skills)) {
        linked[skill.wef_skill_id] = [...(linked[skill.wef_skill_id] ?? []), task];
      }
    }
    return {
      litSkillIds: Object.keys(linked).map(Number),
      tasksBySkill: linked,
    };
  }, [skills, tasks]);

  const selectSkill = (skillId: number | null) => {
    setSelectedSkillId(skillId);
    onHighlightTasks(skillId ? (tasksBySkill[skillId] ?? []).map((task) => task.id) : []);
  };

  return (
    <section id="capabilities" className="scroll-mt-24 rounded-2xl border bg-card p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your capabilities</p>
      <h2 className="mt-1 text-xl font-semibold">Where your skills sit</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Colour is GenAI substitution capacity. Size is how many of your tasks use that skill. Click a point to see those tasks.
      </p>
      <div className="mt-5">
        <SkillBubbleChart
          skills={skills}
          litSkillIds={litSkillIds}
          tasksBySkill={tasksBySkill}
          selectedSkillId={selectedSkillId}
          onSelectSkill={selectSkill}
        />
      </div>
    </section>
  );
};

export default CapabilitiesSection;
