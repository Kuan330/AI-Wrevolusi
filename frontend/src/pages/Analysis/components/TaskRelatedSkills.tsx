import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { skillsForTask } from "@/pages/Analysis/lib/matchSkills";
import { getSkillDecision } from "@/features/journey/journey";
import { ROUTES } from "@/constants/routes";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";

export default function TaskRelatedSkills({ taskText }: { taskText: string }) {
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void referenceService.wefSkills().then(rows => { if (!cancelled) setWefSkills(rows); })
      .catch(() => { if (!cancelled) setError("Skill suggestions could not load. Open your skill review to try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  let related: WefSkill[] = [];
  let readError = "";
  try { related = skillsForTask(taskText, wefSkills, null).filter(skill => getSkillDecision(skill.wef_skill_id) !== "rejected").slice(0, 3); }
  catch { readError = "Your saved skill decisions need attention. Open your skill review to recover them."; }
  if (loading) return <p className="task-details__ai-note">Loading skill suggestions…</p>;
  return <section className="task-details__related-skills">
    <h3 className="task-details__score-title">Skills to review</h3>
    {error || readError ? <p role="alert" className="task-details__ai-note">{error || readError}</p> : <>
      <p className="task-details__related-copy">Broad suggestions from the words in this task. Check which ones fit.</p>
      {related.length ? <ul className="task-details__related-list">
        {related.map(skill => <li className="task-details__related-item" key={skill.wef_skill_id}>{skill.core_skill}</li>)}
      </ul> : <p className="task-details__ai-note">No broad suggestion yet. You can add a specific skill in your review.</p>}
    </>}
    <Link to={ROUTES.skills} className="mt-3 inline-block py-2 text-sm font-semibold text-primary underline underline-offset-4">Review or add my skills</Link>
  </section>;
}
