import { useEffect, useState } from "react";

import { PILOT_WEF_SKILLS } from "@/data/pilotWefSkills";
import { aiService } from "@/services/aiService";

type Suggestion = {
  skillName: string;
  confidence: number;
  evidence: string[];
};

const skillNameById = new Map(
  PILOT_WEF_SKILLS.map((skill) => [skill.wef_skill_id, skill.core_skill]),
);

/**
 * Shows WEF skills the AI matching service suggests for a task wording.
 * The section hides itself when the service returns no reliable suggestion,
 * and never blocks the drawer while the request is in flight.
 */
export default function AiSkillSuggestions({ taskText }: { taskText: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskText.trim().length < 3) {
      setSuggestions(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSuggestions(null);
    void aiService
      .skillMatch({
        task_text: taskText,
        candidates: PILOT_WEF_SKILLS.map((skill) => ({
          id: skill.wef_skill_id,
          skill: skill.core_skill,
        })),
      })
      .then((response) => {
        if (cancelled) return;
        setSuggestions(
          response.skills
            .map((item) => ({
              skillName:
                skillNameById.get(item.wef_skill_id) ??
                `Skill ${item.wef_skill_id}`,
              confidence: item.confidence,
              evidence: item.evidence_phrases,
            }))
            .filter((item) => item.evidence.length > 0),
        );
      })
      .catch(() => {
        if (!cancelled) setSuggestions(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskText]);

  if (loading) {
    return <p className="task-details__ai-note">Checking suggested skills…</p>;
  }
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="task-details__ai-skills">
      <p className="task-details__ai-title">Suggested skills</p>
      <ul className="task-details__ai-list">
        {suggestions.map((item) => (
          <li key={item.skillName}>
            <strong>{item.skillName}</strong>
            <span className="task-details__ai-meta">
              confidence {item.confidence.toFixed(2)}
            </span>
            <span className="task-details__ai-evidence">
              evidence: {item.evidence.map((phrase) => `"${phrase}"`).join(", ")}
            </span>
          </li>
        ))}
      </ul>
      <p className="task-details__ai-note">
        Suggested by the AI matching service for your review — confirm or edit
        before relying on them.
      </p>
    </div>
  );
}
