import { ChevronRight, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoPopover } from "@/components/ui/info-popover";
import { coursesForSkill } from "@/pages/Skills/learningSkills";

export type SkillSidebarProps = {
  activeId: string;
  skills: { id: string; en: string; hint?: string }[];
  onSelect: (id: string) => void;
  onClear: () => void;
  onRemove: (id: string, name: string) => void;
};

export default function SkillSidebar(props: SkillSidebarProps) {
  const { activeId, onSelect, skills: focusSkills, onClear, onRemove } = props;
  return (
    <Card className="library-sidebar library-glass">
      <p className="library-kicker">My learning skills</p>
      <div className="library-sidebar__title-row">
        <h2>Your skills</h2>
        <InfoPopover label="About your skills">
          Skills from your work appear here by default. Add or remove anytime.
        </InfoPopover>
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
        {focusSkills.map((skill) => (
          <div
            key={skill.id}
            className={`library-skill-card ${activeId === skill.id ? "is-active" : ""}`}
          >
            <button
              type="button"
              className="library-skill-card__main"
              aria-pressed={activeId === skill.id}
              onClick={() => onSelect(skill.id)}
            >
              <span className="library-skill-card__copy">
                <strong>{skill.en}</strong>
                <small>
                  {coursesForSkill(skill.id).length} courses
                  {skill.hint ? ` · ${skill.hint}` : ""}
                </small>
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
        ))}
      </div>
    </Card>
  );
}
