import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ROUTES } from "@/constants/routes";
import type { careerPathProgress } from "@/features/dashboard/careerProgress";
import { startLearning } from "@/features/journey/journey";

type Props = { path: ReturnType<typeof careerPathProgress> & { occupationCode: string } };
export default function CareerPathCard({ path }: Props) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const work = async () => {
    const skill = path.nextGap;
    if (!skill || starting) return;
    setStarting(true);
    setError("");
    try {
      navigate(await startLearning({
        origin: "career",
        skill: { id: skill.skill_id, slug: skill.skill_slug, name: skill.name },
        career: { code: path.occupationCode, title: path.title },
        goal: `Develop ${skill.name} for ${path.title}`,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open learning resources.");
      setStarting(false);
    }
  };
  const matched = path.have.length + path.learning.length + path.suggested.length;
  const sources = [path.have.length && `${path.have.length} from your work`, path.suggested.length && `${path.suggested.length} from your tasks`, path.learning.length && `${path.learning.length} from your learning`].filter(Boolean).join(", ");
  return <Card className="career-path-card" aria-label={`Progress towards ${path.title}`}>
    <header className="career-path-header">
      <div><p className="dashboard-eyebrow"><Compass size={15} /> YOUR NEXT CAREER DIRECTION</p><h2>Your path to {path.title}</h2></div>
      <Link className="dashboard-text-link" to={ROUTES.possibilities}>Change direction <ArrowRight size={15} /></Link>
    </header>
    <div className="career-path-body">
      <section aria-label="Skills matched so far">
        <div className="career-path-meter"><Progress value={path.percent} aria-label={`${path.title} skills matched`} /><span>{path.percent}%</span></div>
        <p className="career-path-summary">{matched} of {path.total} skills matched</p>
        <p className="career-path-note">{sources ? `${sources}. ` : ""}This is not a skill level.</p>
      </section>
      <section aria-label="Gaps still to close">
        <p className="dashboard-eyebrow">{path.gaps.length ? `${path.gaps.length} ${path.gaps.length === 1 ? "GAP" : "GAPS"} TO CLOSE` : "NO GAPS LEFT"}</p>
        {path.gaps.length ? <ul className="career-path-gaps">{path.gaps.map(skill => <li key={skill.skill_id} className={skill.skill_id === path.nextGap?.skill_id ? "is-next" : undefined}>
          <span>{skill.name}</span>{skill.skill_id === path.nextGap?.skill_id && <em>Next up</em>}
        </li>)}</ul> : <p>You have a match for every skill in this role.</p>}
        {path.nextGap && <button type="button" className="dashboard-text-link" disabled={starting} onClick={() => { void work(); }}>{starting ? "Opening learning resources…" : <>Start learning {path.nextGap.name} <ArrowRight size={15} /></>}</button>}
        {error && <p role="alert" className="career-path-note">{error}</p>}
      </section>
    </div>
  </Card>;
}
