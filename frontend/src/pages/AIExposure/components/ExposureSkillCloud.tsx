import { useMemo, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import type { SkillEvidence } from "@/pages/Skills/lib/skillProfile";
import SkillOutlookSummary from "@/pages/Skills/components/SkillOutlookSummary";
import {
  readLearningSkills,
  skillKey,
} from "@/pages/Skills/learningSkills";
import type { WefSkill } from "@/types/reference";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";

type ExposureSkillCloudProps = {
  skills: WefSkill[];
  evidence: SkillEvidence[];
  selectedSkillId: number | null;
  onSelectSkill: (skillId: number | null) => void;
};

const CLOUD_SKILL_ORDER = [
  2, 3, 4, 5, 6, 7, 8, 10, 11, 1, 12, 13, 14, 9, 15, 17, 18, 16, 19, 20, 21, 22,
  23, 24, 25, 26,
] as const;

/** Cloud silhouette — slightly wider middle for less side gap. */
const CLOUD_ROW_LENGTHS = [4, 5, 5, 5, 4, 3] as const;

const CLOUD_SKILL_COUNT = CLOUD_ROW_LENGTHS.reduce(
  (total, length) => total + length,
  0,
);

type ChipTone = "matched" | "learning" | "muted";

type SkillCloudChipProps = {
  skill: WefSkill;
  tone: ChipTone;
  active: boolean;
  onSelect: (skillId: number | null) => void;
  onLearningChanged: () => void;
};

/** Uncontrolled hover popover; dismiss on click/add until the pointer leaves. */
const SkillCloudChip = (props: SkillCloudChipProps) => {
  const { skill, tone, active, onSelect, onLearningChanged } = props;
  const actionsRef = useRef<Popover.Root.Actions | null>(null);
  const blockHoverUntilLeave = useRef(false);
  const matched = tone === "matched";

  const dismissOutlook = () => {
    blockHoverUntilLeave.current = true;
    actionsRef.current?.close();
  };

  const handleLearningChanged = () => {
    onLearningChanged();
    dismissOutlook();
  };

  return (
    <Popover.Root
      actionsRef={actionsRef}
      onOpenChange={(next, details) => {
        if (next && blockHoverUntilLeave.current) {
          details.cancel();
        }
      }}
    >
      <Popover.Trigger
        openOnHover
        delay={160}
        closeDelay={120}
        nativeButton
        type="button"
        className={cn(
          "exposure-skill-cloud__skill",
          tone === "matched" && "is-matched",
          tone === "learning" && "is-learning",
          tone === "muted" && "is-muted",
          active && "is-active",
        )}
        aria-pressed={matched ? active : undefined}
        aria-disabled={!matched}
        onPointerLeave={() => {
          blockHoverUntilLeave.current = false;
        }}
        onClick={() => {
          if (!matched) return;
          dismissOutlook();
          onSelect(active ? null : skill.wef_skill_id);
        }}
      >
        <span>{skill.core_skill}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          className="z-[80]"
        >
          <Popover.Popup
            initialFocus={false}
            style={{ background: PAGE_GRADIENT_CSS }}
            className="w-[min(42rem,calc(100vw-1.5rem))] max-h-[var(--available-height)] overflow-y-auto rounded-xl border border-[#dfd5e4] p-2.5 pb-2 shadow-xl outline-none"
          >
            <SkillOutlookSummary
              skill={skill}
              compact
              showAddToLearning
              onAddComplete={handleLearningChanged}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

function loadLearningSkillKeys(): Set<string> {
  try {
    return new Set((readLearningSkills() ?? []).map((skill) => skill.id));
  } catch {
    return new Set();
  }
}

const ExposureSkillCloud = (props: ExposureSkillCloudProps) => {
  const { skills, evidence, selectedSkillId, onSelectSkill } = props;
  const [learningRevision, setLearningRevision] = useState(0);
  const matchedSkillIds = useMemo(
    () => new Set(evidence.map(({ skill }) => skill.wef_skill_id)),
    [evidence],
  );
  // Skills on the Learning Resources list that are not in current task evidence.
  const learningKeys = useMemo(
    () => loadLearningSkillKeys(),
    [learningRevision],
  );
  const learningSkillIds = useMemo(() => {
    const ids = new Set<number>();
    for (const skill of skills) {
      if (
        learningKeys.has(skillKey(skill.core_skill)) &&
        !matchedSkillIds.has(skill.wef_skill_id)
      ) {
        ids.add(skill.wef_skill_id);
      }
    }
    return ids;
  }, [skills, learningKeys, matchedSkillIds]);

  const chipTone = (skillId: number): ChipTone => {
    if (matchedSkillIds.has(skillId)) return "matched";
    if (learningSkillIds.has(skillId)) return "learning";
    return "muted";
  };

  const selectedEvidence = evidence.find(
    ({ skill }) => skill.wef_skill_id === selectedSkillId,
  );
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
  const rowsToRender =
    overflowSkills.length > 0 ? [...cloudRows, overflowSkills] : cloudRows;

  return (
    <section className="exposure-glass-card exposure-skill-cloud">
      <div className="exposure-skill-cloud__header">
        <div className="min-w-0">
          <p className="exposure-kicker">Skills in your work</p>
          <h2 className="exposure-skill-cloud__title">
            See the skills reflected in your work.
          </h2>
          <p className="exposure-skill-cloud__copy">
            Highlighted skills appear in your confirmed tasks. Blue marks skills
            you added to learn. Hover for external outlook. Select a reflected
            skill to filter the task list.
          </p>
        </div>
        <div className="exposure-skill-cloud__header-aside">
          <div className="exposure-skill-cloud__legend" aria-hidden>
            <span className="inline-flex items-center gap-2">
              <span className="exposure-skill-cloud__legend-dot is-matched" />
              Reflected in your tasks
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="exposure-skill-cloud__legend-dot is-learning" />
              To learn
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="exposure-skill-cloud__legend-dot is-other" />
              Other framework skills
            </span>
          </div>
          <div
            className={cn(
              "exposure-skill-cloud__filter-row",
              !selectedEvidence && "is-placeholder",
            )}
            aria-live="polite"
            aria-hidden={!selectedEvidence}
          >
            <span className="exposure-skill-cloud__filter-label">
              Filtering by{" "}
              <strong
                className="exposure-skill-cloud__filter-skill"
                title={
                  selectedEvidence?.skill.core_skill ?? "selected skill"
                }
              >
                {selectedEvidence?.skill.core_skill ?? "selected skill"}
              </strong>
            </span>
            <button
              type="button"
              className="exposure-skill-cloud__clear"
              onClick={() => onSelectSkill(null)}
              disabled={!selectedEvidence}
              tabIndex={selectedEvidence ? 0 : -1}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div
        className="exposure-skill-cloud__visual"
        aria-label="All 26 WEF skills"
      >
        <div className="exposure-skill-cloud__glow" aria-hidden />
        <div className="exposure-skill-cloud__shape">
          {rowsToRender.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={cn(
                "exposure-skill-cloud__row",
                `is-row-${rowIndex + 1}`,
              )}
            >
              {row.map((skill) => (
                <SkillCloudChip
                  key={skill.wef_skill_id}
                  skill={skill}
                  tone={chipTone(skill.wef_skill_id)}
                  active={selectedSkillId === skill.wef_skill_id}
                  onSelect={onSelectSkill}
                  onLearningChanged={() =>
                    setLearningRevision((value) => value + 1)
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExposureSkillCloud;
