import type { ComponentProps } from "react";
import { Check, ChevronRight, Sparkles, TrendingUp, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AI_CAPACITIES,
  aiCapacityFromCategory,
} from "@/pages/Analysis/lib/skillAxes";
import type { SkillEvidence } from "@/pages/Skills/lib/skillProfile";
import { signedPoints } from "@/pages/Skills/lib/skillProfile";
import SkillOutlookInfo from "@/pages/Skills/components/SkillOutlookInfo";

type SkillDetailWorkspaceProps = {
  evidence: SkillEvidence[];
  selectedSkillId: number | null;
  onSelectSkill: (skillId: number) => void;
};

const capacityExplanation = (category: string | null): string => {
  if (category === "Very Low-Low" || category === "Low") {
    return "Research indicates limited GenAI capacity to substitute the central activities associated with this skill.";
  }
  if (category === "Low-Moderate" || category === "Moderate") {
    return "GenAI may support some routine parts, while context, judgement and responsibility still matter.";
  }
  if (category === "Moderate-High") {
    return "GenAI may support more of the routine activities associated with this skill, making effective use alongside AI increasingly relevant.";
  }
  return "The WEF reference does not show a GenAI capacity category for this skill.";
};

const trendExplanation = (change: number | null): string => {
  if (typeof change !== "number") {
    return "There is not enough reference data to describe how use of this skill may change.";
  }
  if (change > 0) {
    return "More employers expect use of this skill to increase than decrease by 2030.";
  }
  if (change === 0) {
    return "Employer expectations for increasing and decreasing use of this skill are balanced.";
  }
  return "More employers expect use of this skill to decrease than increase by 2030.";
};

const skillPosition = (
  importance: number | null | undefined,
  change: number | null,
) => {
  if (typeof importance !== "number" || typeof change !== "number") {
    return {
      label: "Position not available",
      explanation: "More reference data is needed to position this skill.",
    };
  }

  const widelyValued = importance >= 50;
  const growing = change > 20;

  if (widelyValued && growing) {
    return {
      label: "Established and growing",
      explanation:
        "This skill is already widely valued and expected to grow towards 2030.",
    };
  }
  if (growing) {
    return {
      label: "Emerging opportunity",
      explanation:
        "This skill is less widely considered core today, but employers expect its use to grow.",
    };
  }
  if (widelyValued) {
    return {
      label: "Established and evolving",
      explanation:
        "This skill is widely valued today, while its future use may be changing.",
    };
  }
  return {
    label: "Context dependent",
    explanation:
      "Its value may depend more on your role, industry and how it combines with other skills.",
  };
};

