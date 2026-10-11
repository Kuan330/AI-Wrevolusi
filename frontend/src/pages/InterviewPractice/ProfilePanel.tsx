import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { LEVEL_LABEL } from "@/features/interview/competencies";
import { buildProfile, weakestEvidence, type Confidence, type SkillRow } from "@/features/interview/profile";
import type { InterviewSession } from "@/features/interview/session";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";

const CONFIDENCE: Record<Confidence, string> = { none: "", first_look: "First look. One answer", early: "Early. Based on 2 or 3 answers", steady: "Steady. Based on 4 or more answers" };
const TREND = { up: "Improving over your practice", down: "Less clear in recent answers", steady: "About the same over time" } as const;

function SkillHead({ row }: { row: SkillRow }) {
  return <>
    <div className="ip-score-head"><strong>{row.label}</strong><span className={`ip-level ip-level-${row.level}`}>{LEVEL_LABEL[row.level!]}</span></div>
    <meter className="ip-meter" min={1} max={4} value={row.mean!} aria-label={`${row.label}: ${LEVEL_LABEL[row.level!]}`} />
    <p className="ip-hint">{CONFIDENCE[row.confidence]}{row.trend ? ` · ${TREND[row.trend]}` : ""}</p>
  </>;
}

/** What the saved practice answers have shown so far, by skill. It describes answers, never the person, and it is never a score of competence. */
export default function ProfilePanel({ sessions }: { sessions: InterviewSession[] }) {
  const profile = useMemo(() => buildProfile(sessions), [sessions]);
  const [skills, setSkills] = useState<WefSkill[]>(() => referenceService.cachedWefSkills() ?? []);
  useEffect(() => {
    const controller = new AbortController();
    referenceService.wefSkills().then(list => { if (!controller.signal.aborted) setSkills(list); }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const scored = profile.rows.some(row => row.level !== null);
  const skillName = (id: number) => skills.find(skill => skill.wef_skill_id === id)?.core_skill ?? "A skill from the learning list";
  return <Card className="ip-card ip-profile" aria-label="Your skills overview">
    <h2>Your skills overview</h2>
    {!scored ? <p className="ip-hint">Answer a few practice questions and your overview will appear here. It shows which skills your answers have shown so far, and what to work on next.</p> : <>
      <p className="ip-hint">Based on {profile.answers} practice {profile.answers === 1 ? "answer" : "answers"} saved on this device. It shows what your answers have shown so far. It is not a test and does not predict an interview. One answer is only a first look.</p>
      {profile.improve.length > 0 && <section className="ip-group" aria-label="What to improve next"><h3>What you can improve next</h3>
        <ul className="ip-profile-list">{profile.improve.map(row => <li key={row.id}>
          <SkillHead row={row} />
          {weakestEvidence(row, 1).map(item => <div key={`${item.questionId}-${item.at}`} className="ip-evidence">
            {item.quote && <q className="ip-quote">{item.quote}</q>}<p>{item.reason}</p>{item.next_step && <p className="ip-next"><strong>Next level:</strong> {item.next_step}</p>}</div>)}
        </li>)}</ul></section>}
      {profile.strengths.length > 0 && <section className="ip-group" aria-label="What your answers showed well"><h3>What your answers showed well</h3>
        <ul className="ip-profile-list">{profile.strengths.map(row => <li key={row.id}><SkillHead row={row} /></li>)}</ul></section>}
      {profile.notYet.length > 0 && <section className="ip-group" aria-label="Not practised yet"><h3>Not practised yet</h3>
        <p className="ip-hint">Nothing to show for these skills because no answer has covered them.</p>
        <ul className="ip-chips">{profile.notYet.map(row => <li key={row.id} title={row.hint}>{row.label}</li>)}</ul></section>}
      {profile.gaps.length > 0 && <section className="ip-group" aria-label="Skills you may want to strengthen"><h3>Skills you may want to strengthen</h3>
        <p className="ip-hint">These come up in your feedback. They are practice ideas, not proof that you lack a skill.</p>
        <ul>{profile.gaps.map(gap => <li key={gap.skillId}>{skillName(gap.skillId)}: suggested in {gap.count} {gap.count === 1 ? "answer" : "answers"}. {gap.reason}</li>)}</ul></section>}
    </>}
  </Card>;
}
