import { Check, ChevronRight, Sparkles, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AI_CAPACITIES,
  aiCapacityFromCategory,
  classifySkillUseTrendFromNetIncreasePercentage,
  USE_TRENDS,
} from "@/pages/Analysis/lib/skillAxes";
import type { SkillEvidence } from "@/pages/Skills/lib/skillProfile";
import { signedPercentage } from "@/pages/Skills/lib/skillProfile";

type SkillDetailWorkspaceProps = {
  evidence: SkillEvidence[];
  selectedSkillId: number | null;
  onSelectSkill: (skillId: number) => void;
};

const capacityExplanation = (category: string | null): string => {
  if (category === "Very Low-Low" || category === "Low") {
    return "GenAI is expected to have limited capacity to substitute the core parts of this skill group.";
  }
  if (category === "Low-Moderate" || category === "Moderate") {
    return "GenAI may support some routine parts, while context, judgement and responsibility still matter.";
  }
  if (category === "Moderate-High") {
    return "GenAI may support more of the routine work in this skill group, making effective use alongside AI increasingly relevant.";
  }
  return "The WEF reference does not show a GenAI capacity category for this skill.";
};

const trendExplanation = (change: number | null): string => {
  if (typeof change !== "number") {
    return "There is not enough reference data to describe how use of this skill may change.";
  }
  if (change > 20) {
    return "Employers expect use of this skill to increase, so it may be worth keeping visible and developing further.";
  }
  if (change >= 0) {
    return "This skill is expected to remain a useful foundation as work changes.";
  }
  return "How this skill is used may change, so combining it with growing or digital skills may be useful.";
};

const SkillDetailWorkspace = ({
  evidence,
  selectedSkillId,
  onSelectSkill,
}: SkillDetailWorkspaceProps) => {
  const selected =
    evidence.find(({ skill }) => skill.wef_skill_id === selectedSkillId) ?? evidence[0];

  if (!selected) {
    return (
      <section className="skills-glass-card p-6 text-center sm:p-10">
        <h2 className="text-xl font-semibold text-[#2f2430]">No skills identified yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#7f7280]">
          None of the current task wording matched the available skill rules. You can return
          to your tasks, add more detail, and analyse them again.
        </p>
      </section>
    );
  }

  const { skill, tasks } = selected;
  const trend =
    typeof skill.future_net_increase_2025_2030 === "number"
      ? USE_TRENDS.find(
          ({ id }) =>
            id ===
            classifySkillUseTrendFromNetIncreasePercentage(
              skill.future_net_increase_2025_2030,
            ),
        )
      : null;
  const capacity = AI_CAPACITIES.find(
    ({ id }) => id === aiCapacityFromCategory(skill.genai_substitution_capacity_category),
  );

  return (
    <section id="identified-skills" className="scroll-mt-24">
      <div className="mb-4">
        <p className="skills-kicker">Evidence from your work</p>
        <h2 className="mt-1 text-2xl font-semibold text-[#2f2430]">Your identified skills</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#7f7280]">
          Choose a skill to see which tasks support it and what the reference data may mean
          for its future value.
        </p>
      </div>

      <div className="skills-workspace">
        <aside className="skills-glass-card skills-navigation p-3" aria-label="Identified skills">
          <p className="px-3 pb-2 pt-1 text-xs leading-5 text-[#7f7280]">
            <strong className="text-[#3d5f7a]">{evidence.length} skills</strong> · ordered by
            how often they appear across your tasks
          </p>
          <div className="skills-navigation-list">
            {evidence.map((item) => {
              const active = item.skill.wef_skill_id === skill.wef_skill_id;
              return (
                <button
                  key={item.skill.wef_skill_id}
                  type="button"
                  className={cn("skills-navigation-item", active && "is-active")}
                  aria-pressed={active}
                  onClick={() => onSelectSkill(item.skill.wef_skill_id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-5 text-[#2f2430]">
                      {item.skill.core_skill}
                    </span>
                    <span className="mt-1 block text-xs text-[#7f7280]">
                      {item.tasks.length} supporting {item.tasks.length === 1 ? "task" : "tasks"}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-[#7f7280]" aria-hidden />
                </button>
              );
            })}
          </div>
        </aside>

        <article className="skills-glass-card p-5 sm:p-6 lg:p-7" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="skills-kicker">Selected skill</p>
              <h3 className="mt-1 text-2xl font-semibold leading-tight text-[#2f2430]">
                {skill.core_skill}
              </h3>
              <p className="mt-1 text-xs text-[#7f7280]">
                {skill.wef_skill_group ?? "WEF core skill"} · identified from {tasks.length}{" "}
                {tasks.length === 1 ? "task" : "tasks"}
              </p>
            </div>
            <span className="skills-trend-badge">{trend?.label ?? "Not classified"}</span>
          </div>

          <div className="skills-evidence-panel mt-6">
            <p className="text-sm font-medium text-[#2f2430]">Why this skill appears</p>
            <p className="mt-1 text-xs leading-5 text-[#7f7280]">
              These confirmed tasks contain the evidence used for this match.
            </p>
            <ul className="mt-3 space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="skills-evidence-task">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#4f91ba]" aria-hidden />
                  <span>{task.wording}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="skills-insight-card">
              <TrendingUp className="size-5 text-[#4f91ba]" aria-hidden />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#7f7280]">
                  Future use, 2025–2030
                </p>
                <p className="mt-1 text-xl font-semibold text-[#3d5f7a]">
                  {signedPercentage(skill.future_net_increase_2025_2030)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#574a55]">
                  {trendExplanation(skill.future_net_increase_2025_2030)}
                </p>
              </div>
            </div>

            <div className="skills-insight-card">
              <Sparkles className="size-5 text-[#c99589]" aria-hidden />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#7f7280]">
                  GenAI substitution capacity
                </p>
                <p className="mt-1 text-base font-semibold text-[#3d5f7a]">
                  {capacity?.label ?? skill.genai_substitution_capacity_category ?? "Not shown"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#574a55]">
                  {capacityExplanation(skill.genai_substitution_capacity_category)}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-[#7f7280]">
            These figures describe global employer expectations and skill-group patterns.
            They do not measure your personal proficiency or predict whether your job will be
            replaced.
          </p>
        </article>
      </div>
    </section>
  );
};

export default SkillDetailWorkspace;
