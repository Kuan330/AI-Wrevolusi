import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { LEVEL_LABEL } from "@/features/interview/competencies";
import { buildProfile } from "@/features/interview/profile";
import { sessionProgress, type InterviewSession } from "@/features/interview/session";
import { loadResumeDraft } from "@/features/resume/repository";
import LevelBar from "./LevelBar";

type Props = { owner: string; session: InterviewSession; onReview: () => void; onExit: () => void };
/** The end of a set: what this set showed well first, then one thing to do. The all-time overview sits below it. */
export default function FinishView({ owner, session, onReview, onExit }: Props) {
  // Points sent from this practice wait in the Resume builder until the user accepts or dismisses them.
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    if (session.mode !== "resume") return;
    let live = true;
    loadResumeDraft(owner).then(draft => { if (live) setWaiting((draft.interviewSuggestions ?? []).filter(item => item.sessionId === session.id).length); }).catch(() => undefined);
    return () => { live = false; };
  }, [owner, session.id, session.mode]);
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
    {session.mode === "resume" && <div className="ip-finish-block"><h3>Your resume</h3>
      <p>{waiting > 0 ? `${waiting} ${waiting === 1 ? "point" : "points"} from your answers ${waiting === 1 ? "is" : "are"} waiting in the Resume builder. Add or dismiss ${waiting === 1 ? "it" : "them"} there.`
        : "To use what you practised, open an answer and choose “Send a point to my resume”. You add it in the Resume builder."}</p>
      <Button asChild variant="outline"><Link to={ROUTES.resumeBuilder}>Open Resume builder</Link></Button></div>}
    <div className="ip-actions"><Button onClick={onExit}>Back to practice home</Button><Button variant="outline" onClick={onReview}>Review my answers</Button></div>
  </Card>;
}
