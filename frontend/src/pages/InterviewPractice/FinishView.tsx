import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LEVEL_LABEL } from "@/features/interview/competencies";
import { buildProfile } from "@/features/interview/profile";
import { sessionProgress, type InterviewSession } from "@/features/interview/session";
import LevelBar from "./LevelBar";

type Props = { session: InterviewSession; onReview: () => void; onExit: () => void };
/** The end of a set: what this set showed well first, then one thing to do. The all-time overview sits below it. */
export default function FinishView({ session, onReview, onExit }: Props) {
  const profile = buildProfile([session]), progress = sessionProgress(session);
  const best = profile.strengths.slice(0, 3);
  const next = profile.improve[0];
  const step = next?.evidence.find(item => item.next_step)?.next_step;
  return <Card className="ip-done" role="status" aria-label="Practice finished">
    <h2>You finished this practice.</h2>
    <p>{progress.answered > 0 ? `You answered ${progress.answered} ${progress.answered === 1 ? "question" : "questions"}${progress.skipped ? ` and skipped ${progress.skipped}` : ""}. Here is what this practice showed.` : "You skipped every question this time. You can come back to any of them when you are ready."}</p>
    {best.length > 0 && <div className="ip-finish-block"><h3>Showed well</h3>
      <ul className="ip-finish-list">{best.map(row => <li key={row.id}><strong>{row.label}</strong><span className={`ip-level ip-level-${row.level}`}>{LEVEL_LABEL[row.level!]}</span><LevelBar level={row.mean!} /></li>)}</ul></div>}
    {next && <div className="ip-finish-block"><h3>One thing to work on</h3>
      <p><strong>{next.label}.</strong> {step ?? next.hint}</p></div>}
    {!best.length && !next && progress.answered > 0 && <p className="ip-hint">This practice did not show enough to rate a skill. Longer answers give more to work with.</p>}
    <div className="ip-actions"><Button onClick={onExit}>Back to practice home</Button><Button variant="outline" onClick={onReview}>Review my answers</Button></div>
  </Card>;
}
