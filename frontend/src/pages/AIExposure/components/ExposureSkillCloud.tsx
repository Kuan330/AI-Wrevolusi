import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { SkillEvidence } from "../../../features/skills/skillProfile.ts";

type Props = { evidence: SkillEvidence[]; frameworkCount: number };

export default function ExposureSkillCloud({ evidence, frameworkCount }: Props) {
  return <section className="exposure-glass-card p-5 sm:p-6" aria-labelledby="next-skill-step">
    <p className="text-sm font-medium text-primary">Next: your skills</p>
    <h2 id="next-skill-step" className="mt-2 text-xl font-semibold">What skills does this work use?</h2>
    <p className="mt-3 max-w-prose text-sm leading-6">
      {evidence.length ? `${evidence.length} broad skill suggestions connect to the words in your tasks. Check which ones fit your work.` : "We have not found a skill connection in your task wording yet. This does not mean you have no skills."}
    </p>
    {evidence.length > 0 && <ul className="mt-4 flex flex-wrap gap-2" aria-label="Examples of suggested skills">
      {evidence.slice(0, 4).map(({ skill }) => <li key={skill.wef_skill_id} className="rounded-lg bg-white/80 px-3 py-2 text-sm">{skill.core_skill}</li>)}
      {evidence.length > 4 && <li className="px-2 py-2 text-sm text-muted-foreground">and {evidence.length - 4} more</li>}
    </ul>}
    <p className="mt-3 max-w-prose text-sm text-muted-foreground">The current framework has {frameworkCount} broad skills. It does not cover every specialist skill in your job, and these suggestions do not measure your ability. You can add a skill we missed in your skill review.</p>
    <Button asChild className="mt-4 rounded-full"><Link to={ROUTES.skills}>Review my skills</Link></Button>
  </section>;
}
