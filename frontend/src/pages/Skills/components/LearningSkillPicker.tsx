import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Plus, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { toast } from "sonner";
import type { SkillEvidence } from "../lib/skillProfile";
import {
  growingSkills,
  readLearningSkills,
  saveLearningSkills,
  reconcileLearningSkills,
  skillKey,
  type LearningSkill,
} from "../learningSkills";
import "../learning-skills.css";
type Props = { evidence: SkillEvidence[] };
export default function LearningSkillPicker(props: Props) {
  const { evidence } = props;
  const work = evidence.map(({ skill }) => ({
    id: skillKey(skill.core_skill),
    name: skill.core_skill,
    source: "work" as const,
  }));
  const [initial] = useState(() => {
    try {
      return {
        skills: reconcileLearningSkills(readLearningSkills(), work),
        error: "",
      };
    } catch (error) {
      return { skills: work, error: String(error) };
    }
  });
  const [selected, setSelected] = useState(initial.skills);
  const [error, setError] = useState(initial.error);
  const [dragged, setDragged] = useState<LearningSkill | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const navigate = useNavigate();
  function add(skill: LearningSkill, before?: string) {
    setSelected((current) => {
      if (before === skill.id) return current;
      if (!before && current.some((item) => item.id === skill.id)) {
        return current;
      }
      const next = current.filter((item) => item.id !== skill.id);
      const index = before
        ? next.findIndex((item) => item.id === before)
        : next.length;
      next.splice(index < 0 ? next.length : index, 0, skill);
      return next;
    });
  }
  function move(index: number, delta: number) {
    setSelected((current) => {
      const next = [...current];
      const to = index + delta;
      if (to < 0 || to >= next.length) return current;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }
  function remove(skill: LearningSkill, index: number) {
    setSelected((current) => current.filter((item) => item.id !== skill.id));
    toast("Removed from learning skills", {
      action: {
        label: "Undo",
        onClick: () =>
          setSelected((current) => {
            if (current.some((item) => item.id === skill.id)) return current;
            const next = [...current];
            next.splice(Math.min(index, next.length), 0, skill);
            return next;
          }),
      },
    });
  }
  return (
    <section
      id="skill-directions"
      tabIndex={-1}
      className="learning-skill-picker scroll-mt-24"
    >
      <p className="skills-eyebrow">Plan your next skill move</p>
      <h2>Choose skills to learn</h2>
      <p>
        Start with skills reflected in your work, then add skills you want to
        develop. Drag skills across or use the add buttons.
      </p>
      <div className="learning-skill-columns">
        <div className="skills-glass-card learning-skill-panel">
          <h3>Explore growing skills</h3>
          <p className="learning-wef-source">
            WEF · 2025–2030 Top 10
            <a
              href="https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/"
              target="_blank"
              rel="noreferrer"
              aria-label="Open WEF Skills outlook (new tab)"
            >
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </p>
          <small>
            Employer expectations of growing skill importance, not a personal
            skill assessment.
          </small>
          <div className="learning-skill-items">
            {growingSkills.map((skill) => {
              const added = selected.some((item) => item.id === skill.id);
              return (
                <div
                  key={skill.id}
                  className="learning-skill-item"
                  draggable
                  onDragStart={(event) => {
                    setDragged(skill);
                    event.dataTransfer.setData("text/plain", skill.id);
                    event.dataTransfer.effectAllowed = "copyMove";
                  }}
                  onDragEnd={() => {
                    setDragged(null);
                    setTarget(null);
                  }}
                >
                  <span>{skill.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="learning-skill-add"
                    aria-label={`${added ? "Added" : "Add"} ${skill.name}`}
                    disabled={added}
                    onClick={() => add(skill)}
                  >
                    {added ? <Check size={16} /> : <Plus size={16} />}{" "}
                    {added ? "Added" : "Add"}
                  </Button>
                </div>
              );
            })}
          </div>
          <a
            href="https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/"
            target="_blank"
            rel="noreferrer"
          >
            Source: WEF · Future of Jobs Report 2025 ↗
          </a>
        </div>
        <div
          className={`skills-glass-card learning-skill-panel ${dragged ? "accepts-drop" : ""}`}
          onDragOver={(event) => {
            if (dragged) {
              event.preventDefault();
              setTarget("end");
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragged) add(dragged);
            setDragged(null);
            setTarget(null);
          }}
        >
          <h3>Your learning skills · {selected.length}</h3>
          <p>
            Drag to reorder your learning priorities. Removing a skill here
            keeps your work profile unchanged.
          </p>
          <div className="learning-skill-items">
            {selected.map((skill, index) => (
              <div
                key={skill.id}
                className={`learning-skill-item learning-skill-sortable ${dragged?.id === skill.id ? "is-dragging" : ""} ${target === skill.id ? "is-drop-target" : ""}`}
                draggable
                onDragStart={(event) => {
                  setDragged(skill);
                  event.dataTransfer.setData("text/plain", skill.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragged(null);
                  setTarget(null);
                }}
                onDragOver={(event) => {
                  if (dragged) {
                    event.preventDefault();
                    event.stopPropagation();
                    setTarget(skill.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (dragged) add(dragged, skill.id);
                  setDragged(null);
                  setTarget(null);
                }}
              >
                <span>
                  {skill.name}
                  <small>
                    {work.some((item) => item.id === skill.id)
                      ? "From your work"
                      : skill.source === "wef"
                        ? "Added from WEF"
                        : "Selected for learning"}
                  </small>
                </span>
                <div className="learning-skill-actions">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={index === 0}
                    className="learning-skill-sort"
                    aria-label={`Move ${skill.name} up`}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={index === selected.length - 1}
                    className="learning-skill-sort"
                    aria-label={`Move ${skill.name} down`}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${skill.name}`}
                    onClick={() => remove(skill, index)}
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!selected.length && (
            <p className="learning-skill-empty">
              Add skills from the left, or restore your work skills.
            </p>
          )}
          <div className="learning-skill-panel-actions">
            <Button
              variant="link"
              onClick={() =>
                setSelected((current) => [
                  ...current,
                  ...work.filter(
                    (skill) => !current.some((item) => item.id === skill.id),
                  ),
                ])
              }
            >
              Restore my work skills
            </Button>
            <AppButton
              tone="gradient"
              disabled={!selected.length || !!initial.error}
              onClick={() => {
                try {
                  saveLearningSkills(selected);
                  navigate("/learning-centre");
                } catch {
                  setError("Could not save your skills. Please try again.");
                }
              }}
            >
              Confirm and find courses →
            </AppButton>
          </div>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
