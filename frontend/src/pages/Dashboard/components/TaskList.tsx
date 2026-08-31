import { Badge } from "@/components/ui/badge";
import { GradientBar } from "@/components/ui/gradient-bar";
import EmptyState from "@/components/common/EmptyState";
import { resolveTaskBand, taskBandMeta, type TaskBandId } from "@/pages/Dashboard/lib/taskBands";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { WefSkill } from "@/types/reference";

type TaskListProps = {
  tasks: ProfileTask[];
  skills: WefSkill[];
  activeBand: TaskBandId | null;
  highlightedIds: string[];
  selectedSkillId?: number | null;
  onSelectSkill?: (skillId: number | null) => void;
};

const exposureScore = (task: ProfileTask) =>
  typeof task.score2025 === "number" ? task.score2025 : -1;

const skillConfidenceLabel = (task: ProfileTask, skillId: number | null | undefined) => {
  if (!skillId) return null;
  const prediction = task.skillPredictions?.find((item) => item.wefSkillId === skillId);
  if (!prediction) return null;
  return prediction.confidence === "identified" ? "Identified" : "Possible";
};

const TaskList = ({
  tasks,
  skills,
  activeBand,
  highlightedIds,
  selectedSkillId,
  onSelectSkill,
}: TaskListProps) => {
  if (tasks.length === 0) {
    return (
      <EmptyState title="No tasks yet" message="Add tasks in your profile to see them here." />
    );
  }

  const visible = tasks
    .filter((task) => {
      if (!activeBand) return true;
      return resolveTaskBand(task) === activeBand;
    })
    .sort((a, b) => exposureScore(b) - exposureScore(a));

  if (visible.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/80 p-4 text-sm text-[#7f7280]">
        No tasks in this group.
      </p>
    );
  }

  const skillName = (wefSkillId: number) =>
    skills.find((skill) => skill.wef_skill_id === wefSkillId)?.core_skill ?? `Skill ${wefSkillId}`;

  return (
    <div className="space-y-2.5">
      {visible.map((task) => {
        const band = taskBandMeta(resolveTaskBand(task));
        const highlighted = highlightedIds.includes(task.id);
        const skillLabel = skillConfidenceLabel(task, selectedSkillId);
        const predictions = task.skillPredictions ?? [];

        return (
          <article
            key={task.id}
            className={`dashboard-task-item ${highlighted ? "is-highlighted" : ""}`}
          >
            <div className="flex gap-3">
              <span
                className="w-1 shrink-0 rounded-full"
                style={{ background: band?.color ?? "#C9C2C7" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-6 text-[#2f2430]">{task.wording}</p>
                  {band ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <Badge
                        variant="outline"
                        className="rounded-full border-0 px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: `${band.color}55`, color: band.ink }}
                      >
                        {band.label}
                      </Badge>
                      {task.scoreSource === "estimated" ? (
                        <span className="text-[11px] text-[#7f7280]">Estimated</span>
                      ) : null}
                      {skillLabel ? (
                        <span className="text-[11px] font-medium text-[#4f91ba]">{skillLabel}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-[#7f7280]">Not scored yet</span>
                  )}
                </div>
                {typeof task.score2025 === "number" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <GradientBar value={task.score2025 * 100} className="h-1.5" />
                    <span className="w-10 text-right text-xs tabular-nums text-[#7f7280]">
                      {task.score2025.toFixed(2)}
                    </span>
                  </div>
                ) : null}
                {predictions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {predictions.map((prediction) => {
                      const selected = selectedSkillId === prediction.wefSkillId;
                      return (
                        <button
                          key={`${task.id}-${prediction.skillId}`}
                          type="button"
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            selected
                              ? "border-[#4f91ba] bg-[#4f91ba]/10 text-[#2f5f80]"
                              : "border-white/80 bg-white/70 text-[#574a55] hover:border-[#4f91ba]/40"
                          }`}
                          onClick={() =>
                            onSelectSkill?.(selected ? null : prediction.wefSkillId)
                          }
                        >
                          {skillName(prediction.wefSkillId)}
                          <span className="ml-1 text-[#7f7280]">
                            · {prediction.confidence === "identified" ? "Identified" : "Possible"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default TaskList;
