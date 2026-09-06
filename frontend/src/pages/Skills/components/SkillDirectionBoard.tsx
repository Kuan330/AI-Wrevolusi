import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, GripVertical, RotateCcw, Sparkles, Sprout, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { SkillEvidence } from "@/pages/Skills/lib/skillProfile";
import {
  SKILL_DIRECTIONS,
  addLearningCentreItems,
  buildRecommendedDirections,
  type LearningTheme,
  type SkillDirection,
} from "@/pages/Skills/skillDirections";
import { ApiError } from "@/services/api";
import { skillDirectionService } from "@/services/skillDirectionService";

type SkillDirectionBoardProps = {
  evidence: SkillEvidence[];
  occupationTitle: string;
};

const DIRECTION_DETAILS: Record<
  SkillDirection,
  {
    title: string;
    description: string;
    className: string;
    icon: typeof Sprout;
  }
> = {
  keep_building: {
    title: "Keep building",
    description: "Keep using these strengths and make them more visible in your work.",
    className: "is-keep-building",
    icon: Sprout,
  },
  strengthen: {
    title: "Strengthen",
    description: "Develop these skills further as work and responsibilities change.",
    className: "is-strengthen",
    icon: TrendingUp,
  },
  use_with_ai: {
    title: "Use with AI",
    description: "Learn where AI can support the routine parts while you retain judgement.",
    className: "is-use-with-ai",
    icon: Sparkles,
  },
};

