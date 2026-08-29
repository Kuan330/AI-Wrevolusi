import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { bandFromScore, taskBandMeta } from "@/pages/Dashboard/AIExposure/taskBands";
import {
  AI_CAPACITIES,
  aiCapacityFromCategory,
  USE_TRENDS,
  useTrendFromNetIncrease,
  type AiCapacityId,
  type UseTrendId,
} from "@/pages/Dashboard/Capabilities/skillAxes";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { WefSkill } from "@/types/reference";

type SkillBubbleChartProps = {
  skills: WefSkill[];
  litSkillIds: number[];
  tasksBySkill: Record<number, ProfileTask[]>;
  onSelectSkill: (skillId: number | null) => void;
  selectedSkillId: number | null;
};

const capacityIndex = (id: AiCapacityId) => AI_CAPACITIES.findIndex((item) => item.id === id);
const trendIndex = (id: UseTrendId) => USE_TRENDS.findIndex((item) => item.id === id);

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
    const groups = new Map<string, number>();

    return litSkillIds
      .map((id) => skills.find((skill) => skill.wef_skill_id === id))
      .filter((skill): skill is WefSkill => Boolean(skill))
      .map((skill) => {
        const trend = useTrendFromNetIncrease(skill.future_net_increase_2025_2030);
        const capacity = aiCapacityFromCategory(skill.genai_substitution_capacity_category);
        const count = tasksBySkill[skill.wef_skill_id]?.length ?? 0;
        const key = `${trend}:${capacity ?? "none"}`;
        const index = groups.get(key) ?? 0;
        groups.set(key, index + 1);
        const angle = index * 1.7;
        const jitter = index * 6;
        return {
          skill,
          trend,
          capacity,
          count,
          size: 22 + (count / max) * 34,
          dx: Math.cos(angle) * jitter,
          dy: Math.sin(angle) * jitter,
        };
      });
  }, [litSkillIds, skills, tasksBySkill]);

  const selected = skills.find((skill) => skill.wef_skill_id === selectedSkillId) ?? null;
  const selectedTasks = selected ? (tasksBySkill[selected.wef_skill_id] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[#F4F7F4] p-4 md:p-6">
        <div className="mb-3 grid grid-cols-[5.5rem_repeat(4,minmax(0,1fr))] text-center text-[11px] text-[#4F91BA]">
          <span />
          {AI_CAPACITIES.map((item) => (
            <span key={item.id}>{item.label.replace(" capacity", "")}</span>
          ))}
        </div>
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
          <div className="flex flex-col justify-around py-2 text-xs font-medium text-[#4F91BA]">
            {USE_TRENDS.map((item) => (
              <span key={item.id}>{item.label.replace(" use", "")}</span>
            ))}
          </div>
          <div className="relative min-h-[280px] overflow-hidden rounded-2xl bg-white/80">
            {bubbles.map((item) => {
              if (!item.capacity) return null;
              const left = ((capacityIndex(item.capacity) + 0.5) / 4) * 100;
              const top = ((trendIndex(item.trend) + 0.5) / 3) * 100;
              const selectedDot = selectedSkillId === item.skill.wef_skill_id;
              const color = AI_CAPACITIES.find((capacity) => capacity.id === item.capacity)?.color ?? "#3D8FD6";
              return (
                <button
                  key={item.skill.wef_skill_id}
                  type="button"
                  className="absolute rounded-full shadow-sm transition hover:scale-105"
                  style={{
                    left: `calc(${left}% + ${item.dx}px)`,
                    top: `calc(${top}% + ${item.dy}px)`,
                    width: item.size,
                    height: item.size,
                    background: color,
                    transform: "translate(-50%, -50%)",
                    boxShadow: selectedDot ? `0 0 0 5px ${color}33` : undefined,
                    zIndex: selectedDot ? 2 : 1,
                  }}
                  title={`${item.skill.core_skill} · ${item.count} tasks`}
                  aria-label={`${item.skill.core_skill}, ${item.count} tasks`}
                  onClick={() => onSelectSkill(selectedDot ? null : item.skill.wef_skill_id)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {AI_CAPACITIES.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span>Larger points = more linked tasks. Click a point to see those tasks.</span>
      </div>

      {selected ? (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{selected.core_skill}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {USE_TRENDS.find((item) => item.id === useTrendFromNetIncrease(selected.future_net_increase_2025_2030))?.label}
                {" · "}
                {AI_CAPACITIES.find((item) => item.id === aiCapacityFromCategory(selected.genai_substitution_capacity_category))
                  ?.label ?? "AI capacity not shown"}
                {` · ${selectedTasks.length} tasks`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onSelectSkill(null)}>
              Close
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {selectedTasks.map((task) => {
              const band = taskBandMeta(bandFromScore(task.score2025));
              return (
                <li key={task.id} className="rounded-lg border px-3 py-2 text-sm">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: band?.color ?? "#C9C2C7" }} />
                  {task.wording}
                  {typeof task.score2025 === "number" ? (
                    <span className="ml-2 text-xs tabular-nums text-muted-foreground">{task.score2025.toFixed(2)}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default SkillBubbleChart;
