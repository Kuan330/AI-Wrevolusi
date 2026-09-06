import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SkillEvidence } from "@/pages/Skills/lib/skillProfile";
import type { WefSkill } from "@/types/reference";

type SkillMapOverviewProps = {
  skills: WefSkill[];
  evidence: SkillEvidence[];
  taskCount: number;
  selectedSkillId: number | null;
  onSelectSkill: (skillId: number) => void;
};

const SkillMapOverview = ({
  skills,
  evidence,
  taskCount,
  selectedSkillId,
  onSelectSkill,
}: SkillMapOverviewProps) => {
  const matchedSkillIds = new Set(evidence.map(({ skill }) => skill.wef_skill_id));

  return (
    <section className="skills-glass-card overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(18rem,0.78fr)_minmax(32rem,1.35fr)]">
        <div className="skills-map-copy flex flex-col justify-center p-6 lg:p-8">
          <p className="skills-kicker">Your skill map</p>
          <h2 className="mt-2 max-w-[13ch] text-3xl font-semibold leading-tight text-[#2f2430] lg:text-[2.6rem]">
            See where your work sits across 26 future skills.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#574a55]">
            These 26 skills come from the World Economic Forum&apos;s Future of Jobs
            framework. We use this shared language to connect the tasks you perform with
            skills employers discuss when planning work, hiring and learning.
          </p>

          <div className="mt-5 rounded-2xl border border-white/80 bg-white/55 p-4">
            <p className="text-sm font-medium text-[#3d5f7a]">Why this framework?</p>
            <p className="mt-1 text-xs leading-5 text-[#7f7280]">
              It covers cognitive, technology, people, management, self-efficacy and other
              ways people contribute at work.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="skills-summary-stat">
              <strong>{evidence.length} of {skills.length || 26}</strong>
              <span>skills identified</span>
            </div>
            <div className="skills-summary-stat">
              <strong>{taskCount}</strong>
              <span>confirmed tasks analysed</span>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-[#7f7280]">
            This is evidence found in your current tasks, not a test of your ability. A skill
            that is not highlighted may simply not have appeared in the tasks you entered.
          </p>
        </div>

        <div className="skills-cloud-panel p-5 sm:p-6 lg:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7f7280]">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#4f91ba]" />
              Identified from your tasks
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full border border-[#d6e4f0] bg-white/80" />
              Other framework skills
            </span>
          </div>

          <div className="skills-cloud" aria-label="All 26 WEF skills">
            {skills.map((skill) => {
              const matched = matchedSkillIds.has(skill.wef_skill_id);
              const active = selectedSkillId === skill.wef_skill_id;

              return (
                <button
                  key={skill.wef_skill_id}
                  type="button"
                  className={cn(
                    "skills-cloud-item",
                    matched && "is-matched",
                    active && "is-active",
                  )}
                  aria-pressed={matched ? active : undefined}
                  disabled={!matched}
                  title={
                    matched
                      ? "View the tasks that support this skill"
                      : "Not identified from your current tasks"
                  }
                  onClick={() => {
                    if (matched) onSelectSkill(skill.wef_skill_id);
                  }}
                >
                  {matched ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
                  <span>{skill.core_skill}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SkillMapOverview;
