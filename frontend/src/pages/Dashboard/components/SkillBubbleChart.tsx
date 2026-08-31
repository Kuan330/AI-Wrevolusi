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

type BubbleItem = {
  skill: WefSkill;
  count: number;
  size: number;
  left: number;
  top: number;
  color: string;
  capacityIndex: number;
  trendIndex: number;
};

const cellOffsets = (count: number) => {
  if (count <= 1) return [{ dx: 0, dy: 0 }];
  if (count === 2) {
    return [
      { dx: -0.34, dy: 0 },
      { dx: 0.34, dy: 0 },
    ];
  }
  if (count === 3) {
    return [
      { dx: 0, dy: -0.3 },
      { dx: -0.32, dy: 0.24 },
      { dx: 0.32, dy: 0.24 },
    ];
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      dx: ((col + 0.5) / cols - 0.5) * 0.72,
      dy: ((row + 0.5) / rows - 0.5) * 0.72,
    };
  });
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
    const colWidth = 100 / AI_CAPACITIES.length;
    const rowHeight = 100 / USE_TRENDS.length;

    const draft = litSkillIds
      .map((id) => skills.find((skill) => skill.wef_skill_id === id))
      .filter((skill): skill is WefSkill => Boolean(skill))
      .map((skill) => {
        const capacity = aiCapacityFromCategory(skill.genai_substitution_capacity_category);
        if (!capacity) return null;
        const trend = useTrendFromNetIncrease(skill.future_net_increase_2025_2030);
        const count = tasksBySkill[skill.wef_skill_id]?.length ?? 0;
        const capacityIndex = AI_CAPACITIES.findIndex((item) => item.id === capacity);
        const trendIndex = USE_TRENDS.findIndex((item) => item.id === trend);
        return {
          skill,
          count,
          size: 14 + (count / max) * 10,
          capacityIndex,
          trendIndex,
          color: colorForSkillId(skill.wef_skill_id),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.skill.wef_skill_id - b.skill.wef_skill_id);

    const grouped = new Map<string, typeof draft>();
    for (const item of draft) {
      const key = `${item.capacityIndex}-${item.trendIndex}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(item);
      grouped.set(key, bucket);
    }

    const positioned: BubbleItem[] = [];
    for (const group of grouped.values()) {
      const offsets = cellOffsets(group.length);
      group.forEach((item, index) => {
        const offset = offsets[index] ?? { dx: 0, dy: 0 };
        positioned.push({
          skill: item.skill,
          count: item.count,
          size: item.size,
          color: item.color,
          capacityIndex: item.capacityIndex,
          trendIndex: item.trendIndex,
          left: (item.capacityIndex + 0.5) * colWidth + offset.dx * colWidth,
          top: (item.trendIndex + 0.5) * rowHeight + offset.dy * rowHeight,
        });
      });
    }

    return positioned;
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
