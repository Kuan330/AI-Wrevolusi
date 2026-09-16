import { useCallback, useState } from "react";
import { message } from "@/components/ui/message";
import {
  readLearningSkills,
  saveLearningSkills,
  skillKey,
  toLearningSkill,
  type LearningSkill,
} from "@/pages/Skills/learningSkills";

function loadSkills(): LearningSkill[] {
  try {
    return readLearningSkills() ?? [];
  } catch {
    return [];
  }
}

export function useLearningSkills() {
  const [skills, setSkills] = useState(loadSkills);

  const refresh = useCallback(() => {
    setSkills(loadSkills());
  }, []);

  const isAdded = useCallback(
    (nameOrId: string) => {
      const key = skillKey(nameOrId);
      return skills.some(
        (skill) =>
          skill.id === nameOrId ||
          skill.id === key ||
          skill.name === nameOrId,
      );
    },
    [skills],
  );

  const addSkill = useCallback(
    (name: string, source: LearningSkill["source"] = "work") => {
      const learning = toLearningSkill(name, source);
      if (skills.some((skill) => skill.id === learning.id)) {
        message.warning("This skill is already added");
        return false;
      }
      const next = [
        ...skills.filter((skill) => skill.id !== learning.id),
        learning,
      ];
      saveLearningSkills(next);
      setSkills(next);
      message.success("Skill added");
      return true;
    },
    [skills],
  );

  const removeSkill = useCallback(
    (nameOrId: string, options?: { silent?: boolean }) => {
      const key = skillKey(nameOrId);
      const next = skills.filter(
        (skill) =>
          skill.id !== nameOrId &&
          skill.id !== key &&
          skill.name !== nameOrId,
      );
      if (next.length === skills.length) return false;
      saveLearningSkills(next);
      setSkills(next);
      if (!options?.silent) {
        message.success("Skill removed");
      }
      return true;
    },
    [skills],
  );

  return { skills, refresh, isAdded, addSkill, removeSkill, setSkills };
}
