import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { skillsForTask } from "@/pages/Analysis/lib/matchSkills";
import {
  readLearningSkills,
  saveLearningSkills,
  skillKey,
  type LearningSkill,
} from "@/pages/Skills/learningSkills";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";

type TaskRelatedSkillsProps = {
  taskText: string;
};

const toLearningSkill = (skill: WefSkill): LearningSkill => ({
  id: skillKey(skill.core_skill),
  name: skill.core_skill,
  source: "work",
});

const TaskRelatedSkills = (props: TaskRelatedSkillsProps) => {
  const { taskText } = props;
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => {
    try {
      return new Set((readLearningSkills() ?? []).map((skill) => skill.id));
    } catch {
      return new Set();
    }
  });

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

  const addSkill = (skill: WefSkill) => {
    const learning = toLearningSkill(skill);
    if (addedIds.has(learning.id)) return;
    let existing: LearningSkill[] = [];
    try {
      existing = readLearningSkills() ?? [];
    } catch {
      existing = [];
    }
    const next = [...existing.filter((item) => item.id !== learning.id), learning];
    saveLearningSkills(next);
    setAddedIds(new Set(next.map((item) => item.id)));
  };

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
            const learning = toLearningSkill(skill);
            const alreadyAdded = addedIds.has(learning.id);
            return (
              <li key={skill.wef_skill_id} className="task-details__related-item">
                <div className="min-w-0">
                  <p className="task-details__related-name">{skill.core_skill}</p>
                  {alreadyAdded ? (
                    <p className="task-details__related-status">
                      Already added to Learning Centre
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={alreadyAdded}
                  onClick={() => addSkill(skill)}
                >
                  {alreadyAdded ? "Added" : "Add to Learning Centre"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TaskRelatedSkills;
