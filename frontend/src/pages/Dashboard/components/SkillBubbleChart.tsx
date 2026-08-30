import { useMemo, type CSSProperties } from "react";

import {
  AI_CAPACITIES,
  aiCapacityFromCategory,
  USE_TRENDS,
  useTrendFromNetIncrease,
} from "@/pages/Dashboard/lib/skillAxes";
import { GradientPill } from "@/components/ui/gradient-pill";
import {
  colorForSkillId,
  Palette,
  SKILL_SWATCH_LABEL,
  type SkillSwatch,
} from "@/pages/Dashboard/lib/palette";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { WefSkill } from "@/types/reference";

type SkillBubbleChartProps = {
  skills: WefSkill[];
  litSkillIds: number[];
  tasksBySkill: Record<number, ProfileTask[]>;
  onSelectSkill: (skillId: number | null) => void;
  selectedSkillId: number | null;
};

const SkillBubbleChart = ({
  skills,
  litSkillIds,
  tasksBySkill,
  onSelectSkill,
  selectedSkillId,
}: SkillBubbleChartProps) => {
  const bubbles = useMemo(() => {
    const counts = litSkillIds.map((id) => tasksBySkill[id]?.length ?? 0);
    const max = Math.max(...counts, 1);

    return litSkillIds
      .map((id) => skills.find((skill) => skill.wef_skill_id === id))
      .filter((skill): skill is WefSkill => Boolean(skill))
      .flatMap((skill) => {
        const capacity = aiCapacityFromCategory(skill.genai_substitution_capacity_category);
        if (!capacity) return [];
        const trend = useTrendFromNetIncrease(skill.future_net_increase_2025_2030);
        const count = tasksBySkill[skill.wef_skill_id]?.length ?? 0;
        const capacityIndex = AI_CAPACITIES.findIndex((item) => item.id === capacity);
        const trendIndex = USE_TRENDS.findIndex((item) => item.id === trend);
        return [
          {
            skill,
            count,
            size: 28 + (count / max) * 22,
            left: ((capacityIndex + 0.5) / AI_CAPACITIES.length) * 100,
            top: ((trendIndex + 0.5) / USE_TRENDS.length) * 100,
            color: colorForSkillId(skill.wef_skill_id),
          },
        ];
      });
  }, [litSkillIds, skills, tasksBySkill]);

  const presentLegend = useMemo(() => {
    const present = new Set(bubbles.map((item) => item.color));
    return (Object.entries(SKILL_SWATCH_LABEL) as [SkillSwatch, string][]).filter(([swatch]) =>
      present.has(swatch),
    );
  }, [bubbles]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col p-1">
        <div
          className="mb-1 grid grid-cols-[4.5rem_repeat(4,minmax(0,1fr))] text-center text-[10px] font-medium"
          style={{ color: Palette.Blue }}
        >
          <span />
          {AI_CAPACITIES.map((item) => (
            <span key={item.id} className="truncate px-0.5">
              {item.label.replace(" capacity", "")}
            </span>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[4.5rem_minmax(0,1fr)] gap-1.5">
          <div className="flex flex-col justify-around py-1 text-[11px] font-medium" style={{ color: Palette.Blue }}>
            {USE_TRENDS.map((item) => (
              <span key={item.id}>{item.label.replace(" use", "")}</span>
            ))}
          </div>
          <div className="relative min-h-0 flex-1 overflow-visible">
            {bubbles.map((item) => {
              const selected = selectedSkillId === item.skill.wef_skill_id;
              const dimmed = Boolean(selectedSkillId) && !selected;
              return (
                <button
                  key={item.skill.wef_skill_id}
                  type="button"
                  className={`dashboard-skill-bubble ${selected ? "is-selected" : ""} ${
                    dimmed ? "is-dimmed" : ""
                  }`}
                  style={
                    {
                      width: item.size,
                      height: item.size,
                      left: `${item.left}%`,
                      top: `${item.top}%`,
                      background: item.color,
                      "--bubble-color": item.color,
                    } as CSSProperties
                  }
                  aria-pressed={selected}
                  aria-label={`${item.skill.core_skill}, ${item.count} tasks`}
                  onClick={() => onSelectSkill(selected ? null : item.skill.wef_skill_id)}
                >
                  <GradientPill size="sm" className="dashboard-skill-bubble__label">
                    {item.skill.core_skill}
                  </GradientPill>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {presentLegend.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]" style={{ color: Palette.TextMuted }}>
          {presentLegend.map(([swatch, label]) => (
            <span key={swatch} className="inline-flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm"
                style={{ background: swatch }}
              />
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default SkillBubbleChart;
