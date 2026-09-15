import type { ComponentProps } from "react";
import { Sparkles, TrendingUp, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { message } from "@/components/ui/message";
import {
  AI_CAPACITIES,
  aiCapacityFromCategory,
} from "@/pages/Analysis/lib/skillAxes";
import { signedPoints } from "@/pages/Skills/lib/skillProfile";
import {
  capacityExplanation,
  skillPosition,
  trendExplanation,
} from "@/pages/Skills/lib/skillOutlook";
import {
  readLearningSkills,
  saveLearningSkills,
  skillKey,
  type LearningSkill,
} from "@/pages/Skills/learningSkills";
import { cn } from "@/lib/utils";
import type { WefSkill } from "@/types/reference";
import SkillOutlookInfo from "@/pages/Skills/components/SkillOutlookInfo";
import "./SkillOutlookSummary.css";

type SkillOutlookSummaryProps = {
  skill: WefSkill;
  /** Compact layout for hover popovers */
  compact?: boolean;
  showInfo?: boolean;
  showAddToLearning?: boolean;
  /** Called after add (or when already added) so hosts can close hover UI */
  onAddComplete?: () => void;
  className?: string;
};

const toLearningSkill = (skill: WefSkill): LearningSkill => ({
  id: skillKey(skill.core_skill),
  name: skill.core_skill,
  source: "work",
});

const isLearningSkillAdded = (skill: WefSkill) => {
  try {
    const existing = readLearningSkills() ?? [];
    return existing.some((item) => item.id === skillKey(skill.core_skill));
  } catch {
    return false;
  }
};

const SkillOutlookSummary = (props: SkillOutlookSummaryProps) => {
  const {
    skill,
    compact = false,
    showInfo = !compact,
    showAddToLearning = compact,
    onAddComplete,
    className,
  } = props;
  const capacity = AI_CAPACITIES.find(
    ({ id }) =>
      id === aiCapacityFromCategory(skill.genai_substitution_capacity_category),
  );
  const position = skillPosition(
    skill.core_skill_importance_2025_pct,
    skill.future_net_increase_2025_2030,
  );

  const iconProps = {
    className: compact ? "size-4 text-[#4f91ba]" : "size-5 text-[#4f91ba]",
    "aria-hidden": true,
  } satisfies Partial<ComponentProps<typeof Users>>;
  const sparklesProps = {
    className: compact ? "size-4 text-[#c99589]" : "size-5 text-[#c99589]",
    "aria-hidden": true,
  } satisfies Partial<ComponentProps<typeof Sparkles>>;

  const addToLearning = () => {
    if (isLearningSkillAdded(skill)) {
      message.warning("This skill is already added");
      onAddComplete?.();
      return;
    }
    const learning = toLearningSkill(skill);
    let existing: LearningSkill[] = [];
    try {
      existing = readLearningSkills() ?? [];
    } catch {
      existing = [];
    }
    saveLearningSkills([
      ...existing.filter((item) => item.id !== learning.id),
      learning,
    ]);
    message.success("Added successfully");
    onAddComplete?.();
  };

  return (
    <div
      className={cn(
        "skill-outlook-summary",
        compact && "is-compact",
        className,
      )}
    >
      <div className="skill-outlook-summary__heading">
        <div className="min-w-0">
          <p className="skills-kicker">External outlook</p>
          {compact ? (
            <p className="skill-outlook-summary__skill-name">
              {skill.core_skill}
            </p>
          ) : (
            <h4 className="mt-1 text-base font-semibold text-[#2f2430]">
              What external research suggests
            </h4>
          )}
        </div>
        {showInfo ? <SkillOutlookInfo /> : null}
      </div>

      <div className="skills-position-callout">
        <div>
          <span>{position.label}</span>
          <p>{position.explanation}</p>
        </div>
        {!compact ? (
          <small>
            Position based on current importance and future outlook.
          </small>
        ) : null}
      </div>

      <div className="skills-outlook-grid">
        <div className="skills-insight-card">
          <Users {...iconProps} />
          <div className="min-w-0 flex-1">
            <p className="skills-insight-card__label">Valued today</p>
            <p className="skills-insight-card__value">
              {typeof skill.core_skill_importance_2025_pct === "number"
                ? `${skill.core_skill_importance_2025_pct}%`
                : "Not available"}
            </p>
            <p className="skills-insight-card__meta">of surveyed employers</p>
            {!compact ? (
              <p className="skills-insight-card__description">
                Consider this a core skill for their workforce in 2025.
              </p>
            ) : null}
          </div>
        </div>

        <div className="skills-insight-card">
          <TrendingUp {...iconProps} />
          <div className="min-w-0 flex-1">
            <p className="skills-insight-card__label">Future use by 2030</p>
            <p className="skills-insight-card__value">
              {signedPoints(skill.future_net_increase_2025_2030)}
            </p>
            <p className="skills-insight-card__meta">
              {skill.future_trend_category ?? "Not classified"}
              {!compact ? " · net employer outlook" : ""}
            </p>
            {!compact ? (
              <p className="skills-insight-card__description">
                {trendExplanation(skill.future_net_increase_2025_2030)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="skills-insight-card">
          <Sparkles {...sparklesProps} />
          <div className="min-w-0 flex-1">
            <p className="skills-insight-card__label">Working with GenAI</p>
            <p className="skills-insight-card__value skills-insight-card__value--text">
              {capacity?.label ??
                skill.genai_substitution_capacity_category ??
                "Not shown"}
            </p>
            <p className="skills-insight-card__meta">substitution capacity</p>
            {!compact ? (
              <p className="skills-insight-card__description">
                {capacityExplanation(
                  skill.genai_substitution_capacity_category,
                )}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showAddToLearning ? (
        <div className="skill-outlook-summary__actions">
          <Button
            type="button"
            size="sm"
            className="skill-outlook-summary__add-btn"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addToLearning();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            Add to Learning Resources
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default SkillOutlookSummary;
