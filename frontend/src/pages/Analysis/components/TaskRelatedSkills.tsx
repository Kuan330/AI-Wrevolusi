import { Button } from "@/components/ui/button";
import { skillsForTask } from "@/pages/Analysis/lib/matchSkills";
import { useLearningSkills } from "@/pages/Skills/useLearningSkills";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import { useEffect, useState } from "react";

type TaskRelatedSkillsProps = {
  taskText: string;
};

const TaskRelatedSkills = (props: TaskRelatedSkillsProps) => {
  const { taskText } = props;
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdded, addSkill, removeSkill } = useLearningSkills();

  useEffect(() => {
    let cancelled = false;
    void referenceService
      .wefSkills()
      .then((rows) => {
        if (!cancelled) setWefSkills(rows);
      })
      .catch(() => {
        if (!cancelled) setWefSkills([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const related = skillsForTask(taskText, wefSkills);

  if (loading) {
    return <p className="task-details__ai-note">Loading related skills…</p>;
  }

  return (
    <div className="task-details__related-skills">
      <h3 className="task-details__score-title">Related skills</h3>
      <p className="task-details__related-copy">
        Skills linked to this task (same matching as the skill cloud).
      </p>
      {related.length === 0 ? (
        <p className="task-details__ai-note">
          No linked skills for this task yet.
        </p>
      ) : (
        <ul className="task-details__related-list">
          {related.map((skill) => {
            const alreadyAdded = isAdded(skill.core_skill);
            return (
              <li key={skill.wef_skill_id} className="task-details__related-item">
                <div className="min-w-0">
                  <p className="task-details__related-name">
                    <span>{skill.core_skill}</span>
                    {alreadyAdded ? (
                      <span className="task-details__related-badge">Added</span>
                    ) : null}
                  </p>
                </div>
                {alreadyAdded ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="shrink-0"
                    onClick={() => removeSkill(skill.core_skill)}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    onClick={() => addSkill(skill.core_skill, "wef")}
                  >
                    Add to Learning Resources
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TaskRelatedSkills;