const SkillDirectionBoard = ({ evidence, occupationTitle }: SkillDirectionBoardProps) => {
  const recommended = useMemo(() => buildRecommendedDirections(evidence), [evidence]);
  const [assignments, setAssignments] = useState(recommended);
  const [draggedSkillId, setDraggedSkillId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<SkillDirection | null>(null);
  const [generating, setGenerating] = useState(false);
  const [themes, setThemes] = useState<LearningTheme[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  if (!evidence.length) return null;

  const invalidateAnalysis = () => {
    setThemes([]);
    setSelectedThemeIds(new Set());
    setError(null);
    setAddedCount(0);
  };

  const moveSkill = (skillId: number, direction: SkillDirection) => {
    if (assignments[skillId] === direction) return;
    setAssignments((current) => ({ ...current, [skillId]: direction }));
    invalidateAnalysis();
  };

  const moveWithKeyboard = (skillId: number, direction: SkillDirection, key: string) => {
    const currentIndex = SKILL_DIRECTIONS.indexOf(direction);
    if (key === "ArrowLeft" && currentIndex > 0) {
      moveSkill(skillId, SKILL_DIRECTIONS[currentIndex - 1]);
    }
    if (key === "ArrowRight" && currentIndex < SKILL_DIRECTIONS.length - 1) {
      moveSkill(skillId, SKILL_DIRECTIONS[currentIndex + 1]);
    }
  };

  const confirmDirections = async () => {
    setGenerating(true);
    setError(null);
    setAddedCount(0);
    try {
      const response = await skillDirectionService.analyse(
        occupationTitle,
        evidence.map(({ skill, tasks }) => ({
          skill_id: skill.wef_skill_id,
          skill_name: skill.core_skill,
          direction: assignments[skill.wef_skill_id],
          supporting_tasks: tasks.map((task) => task.wording),
          current_importance_pct: skill.core_skill_importance_2025_pct ?? null,
          future_outlook_points: skill.future_net_increase_2025_2030,
          genai_capacity: skill.genai_substitution_capacity_category,
        })),
      );
      setThemes(response.themes);
      setSelectedThemeIds(new Set());
      window.requestAnimationFrame(() => {
        document.getElementById("learning-themes")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.detail
          : "Learning themes could not be generated. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const toggleTheme = (themeId: string, checked: boolean) => {
    setSelectedThemeIds((current) => {
      const next = new Set(current);
      if (checked) next.add(themeId);
      else next.delete(themeId);
      return next;
    });
  };

  const addSelectedThemes = () => {
    const selected = themes.filter((theme) => selectedThemeIds.has(theme.theme_id));
    addLearningCentreItems(selected);
    setAddedCount(selected.length);
  };

  return (
    <section className="skills-direction-section" aria-labelledby="skill-directions-heading">
      <div className="skills-direction-heading">
        <div>
          <p className="skills-kicker">Plan your next skill move</p>
          <h2 id="skill-directions-heading" className="mt-1 text-2xl font-semibold text-[#2f2430]">
            Choose your skill directions
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#7f7280]">
            We have placed each identified skill in a suggested starting direction. Drag any
            skill to reflect what matters to you, then confirm to generate learning themes.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full text-[#3d5f7a]"
          onClick={() => {
            setAssignments(recommended);
            invalidateAnalysis();
          }}
        >
          <RotateCcw aria-hidden />
          Reset suggestions
        </Button>
      </div>

      <div className="skills-direction-guide" aria-label="How this works">
        <span><strong>01</strong> Arrange your skills</span>
        <ArrowRight aria-hidden />
        <span><strong>02</strong> Confirm your directions</span>
        <ArrowRight aria-hidden />
        <span><strong>03</strong> Choose learning themes</span>
      </div>

      <div className="skills-direction-board">
        {SKILL_DIRECTIONS.map((direction) => {
          const details = DIRECTION_DETAILS[direction];
          const Icon = details.icon;
          const items = evidence.filter(
            ({ skill }) => assignments[skill.wef_skill_id] === direction,
          );
          return (
            <section
              key={direction}
              className={cn(
                "skills-direction-column",
                details.className,
                dropTarget === direction && "is-drop-target",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(direction);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDropTarget(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const skillId = Number(event.dataTransfer.getData("text/skill-id"));
                if (skillId) moveSkill(skillId, direction);
                setDraggedSkillId(null);
                setDropTarget(null);
              }}
            >
              <div className="skills-direction-column__header">
                <span className="skills-direction-column__icon"><Icon aria-hidden /></span>
                <div>
                  <h3>{details.title}</h3>
                  <p>{details.description}</p>
                </div>
                <span className="skills-direction-column__count">{items.length}</span>
              </div>

              <div className="skills-direction-column__items">
                {items.map(({ skill }) => {
                  const adjusted = recommended[skill.wef_skill_id] !== direction;
                  return (
                    <article
                      key={skill.wef_skill_id}
                      draggable
                      tabIndex={0}
                      className={cn(
                        "skills-direction-card",
                        draggedSkillId === skill.wef_skill_id && "is-dragging",
                      )}
                      aria-label={`${skill.core_skill}. ${adjusted ? "Your adjusted choice" : "Suggested direction"}. Use left and right arrow keys to move.`}
                      onKeyDown={(event) => moveWithKeyboard(skill.wef_skill_id, direction, event.key)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/skill-id", String(skill.wef_skill_id));
                        setDraggedSkillId(skill.wef_skill_id);
                      }}
                      onDragEnd={() => {
                        setDraggedSkillId(null);
                        setDropTarget(null);
                      }}
                    >
                      <GripVertical aria-hidden />
                      <span>{skill.core_skill}</span>
                      <small>{adjusted ? "Your choice" : "Suggested"}</small>
                    </article>
                  );
                })}
                {!items.length ? <p className="skills-direction-column__empty">Drop a skill here</p> : null}
              </div>
            </section>
          );
        })}
      </div>

      <div className="skills-direction-confirm">
        <p>
          When you confirm, your chosen directions and supporting task text are sent to the
          model to create broad learning themes.
        </p>
        <Button
          type="button"
          className="profile-gradient-btn rounded-full px-6 font-normal"
          disabled={generating}
          onClick={() => void confirmDirections()}
        >
          {generating ? "Generating learning themes…" : "Confirm my skill directions"}
          {!generating ? <Sparkles aria-hidden /> : null}
        </Button>
      </div>

      {error ? (
        <div className="skills-direction-error" role="alert">
          <strong>Learning themes are not available yet.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {themes.length ? (
        <div id="learning-themes" className="skills-learning-themes scroll-mt-24">
          <div>
            <p className="skills-kicker">Your learning shortlist</p>
            <h3 className="mt-1 text-xl font-semibold text-[#2f2430]">
              Choose what you want to explore
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#7f7280]">
              These are broad learning themes, not course recommendations. Select the ones
              you want the Learning Centre to use for course matching.
            </p>
          </div>

          <div className="skills-learning-themes__grid">
            {themes.map((theme) => {
              const checked = selectedThemeIds.has(theme.theme_id);
              return (
                <label key={theme.theme_id} className={cn("skills-learning-theme", checked && "is-selected")}>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleTheme(theme.theme_id, value === true)}
                    aria-label={`Add ${theme.title} to your learning shortlist`}
                  />
                  <span>
                    <small>{theme.skill_name} · {DIRECTION_DETAILS[theme.direction].title}</small>
                    <strong>{theme.title}</strong>
                    <span>{theme.description}</span>
                    <em>{theme.why_relevant}</em>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="skills-learning-themes__actions">
            <p aria-live="polite">
              {addedCount
                ? `${addedCount} ${addedCount === 1 ? "theme" : "themes"} added to your Learning Centre.`
                : `${selectedThemeIds.size} selected`}
            </p>
            {addedCount ? (
              <Button asChild variant="outline" className="profile-outline-btn rounded-full">
                <Link to={ROUTES.learningCentre}>
                  View Learning Centre
                  <BookOpen aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                className="profile-gradient-btn rounded-full font-normal"
                disabled={!selectedThemeIds.size}
                onClick={addSelectedThemes}
              >
                Add to Learning Centre
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default SkillDirectionBoard;