const SkillDetailWorkspace = (props: SkillDetailWorkspaceProps) => {
  const { evidence, selectedSkillId, onSelectSkill } = props;
  const selected =
    evidence.find(({ skill }) => skill.wef_skill_id === selectedSkillId) ??
    evidence[0];

  if (!selected) {
    return (
      <section className="skills-glass-card p-6 text-center sm:p-10">
        <h2 className="text-xl font-semibold text-[#2f2430]">
          No skills identified yet
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#7f7280]">
          No skills are connected to the current confirmed tasks yet. You can
          return to your tasks, add more detail, and analyse them again.
        </p>
      </section>
    );
  }

  const { skill, tasks } = selected;
  const capacity = AI_CAPACITIES.find(
    ({ id }) =>
      id === aiCapacityFromCategory(skill.genai_substitution_capacity_category),
  );
  const position = skillPosition(
    skill.core_skill_importance_2025_pct,
    skill.future_net_increase_2025_2030,
  );

  const usersProps2 = {
    className: "size-5 text-[#4f91ba]",
    "aria-hidden": true,
  } satisfies Partial<ComponentProps<typeof Users>>;
  const trendingUpProps3 = {
    className: "size-5 text-[#4f91ba]",
    "aria-hidden": true,
  } satisfies Partial<ComponentProps<typeof TrendingUp>>;
  const sparklesProps4 = {
    className: "size-5 text-[#c99589]",
    "aria-hidden": true,
  } satisfies Partial<ComponentProps<typeof Sparkles>>;
  return (
    <section id="identified-skills" className="scroll-mt-24">
      <div className="mb-4">
        <p className="skills-kicker">Evidence from your work</p>
        <h2 className="mt-1 text-2xl font-semibold text-[#2f2430]">
          Your identified skills
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#7f7280]">
          Choose a skill to see the tasks connected to it, then explore what
          external research suggests about its future use.
        </p>
      </div>

      <div className="skills-workspace">
        <aside
          className="skills-glass-card skills-navigation p-3"
          aria-label="Identified skills"
        >
          <p className="px-3 pb-2 pt-1 text-xs leading-5 text-[#7f7280]">
            <strong className="text-[#3d5f7a]">{evidence.length} skills</strong>{" "}
            reflected across your confirmed tasks
          </p>
          <div className="skills-navigation-list">
            {evidence.map((item) => {
              const active = item.skill.wef_skill_id === skill.wef_skill_id;
              const chevronRightProps1 = {
                className: "mt-1 size-4 shrink-0 text-[#7f7280]",
                "aria-hidden": true,
              } satisfies Partial<ComponentProps<typeof ChevronRight>>;
              return (
                <button
                  key={item.skill.wef_skill_id}
                  type="button"
                  className={cn(
                    "skills-navigation-item",
                    active && "is-active",
                  )}
                  aria-pressed={active}
                  onClick={() => onSelectSkill(item.skill.wef_skill_id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-5 text-[#2f2430]">
                      {item.skill.core_skill}
                    </span>
                    <span className="mt-1 block text-xs text-[#7f7280]">
                      Found in {item.tasks.length} confirmed{" "}
                      {item.tasks.length === 1 ? "task" : "tasks"}
                    </span>
                  </span>
                  <ChevronRight {...chevronRightProps1} />
                </button>
              );
            })}
          </div>
        </aside>

        <article
          className="skills-glass-card p-5 sm:p-6 lg:p-7"
          aria-live="polite"
        >
          <div>
            <p className="skills-kicker">Selected skill</p>
            <h3 className="mt-1 text-2xl font-semibold leading-tight text-[#2f2430]">
              {skill.core_skill}
            </h3>
            <p className="mt-1 text-xs text-[#7f7280]">
              {skill.wef_skill_group ?? "WEF core skill"} · identified from{" "}
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>

          <div className="skills-evidence-panel mt-6">
            <p className="text-sm font-medium text-[#2f2430]">
              Tasks connected to this skill
            </p>
            <p className="mt-1 text-xs leading-5 text-[#7f7280]">
              These are the confirmed tasks currently linked to this result.
            </p>
            <ul className="mt-3 space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="skills-evidence-task">
                  <Check
                    {...({
                      className: "mt-0.5 size-4 shrink-0 text-[#4f91ba]",
                      "aria-hidden": true,
                    } satisfies Partial<ComponentProps<typeof Check>>)}
                  />
                  <span>{task.wording}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="skills-outlook-heading">
            <div>
              <p className="skills-kicker">External outlook</p>
              <h4 className="mt-1 text-base font-semibold text-[#2f2430]">
                What external research suggests
              </h4>
            </div>
            <SkillOutlookInfo />
          </div>

          <div className="skills-position-callout">
            <div>
              <span>{position.label}</span>
              <p>{position.explanation}</p>
            </div>
            <small>
              Position based on current importance and future outlook.
            </small>
          </div>

          <div className="skills-outlook-grid">
            <div className="skills-insight-card">
              <Users {...usersProps2} />
              <div className="min-w-0 flex-1">
                <p className="skills-insight-card__label">Valued today</p>
                <p className="skills-insight-card__value">
                  {typeof skill.core_skill_importance_2025_pct === "number"
                    ? `${skill.core_skill_importance_2025_pct}%`
                    : "Not available"}
                </p>
                <p className="skills-insight-card__meta">
                  of surveyed employers
                </p>
                <p className="skills-insight-card__description">
                  Consider this a core skill for their workforce in 2025.
                </p>
              </div>
            </div>

            <div className="skills-insight-card">
              <TrendingUp {...trendingUpProps3} />
              <div className="min-w-0 flex-1">
                <p className="skills-insight-card__label">Future use by 2030</p>
                <p className="skills-insight-card__value">
                  {signedPoints(skill.future_net_increase_2025_2030)}
                </p>
                <p className="skills-insight-card__meta">
                  {skill.future_trend_category ?? "Not classified"} · net
                  employer outlook
                </p>
                <p className="skills-insight-card__description">
                  {trendExplanation(skill.future_net_increase_2025_2030)}
                </p>
              </div>
            </div>

            <div className="skills-insight-card">
              <Sparkles {...sparklesProps4} />
              <div className="min-w-0 flex-1">
                <p className="skills-insight-card__label">Working with GenAI</p>
                <p className="skills-insight-card__value skills-insight-card__value--text">
                  {capacity?.label ??
                    skill.genai_substitution_capacity_category ??
                    "Not shown"}
                </p>
                <p className="skills-insight-card__meta">
                  substitution capacity
                </p>
                <p className="skills-insight-card__description">
                  {capacityExplanation(
                    skill.genai_substitution_capacity_category,
                  )}
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};

export default SkillDetailWorkspace;
