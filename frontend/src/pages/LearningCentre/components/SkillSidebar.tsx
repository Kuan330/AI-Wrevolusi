import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { coursesForSkill } from "@/pages/Skills/learningSkills";
export type SkillSidebarProps = {
  activeId: string;
  skills: { id: string; en: string; hint: string }[];
  onSelect: (id: string) => void;
};
export default function SkillSidebar(props: SkillSidebarProps) {
  const { activeId, onSelect, skills: focusSkills } = props;
  return (
    <Card className="library-sidebar library-glass">
      <p className="library-kicker">My focus skill</p>
      <h2>Choose a skill</h2>
      <p className="library-muted">
        See courses related to the skill you want to grow.
      </p>
      <div className="library-skill-list">
        {focusSkills.map((skill) => {
          return (
            <Button
              key={skill.id}
              variant="ghost"
              className={`library-skill ${activeId === skill.id ? "is-active" : ""}`}
              aria-pressed={activeId === skill.id}
              onClick={() => onSelect(skill.id)}
            >
              <span>
                <strong>{skill.en}</strong>
                <small>
                  {coursesForSkill(skill.id).length} courses · {skill.hint}
                </small>
              </span>
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          );
        })}
      </div>
      <Button variant="link" onClick={() => onSelect("")}>
        Clear skill selection
      </Button>
    </Card>
  );
}
