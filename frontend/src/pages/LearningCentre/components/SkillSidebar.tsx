import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoPopover } from "@/components/ui/info-popover";
import { type LearningSkill } from "@/pages/Skills/learningSkills";
import { type SkillRating } from "../lib/skillStars";

export type SkillSidebarProps = {
  activeId: string;
  skills: { id: string; en: string; source?: LearningSkill["source"] }[];
  /** WEF star rating per skill id. Skills outside the framework have no entry. */
  ratings: Map<string, SkillRating>;
  onSelect: (id: string) => void;
  onClear: () => void;
  onRemove: (id: string, name: string) => void;
  /** Opens the add-skill dialog. Available at all times, not only when empty. */
  onAdd: () => void;
};

/** Names longer than this get truncated on the card, so they need a full-name hint. */
const FULL_NAME_THRESHOLD = 22;
/** Matches the horizontal inset of .library-skill-tooltip (0.6rem). */
const TOOLTIP_INSET = 9.6;
/** Matches the vertical overlap of .library-skill-tooltip (0.4rem). */
const TOOLTIP_OFFSET = 6.4;

type TooltipBox = { left: number; bottom: number; width: number };
type ActiveTooltip = { name: string; anchor: HTMLElement; box: TooltipBox };

/** Seats the hint on top of the card it belongs to, slightly overlapping it. */
function measureTooltipBox(anchor: HTMLElement): TooltipBox {
  const rect = anchor.getBoundingClientRect();
  return {
    left: rect.left + TOOLTIP_INSET,
    bottom: window.innerHeight - rect.top + TOOLTIP_OFFSET,
    width: rect.width - TOOLTIP_INSET * 2,
  };
}

/** Five star slots, filled up to the rating so the scale stays readable. */
function SkillStars({ stars }: { stars: number }) {
  return (
    <span
      className="library-skill-stars"
      role="img"
      aria-label={`${stars} out of 5 stars`}
      title={`${stars} of 5 · WEF Future of Jobs 2025`}
    >
      <span className="library-skill-stars__on">{"★".repeat(stars)}</span>
      <span className="library-skill-stars__off">{"★".repeat(5 - stars)}</span>
    </span>
  );
}

export default function SkillSidebar(props: SkillSidebarProps) {
  const {
    activeId,
    onSelect,
    skills: focusSkills,
    ratings,
    onClear,
    onRemove,
    onAdd,
  } = props;
  const [tooltip, setTooltip] = useState<ActiveTooltip | null>(null);
  const anchor = tooltip?.anchor ?? null;

  // Strongest market signal first. Skills outside the WEF framework carry no
  // rating and drop to the bottom.
  const orderedSkills = useMemo(
    () =>
      [...focusSkills].sort((left, right) => {
        const a = ratings.get(left.id);
        const b = ratings.get(right.id);
        if (!a) return b ? 1 : 0;
        if (!b) return -1;
        return a.rank - b.rank;
      }),
    [focusSkills, ratings],
  );

  // The hint is portalled to <body>, so re-anchor it whenever the list scrolls
  // or the window resizes instead of letting it drift away from its card.
  useEffect(() => {
    if (!anchor) return;
    const sync = () =>
      setTooltip((prev) => (prev ? { ...prev, box: measureTooltipBox(anchor) } : prev));
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [anchor]);

  const hideTooltip = () => setTooltip(null);
  const showTooltip = (name: string, target: HTMLElement) => {
    if (name.length > FULL_NAME_THRESHOLD) {
      setTooltip({ name, anchor: target, box: measureTooltipBox(target) });
    }
  };

  return (
    <Card className="library-sidebar library-glass">
      <p className="library-kicker">My learning skills</p>
      <div className="library-sidebar__title-row">
        <h2>Your skills</h2>
        <InfoPopover label="About your skills">
          <p>
            Skills from your work appear here by default, ordered by how much
            employers value them and how fast they are growing. Add or remove
            anytime.
          </p>
          <p className="mt-3">
            Each star is scored from two WEF Future of Jobs 2025 figures:
          </p>
          <ul className="mt-1 list-disc pl-4">
            <li>40% — share of employers who call the skill core in 2025</li>
            <li>60% — expected change in its use between 2025 and 2030</li>
          </ul>
          <p className="mt-3">
            Both are scaled across the 26 WEF skills, then ranked: the top 20%
            earn 5 stars, the next 20% earn 4, and so on.
          </p>
        </InfoPopover>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="library-sidebar__add"
          aria-label="Add a skill"
          title="Add a skill"
          onClick={onAdd}
        >
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
        </Button>
        {activeId ? (
          <Button
            type="button"
            variant="link"
            className="library-sidebar__clear"
            onClick={onClear}
          >
            Clear
          </Button>
        ) : null}
      </div>
      <div className="library-skill-list" tabIndex={0} aria-label="Skill list">
        {orderedSkills.map((skill) => {
          const rating = ratings.get(skill.id);
          return (
            <div
              key={skill.id}
              className={`library-skill-card ${activeId === skill.id ? "is-active" : ""}`}
              onMouseEnter={(event) => showTooltip(skill.en, event.currentTarget)}
              onMouseLeave={hideTooltip}
              onFocus={(event) => showTooltip(skill.en, event.currentTarget)}
              onBlur={hideTooltip}
            >
              <button
                type="button"
                className="library-skill-card__main"
                aria-pressed={activeId === skill.id}
                onClick={() => onSelect(skill.id)}
              >
                <span className="library-skill-card__copy">
                  <strong>{skill.en}</strong>
                  <span className="library-skill-card__meta">
                    <small className={`library-skill-source library-skill-source--${skill.source === "work" ? "work" : skill.source === "other-role" ? "role" : "added"}`}>
                      {skill.source === "work" ? "From your work" : skill.source === "other-role" ? "From other roles" : "Added by you"}
                    </small>
                    {rating ? <SkillStars stars={rating.stars} /> : null}
                  </span>
                </span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="library-skill-card__remove"
                aria-label={`Remove ${skill.en}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(skill.id, skill.en);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <span className="library-skill-card__chevron" aria-hidden="true">
                <ChevronRight className="size-4" />
              </span>
            </div>
          );
        })}
      </div>
      {tooltip
        ? createPortal(
            <div role="tooltip" className="library-skill-tooltip" style={tooltip.box}>
              {tooltip.name}
            </div>,
            document.body,
          )
        : null}
    </Card>
  );
}
