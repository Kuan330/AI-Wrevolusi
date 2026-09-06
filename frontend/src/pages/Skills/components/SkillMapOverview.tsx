import { cn } from "@/lib/utils";
import SkillFrameworkInfo from "@/pages/Skills/components/SkillFrameworkInfo";
import type { SkillEvidence } from "@/pages/Skills/lib/skillProfile";
import type { WefSkill } from "@/types/reference";

type SkillMapOverviewProps = {
  skills: WefSkill[];
  evidence: SkillEvidence[];
  taskCount: number;
  selectedSkillId: number | null;
  onSelectSkill: (skillId: number) => void;
};

const CLOUD_SKILL_ORDER = [
  2, 3, 4,
  5, 6, 7, 8,
  10, 11, 1, 12,
  13, 14, 9, 15,
  17, 18, 16, 19,
  20, 21, 22, 23,
  24, 25, 26,
] as const;

const CLOUD_ROW_LENGTHS = [3, 4, 4, 4, 4, 4, 3] as const;
const CLOUD_SKILL_COUNT = CLOUD_ROW_LENGTHS.reduce((total, length) => total + length, 0);

const SkillMapOverview = ({
  skills,
  evidence,
  taskCount,
  selectedSkillId,
  onSelectSkill,
}: SkillMapOverviewProps) => {
  const matchedSkillIds = new Set(evidence.map(({ skill }) => skill.wef_skill_id));
  const cloudOrder = new Map<number, number>(
    CLOUD_SKILL_ORDER.map((skillId, index) => [skillId, index]),
  );
  const orderedSkills = [...skills].sort(
    (left, right) =>
      (cloudOrder.get(left.wef_skill_id) ?? Number.MAX_SAFE_INTEGER) -
      (cloudOrder.get(right.wef_skill_id) ?? Number.MAX_SAFE_INTEGER),
  );
  const cloudRows = CLOUD_ROW_LENGTHS.map((rowLength, rowIndex) => {
    const start = CLOUD_ROW_LENGTHS.slice(0, rowIndex).reduce(
      (total, length) => total + length,
      0,
    );
    return orderedSkills.slice(start, start + rowLength);
  });
  const overflowSkills = orderedSkills.slice(CLOUD_SKILL_COUNT);
  const rowsToRender = overflowSkills.length > 0 ? [...cloudRows, overflowSkills] : cloudRows;

  const renderSkill = (skill: WefSkill) => {
    const matched = matchedSkillIds.has(skill.wef_skill_id);
    const active = selectedSkillId === skill.wef_skill_id;

    return (
      <button
        key={skill.wef_skill_id}
        type="button"
        className={cn(
          "skills-map-skill",
          matched && "is-matched",
          active && "is-active",
        )}
        aria-pressed={matched ? active : undefined}
        disabled={!matched}
        title={
          matched
            ? "View the tasks that support this skill"
            : "Not reflected in your current tasks"
        }
        onClick={() => {
          if (matched) onSelectSkill(skill.wef_skill_id);
        }}
      >
        <span>{skill.core_skill}</span>
      </button>
    );
  };

  return (
    <section className="skills-glass-card">
      <div className="skills-map-layout">
        <aside className="skills-map-sidebar">
          <p className="skills-kicker">Your skill map</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#2f2430] lg:text-[2.2rem]">
            See the skills reflected in your work.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#574a55]">
            We compare your confirmed tasks with the World Economic Forum&apos;s 26 core
            skills. Skills supported by the work you shared are highlighted.
          </p>

          <div className="skills-map-summary" aria-label="Skill map summary">
            <span>
              <strong>{evidence.length} of {skills.length || 26}</strong>
              <small>skills reflected</small>
            </span>
            <span className="skills-map-summary__divider" aria-hidden />
            <span>
              <strong>{taskCount}</strong>
              <small>confirmed {taskCount === 1 ? "task" : "tasks"}</small>
            </span>
          </div>

          <div className="skills-map-about">
            <span>Why these 26 skills?</span>
            <SkillFrameworkInfo />
          </div>

          <p className="skills-map-note">
            Not highlighted does not mean you lack a skill. It may simply not appear in the
            tasks you shared.
          </p>
        </aside>

        <div className="skills-map-visual">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7f7280]">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#4f91ba]" />
              Reflected in your tasks
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full border border-[#d6e4f0] bg-white/80" />
              Other framework skills
            </span>
          </div>

          <div className="skills-focus-cloud" aria-label="All 26 WEF skills">
            <div className="skills-focus-cloud__glow" aria-hidden />
            <div className="skills-focus-cloud__shape">
              {rowsToRender.map((row, rowIndex) => (
                <div key={rowIndex} className="skills-focus-cloud__row">
                  {row.map(renderSkill)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SkillMapOverview;
