import { BrainCircuit, Layers3, RefreshCw, TrendingUp } from "lucide-react";

import { aiCapacityFromCategory, AiCapacityId, classifySkillUseTrendFromNetIncreasePercentage, UseTrendId } from "@/pages/Analysis/lib/skillAxes";
import type { SkillEvidence } from "@/pages/Skills/lib/skillProfile";

type SkillFutureSummaryProps = {
  evidence: SkillEvidence[];
};

const SkillFutureSummary = ({ evidence }: SkillFutureSummaryProps) => {
  const groups = [
    {
      id: "increase",
      title: "Worth developing further",
      description: "Skills that employers expect to use more by 2030.",
      icon: TrendingUp,
      className: "skills-direction-card--blue",
      skills: evidence.filter(
        ({ skill }) =>
          typeof skill.future_net_increase_2025_2030 === "number" &&
          classifySkillUseTrendFromNetIncreasePercentage(
            skill.future_net_increase_2025_2030,
          ) === UseTrendId.Increasing,
      ),
    },
    {
      id: "stable",
      title: "Foundations to maintain",
      description: "Skills expected to remain useful as work changes.",
      icon: Layers3,
      className: "skills-direction-card--pink",
      skills: evidence.filter(
        ({ skill }) =>
          typeof skill.future_net_increase_2025_2030 === "number" &&
          classifySkillUseTrendFromNetIncreasePercentage(
            skill.future_net_increase_2025_2030,
          ) === UseTrendId.Stable,
      ),
    },
    {
      id: "ai",
      title: "Learn to use alongside AI",
      description: "Skills whose routine parts show moderate or high GenAI capacity.",
      icon: BrainCircuit,
      className: "skills-direction-card--lilac",
      skills: evidence.filter(({ skill }) => {
        const capacity = aiCapacityFromCategory(skill.genai_substitution_capacity_category);
        return capacity === AiCapacityId.Moderate || capacity === AiCapacityId.High;
      }),
    },
    {
      id: "adapt",
      title: "Watch and adapt",
      description: "Skills whose use may decrease or change shape by 2030.",
      icon: RefreshCw,
      className: "skills-direction-card--brown",
      skills: evidence.filter(
        ({ skill }) =>
          typeof skill.future_net_increase_2025_2030 === "number" &&
          classifySkillUseTrendFromNetIncreasePercentage(
            skill.future_net_increase_2025_2030,
          ) === UseTrendId.Decreasing,
      ),
    },
  ].filter((group) => group.skills.length > 0);

  if (groups.length === 0) return null;

  return (
    <section>
      <p className="skills-kicker">Your choice, not a verdict</p>
      <h2 className="mt-1 text-2xl font-semibold text-[#2f2430]">What you could consider next</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-[#7f7280]">
        These directions combine evidence from your tasks with the WEF future-use and GenAI
        reference fields. A skill can appear in more than one direction.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <article key={group.id} className={`skills-direction-card ${group.className}`}>
              <div className="flex items-start gap-3">
                <span className="skills-direction-icon">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-[#2f2430]">{group.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#7f7280]">{group.description}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.skills.map(({ skill }) => (
                  <span key={skill.wef_skill_id} className="skills-direction-chip">
                    {skill.core_skill}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default SkillFutureSummary;
